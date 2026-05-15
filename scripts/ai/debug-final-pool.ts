/**
 * Affiche le pool FINAL apres scoring multi-pool, juste avant l'appel LLM.
 * Permet de verifier si Purphoros / autres signature cards sont inclus.
 */
import prisma from '@/lib/prisma'
import { computeDeckAnalysis } from '@/lib/ai/deck-analysis/analyze-deck'
import {
  extractDeckVectors,
  querySynergies,
  type SynergyCandidate,
} from '@/lib/ai/recommendations/synergies'
import { detectDeckMechanics } from '@/lib/ai/recommendations/mechanic-detection'
import { detectRoleGaps } from '@/lib/ai/recommendations/gap-detection'
import {
  analyzeSynergyChains,
  curveFitMultiplier,
  SYNERGY_CHAINS,
} from '@/lib/ai/recommendations/synergy-graph'
import { Prisma } from '@prisma/client'
import { buildDeterministicWhere } from '@/lib/ai/recommendations/filters'
import { toVectorLiteral } from '@/lib/ai/embeddings/embed-cards'
import type { DeterministicFilterContext } from '@/lib/ai/recommendations/filters'

async function main() {
  const deckId = process.argv[2]
  if (!deckId) {
    console.error('Usage: tsx debug-final-pool.ts <deckId>')
    process.exit(2)
  }
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
  const themes = detectDeckMechanics(
    a.cards.map((c) => ({ oracleText: c.oracleText, quantity: c.quantity }))
  )
  const dominantTags = a.archetype.topTags
    .filter((t) => t.weight >= 2)
    .slice(0, 4)
    .map((t) => t.tag)
  const deckVectors = extractDeckVectors(a.cards)

  // Tags pool — alpha=1.0 (cf. complete-deck.ts)
  const tagsPool: SynergyCandidate[] = dominantTags.length
    ? await querySynergies({
        centroid: a.centroid,
        deckVectors,
        filter,
        archetypeTagsAny: dominantTags,
        alphaOverride: 1.0,
        limit: 20,
      })
    : []

  // Mechanic pools — alpha=1.0 (cf. complete-deck.ts)
  const mechPools: Record<string, SynergyCandidate[]> = {}
  for (const t of themes) {
    mechPools[t.keyword] = await querySynergies({
      centroid: a.centroid,
      deckVectors,
      filter,
      oracleTextLike: t.searchPattern,
      alphaOverride: 1.0,
      limit: 15,
    })
  }

  // Role pools
  const gaps = detectRoleGaps({
    format: filter.format,
    archetype: a.archetype.detected,
    roleDistribution: a.roles,
  }).filter((g) => g.severity === 'critical' || g.severity === 'low')
  const rolePools: Record<string, SynergyCandidate[]> = {}
  for (const g of gaps) {
    rolePools[g.role] = await querySynergies({
      centroid: a.centroid,
      deckVectors,
      filter,
      primaryRoles: [g.role],
      limit: 8,
    })
  }

  // Global
  const global = await querySynergies({
    centroid: a.centroid,
    deckVectors,
    filter,
    limit: 10,
  })

  // Aggregate pool entries with multi-pool tracking
  const POOL_BOOST = 0.04
  type Entry = { card: SynergyCandidate; pools: Set<string>; baseSim: number }
  const entries = new Map<string, Entry>()
  const ingest = (cards: SynergyCandidate[], poolKey: string) => {
    for (const c of cards) {
      const e = entries.get(c.cardId)
      if (e) e.pools.add(poolKey)
      else
        entries.set(c.cardId, {
          card: c,
          pools: new Set([poolKey]),
          baseSim: c.similarityHybrid,
        })
    }
  }
  ingest(tagsPool, 'tags')
  for (const [k, list] of Object.entries(mechPools)) ingest(list, `mech:${k}`)
  for (const [k, list] of Object.entries(rolePools)) ingest(list, `role:${k}`)
  ingest(global, 'global')

  const ranked = [...entries.values()]
    .map((e) => ({
      name: e.card.name,
      pools: [...e.pools],
      baseSim: e.baseSim,
      finalScore: e.baseSim + POOL_BOOST * (e.pools.size - 1),
    }))
    .sort((a, b) => b.finalScore - a.finalScore)

  console.log(
    `\n=== TOTAL UNIQUE CANDIDATES POOLED: ${ranked.length} ===`
  )
  console.log(`themes detected: ${themes.map((t) => t.keyword).join(', ')}`)
  console.log(`dominant tags: ${dominantTags.join(', ')}`)
  console.log(`role gaps: ${gaps.map((g) => `${g.role}(${g.severity})`).join(', ')}`)
  console.log()

  console.log('=== TOP 30 BY FINAL SCORE ===')
  console.log(
    'name'.padEnd(35) +
      ' | ' +
      'baseSim'.padEnd(8) +
      ' | ' +
      'pools'.padEnd(4) +
      ' | ' +
      'final'.padEnd(8) +
      ' | pool keys'
  )
  console.log('-'.repeat(120))
  for (const r of ranked.slice(0, 30)) {
    console.log(
      r.name.padEnd(35) +
        ' | ' +
        r.baseSim.toFixed(3).padEnd(8) +
        ' | ' +
        String(r.pools.length).padEnd(4) +
        ' | ' +
        r.finalScore.toFixed(3).padEnd(8) +
        ' | ' +
        r.pools.join(',')
    )
  }

  // Search Purphoros
  const purph = ranked.find((r) => r.name === 'Purphoros, God of the Forge')
  console.log(
    `\n=== Purphoros: ${
      purph
        ? `rank ${ranked.indexOf(purph) + 1} / ${ranked.length}, score ${purph.finalScore.toFixed(3)}, pools: ${purph.pools.join(', ')}`
        : 'NOT IN POOL'
    } ===`
  )

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
