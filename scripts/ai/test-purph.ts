import prisma from '@/lib/prisma'
import { computeDeckAnalysis } from '@/lib/ai/deck-analysis/analyze-deck'
import {
  extractDeckVectors,
  querySynergies,
} from '@/lib/ai/recommendations/synergies'
import type { DeterministicFilterContext } from '@/lib/ai/recommendations/filters'

async function main() {
  const deckId = 'cmk6zngtj02snlkimjqwcqir1'
  const a = await computeDeckAnalysis(deckId)
  if (!a) throw new Error('no analysis')
  const d = await prisma.deck.findUnique({
    where: { id: deckId },
    include: {
      cards: {
        include: {
          card: { select: { id: true, oracleId: true, colorIdentity: true } },
        },
      },
    },
  })
  if (!d) throw new Error('no deck')
  const filter: DeterministicFilterContext = {
    format: 'vintage',
    colorIdentity: [],
    excludedCardIds: d.cards.map((c) => c.card.id),
    excludedOracleIds: [...new Set(d.cards.map((c) => c.card.oracleId))],
    ownedOnly: false,
    ownerId: d.ownerId,
  }
  const dv = extractDeckVectors(a.cards)

  for (const alpha of [0.6, 1.0]) {
    console.log(`\nALPHA=${alpha}:`)
    for (const limit of [10, 15, 20, 30]) {
      const res = await querySynergies({
        centroid: a.centroid,
        deckVectors: dv,
        filter,
        oracleTextLike: '%creature%enters%deals%damage%',
        alphaOverride: alpha,
        limit,
      })
      const found = res.find((c) => c.name === 'Purphoros, God of the Forge')
      console.log(
        `  limit=${limit}: ${res.length} cards, Purphoros ${found ? `FOUND at rank ${res.indexOf(found) + 1} (score=${found.similarityHybrid.toFixed(3)})` : 'NOT FOUND'}`
      )
    }
  }
  await prisma.$disconnect()
}
main().catch(console.error)
