/**
 * Test end-to-end: charge un deck, calcule l'analyse + lance querySynergies.
 * Pas de HTTP — on appelle directement les fonctions de la pipeline.
 *
 * Usage: npx tsx --env-file=.env scripts/ai/test-synergies.ts <deckId>
 */
import prisma from '@/lib/prisma'
import { computeDeckAnalysis, persistDeckAnalysis } from '@/lib/ai/deck-analysis/analyze-deck'
import { extractDeckVectors, querySynergies } from '@/lib/ai/recommendations/synergies'
import type { DeterministicFilterContext } from '@/lib/ai/recommendations/filters'

async function main() {
  const deckId = process.argv[2]
  if (!deckId) {
    console.error('Usage: tsx test-synergies.ts <deckId>')
    process.exit(2)
  }

  console.log(`[test] analyzing deck ${deckId}...`)
  const t0 = Date.now()
  const analysis = await computeDeckAnalysis(deckId)
  if (!analysis) {
    console.error('[test] deck not found')
    process.exit(1)
  }
  await persistDeckAnalysis(analysis)
  console.log(
    `[test] cards=${analysis.cardsLoaded} embedded=${analysis.cardsWithEmbedding} archetype=${analysis.archetype.detected ?? '-'} (conf=${analysis.archetype.confidence.toFixed(2)}) avgCmc=${analysis.curve.averageCmc.toFixed(2)} took=${Date.now() - t0}ms`
  )

  // Build deck context for filters
  const deckMeta = await prisma.deck.findUnique({
    where: { id: deckId },
    include: {
      cards: {
        include: {
          card: { select: { id: true, oracleId: true, colorIdentity: true } },
        },
      },
    },
  })
  if (!deckMeta) throw new Error('deck disappeared')

  const commanderCards = deckMeta.cards.filter((c) => c.category === 'commander')
  const colorIdentity = [
    ...new Set(
      (commanderCards.length ? commanderCards : deckMeta.cards).flatMap(
        (c) => c.card.colorIdentity ?? []
      )
    ),
  ]
  console.log('[test] color identity:', colorIdentity)

  const filter: DeterministicFilterContext = {
    format: 'commander',
    colorIdentity,
    excludedCardIds: deckMeta.cards.map((c) => c.card.id),
    excludedOracleIds: [...new Set(deckMeta.cards.map((c) => c.card.oracleId))],
    ownedOnly: false,
    ownerId: deckMeta.ownerId,
  }

  console.log('[test] running querySynergies (limit=15)...')
  const t1 = Date.now()
  const results = await querySynergies({
    centroid: analysis.centroid,
    deckVectors: extractDeckVectors(analysis.cards),
    filter,
    limit: 15,
  })
  console.log(`[test] got ${results.length} candidates in ${Date.now() - t1}ms`)
  console.log()
  for (const r of results) {
    console.log(
      `  ${r.similarityHybrid.toFixed(3)}  ${r.name.padEnd(35)}  ${(r.typeLine ?? '').padEnd(40)}  role=${r.primaryRole ?? '-'}`
    )
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('[test] FAILED', err)
  process.exit(1)
})
