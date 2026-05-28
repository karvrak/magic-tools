import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
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
 * Cache: deux niveaux:
 *   - Pas de userPrompt/filtres custom → cache "par defaut" sur
 *     Deck.aiCompletion + Deck.aiCompletedAt.
 *   - Avec userPrompt et/ou filtres custom → cache "variante" sur
 *     Deck.aiCompletionVariants indexe par hash deterministe.
 *
 * Query params:
 *   - force (default false): bypass cache et re-execute le pipeline
 *   - per_role_limit (default 20, max 30)
 *   - max_candidates (default 100, max 150)
 *   - owned_only (default false)
 *   - user_prompt: texte libre (utilisateur veut "des kill", "plus de ramp"…)
 *   - rarities: CSV (common,uncommon,rare,mythic) — filtre SQL strict
 *   - price_max: number EUR (filtre SQL strict)
 */

interface VariantEntry {
  result: CompleteDeckResult
  computedAt: string
  inputs: {
    userPrompt: string | null
    rarities: string[] | null
    priceMaxEur: number | null
  }
}

type VariantsMap = Record<string, VariantEntry>

const VALID_RARITIES = new Set(['common', 'uncommon', 'rare', 'mythic'])
/** Cap pour eviter qu'un deck accumule trop de variantes (LRU manuel). */
const MAX_VARIANTS = 12

function parseRarities(raw: string | null): string[] | null {
  if (!raw) return null
  const list = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => VALID_RARITIES.has(s))
  return list.length > 0 ? list : null
}

function parsePriceMax(raw: string | null): number | null {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

function normalizeUserPrompt(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  // Cap a 800 caracteres: au-dela, l'utilisateur ecrit un roman et ca pollue
  // le contexte LLM. On tronque, c'est documente cote UI.
  return trimmed.length > 800 ? trimmed.slice(0, 800) : trimmed
}

/**
 * Hash deterministe des inputs qui modifient le resultat. Une variante = un
 * hash. Sans prompt ni filtres → null (utilisera le cache par defaut).
 */
function computeVariantHash(inputs: {
  userPrompt: string | null
  rarities: string[] | null
  priceMaxEur: number | null
  ownedOnly: boolean
}): string | null {
  if (
    !inputs.userPrompt &&
    !inputs.rarities &&
    inputs.priceMaxEur == null &&
    !inputs.ownedOnly
  ) {
    return null
  }
  const normalized = {
    userPrompt: inputs.userPrompt ?? null,
    // Tri pour que ['rare','common'] == ['common','rare'].
    rarities: inputs.rarities ? [...inputs.rarities].sort() : null,
    priceMaxEur: inputs.priceMaxEur ?? null,
    ownedOnly: inputs.ownedOnly,
  }
  return createHash('sha1').update(JSON.stringify(normalized)).digest('hex').slice(0, 16)
}

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
  const userPrompt = normalizeUserPrompt(url.searchParams.get('user_prompt'))
  const rarities = parseRarities(url.searchParams.get('rarities'))
  const priceMaxEur = parsePriceMax(url.searchParams.get('price_max'))

  const variantHash = computeVariantHash({
    userPrompt,
    rarities,
    priceMaxEur,
    ownedOnly,
  })

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
        aiCompletionVariants: true,
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

    // Cache hit: deux pistes selon qu'on est en mode "par defaut" ou "variante".
    if (!force) {
      if (variantHash === null && deckForAuth.aiCompletion) {
        const cached = deckForAuth.aiCompletion as unknown as CompleteDeckResult
        if (!cached.computedAt && deckForAuth.aiCompletedAt) {
          cached.computedAt = deckForAuth.aiCompletedAt.toISOString()
        }
        return NextResponse.json({ ...cached, cached: true })
      }
      if (variantHash !== null) {
        const variants =
          (deckForAuth.aiCompletionVariants as unknown as VariantsMap | null) ??
          {}
        const entry = variants[variantHash]
        if (entry) {
          return NextResponse.json({ ...entry.result, cached: true })
        }
      }
    }

    const result = await completeDeck({
      deckId: id,
      perRoleLimit,
      maxCandidates,
      ownedOnly,
      userPrompt,
      rarities,
      priceMaxEur,
    })

    // Persistance: variante → aiCompletionVariants; defaut → aiCompletion.
    if (variantHash === null) {
      await prisma.deck.update({
        where: { id },
        data: {
          aiCompletion: result as unknown as Prisma.InputJsonValue,
          aiCompletedAt: new Date(),
        },
      })
    } else {
      const existing =
        (deckForAuth.aiCompletionVariants as unknown as VariantsMap | null) ?? {}
      const next: VariantsMap = { ...existing }
      next[variantHash] = {
        result,
        computedAt: new Date().toISOString(),
        inputs: { userPrompt, rarities, priceMaxEur },
      }
      // LRU manuel: si on depasse MAX_VARIANTS, evicte le plus ancien.
      const keys = Object.keys(next)
      if (keys.length > MAX_VARIANTS) {
        const sorted = keys
          .map((k) => ({ k, t: next[k].computedAt }))
          .sort((a, b) => a.t.localeCompare(b.t))
        const toEvict = sorted.slice(0, keys.length - MAX_VARIANTS).map((e) => e.k)
        for (const k of toEvict) delete next[k]
      }
      await prisma.deck.update({
        where: { id },
        data: {
          aiCompletionVariants: next as unknown as Prisma.InputJsonValue,
        },
      })
    }

    return NextResponse.json({ ...result, cached: false })
  } catch (err) {
    console.error('[api/decks/complete] error:', err)
    return NextResponse.json(
      { error: 'Internal server error', message: (err as Error).message },
      { status: 500 }
    )
  }
}
