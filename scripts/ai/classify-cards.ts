/**
 * CLI: classifie toutes les cartes (primary_role, archetype_tags, etc.)
 * via gpt-4o-mini en mode synchrone. Idempotent: skip les cartes deja
 * classifiees a la version courante.
 *
 * Usage:
 *   npm run ai:classify -- --limit=200       # debug
 *   npm run ai:classify -- --dry-run         # simulation
 *   npm run ai:classify                      # full run
 */
import { runClassificationPipeline } from '@/lib/ai/classification/classify-cards'
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
  console.log('[ai/classify] start', opts)
  const t0 = Date.now()
  const result = await runClassificationPipeline({
    limit: opts.limit,
    dryRun: opts.dryRun,
    onProgress: (done, total) => {
      const pct = total ? ((done / total) * 100).toFixed(1) : '0'
      console.log(`[ai/classify] progress ${done}/${total} (${pct}%)`)
    },
  })
  const dt = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[ai/classify] done in ${dt}s`, result)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('[ai/classify] FAILED', err)
  process.exit(1)
})
