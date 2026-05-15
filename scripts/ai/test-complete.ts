/**
 * Test end-to-end: pipeline complete (analyse + gap detection + rerank Sonnet).
 *
 * Usage: npx tsx --env-file=.env scripts/ai/test-complete.ts <deckId>
 */
import prisma from '@/lib/prisma'
import { completeDeck } from '@/lib/ai/recommendations/complete-deck'

async function main() {
  const deckId = process.argv[2] ?? 'cmlm9fhm200986rsqfc7nbvme'
  console.log(`[test-complete] running pipeline for deck ${deckId}`)
  const t0 = Date.now()
  const r = await completeDeck({
    deckId,
    perRoleLimit: 4,
    maxCandidates: 20,
    ownedOnly: false,
  })
  const dt = Date.now() - t0
  console.log(`[test-complete] done in ${(dt / 1000).toFixed(1)}s`)
  console.log()
  console.log(`Format: ${r.format}`)
  console.log(`Archetype: ${r.detectedArchetype ?? '(none)'} (conf=${r.archetypeConfidence.toFixed(2)})`)
  if (r.archetypeNote) console.log(`Note: ${r.archetypeNote}`)
  console.log()
  for (const g of r.groups) {
    console.log(
      `=== ${g.role.toUpperCase()} (${g.severity}, current=${g.current}, target ideal=${g.target.ideal}) — ${g.suggestions.length} suggestions ===`
    )
    for (const s of g.suggestions) {
      console.log(`  ${s.score.toFixed(2)}  ${s.name.padEnd(30)}  ${s.explanation.slice(0, 120)}`)
    }
  }
  if (r.miscSuggestions.length) {
    console.log(`=== MISC — ${r.miscSuggestions.length} suggestions ===`)
    for (const s of r.miscSuggestions) {
      console.log(`  ${s.score.toFixed(2)}  ${s.name.padEnd(30)}  ${s.explanation.slice(0, 120)}`)
    }
  }
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('[test-complete] FAILED', err)
  process.exit(1)
})
