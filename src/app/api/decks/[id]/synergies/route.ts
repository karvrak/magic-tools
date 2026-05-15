import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getRequestUser, verifyOwnerAccess } from '@/lib/api-auth'
import { computeDeckAnalysis, persistDeckAnalysis } from '@/lib/ai/deck-analysis/analyze-deck'
import { extractDeckVectors, querySynergies } from '@/lib/ai/recommendations/synergies'
import type { DeterministicFilterContext } from '@/lib/ai/recommendations/filters'
import { isSupportedFormat, type SupportedFormat } from '@/lib/ai/types'

/**
 * GET /api/decks/[id]/synergies
 *
 * Recherche par synergie semantique (vector search hybride) sur le deck.
 * PAS de re-ranking LLM — rapide et bon marche.
 *
 * Query params:
 *   - limit (default 30, max 100)
 *   - owned_only (default false): filtrer sur la collection de l'owner du deck
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = new URL(request.url)
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? '30') || 30))
  const ownedOnly = url.searchParams.get('owned_only') === 'true'

  try {
    const { userId, role } = await getRequestUser()

    const deckForAuth = await prisma.deck.findUnique({
      where: { id },
      select: { id: true, ownerId: true, format: true },
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
          message: 'Seuls Vintage et Commander sont supportes pour les synergies.',
        },
        { status: 400 }
      )
    }
    const format = deckForAuth.format!.toLowerCase() as SupportedFormat

    // Analyse du deck
    const analysis = await computeDeckAnalysis(id)
    if (!analysis) {
      return NextResponse.json({ error: 'Deck analysis failed' }, { status: 500 })
    }
    await persistDeckAnalysis(analysis)

    if (analysis.cardsWithEmbedding === 0) {
      return NextResponse.json(
        {
          error: 'No embeddings available',
          message:
            "Aucune carte du deck n'a d'embedding. Lancez `npm run ai:embed` au prealable.",
        },
        { status: 503 }
      )
    }

    // Color identity du deck (commandant en EDH; vide en Vintage)
    const fullDeck = await prisma.deck.findUnique({
      where: { id },
      include: {
        cards: {
          include: {
            card: { select: { id: true, oracleId: true, colorIdentity: true } },
          },
        },
      },
    })
    if (!fullDeck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    let colorIdentity: string[] = []
    if (format === 'commander') {
      const commanderCards = fullDeck.cards.filter((c) => c.category === 'commander')
      const set = new Set<string>()
      const source = commanderCards.length > 0 ? commanderCards : fullDeck.cards
      for (const dc of source) for (const c of dc.card.colorIdentity ?? []) set.add(c)
      colorIdentity = [...set]
    }

    const filterCtx: DeterministicFilterContext = {
      format,
      colorIdentity,
      excludedCardIds: fullDeck.cards.map((c) => c.card.id),
      excludedOracleIds: [...new Set(fullDeck.cards.map((c) => c.card.oracleId))],
      ownedOnly,
      ownerId: fullDeck.ownerId,
    }

    const candidates = await querySynergies({
      centroid: analysis.centroid,
      deckVectors: extractDeckVectors(analysis.cards),
      filter: filterCtx,
      limit,
    })

    return NextResponse.json({
      deckId: id,
      format,
      detectedArchetype: analysis.archetype.detected,
      archetypeConfidence: analysis.archetype.confidence,
      ownedOnly,
      colorIdentity,
      count: candidates.length,
      candidates,
    })
  } catch (err) {
    console.error('[api/decks/synergies] error:', err)
    return NextResponse.json(
      { error: 'Internal server error', message: (err as Error).message },
      { status: 500 }
    )
  }
}
