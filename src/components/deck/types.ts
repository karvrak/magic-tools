export interface Owner {
  id: string
  name: string
  color: string
  isDefault: boolean
  deckCount?: number
}

export interface Tag {
  id: string
  name: string
  color: string
  deckCount?: number
}

export type DeckStatus = 'building' | 'active' | 'locked'

export interface Deck {
  id: string
  name: string
  description: string | null
  format: string | null
  status: DeckStatus
  colors: string[]
  cardCount: number
  avgCmc: number
  totalPrice: number
  minTotalPrice: number
  owner: Owner | null
  tags: Tag[]
  coverImage: string | null
  createdAt: string
  updatedAt: string
}

export type ViewMode = 'grid' | 'list'
export type SortField = 'name' | 'price' | 'status' | 'updatedAt' | 'cardCount' | 'avgCmc' | 'tags'
export type SortDirection = 'asc' | 'desc'

export const MANA_CONFIG = {
  W: {
    icon: 'Sun' as const,
    name: 'White',
    bg: 'from-amber-100 to-yellow-50',
    border: 'border-amber-300',
    activeBorder: 'border-amber-400',
    glow: 'shadow-[0_0_12px_rgba(251,191,36,0.5)]',
    text: 'text-amber-900',
  },
  U: {
    icon: 'Droplets' as const,
    name: 'Blue',
    bg: 'from-blue-500 to-blue-600',
    border: 'border-blue-400',
    activeBorder: 'border-blue-300',
    glow: 'shadow-[0_0_12px_rgba(59,130,246,0.6)]',
    text: 'text-white',
  },
  B: {
    icon: 'Skull' as const,
    name: 'Black',
    bg: 'from-gray-800 to-gray-900',
    border: 'border-gray-600',
    activeBorder: 'border-purple-500',
    glow: 'shadow-[0_0_12px_rgba(168,85,247,0.5)]',
    text: 'text-gray-200',
  },
  R: {
    icon: 'Flame' as const,
    name: 'Red',
    bg: 'from-red-500 to-red-600',
    border: 'border-red-400',
    activeBorder: 'border-orange-400',
    glow: 'shadow-[0_0_12px_rgba(239,68,68,0.6)]',
    text: 'text-white',
  },
  G: {
    icon: 'TreePine' as const,
    name: 'Green',
    bg: 'from-green-500 to-green-600',
    border: 'border-green-400',
    activeBorder: 'border-emerald-300',
    glow: 'shadow-[0_0_12px_rgba(34,197,94,0.6)]',
    text: 'text-white',
  },
} as const

export const MTG_COLORS = ['W', 'U', 'B', 'R', 'G'] as const

export const MANA_ICONS = {
  W: 'Sun',
  U: 'Droplets',
  B: 'Skull',
  R: 'Flame',
  G: 'TreePine',
} as const

export const OWNER_COLORS = [
  { name: 'Gold', value: '#D4AF37' },
  { name: 'Arcane Purple', value: '#8B5CF6' },
  { name: 'Nature Green', value: '#22C55E' },
  { name: 'Dragon Red', value: '#EF4444' },
  { name: 'Ocean Blue', value: '#3B82F6' },
  { name: 'Sunset Orange', value: '#F97316' },
  { name: 'Rose Pink', value: '#EC4899' },
  { name: 'Teal', value: '#14B8A6' },
]
