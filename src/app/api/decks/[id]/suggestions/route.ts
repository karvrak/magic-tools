import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getRequestUser, verifyOwnerAccess } from '@/lib/api-auth'
import { completeDeck } from '@/lib/ai/recommendations/complete-deck'
import { isSupportedFormat } from '@/lib/ai/types'

/**
 * GET /api/decks/[id]/suggestions
 *
 * Endpoint legacy. Reecrit pour utiliser la nouvelle pipeline IA (couche 4):
 *   filtres deterministes -> embeddings -> classification -> rerank Sonnet 4.6
 *
 * Le contrat de reponse est conserve pour ne pas casser le frontend existant:
 *   { suggestions: [...], analysis: { archetype, synergies, deckColors } }
 *
 * Pour les nouveaux clients, preferer:
 *   - GET /api/decks/[id]/synergies   (rapide, sans LLM)
 *   - GET /api/decks/[id]/complete    (pipeline complet, reponse groupee par role)
 */

interface LegacyResponse {
  suggestions: Array<{
    id: string
    oracleId: string
    name: string
    typeLine: string
    manaCost: string | null
    colorIdentity: string[]
    rarity: string
    setCode: string
    imageSmall: string | null
    imageNormal: string | null
    priceEur: number | null
    priceUsd: number | null
    score: number
    reasons: string[]
  }>
  analysis: {
    archetype: string
    synergies: string[]
    deckColors: string[]
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
      // Comportement legacy: pas d'erreur dure, on renvoie un payload vide.
      const empty: LegacyResponse = {
        suggestions: [],
        analysis: { archetype: '', synergies: [], deckColors: [] },
      }
      return NextResponse.json(empty)
    }

    // Lance la pipeline complete (rerank inclus).
    const result = await completeDeck({
      deckId: id,
      perRoleLimit: 4,
      maxCandidates: 30,
      ownedOnly: false,
    })

    // Aggregate les suggestions de tous les groupes + miscSuggestions
    const all = [
      ...result.groups.flatMap((g) => g.suggestions),
      ...result.miscSuggestions,
    ]

    // Recuperer les champs manquants (rarity, setCode, colorIdentity, priceUsd)
    // par requete batch sur cardId — la pipeline ne les charge pas tous.
    const cardIds = all.map((s) => s.cardId)
    const cards = cardIds.length
      ? await prisma.card.findMany({
          where: { id: { in: cardIds } },
          select: {
            id: true,
            oracleId: true,
            name: true,
            typeLine: true,
            manaCost: true,
            colorIdentity: true,
            rarity: true,
            setCode: true,
            imageSmall: true,
            imageNormal: true,
            priceEur: true,
            priceUsd: true,
          },
        })
      : []
    const cardMap = new Map(cards.map((c) => [c.id, c]))

    // Conserver l'ordre du score (rerank deja trie par groupe), dedup par oracleId
    const seenOracle = new Set<string>()
    const suggestions: LegacyResponse['suggestions'] = []
    for (const s of all) {
      const c = cardMap.get(s.cardId)
      if (!c) continue
      if (seenOracle.has(c.oracleId)) continue
      seenOracle.add(c.oracleId)
      suggestions.push({
        id: c.id,
        oracleId: c.oracleId,
        name: c.name,
        typeLine: c.typeLine,
        manaCost: c.manaCost,
        colorIdentity: c.colorIdentity,
        rarity: c.rarity,
        setCode: c.setCode,
        imageSmall: c.imageSmall,
        imageNormal: c.imageNormal,
        priceEur: c.priceEur,
        priceUsd: c.priceUsd,
        score: Math.round((s.score ?? 0) * 100),
        reasons: [s.explanation],
      })
    }

    // Build "synergies" sommaire pour la backward-compat
    const synergies = result.groups
      .filter((g) => g.suggestions.length > 0)
      .map((g) => `${g.role} (${g.current}/${g.target.ideal})`)

    // Deck colors: union color identity du deck (recuperee via la pipeline)
    const fullDeck = await prisma.deck.findUnique({
      where: { id },
      include: {
        cards: { include: { card: { select: { colorIdentity: true } } } },
      },
    })
    const deckColors = [
      ...new Set((fullDeck?.cards ?? []).flatMap((dc) => dc.card.colorIdentity ?? [])),
    ]

    const response: LegacyResponse = {
      suggestions,
      analysis: {
        archetype: result.detectedArchetype ?? '',
        synergies,
        deckColors,
      },
    }
    return NextResponse.json(response)
  } catch (err) {
    console.error('[api/decks/suggestions] error:', err)
    // Comportement legacy: ne pas casser l'UI sur erreur
    return NextResponse.json({
      suggestions: [],
      analysis: { archetype: '', synergies: [], deckColors: [] },
      error: 'Failed to get suggestions',
    })
  }
}
