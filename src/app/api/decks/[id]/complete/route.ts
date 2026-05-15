import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getRequestUser, verifyOwnerAccess } from '@/lib/api-auth'
import {
  completeDeck,
  type CompleteDeckResult,
} from '@/lib/ai/recommendations/complete-deck'
import { isSupportedFormat } from '@/lib/ai/types'

/**
 * GET /api/decks/[id]/complete
 *
 * Pipeline complete: analyse -> gap detection -> recherche par role
 * -> rerank Sonnet 4.6 -> reponse groupee par role + scoring de chaque
 * carte du deck (best/worst).
 *
 * Cache: le resultat est persiste sur Deck.aiCompletion. Tant qu'il existe
 * et que force !== "true", on le renvoie directement (pas de nouvel appel LLM).
 *
 * Query params:
 *   - force (default false): bypass cache et re-execute le pipeline
 *   - per_role_limit (default 20, max 30)
 *   - max_candidates (default 100, max 150)
 *   - owned_only (default false)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = new URL(request.url)
  const force = url.searchParams.get('force') === 'true'
  const perRoleLimit = Math.max(
    1,
    Math.min(30, Number(url.searchParams.get('per_role_limit') ?? '20') || 20)
  )
  const maxCandidates = Math.max(
    10,
    Math.min(150, Number(url.searchParams.get('max_candidates') ?? '100') || 100)
  )
  const ownedOnly = url.searchParams.get('owned_only') === 'true'

  try {
    const { userId, role } = await getRequestUser()

    const deckForAuth = await prisma.deck.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        format: true,
        aiCompletion: true,
        aiCompletedAt: true,
      },
    })
    if (!deckForAuth) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }
    if (deckForAuth.ownerId) {
      const hasAccess = await verifyOwnerAccess(deckForAuth.ownerId, userId, role)
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!isSupportedFormat(deckForAuth.format)) {
      return NextResponse.json(
        {
          error: 'Format non supporte par la couche IA',
          message: 'Seuls Vintage et Commander sont supportes.',
        },
        { status: 400 }
      )
    }

    // Cache hit: renvoie le resultat persiste tel quel.
    if (!force && deckForAuth.aiCompletion) {
      const cached = deckForAuth.aiCompletion as unknown as CompleteDeckResult
      // Patch computedAt si absent (resultats anciens) avec aiCompletedAt DB.
      if (!cached.computedAt && deckForAuth.aiCompletedAt) {
        cached.computedAt = deckForAuth.aiCompletedAt.toISOString()
      }
      return NextResponse.json({ ...cached, cached: true })
    }

    const result = await completeDeck({
      deckId: id,
      perRoleLimit,
      maxCandidates,
      ownedOnly,
    })

    // Persist en base. JSON cast obligatoire pour Prisma.
    await prisma.deck.update({
      where: { id },
      data: {
        aiCompletion: result as unknown as Prisma.InputJsonValue,
        aiCompletedAt: new Date(),
      },
    })

    return NextResponse.json({ ...result, cached: false })
  } catch (err) {
    console.error('[api/decks/complete] error:', err)
    return NextResponse.json(
      { error: 'Internal server error', message: (err as Error).message },
      { status: 500 }
    )
  }
}
