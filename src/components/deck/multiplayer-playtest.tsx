'use client'

import { useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shuffle,
  ChevronDown,
  Layers,
  Hand,
  Library,
  Trash2,
  EyeOff,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  RotateCw,
  Skull,
  Zap,
  Undo2,
  Play,
  Droplet,
  Check,
  Clock,
  Eye,
  ArrowDown,
  Maximize2,
  Minimize2,
  X,
  ChevronUp,
  Search,
  Swords,
  Sparkles,
  Mountain,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CardWithPrice } from '@/types/scryfall'
import { HoverPreviewProvider, WithHoverPreview } from '@/components/card/card-hover-preview'

interface DeckCard {
  id: string
  cardId: string
  quantity: number
  category: string
  card: CardWithPrice
}

interface NamedCounter {
  label: string
  count: number
}

interface CardCounters {
  plusOne: number
  minusOne: number
  genericCounters: NamedCounter[]
}

interface BattlefieldCardInfo {
  id: string
  name: string
  image: string | null
  type: string
  tapped: boolean
  counters?: CardCounters
}

interface ZoneCardInfo {
  name: string
  image: string | null
  type: string
}

// Last action tracking
interface LastAction {
  playerName: string
  playerColor: string
  cardName: string
  cardImage: string | null
  cardType: string
  action: 'play' | 'discard' | 'draw' | 'bounce' | 'destroy'
  timestamp: number
}

interface GamePlayer {
  id: string
  name: string
  color: string
  isHost: boolean
  life: number
  manaPool: number
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

interface MultiplayerPlaytestProps {
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
}

interface BattlefieldCard extends CardWithPrice {
  uniqueId: string
  tapped: boolean
  counters: CardCounters
}

// Expand deck cards into individual cards for shuffling
function expandDeck(cards: DeckCard[]): CardWithPrice[] {
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

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Check if a card is a land
function isLand(card: CardWithPrice | null | undefined): boolean {
  if (!card || !card.typeLine) return false
  return card.typeLine.toLowerCase().includes('land')
}

// Check if a card is a creature
function isCreature(card: CardWithPrice | null | undefined): boolean {
  if (!card || !card.typeLine) return false
  return card.typeLine.toLowerCase().includes('creature')
}

// Generate unique ID
function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export function MultiplayerPlaytest({
  playerId,
  players,
  startingLife,
  currentTurn,
  activePlayerId,
  isMyTurn,
  cards,
  onUpdateStats,
  onNextTurn,
  onSetReady,
  gamePhase,
}: MultiplayerPlaytestProps) {
  const currentPlayer = players.find(p => p.id === playerId)
  const opponents = players.filter(p => p.id !== playerId)

  // Countdown state
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  // Local game state
  const [library, setLibrary] = useState<CardWithPrice[]>([])
  const [hand, setHand] = useState<CardWithPrice[]>([])
  const [graveyard, setGraveyard] = useState<CardWithPrice[]>([])
  const [exile, setExile] = useState<CardWithPrice[]>([])
  const [battlefield, setBattlefield] = useState<BattlefieldCard[]>([])
  const [life, setLife] = useState(startingLife)
  const [manaPool, setManaPool] = useState(0)
  const [poisonCounters, setPoisonCounters] = useState(0)
  const [gameInitialized, setGameInitialized] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showGraveyard, setShowGraveyard] = useState(false)
  
  // Mulligan state
  const [mulliganCount, setMulliganCount] = useState(0)
  const [mulliganPhase, setMulliganPhase] = useState<'choosing' | 'selecting-bottom' | 'done'>('choosing')
  const [selectedHandIndices, setSelectedHandIndices] = useState<Set<number>>(new Set())

  // Card preview state
  const [previewCard, setPreviewCard] = useState<{ name: string; image: string | null; type: string } | null>(null)

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false)
  const gameContainerRef = useRef<HTMLDivElement>(null)

  // Expanded opponent view
  const [expandedOpponent, setExpandedOpponent] = useState<string | null>(null)

  // Deck menu & scry state
  const [showDeckMenu, setShowDeckMenu] = useState(false)
  const [showScry, setShowScry] = useState(false)
  const [scryCount, setScryCount] = useState(1)
  const [scryCards, setScryCards] = useState<{ card: CardWithPrice; originalIndex: number }[]>([])
  const [showExile, setShowExile] = useState(false)

  // Deck search (tutor) state
  const [showDeckSearch, setShowDeckSearch] = useState(false)
  const [deckSearchQuery, setDeckSearchQuery] = useState('')
  const [deckSearchSelected, setDeckSearchSelected] = useState<Set<number>>(new Set())

  // Generic counter popup state
  const [genericCounterPopup, setGenericCounterPopup] = useState<{ uniqueId: string } | null>(null)
  const [genericCounterLabel, setGenericCounterLabel] = useState('')
  const genericCounterInputRef = useRef<HTMLInputElement>(null)

  // Opponent zone viewing
  const [viewingOpponentGraveyard, setViewingOpponentGraveyard] = useState<string | null>(null)
  const [viewingOpponentExile, setViewingOpponentExile] = useState<string | null>(null)

  // Last action tracking
  const [lastAction, setLastAction] = useState<LastAction | null>(null)
  const [isHoveringAction, setIsHoveringAction] = useState(false)
  const actionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Full deck
  const fullDeck = useMemo(() => expandDeck(cards || []), [cards])

  // Check if all players are ready
  const allPlayersReady = players.length >= 2 && players.every(p => p.isReady)

  // Refs for stable callbacks
  const onUpdateStatsRef = useRef(onUpdateStats)
  onUpdateStatsRef.current = onUpdateStats

  // Track last synced values to prevent duplicate updates
  const lastSyncRef = useRef<string>('')

  // Helper to record last action
  const recordAction = useCallback((
    card: CardWithPrice | null | undefined,
    action: LastAction['action']
  ) => {
    if (!card || !currentPlayer) return
    
    // Clear existing timeout
    if (actionTimeoutRef.current) {
      clearTimeout(actionTimeoutRef.current)
    }

    setLastAction({
      playerName: currentPlayer.name,
      playerColor: currentPlayer.color,
      cardName: card.printedName || card.name || 'Unknown',
      cardImage: card.imageNormal || null,
      cardType: card.typeLine || '',
      action,
      timestamp: Date.now(),
    })

    // Auto-hide after 3 seconds if not hovering
    actionTimeoutRef.current = setTimeout(() => {
      if (!isHoveringAction) {
        setLastAction(null)
      }
    }, 3000)
  }, [currentPlayer, isHoveringAction])

  // Clear action when no longer hovering (after timeout)
  useEffect(() => {
    if (!isHoveringAction && lastAction) {
      actionTimeoutRef.current = setTimeout(() => {
        setLastAction(null)
      }, 3000)
    }
    return () => {
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current)
      }
    }
  }, [isHoveringAction, lastAction])

  // Start countdown when all ready
  useEffect(() => {
    if (allPlayersReady && gamePhase === 'lobby' && countdown === null) {
      setCountdown(3)
    }
    if (!allPlayersReady && countdown !== null && gamePhase === 'lobby') {
      // Someone became unready, cancel countdown
      if (countdownRef.current) {
        clearTimeout(countdownRef.current)
        countdownRef.current = null
      }
      setCountdown(null)
    }
  }, [allPlayersReady, gamePhase, countdown])

  // Countdown timer
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : prev))
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Initialize game when countdown reaches 0 — enter mulligan phase
  useEffect(() => {
    if (countdown === 0 && !gameInitialized) {
      if (fullDeck.length > 0) {
        const shuffled = shuffleArray(fullDeck)
        const initialHand = shuffled.slice(0, 7)
        const remainingLibrary = shuffled.slice(7)
        setLibrary(remainingLibrary)
        setHand(initialHand)
      }
      setGraveyard([])
      setExile([])
      setBattlefield([])
      setLife(startingLife)
      setManaPool(0)
      setPoisonCounters(0)
      setMulliganCount(0)
      setMulliganPhase('choosing')
      setSelectedHandIndices(new Set())
      setGameInitialized(true)
    }
  }, [countdown, gameInitialized, fullDeck, startingLife])

  // Mulligan: whether we are still in mulligan (game initialized but not done)
  const inMulliganScreen = gameInitialized && mulliganPhase !== 'done'

  // London Mulligan — reshuffle and draw 7 new cards
  const doMulligan = useCallback(() => {
    if (mulliganCount >= 2) return // max 2 mulligans
    const newCount = mulliganCount + 1
    const shuffled = shuffleArray(fullDeck)
    const newHand = shuffled.slice(0, 7)
    const newLibrary = shuffled.slice(7)
    setLibrary(newLibrary)
    setHand(newHand)
    setMulliganCount(newCount)
    setSelectedHandIndices(new Set())
    setMulliganPhase('choosing')
  }, [fullDeck, mulliganCount])

  // Keep hand — if mulliganCount > 0, go to selecting-bottom; else done
  const keepHand = useCallback(() => {
    if (mulliganCount > 0) {
      setMulliganPhase('selecting-bottom')
      setSelectedHandIndices(new Set())
    } else {
      setMulliganPhase('done')
    }
  }, [mulliganCount])

  // Toggle card selection for putting on bottom
  const toggleMulliganSelection = useCallback((index: number) => {
    const newSelection = new Set(selectedHandIndices)
    if (newSelection.has(index)) {
      newSelection.delete(index)
    } else if (newSelection.size < mulliganCount) {
      newSelection.add(index)
    }
    setSelectedHandIndices(newSelection)
  }, [selectedHandIndices, mulliganCount])

  // Put selected cards on bottom and start
  const putOnBottom = useCallback(() => {
    if (selectedHandIndices.size !== mulliganCount) return
    const keptCards: CardWithPrice[] = []
    const bottomCards: CardWithPrice[] = []
    hand.forEach((card, index) => {
      if (selectedHandIndices.has(index)) {
        bottomCards.push(card)
      } else {
        keptCards.push(card)
      }
    })
    setHand(keptCards)
    setLibrary(prev => [...prev, ...bottomCards])
    setSelectedHandIndices(new Set())
    setMulliganPhase('done')
  }, [hand, selectedHandIndices, mulliganCount])

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Close deck menu on outside click
  useEffect(() => {
    if (!showDeckMenu) return
    const handleClick = () => setShowDeckMenu(false)
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0)
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClick) }
  }, [showDeckMenu])

  // Prepare battlefield cards info for sync
  const battlefieldCardsInfo: BattlefieldCardInfo[] = useMemo(() => {
    return battlefield.map(card => ({
      id: card.uniqueId,
      name: card.name || 'Unknown',
      image: card.imageNormal || null,
      type: card.typeLine || '',
      tapped: card.tapped,
      counters: card.counters,
    }))
  }, [battlefield])

  // Prepare graveyard/exile cards info for sync
  const graveyardCardsInfo: ZoneCardInfo[] = useMemo(() => {
    return graveyard.map(card => ({
      name: card.name || 'Unknown',
      image: card.imageNormal || null,
      type: card.typeLine || '',
    }))
  }, [graveyard])

  const exileCardsInfo: ZoneCardInfo[] = useMemo(() => {
    return exile.map(card => ({
      name: card.name || 'Unknown',
      image: card.imageNormal || null,
      type: card.typeLine || '',
    }))
  }, [exile])

  // Sync stats to server with debounce (only when values actually change)
  useEffect(() => {
    if (gamePhase !== 'playing' || !gameInitialized || inMulliganScreen) return

    // Include battlefield state in sync key
    const bfKey = battlefield.map(c => `${c.uniqueId}:${c.tapped}:${c.counters.plusOne}:${c.counters.minusOne}:${c.counters.genericCounters.map(g => `${g.label}=${g.count}`).join(';')}`).join(',')
    const gyKey = graveyard.map(c => c.name).join(',')
    const exKey = exile.map(c => c.name).join(',')
    const syncKey = `${life}-${manaPool}-${poisonCounters}-${hand.length}-${library.length}-${graveyard.length}-${exile.length}-${battlefield.length}-${bfKey}-${gyKey}-${exKey}`

    if (syncKey === lastSyncRef.current) return
    lastSyncRef.current = syncKey

    const timer = setTimeout(() => {
      onUpdateStatsRef.current({
        life,
        manaPool,
        poisonCounters,
        handCount: hand.length,
        libraryCount: library.length,
        graveyardCount: graveyard.length,
        exileCount: exile.length,
        battlefieldCount: battlefield.length,
        battlefieldCards: battlefieldCardsInfo,
        graveyardCards: graveyardCardsInfo,
        exileCards: exileCardsInfo,
        isEliminated: life <= 0 || poisonCounters >= 10,
      })
    }, 300) // Debounce 300ms

    return () => clearTimeout(timer)
  }, [life, manaPool, poisonCounters, hand.length, library.length, graveyard.length, exile.length, battlefield, battlefieldCardsInfo, graveyardCardsInfo, exileCardsInfo, gamePhase, gameInitialized, inMulliganScreen])

  // Draw card
  const draw = useCallback((count: number = 1) => {
    if (library.length === 0) return
    const drawCount = Math.min(count, library.length)
    const drawnCards = library.slice(0, drawCount)
    setHand(prev => [...prev, ...drawnCards])
    setLibrary(prev => prev.slice(drawCount))
  }, [library])

  // Play card from hand
  const playCard = useCallback((index: number) => {
    const card = hand[index]
    if (!card) return
    const newHand = hand.filter((_, i) => i !== index)
    const battlefieldCard: BattlefieldCard = {
      ...card,
      uniqueId: generateUniqueId(),
      tapped: false,
      counters: { plusOne: 0, minusOne: 0, genericCounters: [] },
    }
    setHand(newHand)
    setBattlefield(prev => [...prev, battlefieldCard])
    if (isLand(card)) {
      setManaPool(m => m + 1)
    }
    recordAction(card, 'play')
  }, [hand, recordAction])

  // Discard card
  const discardCard = useCallback((index: number) => {
    const card = hand[index]
    if (!card) return
    setHand(prev => prev.filter((_, i) => i !== index))
    setGraveyard(prev => [card, ...prev])
    recordAction(card, 'discard')
  }, [hand, recordAction])

  // Toggle tap
  const toggleTap = useCallback((uniqueId: string) => {
    setBattlefield(prev => prev.map(card =>
      card.uniqueId === uniqueId ? { ...card, tapped: !card.tapped } : card
    ))
  }, [])

  // Send to graveyard from battlefield
  const sendToGraveyard = useCallback((uniqueId: string) => {
    const card = battlefield.find(c => c.uniqueId === uniqueId)
    if (!card) return
    setBattlefield(prev => prev.filter(c => c.uniqueId !== uniqueId))
    setGraveyard(prev => [card, ...prev])
    recordAction(card, 'destroy')
  }, [battlefield, recordAction])

  // Bounce to hand
  const bounceToHand = useCallback((uniqueId: string) => {
    const card = battlefield.find(c => c.uniqueId === uniqueId)
    if (!card) return
    setBattlefield(prev => prev.filter(c => c.uniqueId !== uniqueId))
    setHand(prev => [...prev, card])
    recordAction(card, 'bounce')
  }, [battlefield, recordAction])

  // Graveyard to hand
  const graveyardToHand = useCallback((index: number) => {
    const card = graveyard[index]
    if (!card) return
    setGraveyard(prev => prev.filter((_, i) => i !== index))
    setHand(prev => [...prev, card])
  }, [graveyard])

  // Graveyard to battlefield
  const graveyardToBattlefield = useCallback((index: number) => {
    const card = graveyard[index]
    if (!card) return
    const battlefieldCard: BattlefieldCard = {
      ...card,
      uniqueId: generateUniqueId(),
      tapped: false,
      counters: { plusOne: 0, minusOne: 0, genericCounters: [] },
    }
    setGraveyard(prev => prev.filter((_, i) => i !== index))
    setBattlefield(prev => [...prev, battlefieldCard])
  }, [graveyard])

  // Start of turn - untap all, reset mana, draw
  const handleStartTurn = useCallback(() => {
    setBattlefield(prev => prev.map(card => ({ ...card, tapped: false })))
    const landCount = battlefield.filter(c => isLand(c)).length
    setManaPool(landCount)
    draw(1)
  }, [battlefield, draw])

  // End turn - pass to next player
  const handleEndTurn = useCallback(() => {
    onNextTurn()
  }, [onNextTurn])

  // Mill top card (library → graveyard)
  const mill = useCallback((count: number = 1) => {
    if (library.length === 0) return
    const millCount = Math.min(count, library.length)
    const milledCards = library.slice(0, millCount)
    setGraveyard(prev => [...milledCards, ...prev])
    setLibrary(prev => prev.slice(millCount))
  }, [library])

  // Exile top card
  const exileTop = useCallback((count: number = 1) => {
    if (library.length === 0) return
    const exileCount = Math.min(count, library.length)
    const exiledCards = library.slice(0, exileCount)
    setExile(prev => [...exiledCards, ...prev])
    setLibrary(prev => prev.slice(exileCount))
  }, [library])

  // Shuffle library
  const shuffleLibrary = useCallback(() => {
    setLibrary(prev => shuffleArray(prev))
  }, [])

  // Start scry: extract top N cards from library into scryCards
  const startScry = useCallback((count: number) => {
    const n = Math.min(count, library.length)
    const cards = library.slice(0, n).map((card, i) => ({ card, originalIndex: i }))
    setScryCards(cards)
    setScryCount(count)
    setShowScry(true)
    // Remove scried cards from library temporarily
    setLibrary(prev => prev.slice(n))
  }, [library])

  // Scry: put card on top of library, remove from scry list
  const scryPutTop = useCallback((scryIndex: number) => {
    const entry = scryCards[scryIndex]
    if (!entry) return
    setLibrary(prev => [entry.card, ...prev])
    const remaining = scryCards.filter((_, i) => i !== scryIndex)
    if (remaining.length === 0) {
      setShowScry(false)
      setScryCards([])
    } else {
      setScryCards(remaining)
    }
  }, [scryCards])

  // Scry: put card on bottom of library, remove from scry list
  const scryPutBottom = useCallback((scryIndex: number) => {
    const entry = scryCards[scryIndex]
    if (!entry) return
    setLibrary(prev => [...prev, entry.card])
    const remaining = scryCards.filter((_, i) => i !== scryIndex)
    if (remaining.length === 0) {
      setShowScry(false)
      setScryCards([])
    } else {
      setScryCards(remaining)
    }
  }, [scryCards])

  // Deck search (tutor): toggle card selection
  const toggleDeckSearchSelection = useCallback((index: number) => {
    setDeckSearchSelected(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  // Deck search: put selected cards on top of library and shuffle the rest
  const deckSearchToTop = useCallback(() => {
    if (deckSearchSelected.size === 0) return
    const selected: CardWithPrice[] = []
    const remaining: CardWithPrice[] = []
    library.forEach((card, i) => {
      if (deckSearchSelected.has(i)) {
        selected.push(card)
      } else {
        remaining.push(card)
      }
    })
    setLibrary([...selected, ...shuffleArray(remaining)])
    setShowDeckSearch(false)
    setDeckSearchQuery('')
    setDeckSearchSelected(new Set())
  }, [library, deckSearchSelected])

  // Deck search: put selected cards in hand and shuffle the rest
  const deckSearchToHand = useCallback(() => {
    if (deckSearchSelected.size === 0) return
    const selected: CardWithPrice[] = []
    const remaining: CardWithPrice[] = []
    library.forEach((card, i) => {
      if (deckSearchSelected.has(i)) {
        selected.push(card)
      } else {
        remaining.push(card)
      }
    })
    setHand(prev => [...prev, ...selected])
    setLibrary(shuffleArray(remaining))
    setShowDeckSearch(false)
    setDeckSearchQuery('')
    setDeckSearchSelected(new Set())
  }, [library, deckSearchSelected])

  // Exile from hand
  const exileFromHand = useCallback((index: number) => {
    const card = hand[index]
    if (!card) return
    setHand(prev => prev.filter((_, i) => i !== index))
    setExile(prev => [card, ...prev])
  }, [hand])

  // Exile from battlefield
  const exileFromBattlefield = useCallback((uniqueId: string) => {
    const card = battlefield.find(c => c.uniqueId === uniqueId)
    if (!card) return
    setBattlefield(prev => prev.filter(c => c.uniqueId !== uniqueId))
    setExile(prev => [card, ...prev])
  }, [battlefield])

  // Exile to hand
  const exileToHand = useCallback((index: number) => {
    const card = exile[index]
    if (!card) return
    setExile(prev => prev.filter((_, i) => i !== index))
    setHand(prev => [...prev, card])
  }, [exile])

  // Exile to battlefield
  const exileToBattlefield = useCallback((index: number) => {
    const card = exile[index]
    if (!card) return
    const battlefieldCard: BattlefieldCard = {
      ...card,
      uniqueId: generateUniqueId(),
      tapped: false,
      counters: { plusOne: 0, minusOne: 0, genericCounters: [] },
    }
    setExile(prev => prev.filter((_, i) => i !== index))
    setBattlefield(prev => [...prev, battlefieldCard])
  }, [exile])

  // Adjust life
  const adjustLife = (amount: number) => setLife(l => l + amount)

  // Adjust poison
  const adjustPoison = (amount: number) => setPoisonCounters(p => Math.max(0, p + amount))

  // Adjust +1/+1 or -1/-1 counter on a battlefield card
  const adjustCounter = useCallback((uniqueId: string, type: 'plusOne' | 'minusOne', delta: number) => {
    setBattlefield(prev => prev.map(card =>
      card.uniqueId === uniqueId
        ? { ...card, counters: { ...card.counters, [type]: Math.max(0, card.counters[type] + delta) } }
        : card
    ))
  }, [])

  // Open popup to add a named generic counter
  const openGenericCounterPopup = useCallback((uniqueId: string) => {
    setGenericCounterPopup({ uniqueId })
    setGenericCounterLabel('')
    setTimeout(() => genericCounterInputRef.current?.focus(), 50)
  }, [])

  // Confirm adding generic counter
  const confirmGenericCounter = useCallback(() => {
    if (!genericCounterPopup || !genericCounterLabel.trim()) return
    const label = genericCounterLabel.trim()
    setBattlefield(prev => prev.map(card => {
      if (card.uniqueId !== genericCounterPopup.uniqueId) return card
      const existing = card.counters.genericCounters.find(c => c.label === label)
      if (existing) {
        return {
          ...card,
          counters: {
            ...card.counters,
            genericCounters: card.counters.genericCounters.map(c =>
              c.label === label ? { ...c, count: c.count + 1 } : c
            ),
          },
        }
      }
      return {
        ...card,
        counters: {
          ...card.counters,
          genericCounters: [...card.counters.genericCounters, { label, count: 1 }],
        },
      }
    }))
    setGenericCounterPopup(null)
    setGenericCounterLabel('')
  }, [genericCounterPopup, genericCounterLabel])

  // Adjust existing generic counter
  const adjustGenericCounter = useCallback((uniqueId: string, label: string, delta: number) => {
    setBattlefield(prev => prev.map(card => {
      if (card.uniqueId !== uniqueId) return card
      const updatedGeneric = card.counters.genericCounters
        .map(c => c.label === label ? { ...c, count: c.count + delta } : c)
        .filter(c => c.count > 0)
      return { ...card, counters: { ...card.counters, genericCounters: updatedGeneric } }
    }))
  }, [])

  // Remove generic counter entirely
  const removeGenericCounter = useCallback((uniqueId: string, label: string) => {
    setBattlefield(prev => prev.map(card => {
      if (card.uniqueId !== uniqueId) return card
      return {
        ...card,
        counters: {
          ...card.counters,
          genericCounters: card.counters.genericCounters.filter(c => c.label !== label),
        },
      }
    }))
  }, [])

  // Battlefield separated
  // Categorize battlefield cards
  const battlefieldLands = battlefield.filter(c => isLand(c))
  const battlefieldCreatures = battlefield.filter(c => isCreature(c) && !isLand(c))
  const battlefieldEnchantments = battlefield.filter(c => {
    const type = (c.typeLine || '').toLowerCase()
    return (type.includes('enchantment') || type.includes('artifact') || type.includes('planeswalker')) 
           && !type.includes('creature') && !type.includes('land')
  })
  const battlefieldOther = battlefield.filter(c => {
    const type = (c.typeLine || '').toLowerCase()
    return !type.includes('land') && !type.includes('creature') && 
           !type.includes('enchantment') && !type.includes('artifact') && !type.includes('planeswalker')
  })

  // Safety check
  if (!currentPlayer) {
    return (
      <div className="card-frame p-6 text-center">
        <p className="text-dragon-400">Error: player not found</p>
      </div>
    )
  }

  // ========== LOBBY PHASE ==========
  if (gamePhase === 'lobby') {
    return (
      <div className="space-y-6">
        {/* Countdown overlay */}
        <AnimatePresence>
          {countdown !== null && countdown > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-dungeon-900/90 flex items-center justify-center"
            >
              <motion.div
                key={countdown}
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="text-9xl font-medieval text-gold-400"
              >
                {countdown}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Players status */}
        <div className="grid gap-4">
          {players.map((player) => (
            <div
              key={player.id}
              className={cn(
                "card-frame p-4 flex items-center justify-between transition-all",
                player.isReady && "ring-2 ring-emerald-500/50"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: player.color }}
                >
                  {player.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-parchment-200 flex items-center gap-2">
                    {player.name}
                    {player.id === playerId && (
                      <span className="text-xs text-arcane-400">(you)</span>
                    )}
                  </p>
                  {player.deckName ? (
                    <p className="text-sm text-parchment-500">{player.deckName}</p>
                  ) : (
                    <p className="text-sm text-parchment-600 italic">No deck</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {player.isReady ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">
                    <Check className="w-4 h-4" />
                    Ready
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-dungeon-700 text-parchment-500 rounded-full text-sm">
                    <Clock className="w-4 h-4" />
                    Waiting
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Ready button */}
        <div className="text-center">
          {currentPlayer.isReady ? (
            <Button
              variant="outline"
              size="lg"
              onClick={() => onSetReady(false)}
              className="min-w-[200px]"
            >
              Cancel
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => onSetReady(true)}
              className="min-w-[200px]"
            >
              <Check className="w-5 h-5 mr-2" />
              I'm ready!
            </Button>
          )}
          
          {!allPlayersReady && (
            <p className="text-parchment-500 text-sm mt-3">
              Waiting for all players to be ready...
            </p>
          )}
        </div>
      </div>
    )
  }

  // ========== MULLIGAN SCREEN ==========
  if (inMulliganScreen && gameInitialized) {
    return (
      <div className="fixed inset-0 z-50 bg-dungeon-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-3xl w-full space-y-6">
          <div className="text-center">
            <h2 className="font-medieval text-3xl text-gold-400 mb-2">
              {mulliganPhase === 'choosing' ? 'Opening Hand' : 'Select Cards for Bottom'}
            </h2>
            <p className="text-parchment-400">
              {mulliganPhase === 'choosing' ? (
                mulliganCount === 0
                  ? 'Your opening hand of 7 cards. Keep or mulligan?'
                  : `Mulligan #${mulliganCount} — Draw 7, will keep ${7 - mulliganCount}`
              ) : (
                <>
                  Select <strong className="text-gold-400">{mulliganCount}</strong> card{mulliganCount > 1 ? 's' : ''} to put on the bottom of your library
                  <span className="text-parchment-500 ml-2">
                    ({selectedHandIndices.size}/{mulliganCount})
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Hand display - large cards */}
          <div className="flex flex-wrap gap-3 justify-center min-h-[220px]">
            <AnimatePresence mode="popLayout">
              {hand.map((card, index) => {
                const isSelected = selectedHandIndices.has(index)
                return (
                  <motion.div
                    key={`mulligan-${card?.id || index}-${index}`}
                    layout
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{
                      opacity: 1,
                      scale: isSelected ? 0.95 : 1,
                      y: isSelected ? 8 : 0
                    }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={cn(
                      "relative cursor-pointer transition-all",
                      mulliganPhase === 'selecting-bottom' && "hover:ring-2 hover:ring-gold-400/50 rounded-lg",
                      isSelected && "ring-2 ring-dragon-500 rounded-lg opacity-60"
                    )}
                    onClick={() => {
                      if (mulliganPhase === 'selecting-bottom') {
                        toggleMulliganSelection(index)
                      }
                    }}
                  >
                    <div className="w-[120px] h-[168px] rounded-lg overflow-hidden relative">
                      {card?.imageNormal ? (
                        <Image src={card.imageNormal} alt={card.name || 'Card'} fill className="object-cover" sizes="120px" />
                      ) : (
                        <div className="w-full h-full bg-dungeon-800 flex items-center justify-center p-2 border border-dungeon-600 rounded-lg">
                          <span className="text-xs text-center text-parchment-500">{card?.name || 'Card'}</span>
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-dragon-900/40 rounded-lg">
                        <ArrowDown className="w-8 h-8 text-dragon-400" />
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-4">
            {mulliganPhase === 'choosing' && (
              <>
                <Button size="lg" onClick={keepHand} className="min-w-[140px]">
                  <Check className="w-5 h-5 mr-2" />
                  Keep
                </Button>
                {mulliganCount < 2 && (
                  <Button variant="outline" size="lg" onClick={doMulligan} className="min-w-[140px]">
                    <Shuffle className="w-5 h-5 mr-2" />
                    Mulligan
                  </Button>
                )}
              </>
            )}
            {mulliganPhase === 'selecting-bottom' && selectedHandIndices.size === mulliganCount && (
              <Button size="lg" onClick={putOnBottom} className="min-w-[200px]">
                <ArrowDown className="w-5 h-5 mr-2" />
                Put on bottom and start
              </Button>
            )}
          </div>

          {/* Mulligan counter */}
          {mulliganCount > 0 && mulliganPhase === 'choosing' && (
            <p className="text-center text-sm text-parchment-500">
              Mulligan {mulliganCount}/2 — Will keep {7 - mulliganCount} cards
            </p>
          )}
        </div>
      </div>
    )
  }

  // ========== PLAYING PHASE ==========
  return (
    <HoverPreviewProvider>
    <div ref={gameContainerRef} className={cn(
      "flex gap-4",
      isFullscreen && "fixed inset-0 z-[100] bg-dungeon-950 p-4 overflow-auto"
    )}>
      {/* Fullscreen toggle button */}
      <button
        onClick={toggleFullscreen}
        className="fixed top-3 right-3 z-[110] p-2 bg-dungeon-800/90 hover:bg-dungeon-700 text-parchment-400 hover:text-parchment-200 rounded-lg border border-dungeon-600 transition-colors"
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
      </button>

      {/* Main game area */}
      <div className="flex-1 flex flex-col min-h-[calc(100vh-200px)]">
      {/* ===== OPPONENT ZONE (TOP) — MTG Arena style ===== */}
      <div className="flex-shrink-0 pb-1">
        {opponents.map((opponent) => {
          const oppCards = opponent.battlefieldCards || []
          const opponentLands = oppCards.filter(c => c.type.toLowerCase().includes('land'))
          const opponentCreatures = oppCards.filter(c => c.type.toLowerCase().includes('creature') && !c.type.toLowerCase().includes('land'))
          const opponentOther = oppCards.filter(c => !c.type.toLowerCase().includes('land') && !c.type.toLowerCase().includes('creature'))

          return (
          <div key={opponent.id} className={cn(
            "rounded-lg overflow-hidden",
            opponent.isEliminated && "opacity-40"
          )}>
            {/* Opponent info bar — always visible */}
            <div className={cn(
              "flex items-center justify-between px-3 py-1.5",
              opponent.id === activePlayerId ? "bg-gold-500/20 border-b-2 border-gold-500/40 shadow-[0_2px_8px_rgba(234,179,8,0.15)]" : "bg-dungeon-800/60 border-b border-dungeon-700"
            )}>
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md"
                  style={{ backgroundColor: opponent.color }}
                >
                  {opponent.name[0].toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-parchment-200 font-medium leading-tight flex items-center gap-1.5">
                    {opponent.name}
                    {opponent.id === activePlayerId && (
                      <span className="text-[10px] bg-gold-500/30 text-gold-400 px-2 py-0.5 rounded-full font-bold animate-pulse">⚔️ TURN</span>
                    )}
                    {opponent.isEliminated && <Skull className="w-3.5 h-3.5 text-dragon-400" />}
                  </span>
                  {opponent.deckName && (
                    <span className="text-[10px] text-parchment-500 leading-tight">{opponent.deckName}</span>
                  )}
                </div>
              </div>

              {/* Stats — like Arena top bar */}
              <div className="flex items-center gap-2">
                {/* Life */}
                <div className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-bold",
                  opponent.life <= 5 ? "bg-dragon-500/20 text-dragon-400" : "bg-dungeon-700/80 text-parchment-200"
                )}>
                  <Heart className="w-3.5 h-3.5 text-dragon-400" />
                  {opponent.life}
                </div>
                {/* Poison */}
                {opponent.poisonCounters > 0 && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-bold bg-emerald-500/20 text-emerald-400">
                    ☠ {opponent.poisonCounters}
                  </div>
                )}
                {/* Zone counts */}
                <div className="flex items-center gap-1.5 text-[11px] text-parchment-500">
                  <span title="Hand">✋{opponent.handCount}</span>
                  <span className="text-dungeon-600">|</span>
                  <span title="Library">📚{opponent.libraryCount}</span>
                  <span className="text-dungeon-600">|</span>
                  <button
                    onClick={() => opponent.graveyardCount > 0 && setViewingOpponentGraveyard(opponent.id)}
                    className={cn("hover:text-gold-400 transition-colors", opponent.graveyardCount > 0 && "cursor-pointer underline decoration-dotted")}
                    title="View graveyard"
                  >
                    🪦{opponent.graveyardCount}
                  </button>
                  {(opponent.exileCount ?? 0) > 0 && (
                    <>
                      <span className="text-dungeon-600">|</span>
                      <button
                        onClick={() => setViewingOpponentExile(opponent.id)}
                        className="hover:text-gold-400 transition-colors cursor-pointer underline decoration-dotted"
                        title="View exile"
                      >
                        ⛓{opponent.exileCount}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Opponent battlefield — Arena-style with zones */}
            <div className={cn(
              "min-h-[60px] px-2 py-1",
              opponent.id === activePlayerId ? "bg-gold-500/5" : "bg-dungeon-900/30"
            )}>
              {oppCards.length === 0 ? (
                <div className="flex items-center justify-center py-3 text-parchment-700 text-xs italic">
                  No permanents
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Row 1: Lands (far from center = their bottom) */}
                  {opponentLands.length > 0 && (
                    <div>
                      <div className="text-[8px] text-parchment-700 uppercase tracking-wider mb-0.5 text-center">Lands</div>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {opponentLands.map((card) => (
                          <OpponentBattlefieldCard key={card.id} card={card} small={true} onSelect={() => setPreviewCard({ name: card.name, image: card.image, type: card.type })} />
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Row 2: Enchantments/Artifacts (left = their right) + Creatures (center/right) */}
                  {(opponentOther.length > 0 || opponentCreatures.length > 0) && (
                    <div className="flex gap-2">
                      {/* Enchantments/Artifacts on left (mirrored = their right) */}
                      {opponentOther.length > 0 && (
                        <div className="flex-shrink-0 border-r border-dungeon-700/50 pr-2">
                          <div className="text-[8px] text-parchment-700 uppercase tracking-wider mb-0.5">Enchant / Artifacts</div>
                          <div className="flex flex-col gap-1">
                            {opponentOther.map((card) => (
                              <OpponentBattlefieldCard key={card.id} card={card} small={false} onSelect={() => setPreviewCard({ name: card.name, image: card.image, type: card.type })} />
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Creatures (closest to center = combat zone) */}
                      {opponentCreatures.length > 0 && (
                        <div className="flex-1">
                          <div className="text-[8px] text-parchment-700 uppercase tracking-wider mb-0.5 text-center">Creatures</div>
                          <div className="flex flex-wrap gap-1.5 justify-center">
                            {opponentCreatures.map((card) => (
                              <OpponentBattlefieldCard key={card.id} card={card} small={false} onSelect={() => setPreviewCard({ name: card.name, image: card.image, type: card.type })} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          )
        })}
      </div>

      {/* ===== CENTER DIVIDER — Arena style ===== */}
      <div className="flex items-center justify-center py-1 relative">
        <div className={cn(
          "flex-1 h-px bg-gradient-to-r from-transparent to-transparent",
          isMyTurn ? "via-gold-500/60" : "via-dungeon-500"
        )} />
        <div className={cn(
          "mx-3 rounded-full font-medium border",
          isMyTurn
            ? "px-4 py-1 text-sm bg-gold-500/20 text-gold-400 border-gold-500/40 animate-pulse shadow-[0_0_12px_rgba(234,179,8,0.3)]"
            : "px-3 py-0.5 text-xs bg-dungeon-800 text-parchment-500 border-dungeon-600"
        )}>
          {isMyTurn ? `⚔️ Turn ${currentTurn} — Your turn` : `Turn ${currentTurn} — Waiting...`}
        </div>
        <div className={cn(
          "flex-1 h-px bg-gradient-to-r from-transparent to-transparent",
          isMyTurn ? "via-gold-500/60" : "via-dungeon-500"
        )} />
      </div>

      {/* ===== MY BATTLEFIELD (MIDDLE) - Zone Layout ===== */}
      <div className="flex-1 space-y-1">
        {/* My battlefield */}
        {fullDeck.length > 0 && battlefield.length > 0 && (
          <div className="p-2 space-y-1">
            {/* Top area: Creatures (left) + Enchantments/Artifacts (right) */}
            {(battlefieldCreatures.length > 0 || battlefieldEnchantments.length > 0 || battlefieldOther.length > 0) && (
              <div className="flex gap-2">
                {/* Creatures zone - takes remaining space */}
                <div className="flex-1 min-h-[40px]">
                  {battlefieldCreatures.length > 0 && (
                    <div>
                      <div className="text-[9px] text-parchment-600 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                        <Swords className="w-2.5 h-2.5" />
                        Creatures
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {battlefieldCreatures.map((card) => (
                          <BattlefieldCardMini
                            key={card.uniqueId}
                            card={card}
                            onTap={() => toggleTap(card.uniqueId)}
                            onGraveyard={() => sendToGraveyard(card.uniqueId)}
                            onBounce={() => bounceToHand(card.uniqueId)}
                            onExile={() => exileFromBattlefield(card.uniqueId)}
                            onAdjustCounter={(type, delta) => adjustCounter(card.uniqueId, type, delta)}
                            onAddGenericCounter={() => openGenericCounterPopup(card.uniqueId)}
                            onAdjustGenericCounter={(label, delta) => adjustGenericCounter(card.uniqueId, label, delta)}
                            onRemoveGenericCounter={(label) => removeGenericCounter(card.uniqueId, label)}
                            onSelect={() => setPreviewCard({ name: card.printedName || card.name, image: card.imageNormal ?? null, type: card.typeLine })}
                            larger
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Other non-categorized cards inline with creatures if any */}
                  {battlefieldOther.length > 0 && (
                    <div className={battlefieldCreatures.length > 0 ? "mt-1" : ""}>
                      <div className="text-[9px] text-parchment-600 uppercase tracking-wider mb-0.5">Other</div>
                      <div className="flex flex-wrap gap-1.5">
                        {battlefieldOther.map((card) => (
                          <BattlefieldCardMini
                            key={card.uniqueId}
                            card={card}
                            onTap={() => toggleTap(card.uniqueId)}
                            onGraveyard={() => sendToGraveyard(card.uniqueId)}
                            onBounce={() => bounceToHand(card.uniqueId)}
                            onExile={() => exileFromBattlefield(card.uniqueId)}
                            onAdjustCounter={(type, delta) => adjustCounter(card.uniqueId, type, delta)}
                            onAddGenericCounter={() => openGenericCounterPopup(card.uniqueId)}
                            onAdjustGenericCounter={(label, delta) => adjustGenericCounter(card.uniqueId, label, delta)}
                            onRemoveGenericCounter={(label) => removeGenericCounter(card.uniqueId, label)}
                            onSelect={() => setPreviewCard({ name: card.printedName || card.name, image: card.imageNormal ?? null, type: card.typeLine })}
                            larger
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Enchantments/Artifacts zone - right side */}
                {battlefieldEnchantments.length > 0 && (
                  <div className="flex-shrink-0 border-l border-dungeon-700/50 pl-2">
                    <div className="text-[9px] text-parchment-600 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      Enchant / Artifacts
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {battlefieldEnchantments.map((card) => (
                        <BattlefieldCardMini
                          key={card.uniqueId}
                          card={card}
                          onTap={() => toggleTap(card.uniqueId)}
                          onGraveyard={() => sendToGraveyard(card.uniqueId)}
                          onBounce={() => bounceToHand(card.uniqueId)}
                          onExile={() => exileFromBattlefield(card.uniqueId)}
                          onAdjustCounter={(type, delta) => adjustCounter(card.uniqueId, type, delta)}
                          onAddGenericCounter={() => openGenericCounterPopup(card.uniqueId)}
                          onAdjustGenericCounter={(label, delta) => adjustGenericCounter(card.uniqueId, label, delta)}
                          onRemoveGenericCounter={(label) => removeGenericCounter(card.uniqueId, label)}
                          onSelect={() => setPreviewCard({ name: card.printedName || card.name, image: card.imageNormal ?? null, type: card.typeLine })}
                          larger
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Lands zone - bottom, closest to player */}
            {battlefieldLands.length > 0 && (
              <div>
                <div className="text-[9px] text-parchment-600 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                  <Mountain className="w-2.5 h-2.5" />
                  Lands
                </div>
                <div className="flex flex-wrap gap-1">
                  {battlefieldLands.map((card) => (
                    <BattlefieldCardMini
                      key={card.uniqueId}
                      card={card}
                      onTap={() => toggleTap(card.uniqueId)}
                      onGraveyard={() => sendToGraveyard(card.uniqueId)}
                      onBounce={() => bounceToHand(card.uniqueId)}
                      onExile={() => exileFromBattlefield(card.uniqueId)}
                      onAdjustCounter={(type, delta) => adjustCounter(card.uniqueId, type, delta)}
                      onAddGenericCounter={() => openGenericCounterPopup(card.uniqueId)}
                      onAdjustGenericCounter={(label, delta) => adjustGenericCounter(card.uniqueId, label, delta)}
                      onRemoveGenericCounter={(label) => removeGenericCounter(card.uniqueId, label)}
                      onSelect={() => setPreviewCard({ name: card.printedName || card.name, image: card.imageNormal ?? null, type: card.typeLine })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Library/Graveyard peek modals */}
        {showLibrary && fullDeck.length > 0 && (
          <div className="card-frame p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gold-400 flex items-center gap-2">
                <Library className="w-4 h-4" />
                Library ({library.length}) - Top 20
              </h3>
              <button onClick={() => setShowLibrary(false)} className="text-parchment-400 hover:text-parchment-200">
                <EyeOff className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto">
              {library.slice(0, 20).map((card, index) => (
                <WithHoverPreview key={`lib-${index}`} card={{ name: card?.printedName || card?.name || '', image: card?.imageNormal || null, type: card?.typeLine }}>
                  <div className="relative w-[60px] h-[84px] rounded-lg overflow-hidden opacity-60 hover:opacity-100 transition-opacity border border-dungeon-600 hover:border-arcane-500/50 cursor-pointer shadow-sm">
                    {card?.imageNormal ? (
                      <Image src={card.imageNormal} alt={card.name || ''} fill className="object-cover" sizes="60px" />
                    ) : (
                      <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-1">
                        <span className="text-[7px] text-parchment-400 text-center">{card?.name || ''}</span>
                      </div>
                    )}
                    <div className="absolute top-0 left-0 px-1.5 py-0.5 bg-dungeon-900/90 text-[9px] text-parchment-400 font-medium rounded-br">{index + 1}</div>
                  </div>
                </WithHoverPreview>
              ))}
            </div>
          </div>
        )}

        {showGraveyard && graveyard.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dungeon-950/70 backdrop-blur-sm">
            <div className="max-w-2xl w-full mx-4 space-y-4">
              <div className="text-center">
                <h2 className="font-medieval text-2xl text-gold-400 flex items-center justify-center gap-2 mb-1">
                  <Trash2 className="w-5 h-5" />
                  Graveyard ({graveyard.length})
                </h2>
              </div>
              <div className="flex flex-wrap gap-3 justify-center max-h-[60vh] overflow-y-auto p-2">
                {graveyard.map((card, index) => (
                  <div key={`gy-${index}`} className="relative group">
                    <WithHoverPreview card={{ name: card?.printedName || card?.name || '', image: card?.imageNormal || null, type: card?.typeLine }}>
                      <div className="w-[100px] h-[140px] rounded-lg overflow-hidden opacity-80 group-hover:opacity-100 relative border border-dungeon-600 hover:border-gold-500/50 shadow-md hover:shadow-lg transition-all cursor-pointer">
                        {card?.imageNormal ? (
                          <Image src={card.imageNormal} alt={card.name || ''} fill className="object-cover" sizes="100px" />
                        ) : (
                          <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-2">
                            <span className="text-xs text-parchment-400 text-center">{card?.name || ''}</span>
                          </div>
                        )}
                      </div>
                    </WithHoverPreview>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                      <button onClick={() => graveyardToHand(index)} className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-md" title="Return to hand">
                        <Hand className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => graveyardToBattlefield(index)} className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-md" title="Put onto battlefield">
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center">
                <Button onClick={() => setShowGraveyard(false)} variant="outline" size="lg">
                  <Eye className="w-5 h-5 mr-2" />
                  Voir le champ de bataille
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Scry overlay */}
        {showScry && scryCards.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dungeon-950/70 backdrop-blur-sm">
            <div className="max-w-2xl w-full mx-4 space-y-4">
              <div className="text-center">
                <h2 className="font-medieval text-2xl text-gold-400 flex items-center justify-center gap-2 mb-1">
                  <Eye className="w-5 h-5" />
                  Scry {scryCount} — Top of library
                </h2>
                <p className="text-parchment-400 text-sm">
                  {scryCards.length > 1 ? `Choose where to put each card (${scryCards.length} remaining)` : 'Choose where to put this card'}
                </p>
              </div>
              <div className="flex flex-wrap gap-4 justify-center">
                <AnimatePresence mode="popLayout">
                {scryCards.map((entry, index) => (
                  <motion.div
                    key={`scry-${entry.originalIndex}`}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <WithHoverPreview card={{ name: entry.card?.printedName || entry.card?.name || '', image: entry.card?.imageNormal || null, type: entry.card?.typeLine }}>
                      <div className="w-[140px] h-[196px] rounded-lg overflow-hidden relative border-2 border-gold-500/40 shadow-lg">
                        {entry.card?.imageNormal ? (
                          <Image src={entry.card.imageNormal} alt={entry.card.name || ''} fill className="object-cover" sizes="140px" />
                        ) : (
                          <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-2">
                            <span className="text-sm text-parchment-400 text-center">{entry.card?.name || ''}</span>
                          </div>
                        )}
                      </div>
                    </WithHoverPreview>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => scryPutTop(index)}
                      >
                        <ChevronUp className="w-4 h-4 mr-1" />
                        Top
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => scryPutBottom(index)}
                      >
                        <ChevronDown className="w-4 h-4 mr-1" />
                        Bottom
                      </Button>
                    </div>
                  </motion.div>
                ))}
                </AnimatePresence>
              </div>
              <div className="text-center">
                <Button onClick={() => {
                  // Put remaining scry cards back on top
                  setLibrary(prev => [...scryCards.map(e => e.card), ...prev])
                  setScryCards([])
                  setShowScry(false)
                }} variant="outline" size="lg">
                  <Eye className="w-5 h-5 mr-2" />
                  Voir le champ de bataille
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Exile zone viewer */}
        {showExile && exile.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dungeon-950/70 backdrop-blur-sm">
            <div className="max-w-2xl w-full mx-4 space-y-4">
              <div className="text-center">
                <h2 className="font-medieval text-2xl text-gold-400 flex items-center justify-center gap-2 mb-1">
                  <EyeOff className="w-5 h-5" />
                  Exile ({exile.length})
                </h2>
              </div>
              <div className="flex flex-wrap gap-3 justify-center max-h-[60vh] overflow-y-auto p-2">
                {exile.map((card, index) => (
                  <div key={`exile-${index}`} className="relative group">
                    <WithHoverPreview card={{ name: card?.printedName || card?.name || '', image: card?.imageNormal || null, type: card?.typeLine }}>
                      <div className="w-[100px] h-[140px] rounded-lg overflow-hidden opacity-80 group-hover:opacity-100 relative border border-dungeon-600 hover:border-parchment-500/50 shadow-md hover:shadow-lg transition-all cursor-pointer">
                        {card?.imageNormal ? (
                          <Image src={card.imageNormal} alt={card.name || ''} fill className="object-cover" sizes="100px" />
                        ) : (
                          <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-2">
                            <span className="text-xs text-parchment-400 text-center">{card?.name || ''}</span>
                          </div>
                        )}
                      </div>
                    </WithHoverPreview>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                      <button onClick={() => exileToHand(index)} className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-md" title="Return to hand">
                        <Hand className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => exileToBattlefield(index)} className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-md" title="Put onto battlefield">
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center">
                <Button onClick={() => setShowExile(false)} variant="outline" size="lg">
                  <Eye className="w-5 h-5 mr-2" />
                  Voir le champ de bataille
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Deck search (tutor) modal */}
        {showDeckSearch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dungeon-950/70 backdrop-blur-sm">
            <div className="max-w-3xl w-full mx-4 space-y-4">
              <div className="text-center">
                <h2 className="font-medieval text-2xl text-gold-400 flex items-center justify-center gap-2 mb-1">
                  <Search className="w-5 h-5" />
                  Search Library ({library.length})
                </h2>
              </div>
              {/* Search input */}
              <div className="flex justify-center">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-parchment-500" />
                  <input
                    type="text"
                    value={deckSearchQuery}
                    onChange={(e) => setDeckSearchQuery(e.target.value)}
                    placeholder="Search by name or type..."
                    className="w-full pl-10 pr-4 py-2 bg-dungeon-800 border border-dungeon-600 rounded-lg text-parchment-200 placeholder-parchment-600 focus:outline-none focus:border-gold-500/50 text-sm"
                    autoFocus
                  />
                </div>
              </div>
              {/* Selected count */}
              {deckSearchSelected.size > 0 && (
                <p className="text-center text-sm text-gold-400">
                  {deckSearchSelected.size} card{deckSearchSelected.size > 1 ? 's' : ''} selected
                </p>
              )}
              {/* Cards grid */}
              <div className="flex flex-wrap gap-2 justify-center max-h-[50vh] overflow-y-auto p-2">
                {library
                  .map((card, index) => ({ card, index }))
                  .filter(({ card }) => {
                    if (!deckSearchQuery.trim()) return true
                    const q = deckSearchQuery.toLowerCase()
                    return (card.name || '').toLowerCase().includes(q)
                      || (card.printedName || '').toLowerCase().includes(q)
                      || (card.typeLine || '').toLowerCase().includes(q)
                  })
                  .map(({ card, index }) => {
                    const isSelected = deckSearchSelected.has(index)
                    return (
                      <div key={`search-${index}`} className="relative">
                        <WithHoverPreview card={{ name: card?.printedName || card?.name || '', image: card?.imageNormal || null, type: card?.typeLine }}>
                          <button
                            onClick={() => toggleDeckSearchSelection(index)}
                            className={cn(
                              "w-[80px] h-[112px] rounded-lg overflow-hidden relative border-2 shadow-sm transition-all cursor-pointer",
                              isSelected
                                ? "border-gold-400 ring-2 ring-gold-400/30 scale-105"
                                : "border-dungeon-600 hover:border-parchment-500/50 opacity-80 hover:opacity-100"
                            )}
                          >
                            {card?.imageNormal ? (
                              <Image src={card.imageNormal} alt={card.name || ''} fill className="object-cover" sizes="80px" />
                            ) : (
                              <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-1">
                                <span className="text-[8px] text-parchment-400 text-center">{card?.name || ''}</span>
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute inset-0 bg-gold-500/20 flex items-center justify-center">
                                <Check className="w-6 h-6 text-gold-400 drop-shadow-lg" />
                              </div>
                            )}
                          </button>
                        </WithHoverPreview>
                      </div>
                    )
                  })}
              </div>
              {/* Action buttons */}
              <div className="flex items-center justify-center gap-3">
                <Button
                  onClick={deckSearchToTop}
                  disabled={deckSearchSelected.size === 0}
                  size="lg"
                >
                  <ChevronUp className="w-5 h-5 mr-2" />
                  Top of library
                </Button>
                <Button
                  onClick={deckSearchToHand}
                  disabled={deckSearchSelected.size === 0}
                  variant="outline"
                  size="lg"
                >
                  <Hand className="w-5 h-5 mr-2" />
                  To hand
                </Button>
              </div>
              <div className="text-center">
                <Button onClick={() => { setShowDeckSearch(false); shuffleLibrary() }} variant="outline" size="sm" className="text-parchment-500">
                  <Eye className="w-4 h-4 mr-1" />
                  Voir le champ de bataille
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== MY ZONE (BOTTOM - STICKY) - Clean ===== */}
      <div className={cn(
        "flex-shrink-0 mt-auto pt-2 sticky bottom-0 bg-dungeon-900/95 backdrop-blur-sm pb-1",
        isMyTurn && "border-t-2 border-gold-500/60 shadow-[0_-4px_12px_rgba(234,179,8,0.15)]"
      )}>
        {/* Compact stats bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 mb-1">
          {/* Life */}
          <div className="flex items-center gap-1">
            <button onClick={() => adjustLife(-1)} className="p-1 text-dragon-400 active:scale-90">
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-2xl font-bold text-parchment-200 min-w-[3ch] text-center">{life}</span>
            <button onClick={() => adjustLife(1)} className="p-1 text-emerald-400 active:scale-90">
              <Plus className="w-4 h-4" />
            </button>
            <div className="flex gap-0.5 ml-1">
              <button onClick={() => adjustLife(-5)} className="px-1 py-0.5 text-[10px] text-dragon-400 active:bg-dragon-500/20 rounded">-5</button>
              <button onClick={() => adjustLife(5)} className="px-1 py-0.5 text-[10px] text-emerald-400 active:bg-emerald-500/20 rounded">+5</button>
            </div>
          </div>

          {/* Poison */}
          {poisonCounters > 0 && (
            <span className="text-emerald-400 font-bold text-sm">{poisonCounters}☠</span>
          )}

          {/* Zone counters + Deck menu */}
          <div className="flex items-center gap-2">
            {fullDeck.length > 0 && (
              <>
                <button onClick={() => setShowGraveyard(!showGraveyard)} className="text-xs text-parchment-400 hover:text-parchment-200 transition-colors">
                  🪦{graveyard.length}
                </button>
                <button onClick={() => setShowExile(!showExile)} className="text-xs text-parchment-400 hover:text-parchment-200 transition-colors">
                  ⛓{exile.length}
                </button>
              </>
            )}
            {isMyTurn && <span className="text-[10px] text-gold-400 font-bold animate-pulse">YOUR TURN</span>}

            {/* Library card-back button with deck menu */}
            {fullDeck.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowDeckMenu(!showDeckMenu)}
                  className="relative w-[40px] h-[56px] rounded border-2 border-dungeon-500 hover:border-gold-500/60 transition-all group overflow-hidden"
                  title="Deck actions"
                >
                  {/* Card back design */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900">
                    <div className="absolute inset-[3px] border border-gold-500/30 rounded-sm flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full border border-gold-500/40 bg-gold-500/10 flex items-center justify-center">
                        <span className="text-[8px] text-gold-400/80 font-bold">M</span>
                      </div>
                    </div>
                  </div>
                  {/* Count overlay */}
                  <div className="absolute bottom-0 inset-x-0 bg-dungeon-900/80 text-[9px] text-parchment-300 text-center py-0.5 font-medium">
                    {library.length}
                  </div>
                </button>

                {/* Deck actions popup menu */}
                <AnimatePresence>
                  {showDeckMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      className="absolute bottom-full mb-2 right-0 w-44 bg-dungeon-800 border border-dungeon-600 rounded-lg shadow-xl z-30 py-1 overflow-hidden"
                    >
                      <button
                        onClick={() => { draw(1); setShowDeckMenu(false) }}
                        disabled={library.length === 0}
                        className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 disabled:opacity-40 flex items-center gap-2"
                      >
                        <ChevronDown className="w-3.5 h-3.5 text-arcane-400" />
                        Draw
                      </button>
                      <button
                        onClick={() => { draw(2); setShowDeckMenu(false) }}
                        disabled={library.length === 0}
                        className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 disabled:opacity-40 flex items-center gap-2"
                      >
                        <ChevronDown className="w-3.5 h-3.5 text-arcane-400" />
                        Draw 2
                      </button>
                      <div className="h-px bg-dungeon-600 my-0.5" />
                      <button
                        onClick={() => { startScry(1); setShowDeckMenu(false) }}
                        disabled={library.length === 0}
                        className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 disabled:opacity-40 flex items-center gap-2"
                      >
                        <Eye className="w-3.5 h-3.5 text-gold-400" />
                        Scry 1
                      </button>
                      <button
                        onClick={() => { startScry(2); setShowDeckMenu(false) }}
                        disabled={library.length < 2}
                        className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 disabled:opacity-40 flex items-center gap-2"
                      >
                        <Eye className="w-3.5 h-3.5 text-gold-400" />
                        Scry 2
                      </button>
                      <div className="h-px bg-dungeon-600 my-0.5" />
                      <button
                        onClick={() => { mill(1); setShowDeckMenu(false) }}
                        disabled={library.length === 0}
                        className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 disabled:opacity-40 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-dragon-400" />
                        Mill 1
                      </button>
                      <button
                        onClick={() => { exileTop(1); setShowDeckMenu(false) }}
                        disabled={library.length === 0}
                        className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 disabled:opacity-40 flex items-center gap-2"
                      >
                        <EyeOff className="w-3.5 h-3.5 text-parchment-500" />
                        Exile top
                      </button>
                      <div className="h-px bg-dungeon-600 my-0.5" />
                      <button
                        onClick={() => { setShowDeckSearch(true); setDeckSearchQuery(''); setDeckSearchSelected(new Set()); setShowDeckMenu(false) }}
                        disabled={library.length === 0}
                        className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 disabled:opacity-40 flex items-center gap-2"
                      >
                        <Search className="w-3.5 h-3.5 text-arcane-400" />
                        Search deck
                      </button>
                      <button
                        onClick={() => { setShowLibrary(!showLibrary); setShowDeckMenu(false) }}
                        className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 flex items-center gap-2"
                      >
                        <Library className="w-3.5 h-3.5 text-parchment-400" />
                        Peek top 20
                      </button>
                      <button
                        onClick={() => { shuffleLibrary(); setShowDeckMenu(false) }}
                        className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 flex items-center gap-2"
                      >
                        <Shuffle className="w-3.5 h-3.5 text-parchment-400" />
                        Shuffle
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {isMyTurn && (
              <>
              <Button size="sm" onClick={handleStartTurn} className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500">
                ▶ Start
              </Button>
              <Button size="sm" onClick={handleEndTurn} className="h-7 px-3 text-xs bg-gold-600 hover:bg-gold-500 text-dungeon-900 font-semibold border-gold-500">
                End Turn ⏭
              </Button>
              </>
            )}
          </div>
        </div>

        {/* My hand - clean cards */}
        {fullDeck.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1 min-h-[100px] justify-center">
            <AnimatePresence mode="popLayout">
              {hand.map((card, index) => (
                <motion.div
                  key={`hand-${card?.id || index}-${index}`}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative group"
                >
                  <WithHoverPreview card={{ name: card?.printedName || card?.name || 'Card', image: card?.imageNormal || null, type: card?.typeLine }}>
                    <div className="w-[70px] h-[98px] rounded overflow-hidden relative hover:scale-110 transition-transform cursor-pointer">
                      {card?.imageNormal ? (
                        <Image src={card.imageNormal} alt={card.name || 'Card'} fill className="object-cover" sizes="70px" />
                      ) : (
                        <div className="w-full h-full bg-dungeon-800 flex items-center justify-center p-1">
                          <span className="text-[8px] text-center text-parchment-500">{card?.name || 'Card'}</span>
                        </div>
                      )}
                    </div>
                  </WithHoverPreview>
                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 z-10">
                    <button onClick={() => playCard(index)} className="px-1.5 py-0.5 text-[10px] bg-emerald-600/90 text-white rounded-l" title="Play">
                      ▶
                    </button>
                    <button onClick={() => discardCard(index)} className="px-1.5 py-0.5 text-[10px] bg-dragon-600/90 text-white" title="Discard">
                      ✕
                    </button>
                    <button onClick={() => exileFromHand(index)} className="px-1.5 py-0.5 text-[10px] bg-parchment-700/90 text-white rounded-r" title="Exile">
                      ⛓
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {hand.length === 0 && <p className="text-parchment-600 italic text-xs py-6">Empty hand</p>}
          </div>
        )}
      </div>
      </div>

      {/* Card preview panel */}
      {previewCard && previewCard.image && (
        <div
          className="w-[280px] flex-shrink-0 flex flex-col items-center pt-4 cursor-pointer"
          onClick={() => setPreviewCard(null)}
        >
          <div className="sticky top-4">
            <div className="w-[250px] h-[349px] rounded-xl overflow-hidden shadow-2xl border-2 border-dungeon-600 relative">
              <Image src={previewCard.image} alt={previewCard.name} fill className="object-cover" sizes="250px" />
            </div>
            <p className="text-center text-parchment-300 text-sm mt-2 font-medium">{previewCard.name}</p>
            <p className="text-center text-parchment-500 text-xs">{previewCard.type}</p>
          </div>
        </div>
      )}

      {/* Opponent graveyard modal */}
      {viewingOpponentGraveyard && (() => {
        const opp = opponents.find(o => o.id === viewingOpponentGraveyard)
        const oppGraveyardCards = (opp?.graveyardCards || []) as ZoneCardInfo[]
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dungeon-950/70 backdrop-blur-sm">
            <div className="max-w-2xl w-full mx-4 space-y-4">
              <div className="text-center">
                <h2 className="font-medieval text-2xl text-gold-400 flex items-center justify-center gap-2 mb-1">
                  <Trash2 className="w-5 h-5" />
                  {opp?.name} — Graveyard ({oppGraveyardCards.length})
                </h2>
              </div>
              <div className="flex flex-wrap gap-3 justify-center max-h-[60vh] overflow-y-auto p-2">
                {oppGraveyardCards.length === 0 ? (
                  <p className="text-parchment-500 italic py-8">Empty graveyard</p>
                ) : (
                  oppGraveyardCards.map((card, index) => (
                    <WithHoverPreview key={`opp-gy-${index}`} card={{ name: card.name, image: card.image, type: card.type }}>
                      <div className="w-[100px] h-[140px] rounded-lg overflow-hidden border border-dungeon-600 shadow-md cursor-pointer hover:border-gold-500/50 transition-all relative">
                        {card.image ? (
                          <Image src={card.image} alt={card.name} fill className="object-cover" sizes="100px" />
                        ) : (
                          <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-2">
                            <span className="text-xs text-parchment-400 text-center">{card.name}</span>
                          </div>
                        )}
                      </div>
                    </WithHoverPreview>
                  ))
                )}
              </div>
              <div className="text-center">
                <Button onClick={() => setViewingOpponentGraveyard(null)} variant="outline" size="lg">
                  <Eye className="w-5 h-5 mr-2" />
                  Voir le champ de bataille
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Opponent exile modal */}
      {viewingOpponentExile && (() => {
        const opp = opponents.find(o => o.id === viewingOpponentExile)
        const oppExileCards = (opp?.exileCards || []) as ZoneCardInfo[]
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dungeon-950/70 backdrop-blur-sm">
            <div className="max-w-2xl w-full mx-4 space-y-4">
              <div className="text-center">
                <h2 className="font-medieval text-2xl text-gold-400 flex items-center justify-center gap-2 mb-1">
                  <EyeOff className="w-5 h-5" />
                  {opp?.name} — Exile ({oppExileCards.length})
                </h2>
              </div>
              <div className="flex flex-wrap gap-3 justify-center max-h-[60vh] overflow-y-auto p-2">
                {oppExileCards.length === 0 ? (
                  <p className="text-parchment-500 italic py-8">No exiled cards</p>
                ) : (
                  oppExileCards.map((card, index) => (
                    <WithHoverPreview key={`opp-ex-${index}`} card={{ name: card.name, image: card.image, type: card.type }}>
                      <div className="w-[100px] h-[140px] rounded-lg overflow-hidden border border-dungeon-600 shadow-md cursor-pointer hover:border-parchment-500/50 transition-all relative">
                        {card.image ? (
                          <Image src={card.image} alt={card.name} fill className="object-cover" sizes="100px" />
                        ) : (
                          <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-2">
                            <span className="text-xs text-parchment-400 text-center">{card.name}</span>
                          </div>
                        )}
                      </div>
                    </WithHoverPreview>
                  ))
                )}
              </div>
              <div className="text-center">
                <Button onClick={() => setViewingOpponentExile(null)} variant="outline" size="lg">
                  <Eye className="w-5 h-5 mr-2" />
                  Voir le champ de bataille
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Generic counter name popup */}
      {genericCounterPopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-dungeon-950/70 backdrop-blur-sm" onClick={() => setGenericCounterPopup(null)}>
          <div className="bg-dungeon-800 border border-dungeon-600 rounded-xl p-4 w-72 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-gold-400 text-center">Ajouter un marqueur</h3>
            <input
              ref={genericCounterInputRef}
              type="text"
              value={genericCounterLabel}
              onChange={(e) => setGenericCounterLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmGenericCounter(); if (e.key === 'Escape') setGenericCounterPopup(null); }}
              placeholder="Nom du marqueur (ex: Loyalty, Charge...)"
              className="w-full px-3 py-2 bg-dungeon-900 border border-dungeon-500 rounded-lg text-parchment-200 placeholder-parchment-600 focus:outline-none focus:border-gold-500/50 text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={() => setGenericCounterPopup(null)} variant="outline" size="sm" className="flex-1">
                Annuler
              </Button>
              <Button onClick={confirmGenericCounter} size="sm" className="flex-1" disabled={!genericCounterLabel.trim()}>
                Ajouter
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
    </HoverPreviewProvider>
  )
}

// Counter badge component for displaying counters on cards
function CounterBadge({ count, color, label }: { count: number; color: string; label: string }) {
  if (count === 0) return null
  return (
    <div
      className={cn(
        "min-w-[16px] h-[16px] rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-md border border-white/20",
        color
      )}
      title={label}
    >
      {count}
    </div>
  )
}

// Mini battlefield card - Clean, no borders
function BattlefieldCardMini({
  card,
  onTap,
  onGraveyard,
  onBounce,
  onExile,
  onAdjustCounter,
  onAddGenericCounter,
  onAdjustGenericCounter,
  onRemoveGenericCounter,
  onSelect,
  larger = false
}: {
  card: BattlefieldCard
  onTap: () => void
  onGraveyard: () => void
  onBounce: () => void
  onExile?: () => void
  onAdjustCounter?: (type: 'plusOne' | 'minusOne', delta: number) => void
  onAddGenericCounter?: () => void
  onAdjustGenericCounter?: (label: string, delta: number) => void
  onRemoveGenericCounter?: (label: string) => void
  onSelect?: () => void
  larger?: boolean
}) {
  const size = larger ? "w-[80px] h-[112px]" : "w-[60px] h-[84px]"
  const hasCounters = card.counters.plusOne > 0 || card.counters.minusOne > 0 || card.counters.genericCounters.length > 0

  // Build counters info for hover preview
  const countersInfo: CardCounters | undefined = hasCounters ? card.counters : undefined

  return (
    <div className="relative group">
      <WithHoverPreview card={{ name: card?.printedName || card?.name || '', image: card?.imageNormal || null, type: card?.typeLine, counters: countersInfo }}>
        <button
          onClick={(e) => { if (onSelect) onSelect(); else onTap(); }}
          className={cn(
            size,
            "rounded overflow-hidden transition-transform relative",
            card.tapped && "rotate-90"
          )}
        >
          {card?.imageNormal ? (
            <Image src={card.imageNormal} alt={card.name || ''} fill className="object-cover" sizes={larger ? "80px" : "60px"} />
          ) : (
            <div className="w-full h-full bg-dungeon-800 flex items-center justify-center p-1">
              <span className="text-[7px] text-center text-parchment-500 leading-tight">{card?.name || ''}</span>
            </div>
          )}
          {card.tapped && <div className="absolute inset-0 bg-black/20" />}

          {/* Counter badges overlay - top-right corner */}
          {hasCounters && (
            <div className={cn(
              "absolute top-0.5 right-0.5 flex flex-col gap-0.5",
              card.tapped && "rotate-[-90deg]"
            )}>
              <CounterBadge count={card.counters.plusOne} color="bg-emerald-600" label={`+1/+1 (${card.counters.plusOne})`} />
              <CounterBadge count={card.counters.minusOne} color="bg-dragon-600" label={`-1/-1 (${card.counters.minusOne})`} />
              {card.counters.genericCounters.map((gc) => (
                <CounterBadge key={gc.label} count={gc.count} color="bg-arcane-600" label={`${gc.label} (${gc.count})`} />
              ))}
            </div>
          )}
        </button>
      </WithHoverPreview>

      {/* Action buttons on hover */}
      <div className={cn(
        "absolute opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 z-10",
        card.tapped ? "top-1/2 -right-1 -translate-y-1/2 flex-col" : "-bottom-1 left-1/2 -translate-x-1/2"
      )}>
        <button onClick={(e) => { e.stopPropagation(); onTap(); }} className="p-0.5 bg-arcane-600/90 text-white rounded" title="Tap">
          <RotateCw className="w-2.5 h-2.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onBounce(); }} className="p-0.5 bg-blue-600/90 text-white rounded" title="Hand">
          <Undo2 className="w-2.5 h-2.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onGraveyard(); }} className="p-0.5 bg-dragon-600/90 text-white rounded" title="Graveyard">
          <Trash2 className="w-2.5 h-2.5" />
        </button>
        {onExile && (
          <button onClick={(e) => { e.stopPropagation(); onExile(); }} className="p-0.5 bg-parchment-700/90 text-white rounded" title="Exile">
            <EyeOff className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      {/* Counter controls on hover - top row */}
      {onAdjustCounter && (
        <div className={cn(
          "absolute opacity-0 group-hover:opacity-100 transition-opacity z-10",
          card.tapped ? "-left-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5" : "-top-1 left-1/2 -translate-x-1/2 flex gap-0.5"
        )}>
          {/* +1/+1 counter controls */}
          <button
            onClick={(e) => { e.stopPropagation(); onAdjustCounter('plusOne', -1); }}
            className="p-0.5 bg-emerald-800/90 text-emerald-200 rounded text-[8px] font-bold leading-none min-w-[14px]"
            title="Remove +1/+1"
          >
            -
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAdjustCounter('plusOne', 1); }}
            className="p-0.5 bg-emerald-600/90 text-white rounded text-[8px] font-bold leading-none min-w-[14px]"
            title="Add +1/+1"
          >
            +
          </button>
          {/* -1/-1 counter control */}
          <button
            onClick={(e) => { e.stopPropagation(); onAdjustCounter('minusOne', 1); }}
            className="p-0.5 bg-dragon-600/90 text-white rounded text-[8px] font-bold leading-none min-w-[14px]"
            title="Add -1/-1"
          >
            <Minus className="w-2 h-2" />
          </button>
          {/* Generic counter — opens popup */}
          {onAddGenericCounter && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddGenericCounter(); }}
              className="p-0.5 bg-arcane-600/90 text-white rounded text-[8px] font-bold leading-none min-w-[14px]"
              title="Add named counter"
            >
              <Zap className="w-2 h-2" />
            </button>
          )}
        </div>
      )}

      {/* Generic counter adjustment buttons (when card has generic counters) */}
      {card.counters.genericCounters.length > 0 && onAdjustGenericCounter && onRemoveGenericCounter && (
        <div className={cn(
          "absolute opacity-0 group-hover:opacity-100 transition-opacity z-10",
          card.tapped ? "-left-6 top-0 flex flex-col gap-0.5" : "top-0 -left-1 flex flex-col gap-0.5"
        )}>
          {card.counters.genericCounters.map((gc) => (
            <div key={gc.label} className="flex items-center gap-px">
              <button
                onClick={(e) => { e.stopPropagation(); onAdjustGenericCounter(gc.label, -1); }}
                className="px-0.5 bg-arcane-800/90 text-arcane-200 rounded-l text-[7px] font-bold"
                title={`Remove ${gc.label}`}
              >-</button>
              <span className="px-1 bg-arcane-700/80 text-[7px] text-white">{gc.count}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onAdjustGenericCounter(gc.label, 1); }}
                className="px-0.5 bg-arcane-600/90 text-white rounded-r text-[7px] font-bold"
                title={`Add ${gc.label}`}
              >+</button>
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveGenericCounter(gc.label); }}
                className="ml-px p-0.5 bg-dragon-700/80 text-white rounded text-[7px]"
                title={`Remove all ${gc.label}`}
              >
                <X className="w-2 h-2" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Opponent battlefield card - with improved sizes
function OpponentBattlefieldCard({
  card,
  small = false,
  expanded = false,
  onSelect,
}: {
  card: BattlefieldCardInfo
  small?: boolean
  expanded?: boolean
  onSelect?: () => void
}) {
  // Expanded: full size like own cards; default: doubled from original tiny sizes
  const size = expanded
    ? (small ? "w-[60px] h-[84px]" : "w-[80px] h-[112px]")
    : (small ? "w-[70px] h-[98px]" : "w-[90px] h-[126px]")
  const imgSize = expanded ? (small ? "60px" : "80px") : (small ? "70px" : "90px")

  const hasCounters = card.counters && (card.counters.plusOne > 0 || card.counters.minusOne > 0 || (card.counters.genericCounters && card.counters.genericCounters.length > 0))

  return (
    <WithHoverPreview card={{ name: card.name, image: card.image, type: card.type, counters: hasCounters ? card.counters : undefined }}>
      <div
        onClick={onSelect}
        className={cn(
          size,
          "rounded overflow-hidden relative cursor-pointer",
          card.tapped && "rotate-90"
        )}
      >
        {card.image ? (
          <Image src={card.image} alt={card.name} fill className="object-cover" sizes={imgSize} />
        ) : (
          <div className="w-full h-full bg-dungeon-800 flex items-center justify-center p-1">
            <span className="text-[7px] text-center text-parchment-500 leading-tight">{card.name}</span>
          </div>
        )}
        {card.tapped && <div className="absolute inset-0 bg-black/20" />}

        {/* Counter badges overlay - read-only for opponents */}
        {hasCounters && card.counters && (
          <div className={cn(
            "absolute top-0.5 right-0.5 flex flex-col gap-0.5",
            card.tapped && "rotate-[-90deg]"
          )}>
            <CounterBadge count={card.counters.plusOne} color="bg-emerald-600" label={`+1/+1 (${card.counters.plusOne})`} />
            <CounterBadge count={card.counters.minusOne} color="bg-dragon-600" label={`-1/-1 (${card.counters.minusOne})`} />
            {(card.counters.genericCounters || []).map((gc) => (
              <CounterBadge key={gc.label} count={gc.count} color="bg-arcane-600" label={`${gc.label} (${gc.count})`} />
            ))}
          </div>
        )}
      </div>
    </WithHoverPreview>
  )
}
