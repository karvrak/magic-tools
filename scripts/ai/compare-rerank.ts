/**
 * Compare rerank Sonnet vs Gemini sur le meme deck.
 * Lance completeDeck deux fois — le pool de candidats est deterministe (SQL),
 * seules les sorties LLM different.
 */
import prisma from '@/lib/prisma'
import { completeDeck } from '@/lib/ai/recommendations/complete-deck'

const MODELS = {
  sonnet: 'anthropic/claude-sonnet-4.6',
  gemini: 'google/gemini-3.1-pro-preview',
}

async function main() {
  const deckId = process.argv[2]
  if (!deckId) {
    console.error('Usage: tsx compare-rerank.ts <deckId>')
    process.exit(2)
  }

  const t0 = Date.now()
  const [sonnet, gemini] = await Promise.all([
    completeDeck({
      deckId,
      perRoleLimit: 4,
      maxCandidates: 25,
      ownedOnly: false,
      rerankModel: MODELS.sonnet,
    }),
    completeDeck({
      deckId,
      perRoleLimit: 4,
      maxCandidates: 25,
      ownedOnly: false,
      rerankModel: MODELS.gemini,
    }),
  ])
  console.log(`[compare] both reranks done in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`)

  // Format archetype + note
  console.log('━━━━━━━━━━━━━━━ ARCHETYPE NOTE ━━━━━━━━━━━━━━━')
  console.log(`SONNET: ${sonnet.archetypeNote ?? '(none)'}`)
  console.log()
  console.log(`GEMINI: ${gemini.archetypeNote ?? '(none)'}`)
  console.log()

  // Compare top-level: build ordered list of (cardName, sonnetScore, geminiScore, sonnetExpl, geminiExpl)
  const sonnetMap = new Map<
    string,
    { score: number; expl: string; role: string }
  >()
  for (const g of sonnet.groups) {
    for (const s of g.suggestions) {
      sonnetMap.set(s.name, {
        score: s.score,
        expl: s.explanation,
        role: g.role,
      })
    }
  }
  for (const s of sonnet.miscSuggestions) {
    sonnetMap.set(s.name, {
      score: s.score,
      expl: s.explanation,
      role: 'misc',
    })
  }
  const geminiMap = new Map<
    string,
    { score: number; expl: string; role: string }
  >()
  for (const g of gemini.groups) {
    for (const s of g.suggestions) {
      geminiMap.set(s.name, {
        score: s.score,
        expl: s.explanation,
        role: g.role,
      })
    }
  }
  for (const s of gemini.miscSuggestions) {
    geminiMap.set(s.name, {
      score: s.score,
      expl: s.explanation,
      role: 'misc',
    })
  }

  const allNames = new Set<string>([...sonnetMap.keys(), ...geminiMap.keys()])
  const rows = [...allNames].map((name) => {
    const s = sonnetMap.get(name)
    const g = geminiMap.get(name)
    const sScore = s?.score ?? null
    const gScore = g?.score ?? null
    const avg =
      sScore !== null && gScore !== null
        ? (sScore + gScore) / 2
        : sScore ?? gScore ?? 0
    return { name, s, g, avg }
  })
  rows.sort((a, b) => b.avg - a.avg)

  console.log('━━━━━━━━━━━━ COMPARISON (top→bottom by avg score) ━━━━━━━━━━━━')
  console.log(
    'card name'.padEnd(35) +
      ' | ' +
      'SONNET'.padEnd(35) +
      ' | ' +
      'GEMINI'.padEnd(35)
  )
  console.log('-'.repeat(115))
  for (const row of rows) {
    const sStr = row.s
      ? `${row.s.score.toFixed(2)} [${row.s.role.slice(0, 8)}]`
      : '—'
    const gStr = row.g
      ? `${row.g.score.toFixed(2)} [${row.g.role.slice(0, 8)}]`
      : '—'
    console.log(
      row.name.padEnd(35) +
        ' | ' +
        sStr.padEnd(35) +
        ' | ' +
        gStr.padEnd(35)
    )
  }

  console.log('\n━━━━━━━━━━━━ EXPLANATIONS DIFF ━━━━━━━━━━━━')
  for (const row of rows.slice(0, 12)) {
    console.log(`\n  ${row.name}`)
    if (row.s) console.log(`    [Sonnet ${row.s.score.toFixed(2)}] ${row.s.expl.slice(0, 200)}`)
    if (row.g) console.log(`    [Gemini ${row.g.score.toFixed(2)}] ${row.g.expl.slice(0, 200)}`)
  }

  // Stats
  console.log('\n━━━━━━━━━━━━ STATS ━━━━━━━━━━━━')
  const sonnetSize = sonnetMap.size
  const geminiSize = geminiMap.size
  const overlap = [...sonnetMap.keys()].filter((n) => geminiMap.has(n)).length
  console.log(`Sonnet suggestions: ${sonnetSize}`)
  console.log(`Gemini suggestions: ${geminiSize}`)
  console.log(`Overlap (cards both picked): ${overlap}`)
  console.log(`Sonnet only: ${sonnetSize - overlap}`)
  console.log(`Gemini only: ${geminiSize - overlap}`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('[compare] FAILED', err)
  process.exit(1)
})
