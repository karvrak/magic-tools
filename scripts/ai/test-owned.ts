/**
 * Test du filtre owned_only sur un deck.
 */
import prisma from '@/lib/prisma'
import { computeDeckAnalysis } from '@/lib/ai/deck-analysis/analyze-deck'
import {
  extractDeckVectors,
  querySynergies,
} from '@/lib/ai/recommendations/synergies'
import type { DeterministicFilterContext } from '@/lib/ai/recommendations/filters'

async function main() {
  const deckId = process.argv[2] ?? 'cmlm9fhm200986rsqfc7nbvme'
  const a = await computeDeckAnalysis(deckId)
  if (!a) {
    console.error('deck not found')
    process.exit(1)
  }
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
  if (!d) throw new Error('deck disappeared')
  const cmdrs = d.cards.filter((c) => c.category === 'commander')
  const ci = [
    ...new Set(
      (cmdrs.length ? cmdrs : d.cards).flatMap((c) => c.card.colorIdentity ?? [])
    ),
  ]
  const baseFilter: Omit<DeterministicFilterContext, 'ownedOnly'> = {
    format: 'commander',
    colorIdentity: ci,
    excludedCardIds: d.cards.map((c) => c.card.id),
    excludedOracleIds: [...new Set(d.cards.map((c) => c.card.oracleId))],
    ownerId: d.ownerId,
  }

  console.log('--- owned_only=false ---')
  const all = await querySynergies({
    centroid: a.centroid,
    deckVectors: extractDeckVectors(a.cards),
    filter: { ...baseFilter, ownedOnly: false },
    limit: 5,
  })
  for (const r of all) console.log(`  ${r.similarityHybrid.toFixed(3)}  ${r.name}`)

  console.log('--- owned_only=true ---')
  const t0 = Date.now()
  const owned = await querySynergies({
    centroid: a.centroid,
    deckVectors: extractDeckVectors(a.cards),
    filter: { ...baseFilter, ownedOnly: true },
    limit: 5,
  })
  console.log(`  (took ${Date.now() - t0}ms)`)
  for (const r of owned) console.log(`  ${r.similarityHybrid.toFixed(3)}  ${r.name}`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
