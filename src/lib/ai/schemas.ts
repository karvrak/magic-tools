import { z } from 'zod'
import { CARD_ROLES, INTERACTION_TYPES } from './types'

// ============================================================
// Schemas zod pour valider les sorties LLM
// ============================================================

/**
 * Sortie attendue de la classification d'UNE carte.
 * Le batch envoie 50 cartes, le LLM retourne un objet keyé par card_id.
 */
export const CardClassificationSchema = z.object({
  primary_role: z.enum(CARD_ROLES),
  secondary_roles: z.array(z.enum(CARD_ROLES)).max(5).default([]),
  archetype_tags: z.array(z.string().min(1).max(40)).max(8).default([]),
  interaction_type: z.enum(INTERACTION_TYPES),
})
export type CardClassification = z.infer<typeof CardClassificationSchema>

/**
 * Reponse complete d'un batch (50 cartes par batch).
 * Cles = card.id (Scryfall ID).
 */
export const ClassificationBatchResponseSchema = z.object({
  classifications: z.record(z.string(), CardClassificationSchema),
})
export type ClassificationBatchResponse = z.infer<
  typeof ClassificationBatchResponseSchema
>

/**
 * Sortie attendue du re-ranking final.
 * `card_id` est la cle Scryfall, `score` est dans [0, 1] ou peut etre une note relative.
 */
export const RerankSuggestionSchema = z.object({
  card_id: z.string().min(1),
  score: z.number(),
  role_filled: z.string().nullable().optional(),
  explanation: z.string().min(1).max(500),
})
export type RerankSuggestion = z.infer<typeof RerankSuggestionSchema>

/**
 * Evaluation d'une carte DEJA dans le deck (best/worst du deck).
 * Meme echelle 0..1 que `RerankSuggestionSchema` mais re-cadree:
 *   - 0.8-1.0 = pivot / win condition / pilier essentiel du plan
 *   - 0.6-0.8 = bonne fit, contribue au moteur
 *   - 0.4-0.6 = generique, role rempli mais remplacable
 *   - 0.2-0.4 = faible synergie, candidat a la sortie
 *   - 0.0-0.2 = hors-plan, devrait sortir du deck
 */
export const DeckCardEvaluationSchema = z.object({
  card_id: z.string().min(1),
  score: z.number(),
  explanation: z.string().min(1).max(500),
})
export type DeckCardEvaluation = z.infer<typeof DeckCardEvaluationSchema>

export const RerankResponseSchema = z.object({
  suggestions: z.array(RerankSuggestionSchema),
  deck_evaluations: z.array(DeckCardEvaluationSchema).optional(),
  archetype_note: z.string().optional(),
})
export type RerankResponse = z.infer<typeof RerankResponseSchema>
