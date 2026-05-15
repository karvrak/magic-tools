/**
 * CLI: Genere ou met a jour les embeddings de toutes les cartes.
 *
 * Usage:
 *   npm run ai:embed                   # tout
 *   npm run ai:embed -- --limit=500    # debug
 *   npm run ai:embed -- --dry-run      # simulation
 */
import { runEmbeddingsPipeline } from '@/lib/ai/embeddings/embed-cards'
import prisma from '@/lib/prisma'

function parseArgs() {
  const args = process.argv.slice(2)
  const out: { limit?: number; dryRun: boolean } = { dryRun: false }
  for (const a of args) {
    if (a === '--dry-run') out.dryRun = true
    else if (a.startsWith('--limit=')) out.limit = Number(a.split('=')[1])
  }
  return out
}

async function main() {
  const opts = parseArgs()
  console.log('[ai/embed] start', opts)
  const t0 = Date.now()

  const result = await runEmbeddingsPipeline({
    limit: opts.limit,
    dryRun: opts.dryRun,
    onProgress: (done, total) => {
      const pct = total ? ((done / total) * 100).toFixed(1) : '0'
      console.log(`[ai/embed] progress ${done}/${total} (${pct}%)`)
    },
  })

  const dt = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[ai/embed] done in ${dt}s`, result)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('[ai/embed] FAILED', err)
  process.exit(1)
})
