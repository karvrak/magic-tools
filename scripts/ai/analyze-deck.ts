/**
 * CLI: calcule l'analyse IA d'un deck (centroide, archetype, distributions).
 *
 * Usage:
 *   npm run ai:analyze-deck -- --id=<deckId>
 *   npm run ai:analyze-deck -- --all                # tous les decks
 */
import {
  computeDeckAnalysis,
  persistDeckAnalysis,
} from '@/lib/ai/deck-analysis/analyze-deck'
import prisma from '@/lib/prisma'

function parseArgs() {
  const args = process.argv.slice(2)
  const out: { id?: string; all: boolean } = { all: false }
  for (const a of args) {
    if (a === '--all') out.all = true
    else if (a.startsWith('--id=')) out.id = a.split('=')[1]
  }
  return out
}

async function analyzeOne(id: string) {
  const t0 = Date.now()
  const a = await computeDeckAnalysis(id)
  if (!a) {
    console.warn(`[ai/analyze] deck not found: ${id}`)
    return
  }
  await persistDeckAnalysis(a)
  const dt = Date.now() - t0
  console.log(
    `[ai/analyze] ${id} cards=${a.cardsLoaded} embedded=${a.cardsWithEmbedding} archetype=${a.archetype.detected ?? '-'} (conf=${a.archetype.confidence.toFixed(2)}) avgCmc=${a.curve.averageCmc.toFixed(2)} took=${dt}ms`
  )
}

async function main() {
  const opts = parseArgs()
  if (!opts.id && !opts.all) {
    console.error('Usage: --id=<deckId> | --all')
    process.exit(2)
  }
  if (opts.id) {
    await analyzeOne(opts.id)
  } else {
    const decks = await prisma.deck.findMany({ select: { id: true } })
    console.log(`[ai/analyze] processing ${decks.length} decks`)
    for (const d of decks) {
      try {
        await analyzeOne(d.id)
      } catch (err) {
        console.error(`[ai/analyze] failed for ${d.id}:`, err)
      }
    }
  }
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('[ai/analyze] FAILED', err)
  process.exit(1)
})
