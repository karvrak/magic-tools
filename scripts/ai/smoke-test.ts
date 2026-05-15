/**
 * Smoke test: verifie que la chaine OpenRouter (embeddings + chat + rerank)
 * est fonctionnelle. Pas de DB writes.
 *
 * Usage: npm run ai:smoke
 */
import { getLLMClient } from '@/lib/ai/clients'
import {
  CLASSIFICATION_MODEL,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  RERANK_MAX_TOKENS,
  RERANK_MODEL,
} from '@/lib/ai/config'

async function main() {
  const llm = getLLMClient()
  console.log('[smoke] using base URL:', (llm as unknown as { baseURL?: string }).baseURL)

  // 1. Embedding
  console.log('[smoke] testing embedding (', EMBEDDING_MODEL, ')...')
  const t1 = Date.now()
  const emb = await llm.embeddings.create({
    model: EMBEDDING_MODEL,
    input: 'Lightning Bolt deals 3 damage to any target.',
    dimensions: EMBEDDING_DIMENSIONS,
    encoding_format: 'float',
  })
  const v = emb.data[0]?.embedding as number[] | undefined
  if (!v) throw new Error('No embedding returned')
  console.log(
    `[smoke] embedding OK: dim=${v.length} (expected ${EMBEDDING_DIMENSIONS}) latency=${Date.now() - t1}ms`
  )

  // 2. Classification (chat completion JSON)
  console.log('[smoke] testing classification (', CLASSIFICATION_MODEL, ')...')
  const t2 = Date.now()
  const c = await llm.chat.completions.create({
    model: CLASSIFICATION_MODEL,
    response_format: { type: 'json_object' },
    temperature: 0,
    messages: [
      {
        role: 'system',
        content:
          'Return JSON only. Format: {"role": "ramp"|"removal"|"draw"|"finisher"|"other"}',
      },
      {
        role: 'user',
        content:
          'Classify: Sol Ring — Artifact — {T}: Add {C}{C}.',
      },
    ],
  })
  const cl = c.choices[0]?.message?.content
  console.log(
    `[smoke] classification OK: response=${cl} latency=${Date.now() - t2}ms`
  )

  // 3. Rerank (Claude via OpenRouter)
  console.log('[smoke] testing rerank (', RERANK_MODEL, ')...')
  const t3 = Date.now()
  const r = await llm.chat.completions.create({
    model: RERANK_MODEL,
    max_tokens: RERANK_MAX_TOKENS,
    messages: [
      {
        role: 'system',
        content:
          'Reply with a single short JSON: {"ok": true, "card": "<a Magic card name that synergizes with Sol Ring in Commander>"}',
      },
      { role: 'user', content: 'Suggest one card.' },
    ],
  })
  const rr = r.choices[0]?.message?.content
  console.log(
    `[smoke] rerank OK: response=${rr} latency=${Date.now() - t3}ms`
  )

  console.log('[smoke] ALL OK ✓')
}

main().catch((err) => {
  console.error('[smoke] FAILED', err)
  process.exit(1)
})
