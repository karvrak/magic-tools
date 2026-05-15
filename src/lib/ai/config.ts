/**
 * Constantes de configuration de la couche IA.
 * Toute modification d'un modele ou d'une version impose un re-traitement
 * (re-embedding pour EMBEDDING_*, re-classification pour CLASSIFICATION_*).
 */

// Embeddings — text-embedding-3-large tronque a 1536 dim (Matryoshka)
// Format OpenRouter: prefixe vendor.
export const EMBEDDING_MODEL = 'openai/text-embedding-3-large'
export const EMBEDDING_DIMENSIONS = 1536
// Bump cette version si le builder de texte canonique change.
export const EMBEDDING_VERSION = '1'

// Classification one-shot via OpenRouter
export const CLASSIFICATION_MODEL = 'openai/gpt-4o-mini'
// Bump cette version si le prompt ou le schema de sortie change.
export const CLASSIFICATION_VERSION = 'v3'
// Taille de batch dans le contenu d'une seule requete LLM (50 cartes en JSON).
export const CLASSIFICATION_BATCH_SIZE = 50

// Re-ranking final via OpenRouter (route Anthropic).
export const RERANK_MODEL = 'anthropic/claude-sonnet-4.6'
// 32768 = double l'ancien plafond (16384) car les decks EDH (100 cartes) +
// candidats généraient des réponses de 43k+ chars en français et finissaient
// tronquées en plein milieu d'une string JSON. Sonnet 4.6 via OpenRouter
// supporte jusqu'à ~64K tokens output, donc cette marge est sûre.
export const RERANK_MAX_TOKENS = 32768

// Limites OpenAI Embeddings API
export const EMBEDDING_API_MAX_INPUTS = 2048
export const EMBEDDING_API_MAX_TOKENS_PER_INPUT = 8000

// Score hybride synergies = alpha * sim_centroid + (1 - alpha) * sim_max_to_deck
export const SYNERGY_ALPHA = 0.6

// Pondération du commandant dans le centroïde EDH
export const COMMANDER_CENTROID_WEIGHT = 3
