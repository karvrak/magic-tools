// Types partagés pour le système de tags utilisateur sur les cartes d'un deck.
// Voir prisma/migrations/20260515000000_add_card_tags pour le schéma DB.

export type CardTagScope = 'global' | 'deck'

export interface CardTag {
  id: string
  name: string
  color: string
  scope: CardTagScope
}

export interface CardTagWithUsage extends CardTag {
  usageCount?: number
}

// Stat agrégée renvoyée par GET /api/decks/[id] (tagStats)
export interface CardTagStat extends CardTag {
  count: number       // somme des quantités (4 copies d'une carte taguée = 4)
  uniqueCards: number // nombre de DeckCards distincts taguées
}

// Palette utilisée par le tag picker / manager. Reprise des couleurs Owner
// pour rester cohérent visuellement.
export const CARD_TAG_COLORS = [
  '#8B5CF6', // violet (défaut)
  '#22C55E', // vert
  '#EF4444', // rouge
  '#3B82F6', // bleu
  '#F97316', // orange
  '#EC4899', // rose
  '#14B8A6', // sarcelle
  '#D4AF37', // or
  '#A78BFA', // lavande
  '#64748B', // ardoise
] as const
