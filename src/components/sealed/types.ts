export interface BoosterCard {
  id: string
  oracleId: string
  name: string
  printedName: string | null
  manaCost: string | null
  cmc: number
  typeLine: string
  printedTypeLine: string | null
  colors: string[]
  colorIdentity: string[]
  rarity: string
  imageNormal: string | null
  imageLarge: string | null
  imageNormalBack: string | null
  imageLargeBack: string | null
  power: string | null
  toughness: string | null
  loyalty: string | null
  oracleText: string | null
  printedText: string | null
  setCode: string
  setName: string
  layout: string
  slot: string
}

export interface SetInfo {
  setCode: string
  setName: string
  commons: number
  uncommons: number
  rares: number
  mythics: number
  releasedAt: string | null
}

export interface GeneratedPool {
  setCode: string
  setName: string
  pool: BoosterCard[]
  boosters: Array<{ packNumber: number; cards: BoosterCard[] }>
  stats: {
    commons: number
    uncommons: number
    rares: number
    mythics: number
    lands: number
  }
}

export const BASIC_LANDS = [
  { name: 'Plains', color: 'W', bgClass: 'bg-yellow-200' },
  { name: 'Island', color: 'U', bgClass: 'bg-blue-400' },
  { name: 'Swamp', color: 'B', bgClass: 'bg-gray-700' },
  { name: 'Mountain', color: 'R', bgClass: 'bg-red-500' },
  { name: 'Forest', color: 'G', bgClass: 'bg-green-500' },
] as const

export const DEFAULT_BASIC_LANDS: Record<string, number> = {
  Plains: 0,
  Island: 0,
  Swamp: 0,
  Mountain: 0,
  Forest: 0,
}

export const RARITY_ORDER = ['mythic', 'rare', 'uncommon', 'common']
export const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G', 'multicolor', 'colorless']

export const SORT_OPTIONS = [
  { key: 'rarity', label: 'Rarity' },
  { key: 'color', label: 'Color' },
  { key: 'cmc', label: 'CMC' },
  { key: 'type', label: 'Type' },
] as const

export type SortKey = typeof SORT_OPTIONS[number]['key']

export function getCardTypeCategory(typeLine: string): string {
  const lowerType = typeLine.toLowerCase()
  if (lowerType.includes('creature')) return 'creature'
  if (lowerType.includes('planeswalker')) return 'planeswalker'
  if (lowerType.includes('land')) return 'land'
  if (lowerType.includes('instant')) return 'instant'
  if (lowerType.includes('sorcery')) return 'sorcery'
  if (lowerType.includes('artifact')) return 'artifact'
  if (lowerType.includes('enchantment')) return 'enchantment'
  return 'other'
}

export function getColorCategory(card: BoosterCard): string {
  if (card.colors.length > 1) return 'multicolor'
  if (card.colors.length === 0) return 'colorless'
  return card.colors[0]
}

export function sortByCMC(a: BoosterCard, b: BoosterCard): number {
  return a.cmc - b.cmc || a.name.localeCompare(b.name)
}
