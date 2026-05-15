/**
 * Types partages de la couche IA.
 * Ces enums sont la source de verite pour les valeurs autorisees en BDD.
 */

// Roles canoniques. Un seul primary_role par carte. Les recouvrements
// (finisher vs threat vs win_condition) sont laisses au LLM de re-ranking
// qui jugera a partir de l'oracle text. Garde la liste resserree.
export const CARD_ROLES = [
  'ramp',
  'mana_fixing',
  'removal',
  'sweeper',
  'draw',
  'tutor',
  'counter',
  'protection',
  'recursion',
  'finisher',
  'threat',
  'lock_piece',
  'hate_piece',
  'utility',
  'land',
] as const
export type CardRole = (typeof CARD_ROLES)[number]

export const INTERACTION_TYPES = ['proactive', 'reactive', 'mixed'] as const
export type InteractionType = (typeof INTERACTION_TYPES)[number]

// Tags d'archetype libres mais on definit la liste connue pour la detection.
// Si le LLM en propose un hors liste, on l'accepte mais il ne contribue pas
// au vote d'archetype.
export const KNOWN_ARCHETYPES = [
  // Strategies generales
  'aggro',
  'midrange',
  'control',
  'combo',
  'tempo',
  'ramp',
  'tokens',
  'voltron',
  'tribal',
  // Vintage meta
  'shops',
  'oath',
  'doomsday',
  'dredge',
  'storm',
  'paradoxical_outcome',
  'painter',
  'workshops',
  // EDH meta
  'reanimator',
  'stax',
  'prison',
  'lands',
  'spellslinger',
  'aristocrats',
  'enchantress',
  'artifacts',
  'group_hug',
  'group_slug',
] as const
export type ArchetypeTag = (typeof KNOWN_ARCHETYPES)[number] | string

// Couleurs MTG
export const MTG_COLORS = ['W', 'U', 'B', 'R', 'G'] as const
export type Color = (typeof MTG_COLORS)[number]

// Formats supportes par le systeme IA. Les autres formats du projet
// (modern, standard, etc.) ne sont pas servis pour l'instant.
export const SUPPORTED_FORMATS = ['vintage', 'commander'] as const
export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number]

export function isSupportedFormat(f: string | null | undefined): f is SupportedFormat {
  if (!f) return false
  return (SUPPORTED_FORMATS as readonly string[]).includes(f.toLowerCase())
}

// Categories DeckCard utilisees comme commandant
export const COMMANDER_CATEGORIES = ['commander', 'companion'] as const
