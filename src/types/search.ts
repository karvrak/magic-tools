export interface SearchState {
  query: string
  filters: SearchFilters
  results: any[]
  total: number
  page: number
  loading: boolean
  error: string | null
}

export type NewnessFilter = 'new_card' | 'new_art' | 'all_new'

export interface SearchFilters {
  name: string
  text: string
  type: string
  colors: string[]
  colorIdentity: string[]
  colorMode: 'exact' | 'include' | 'atMost'
  cmcMin: number | null
  cmcMax: number | null
  cmcExact: number | null
  rarity: string[]
  set: string
  format: string
  priceMinEur: number | null
  priceMaxEur: number | null
  priceMinUsd: number | null
  priceMaxUsd: number | null
  keywords: string[]
  // Newness filter (new cards / new artworks from recent syncs)
  newness: NewnessFilter | null
  newnessSince: string | null // ISO date string
}

export const defaultSearchFilters: SearchFilters = {
  name: '',
  text: '',
  type: '',
  colors: [],
  colorIdentity: [],
  colorMode: 'include',
  cmcMin: null,
  cmcMax: null,
  cmcExact: null,
  rarity: [],
  set: '',
  format: '',
  priceMinEur: null,
  priceMaxEur: null,
  priceMinUsd: null,
  priceMaxUsd: null,
  keywords: [],
  newness: null,
  newnessSince: null,
}

export const MTG_COLORS = [
  { code: 'W', name: 'White', color: '#f9fafb' },
  { code: 'U', name: 'Blue', color: '#3b82f6' },
  { code: 'B', name: 'Black', color: '#1f2937' },
  { code: 'R', name: 'Red', color: '#ef4444' },
  { code: 'G', name: 'Green', color: '#22c55e' },
] as const

export const RARITIES = [
  { code: 'common', name: 'Common' },
  { code: 'uncommon', name: 'Uncommon' },
  { code: 'rare', name: 'Rare' },
  { code: 'mythic', name: 'Mythic' },
] as const

export const FORMATS = [
  { code: 'standard', name: 'Standard' },
  { code: 'modern', name: 'Modern' },
  { code: 'legacy', name: 'Legacy' },
  { code: 'vintage', name: 'Vintage' },
  { code: 'commander', name: 'Commander' },
  { code: 'pioneer', name: 'Pioneer' },
  { code: 'pauper', name: 'Pauper' },
  { code: 'historic', name: 'Historic' },
  { code: 'brawl', name: 'Brawl' },
] as const

export const CARD_CATEGORIES = [
  { code: 'mainboard', name: 'Mainboard' },
  { code: 'sideboard', name: 'Sideboard' },
  { code: 'maybeboard', name: 'Maybeboard' },
  { code: 'commander', name: 'Commander' },
] as const

export const PRIORITIES = [
  { code: 'high', name: 'High', color: 'text-dragon-500' },
  { code: 'medium', name: 'Medium', color: 'text-gold-500' },
  { code: 'low', name: 'Low', color: 'text-dungeon-400' },
] as const
