import OpenAI from 'openai'

let _client: OpenAI | null = null

/**
 * Strategie LLM:
 *  - PRIMAIRE: OpenRouter (`OPENROUTER_API_KEY`) — un seul gateway pour
 *    embeddings (openai/text-embedding-3-large), classification
 *    (openai/gpt-4o-mini) et re-ranking (anthropic/claude-sonnet-4.6).
 *    Utilise l'API OpenAI-compatible exposee par OpenRouter.
 *  - FALLBACK: cle OpenAI native (`OPENAI_API_KEY`) — pour les setups
 *    qui veulent passer en direct (pas via gateway).
 *
 * Le code consommateur appelle uniquement getLLMClient(); le model id
 * (config.ts) integre le prefixe vendor (openai/, anthropic/, ...) qui est
 * ignore par l'API OpenAI native si on bascule en direct (a tester).
 */
export function getLLMClient(): OpenAI {
  if (_client) return _client
  const orKey = process.env.OPENROUTER_API_KEY
  const oaKey = process.env.OPENAI_API_KEY
  if (orKey) {
    _client = new OpenAI({
      apiKey: orKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        // Attribution OpenRouter (optionnel mais recommande).
        'HTTP-Referer': process.env.PUBLIC_APP_URL ?? 'https://magic-tools.local',
        'X-Title': 'Magic Tools',
      },
    })
    return _client
  }
  if (oaKey) {
    _client = new OpenAI({ apiKey: oaKey })
    return _client
  }
  throw new Error(
    'LLM key manquante. Configurez OPENROUTER_API_KEY (recommande) ou OPENAI_API_KEY dans .env / docker-compose.yml.'
  )
}

// Alias backward-compat pour les callers existants.
export const getOpenAI = getLLMClient

/**
 * Conserve pour compat (utilise dans complete-deck.ts pour le rerank).
 * Avec OpenRouter, on appelle Claude via le client OpenAI-compatible
 * en passant model='anthropic/claude-sonnet-4.6'. Pas besoin du SDK natif.
 */
export const getAnthropic = (): never => {
  throw new Error(
    'getAnthropic() est deprecie. Utilisez getLLMClient() avec model=anthropic/claude-sonnet-4.6 via OpenRouter.'
  )
}
