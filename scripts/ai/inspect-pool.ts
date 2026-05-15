/**
 * Inspecte le pool de candidats genere par la couche retrieval (avant rerank LLM).
 * Permet de diagnostiquer si une carte attendue est dans le pool ou pas.
 */
import prisma from '@/lib/prisma'
import { computeDeckAnalysis } from '@/lib/ai/deck-analysis/analyze-deck'
import {
  extractDeckVectors,
  querySynergies,
} from '@/lib/ai/recommendations/synergies'
import { detectDeckMechanics } from '@/lib/ai/recommendations/mechanic-detection'
import type { DeterministicFilterContext } from '@/lib/ai/recommendations/filters'

async function main() {
  const deckId = process.argv[2]
  const checkCards = process.argv.slice(3) // ex: 'Library of Leng' 'Thought Vessel'
  if (!deckId) {
    console.error('Usage: tsx inspect-pool.ts <deckId> [card_name_to_check ...]')
    process.exit(2)
  }

  const a = await computeDeckAnalysis(deckId)
  if (!a) throw new Error('deck not found')
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
  const filter: DeterministicFilterContext = {
    format: d.format!.toLowerCase() as 'commander' | 'vintage',
    colorIdentity: ci,
    excludedCardIds: d.cards.map((c) => c.card.id),
    excludedOracleIds: [...new Set(d.cards.map((c) => c.card.oracleId))],
    ownedOnly: false,
    ownerId: d.ownerId,
  }

  // Themes detected
  const themes = detectDeckMechanics(
    a.cards.map((c) => ({ oracleText: c.oracleText, quantity: c.quantity }))
  )
  console.log('=== MECHANICAL THEMES DETECTED ===')
  for (const t of themes) console.log(`  ${t.label} (count=${t.count})`)

  // Pool global
  const deckVectors = extractDeckVectors(a.cards)
  const global = await querySynergies({
    centroid: a.centroid,
    deckVectors,
    filter,
    limit: 30,
  })
  console.log('\n=== TOP 30 GLOBAL CANDIDATES (vector hybrid) ===')
  for (const c of global.slice(0, 30)) {
    console.log(`  ${c.similarityHybrid.toFixed(3)}  ${c.name}`)
  }

  // Pool par mecanique
  for (const t of themes) {
    const cands = await querySynergies({
      centroid: a.centroid,
      deckVectors,
      filter,
      oracleTextLike: t.searchPattern,
      limit: 6,
    })
    console.log(`\n=== TOP MECANIQUE [${t.keyword}] (${cands.length}) ===`)
    for (const c of cands)
      console.log(`  ${c.similarityHybrid.toFixed(3)}  ${c.name}`)
  }

  // Verification de cartes specifiques
  if (checkCards.length > 0) {
    console.log('\n=== CHECK SPECIFIC CARDS ===')
    for (const cardName of checkCards) {
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: string
          oracleId: string
          name: string
          oracleText: string | null
          colorIdentity: string[]
          legalities: Record<string, string>
          hasEmbedding: boolean
        }>
      >(
        `SELECT id, "oracleId", name, "oracleText", "colorIdentity", legalities, ("embedding" IS NOT NULL) AS "hasEmbedding"
         FROM "Card" WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        cardName
      )
      const card = rows[0]
      if (!card) {
        console.log(`  ❌ ${cardName}: NOT IN DB`)
        continue
      }
      const ciOk =
        ci.length === 0 ||
        (card.colorIdentity ?? []).every((c) => ci.includes(c))
      const legalities = card.legalities
      const legal =
        d.format!.toLowerCase() === 'vintage'
          ? ['legal', 'restricted'].includes(legalities?.vintage)
          : ['legal', 'restricted'].includes(legalities?.commander)
      console.log(
        `  ${card.name}: in DB=YES, color OK=${ciOk}, legal=${legal}, embedded=${card.hasEmbedding ? 'YES' : 'NO'}`
      )
      console.log(`    oracle: ${(card.oracleText ?? '').slice(0, 200)}`)
    }
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
