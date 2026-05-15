/**
 * Calcule la similarite d'une carte avec le centroide d'un deck + son rang
 * dans le top global filtre.
 */
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { computeDeckAnalysis } from '@/lib/ai/deck-analysis/analyze-deck'
import { toVectorLiteral } from '@/lib/ai/embeddings/embed-cards'
import { buildDeterministicWhere } from '@/lib/ai/recommendations/filters'
import { extractDeckVectors } from '@/lib/ai/recommendations/synergies'

async function main() {
  const deckId = process.argv[2]
  const cardName = process.argv[3]
  if (!deckId || !cardName) {
    console.error('Usage: tsx inspect-card-rank.ts <deckId> <cardName>')
    process.exit(2)
  }

  const a = await computeDeckAnalysis(deckId)
  if (!a || !a.centroid) throw new Error('no centroid')
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
  const cmdrs = d.cards.filter((c) => c.category === 'commander')
  const ci = [
    ...new Set(
      (cmdrs.length ? cmdrs : d.cards).flatMap((c) => c.card.colorIdentity ?? [])
    ),
  ]
  const filter = {
    format: d.format!.toLowerCase() as 'commander' | 'vintage',
    colorIdentity: ci,
    excludedCardIds: d.cards.map((c) => c.card.id),
    excludedOracleIds: [...new Set(d.cards.map((c) => c.card.oracleId))],
    ownedOnly: false,
    ownerId: d.ownerId,
  }
  const where = buildDeterministicWhere(filter)
  const centroidLit = toVectorLiteral(a.centroid)

  // 1. Similarity of the target card with centroid
  const target = await prisma.$queryRaw<
    Array<{
      id: string
      name: string
      colorIdentity: string[]
      legalities: Record<string, string>
      hasEmb: boolean
      simC: number | null
    }>
  >(Prisma.sql`
    SELECT
      c.id,
      c.name,
      c."colorIdentity",
      c.legalities,
      (c."embedding" IS NOT NULL) AS "hasEmb",
      CASE WHEN c."embedding" IS NULL THEN NULL
        ELSE (1 - (c."embedding" <=> ${centroidLit}::vector(1536)))::float8
      END AS "simC"
    FROM "Card" c
    WHERE LOWER(c.name) LIKE LOWER(${cardName + '%'})
    ORDER BY c."releasedAt" ASC NULLS LAST
    LIMIT 5
  `)
  console.log(`Found ${target.length} matching prints for "${cardName}":`)
  for (const t of target) {
    console.log(
      `  ${t.name} | hasEmb=${t.hasEmb} | simC=${t.simC?.toFixed(3) ?? '-'} | colorOK=${t.colorIdentity.every((c) => ci.length === 0 || ci.includes(c))} | legal=${
        filter.format === 'vintage'
          ? ['legal', 'restricted'].includes(t.legalities?.vintage)
          : ['legal', 'restricted'].includes(t.legalities?.commander)
      }`
    )
  }
  if (target.length === 0) {
    console.log('  ❌ NOT IN DB')
    return
  }

  // 2. Rank in the deterministic-filtered pool sorted by sim_centroid
  // (count how many cards have higher sim AND pass the deterministic filters)
  const targetCard = target[0]
  if (!targetCard.simC) {
    console.log('  not embedded, skipping rank')
    return
  }
  const rankRow = await prisma.$queryRaw<Array<{ rank: bigint }>>(Prisma.sql`
    WITH oracle_reps AS (
      SELECT DISTINCT ON (c."oracleId")
        c.id, c."oracleId", c.name, c."embedding"
      FROM "Card" c
      WHERE ${where}
      ORDER BY c."oracleId", c."releasedAt" ASC NULLS LAST, c.id ASC
    )
    SELECT COUNT(*)::bigint AS rank
    FROM oracle_reps r
    WHERE (1 - (r."embedding" <=> ${centroidLit}::vector(1536))) > ${targetCard.simC}
  `)
  const rank = Number(rankRow[0]?.rank ?? 0n)
  console.log(`\n  Rank in deterministic pool by sim_centroid: ${rank + 1} (i.e. ${rank} cards score HIGHER)`)

  // 3. Show top 5 cards that beat it
  const topBeats = await prisma.$queryRaw<
    Array<{ name: string; sim: number }>
  >(Prisma.sql`
    WITH oracle_reps AS (
      SELECT DISTINCT ON (c."oracleId")
        c.id, c."oracleId", c.name, c."embedding"
      FROM "Card" c
      WHERE ${where}
      ORDER BY c."oracleId", c."releasedAt" ASC NULLS LAST, c.id ASC
    )
    SELECT r.name,
      (1 - (r."embedding" <=> ${centroidLit}::vector(1536)))::float8 AS sim
    FROM oracle_reps r
    WHERE (1 - (r."embedding" <=> ${centroidLit}::vector(1536))) > ${targetCard.simC}
    ORDER BY sim DESC
    LIMIT 10
  `)
  console.log(`\n  Top 10 cards that score higher than ${targetCard.name}:`)
  for (const c of topBeats) console.log(`    ${c.sim.toFixed(3)}  ${c.name}`)

  // 4. Compute max-similarity-to-deck for the target
  const deckVectors = extractDeckVectors(a.cards)
  let maxSim = 0
  let bestMatch = ''
  // Need to fetch the actual embedding of the target — easier: compute max in SQL
  const maxRow = await prisma.$queryRaw<
    Array<{ name: string; sim: number }>
  >(Prisma.sql`
    SELECT
      ${targetCard.name} AS name,
      MAX(1 - (target."embedding" <=> dv.embedding))::float8 AS sim
    FROM "Card" target
    CROSS JOIN unnest(ARRAY[${Prisma.join(
      deckVectors.slice(0, 50).map((v) => Prisma.sql`${toVectorLiteral(v)}`),
      ','
    )}]::text[]) AS dv_str
    CROSS JOIN LATERAL (SELECT dv_str::vector(1536) AS embedding) dv
    WHERE target.id = ${targetCard.id}
    GROUP BY target.id
  `)
  if (maxRow[0]) {
    console.log(`\n  Max similarity to ANY deck card: ${maxRow[0].sim.toFixed(3)}`)
    // What is the closest deck card?
    const closest = await prisma.$queryRaw<
      Array<{ deckName: string; sim: number }>
    >(Prisma.sql`
      WITH deck_cards AS (
        SELECT c.name, c."embedding"
        FROM "DeckCard" dc
        JOIN "Card" c ON c.id = dc."cardId"
        WHERE dc."deckId" = ${deckId}
          AND c."embedding" IS NOT NULL
      )
      SELECT dc.name AS "deckName",
        (1 - (target."embedding" <=> dc."embedding"))::float8 AS sim
      FROM "Card" target, deck_cards dc
      WHERE target.id = ${targetCard.id}
      ORDER BY sim DESC
      LIMIT 5
    `)
    console.log('\n  Top 5 closest deck cards to target:')
    for (const c of closest) console.log(`    ${c.sim.toFixed(3)}  ${c.deckName}`)
  }
  void maxSim
  void bestMatch

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
