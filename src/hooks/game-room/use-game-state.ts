'use client'

import { useState, useRef, useMemo, useCallback } from 'react'
import { CardWithPrice } from '@/types/scryfall'
import { BattlefieldCard, DeckCard, ManaPoolColors, GameStateSnapshot, DEFAULT_MANA_POOL_COLORS } from '@/lib/game-room/types'

const MAX_UNDO_STACK_SIZE = 10

/** Expand deck cards into individual cards, excluding sideboard */
export function expandDeck(cards: DeckCard[]): CardWithPrice[] {
  const expanded: CardWithPrice[] = []
  if (!cards) return expanded
  for (const dc of cards) {
    if (!dc || !dc.card) continue
    if (dc.category === 'sideboard') continue
    for (let i = 0; i < dc.quantity; i++) {
      expanded.push(dc.card)
    }
  }
  return expanded
}

export interface GameState {
  // Core zones
  library: CardWithPrice[]
  setLibrary: React.Dispatch<React.SetStateAction<CardWithPrice[]>>
  hand: CardWithPrice[]
  setHand: React.Dispatch<React.SetStateAction<CardWithPrice[]>>
  graveyard: CardWithPrice[]
  setGraveyard: React.Dispatch<React.SetStateAction<CardWithPrice[]>>
  exile: CardWithPrice[]
  setExile: React.Dispatch<React.SetStateAction<CardWithPrice[]>>
  battlefield: BattlefieldCard[]
  setBattlefield: React.Dispatch<React.SetStateAction<BattlefieldCard[]>>

  // Player stats
  life: number
  setLife: React.Dispatch<React.SetStateAction<number>>
  manaPool: number
  setManaPool: React.Dispatch<React.SetStateAction<number>>
  poisonCounters: number
  setPoisonCounters: React.Dispatch<React.SetStateAction<number>>

  // Game init
  gameInitialized: boolean
  setGameInitialized: React.Dispatch<React.SetStateAction<boolean>>
  countdown: number | null
  setCountdown: React.Dispatch<React.SetStateAction<number | null>>

  // Mulligan
  mulliganCount: number
  setMulliganCount: React.Dispatch<React.SetStateAction<number>>
  mulliganPhase: 'choosing' | 'selecting-bottom' | 'done'
  setMulliganPhase: React.Dispatch<React.SetStateAction<'choosing' | 'selecting-bottom' | 'done'>>
  selectedHandIndices: Set<number>
  setSelectedHandIndices: React.Dispatch<React.SetStateAction<Set<number>>>

  // UI overlays
  showLibrary: boolean
  setShowLibrary: React.Dispatch<React.SetStateAction<boolean>>
  showGraveyard: boolean
  setShowGraveyard: React.Dispatch<React.SetStateAction<boolean>>
  showExile: boolean
  setShowExile: React.Dispatch<React.SetStateAction<boolean>>
  showScry: boolean
  setShowScry: React.Dispatch<React.SetStateAction<boolean>>
  showDeckMenu: boolean
  setShowDeckMenu: React.Dispatch<React.SetStateAction<boolean>>
  showDeckSearch: boolean
  setShowDeckSearch: React.Dispatch<React.SetStateAction<boolean>>

  // Scry state
  scryCards: { card: CardWithPrice; originalIndex: number }[]
  setScryCards: React.Dispatch<React.SetStateAction<{ card: CardWithPrice; originalIndex: number }[]>>
  scryCount: number
  setScryCount: React.Dispatch<React.SetStateAction<number>>

  // Deck search
  deckSearchQuery: string
  setDeckSearchQuery: React.Dispatch<React.SetStateAction<string>>
  deckSearchSelected: Set<number>
  setDeckSearchSelected: React.Dispatch<React.SetStateAction<Set<number>>>

  // Preview
  previewCard: { name: string; image: string | null; type: string } | null
  setPreviewCard: React.Dispatch<React.SetStateAction<{ name: string; image: string | null; type: string } | null>>

  // Colored mana pool
  manaPoolColors: ManaPoolColors
  setManaPoolColors: React.Dispatch<React.SetStateAction<ManaPoolColors>>

  // Undo
  undoStack: GameStateSnapshot[]
  pushUndoSnapshot: () => void
  popUndoSnapshot: () => GameStateSnapshot | null

  // UI toggles
  showKeyboardHelp: boolean
  setShowKeyboardHelp: React.Dispatch<React.SetStateAction<boolean>>
  showTokenCreator: boolean
  setShowTokenCreator: React.Dispatch<React.SetStateAction<boolean>>

  // Fullscreen
  isFullscreen: boolean
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>

  // Opponent views
  expandedOpponent: string | null
  setExpandedOpponent: React.Dispatch<React.SetStateAction<string | null>>
  viewingOpponentGraveyard: string | null
  setViewingOpponentGraveyard: React.Dispatch<React.SetStateAction<string | null>>
  viewingOpponentExile: string | null
  setViewingOpponentExile: React.Dispatch<React.SetStateAction<string | null>>

  // Generic counter popup
  genericCounterPopup: { uniqueId: string } | null
  setGenericCounterPopup: React.Dispatch<React.SetStateAction<{ uniqueId: string } | null>>
  genericCounterLabel: string
  setGenericCounterLabel: React.Dispatch<React.SetStateAction<string>>

  // Last action
  lastAction: import('@/lib/game-room/types').LastAction | null
  setLastAction: React.Dispatch<React.SetStateAction<import('@/lib/game-room/types').LastAction | null>>
  isHoveringAction: boolean
  setIsHoveringAction: React.Dispatch<React.SetStateAction<boolean>>

  // Refs
  gameContainerRef: React.RefObject<HTMLDivElement | null>
  onUpdateStatsRef: React.MutableRefObject<((...args: any[]) => void) | null>
  lastSyncRef: React.MutableRefObject<string>
  actionTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>
  countdownRef: React.MutableRefObject<NodeJS.Timeout | null>
  genericCounterInputRef: React.RefObject<HTMLInputElement | null>

  // Derived
  fullDeck: CardWithPrice[]
}

export function useGameState(
  startingLife: number,
  cards: DeckCard[] | null
): GameState {
  // Core zones
  const [library, setLibrary] = useState<CardWithPrice[]>([])
  const [hand, setHand] = useState<CardWithPrice[]>([])
  const [graveyard, setGraveyard] = useState<CardWithPrice[]>([])
  const [exile, setExile] = useState<CardWithPrice[]>([])
  const [battlefield, setBattlefield] = useState<BattlefieldCard[]>([])

  // Player stats
  const [life, setLife] = useState(startingLife)
  const [manaPool, setManaPool] = useState(0)
  const [poisonCounters, setPoisonCounters] = useState(0)

  // Game init
  const [gameInitialized, setGameInitialized] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  // Mulligan
  const [mulliganCount, setMulliganCount] = useState(0)
  const [mulliganPhase, setMulliganPhase] = useState<'choosing' | 'selecting-bottom' | 'done'>('choosing')
  const [selectedHandIndices, setSelectedHandIndices] = useState<Set<number>>(new Set())

  // Colored mana pool
  const [manaPoolColors, setManaPoolColors] = useState<ManaPoolColors>({ ...DEFAULT_MANA_POOL_COLORS })

  // Undo stack
  const undoStackRef = useRef<GameStateSnapshot[]>([])
  const [undoStack, setUndoStack] = useState<GameStateSnapshot[]>([])

  // UI toggles
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [showTokenCreator, setShowTokenCreator] = useState(false)

  // UI overlays
  const [showLibrary, setShowLibrary] = useState(false)
  const [showGraveyard, setShowGraveyard] = useState(false)
  const [showExile, setShowExile] = useState(false)
  const [showScry, setShowScry] = useState(false)
  const [showDeckMenu, setShowDeckMenu] = useState(false)
  const [showDeckSearch, setShowDeckSearch] = useState(false)

  // Scry state
  const [scryCards, setScryCards] = useState<{ card: CardWithPrice; originalIndex: number }[]>([])
  const [scryCount, setScryCount] = useState(1)

  // Deck search
  const [deckSearchQuery, setDeckSearchQuery] = useState('')
  const [deckSearchSelected, setDeckSearchSelected] = useState<Set<number>>(new Set())

  // Preview
  const [previewCard, setPreviewCard] = useState<{ name: string; image: string | null; type: string } | null>(null)

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Opponent views
  const [expandedOpponent, setExpandedOpponent] = useState<string | null>(null)
  const [viewingOpponentGraveyard, setViewingOpponentGraveyard] = useState<string | null>(null)
  const [viewingOpponentExile, setViewingOpponentExile] = useState<string | null>(null)

  // Generic counter popup
  const [genericCounterPopup, setGenericCounterPopup] = useState<{ uniqueId: string } | null>(null)
  const [genericCounterLabel, setGenericCounterLabel] = useState('')

  // Last action
  const [lastAction, setLastAction] = useState<import('@/lib/game-room/types').LastAction | null>(null)
  const [isHoveringAction, setIsHoveringAction] = useState(false)

  // Refs
  const gameContainerRef = useRef<HTMLDivElement>(null)
  const onUpdateStatsRef = useRef<((...args: any[]) => void) | null>(null)
  const lastSyncRef = useRef<string>('')
  const actionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const genericCounterInputRef = useRef<HTMLInputElement>(null)

  // Undo snapshot functions
  const pushUndoSnapshot = useCallback(() => {
    const snapshot: GameStateSnapshot = {
      hand: [...hand],
      library: [...library],
      graveyard: [...graveyard],
      exile: [...exile],
      battlefield: battlefield.map(c => ({ ...c })),
      life,
      manaPoolColors: { ...manaPoolColors },
      poisonCounters,
    }
    const newStack = [...undoStackRef.current, snapshot].slice(-MAX_UNDO_STACK_SIZE)
    undoStackRef.current = newStack
    setUndoStack(newStack)
  }, [hand, library, graveyard, exile, battlefield, life, manaPoolColors, poisonCounters])

  const popUndoSnapshot = useCallback((): GameStateSnapshot | null => {
    if (undoStackRef.current.length === 0) return null
    const newStack = [...undoStackRef.current]
    const snapshot = newStack.pop()!
    undoStackRef.current = newStack
    setUndoStack(newStack)
    return snapshot
  }, [])

  // Derived
  const fullDeck = useMemo(() => expandDeck(cards || []), [cards])

  return {
    library, setLibrary,
    hand, setHand,
    graveyard, setGraveyard,
    exile, setExile,
    battlefield, setBattlefield,
    life, setLife,
    manaPool, setManaPool,
    manaPoolColors, setManaPoolColors,
    poisonCounters, setPoisonCounters,
    undoStack, pushUndoSnapshot, popUndoSnapshot,
    showKeyboardHelp, setShowKeyboardHelp,
    showTokenCreator, setShowTokenCreator,
    gameInitialized, setGameInitialized,
    countdown, setCountdown,
    mulliganCount, setMulliganCount,
    mulliganPhase, setMulliganPhase,
    selectedHandIndices, setSelectedHandIndices,
    showLibrary, setShowLibrary,
    showGraveyard, setShowGraveyard,
    showExile, setShowExile,
    showScry, setShowScry,
    showDeckMenu, setShowDeckMenu,
    showDeckSearch, setShowDeckSearch,
    scryCards, setScryCards,
    scryCount, setScryCount,
    deckSearchQuery, setDeckSearchQuery,
    deckSearchSelected, setDeckSearchSelected,
    previewCard, setPreviewCard,
    isFullscreen, setIsFullscreen,
    expandedOpponent, setExpandedOpponent,
    viewingOpponentGraveyard, setViewingOpponentGraveyard,
    viewingOpponentExile, setViewingOpponentExile,
    genericCounterPopup, setGenericCounterPopup,
    genericCounterLabel, setGenericCounterLabel,
    lastAction, setLastAction,
    isHoveringAction, setIsHoveringAction,
    gameContainerRef,
    onUpdateStatsRef,
    lastSyncRef,
    actionTimeoutRef,
    countdownRef,
    genericCounterInputRef,
    fullDeck,
  }
}
