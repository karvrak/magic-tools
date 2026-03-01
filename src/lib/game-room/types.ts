import { CardWithPrice } from '@/types/scryfall'

export interface DeckCard {
  id: string
  cardId: string
  quantity: number
  category: string
  card: CardWithPrice
}

export interface NamedCounter {
  label: string
  count: number
}

export interface CardCounters {
  plusOne: number
  minusOne: number
  genericCounters: NamedCounter[]
}

export interface ManaPoolColors {
  W: number
  U: number
  B: number
  R: number
  G: number
  C: number
}

export const DEFAULT_MANA_POOL_COLORS: ManaPoolColors = {
  W: 0, U: 0, B: 0, R: 0, G: 0, C: 0,
}

export interface BattlefieldCard extends CardWithPrice {
  uniqueId: string
  tapped: boolean
  counters: CardCounters
  isToken?: boolean
}

export interface GameStateSnapshot {
  hand: CardWithPrice[]
  library: CardWithPrice[]
  graveyard: CardWithPrice[]
  exile: CardWithPrice[]
  battlefield: BattlefieldCard[]
  life: number
  manaPoolColors: ManaPoolColors
  poisonCounters: number
}

export interface BattlefieldCardInfo {
  id: string
  name: string
  image: string | null
  type: string
  tapped: boolean
  counters?: CardCounters
}

export interface ZoneCardInfo {
  name: string
  image: string | null
  type: string
}

export interface LastAction {
  playerName: string
  playerColor: string
  cardName: string
  cardImage: string | null
  cardType: string
  action: 'play' | 'discard' | 'draw' | 'bounce' | 'destroy'
  timestamp: number
}

export interface GamePlayer {
  id: string
  name: string
  color: string
  isHost: boolean
  life: number
  manaPool: number
  manaPoolColors?: ManaPoolColors
  poisonCounters: number
  handCount: number
  libraryCount: number
  graveyardCount: number
  exileCount?: number
  battlefieldCount: number
  battlefieldCards: BattlefieldCardInfo[]
  graveyardCards?: ZoneCardInfo[]
  exileCards?: ZoneCardInfo[]
  isEliminated: boolean
  isConnected: boolean
  isReady: boolean
  playerOrder: number
  deckName?: string
}

export interface GameRoomProps {
  playerId: string
  players: GamePlayer[]
  startingLife: number
  currentTurn: number
  activePlayerId: string | null
  isMyTurn: boolean
  cards: DeckCard[] | null
  onUpdateStats: (stats: Partial<GamePlayer>) => void
  onNextTurn: () => void
  onSetReady: (ready: boolean) => void
  gamePhase: 'lobby' | 'playing' | 'finished'
  decks?: { id: string; name: string }[]
  selectedDeckId?: string
  onSelectDeck?: (deckId: string) => void
}
