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

interface BattlefieldCardInfo {
  id: string
  name: string
  image: string | null
  type: string
  tapped: boolean
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
  battlefieldCount: number
  battlefieldCards: BattlefieldCardInfo[]
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

  // Initialize game when countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && !gameInitialized) {
      // Initialize game locally
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
      setGameInitialized(true)
    }
  }, [countdown, gameInitialized, fullDeck, startingLife])

  // Prepare battlefield cards info for sync
  const battlefieldCardsInfo: BattlefieldCardInfo[] = useMemo(() => {
    return battlefield.map(card => ({
      id: card.uniqueId,
      name: card.name || 'Unknown',
      image: card.imageNormal || null,
      type: card.typeLine || '',
      tapped: card.tapped,
    }))
  }, [battlefield])

  // Sync stats to server with debounce (only when values actually change)
  useEffect(() => {
    if (gamePhase !== 'playing' || !gameInitialized) return

    // Include battlefield state in sync key
    const bfKey = battlefield.map(c => `${c.uniqueId}:${c.tapped}`).join(',')
    const syncKey = `${life}-${manaPool}-${poisonCounters}-${hand.length}-${library.length}-${graveyard.length}-${battlefield.length}-${bfKey}`
    
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
        battlefieldCount: battlefield.length,
        battlefieldCards: battlefieldCardsInfo,
        isEliminated: life <= 0 || poisonCounters >= 10,
      })
    }, 300) // Debounce 300ms

    return () => clearTimeout(timer)
  }, [life, manaPool, poisonCounters, hand.length, library.length, graveyard.length, battlefield, battlefieldCardsInfo, gamePhase, gameInitialized])

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
    }
    setGraveyard(prev => prev.filter((_, i) => i !== index))
    setBattlefield(prev => [...prev, battlefieldCard])
  }, [graveyard])

  // Next turn - untap all, reset mana
  const handleNextTurn = useCallback(() => {
    setBattlefield(prev => prev.map(card => ({ ...card, tapped: false })))
    const landCount = battlefield.filter(c => isLand(c)).length
    setManaPool(landCount)
    draw(1)
    onNextTurn()
  }, [battlefield, draw, onNextTurn])

  // Adjust life
  const adjustLife = (amount: number) => setLife(l => l + amount)

  // Adjust poison
  const adjustPoison = (amount: number) => setPoisonCounters(p => Math.max(0, p + amount))

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
        <p className="text-dragon-400">Erreur: joueur non trouvé</p>
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
                      <span className="text-xs text-arcane-400">(vous)</span>
                    )}
                  </p>
                  {player.deckName ? (
                    <p className="text-sm text-parchment-500">{player.deckName}</p>
                  ) : (
                    <p className="text-sm text-parchment-600 italic">Sans deck</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {player.isReady ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">
                    <Check className="w-4 h-4" />
                    Prêt
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-dungeon-700 text-parchment-500 rounded-full text-sm">
                    <Clock className="w-4 h-4" />
                    En attente
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
              Annuler
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => onSetReady(true)}
              className="min-w-[200px]"
            >
              <Check className="w-5 h-5 mr-2" />
              Je suis prêt !
            </Button>
          )}
          
          {!allPlayersReady && (
            <p className="text-parchment-500 text-sm mt-3">
              En attente que tous les joueurs soient prêts...
            </p>
          )}
        </div>
      </div>
    )
  }

  // ========== PLAYING PHASE ==========
  return (
    <HoverPreviewProvider>
    <div className="flex gap-4">
      {/* Main game area */}
      <div className="flex-1 flex flex-col min-h-[calc(100vh-200px)]">
      {/* ===== OPPONENT ZONE (TOP) - Compact ===== */}
      <div className="flex-shrink-0 space-y-1 pb-2">
        {opponents.map((opponent) => (
          <div key={opponent.id} className={cn(
            "rounded-lg p-2",
            opponent.id === activePlayerId && "bg-gold-500/10",
            opponent.isEliminated && "opacity-40"
          )}>
            {/* Opponent header - ultra compact */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: opponent.color }}
                >
                  {opponent.name[0].toUpperCase()}
                </div>
                <span className="text-sm text-parchment-300 font-medium">
                  {opponent.deckName || opponent.name}
                </span>
                {opponent.id === activePlayerId && (
                  <span className="text-[10px] bg-gold-500/30 text-gold-400 px-1 rounded">Tour</span>
                )}
                {opponent.isEliminated && <Skull className="w-3 h-3 text-dragon-400" />}
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className={cn("font-bold", opponent.life <= 5 ? "text-dragon-400" : "text-parchment-300")}>
                  {opponent.life} <Heart className="w-3 h-3 inline text-dragon-400/70" />
                </span>
                {opponent.poisonCounters > 0 && (
                  <span className="text-emerald-400">{opponent.poisonCounters}☠</span>
                )}
                <span className="text-parchment-500">{opponent.handCount}✋</span>
              </div>
            </div>

            {/* Opponent battlefield - minimal */}
            {opponent.battlefieldCards && opponent.battlefieldCards.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {opponent.battlefieldCards.map((card) => (
                  <OpponentBattlefieldCard
                    key={card.id}
                    card={card}
                    small={card.type.toLowerCase().includes('land')}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ===== CENTER DIVIDER ===== */}
      <div className="flex items-center justify-center py-2 text-parchment-600">
        <div className="flex-1 h-px bg-dungeon-600" />
        <span className="px-3 text-xs">Tour {currentTurn}</span>
        <div className="flex-1 h-px bg-dungeon-600" />
      </div>

      {/* ===== MY BATTLEFIELD (MIDDLE) - Clean ===== */}
      <div className="flex-1 space-y-2">
        {/* My battlefield */}
        {fullDeck.length > 0 && battlefield.length > 0 && (
          <div className="p-2 space-y-2">
            {/* Non-lands: creatures + others in one row */}
            {(battlefieldCreatures.length > 0 || battlefieldEnchantments.length > 0 || battlefieldOther.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {[...battlefieldCreatures, ...battlefieldEnchantments, ...battlefieldOther].map((card) => (
                  <BattlefieldCardMini
                    key={card.uniqueId}
                    card={card}
                    onTap={() => toggleTap(card.uniqueId)}
                    onGraveyard={() => sendToGraveyard(card.uniqueId)}
                    onBounce={() => bounceToHand(card.uniqueId)}
                    larger
                  />
                ))}
              </div>
            )}

            {/* Lands row */}
            {battlefieldLands.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {battlefieldLands.map((card) => (
                  <BattlefieldCardMini
                    key={card.uniqueId}
                    card={card}
                    onTap={() => toggleTap(card.uniqueId)}
                    onGraveyard={() => sendToGraveyard(card.uniqueId)}
                    onBounce={() => bounceToHand(card.uniqueId)}
                  />
                ))}
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
                Bibliothèque ({library.length}) - Top 20
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
          <div className="card-frame p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gold-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Cimetière ({graveyard.length})
              </h3>
              <button onClick={() => setShowGraveyard(false)} className="text-parchment-400 hover:text-parchment-200">
                <EyeOff className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {graveyard.map((card, index) => (
                <div key={`gy-${index}`} className="relative group">
                  <WithHoverPreview card={{ name: card?.printedName || card?.name || '', image: card?.imageNormal || null, type: card?.typeLine }}>
                    <div className="w-[75px] h-[105px] rounded-lg overflow-hidden opacity-70 group-hover:opacity-100 relative border border-dungeon-600 hover:border-gold-500/50 shadow-sm hover:shadow-md transition-all cursor-pointer">
                      {card?.imageNormal ? (
                        <Image src={card.imageNormal} alt={card.name || ''} fill className="object-cover" sizes="75px" />
                      ) : (
                        <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-1">
                          <span className="text-[8px] text-parchment-400 text-center">{card?.name || ''}</span>
                        </div>
                      )}
                    </div>
                  </WithHoverPreview>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                    <button onClick={() => graveyardToHand(index)} className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-md" title="Renvoyer en main">
                      <Hand className="w-3 h-3" />
                    </button>
                    <button onClick={() => graveyardToBattlefield(index)} className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-md" title="Mettre sur le champ de bataille">
                      <Play className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ===== MY ZONE (BOTTOM - STICKY) - Clean ===== */}
      <div className="flex-shrink-0 mt-auto pt-2 sticky bottom-0 bg-dungeon-900/95 backdrop-blur-sm pb-1">
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

          {/* Mana + Poison - minimal */}
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <button onClick={() => setManaPool(m => Math.max(0, m - 1))} className="text-parchment-500 active:scale-90">-</button>
              <span className="text-arcane-400 font-bold">{manaPool}⚡</span>
              <button onClick={() => setManaPool(m => m + 1)} className="text-parchment-500 active:scale-90">+</button>
            </div>
            {poisonCounters > 0 && (
              <span className="text-emerald-400 font-bold">{poisonCounters}☠</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {fullDeck.length > 0 && (
              <>
                <button onClick={() => setShowLibrary(!showLibrary)} className="text-xs text-parchment-400">
                  📚{library.length}
                </button>
                <button onClick={() => setShowGraveyard(!showGraveyard)} className="text-xs text-parchment-400">
                  🪦{graveyard.length}
                </button>
              </>
            )}
            {isMyTurn && <span className="text-[10px] text-gold-400">●</span>}
            {fullDeck.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => draw(1)} disabled={library.length === 0} className="h-7 px-2 text-xs">
                Piocher
              </Button>
            )}
            {isMyTurn && (
              <Button size="sm" onClick={handleNextTurn} className="h-7 px-2 text-xs">
                Fin
              </Button>
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
                  <WithHoverPreview card={{ name: card?.printedName || card?.name || 'Carte', image: card?.imageNormal || null, type: card?.typeLine }}>
                    <div className="w-[70px] h-[98px] rounded overflow-hidden relative hover:scale-110 transition-transform cursor-pointer">
                      {card?.imageNormal ? (
                        <Image src={card.imageNormal} alt={card.name || 'Card'} fill className="object-cover" sizes="70px" />
                      ) : (
                        <div className="w-full h-full bg-dungeon-800 flex items-center justify-center p-1">
                          <span className="text-[8px] text-center text-parchment-500">{card?.name || 'Carte'}</span>
                        </div>
                      )}
                    </div>
                  </WithHoverPreview>
                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 z-10">
                    <button onClick={() => playCard(index)} className="px-1.5 py-0.5 text-[10px] bg-emerald-600/90 text-white rounded-l">
                      ▶
                    </button>
                    <button onClick={() => discardCard(index)} className="px-1.5 py-0.5 text-[10px] bg-dragon-600/90 text-white rounded-r">
                      ✕
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {hand.length === 0 && <p className="text-parchment-600 italic text-xs py-6">Main vide</p>}
          </div>
        )}
      </div>
      </div>

    </div>
    </HoverPreviewProvider>
  )
}

// Mini battlefield card - Clean, no borders
function BattlefieldCardMini({
  card,
  onTap,
  onGraveyard,
  onBounce,
  larger = false
}: {
  card: BattlefieldCard
  onTap: () => void
  onGraveyard: () => void
  onBounce: () => void
  larger?: boolean
}) {
  const size = larger ? "w-[80px] h-[112px]" : "w-[60px] h-[84px]"

  return (
    <div className="relative group">
      <WithHoverPreview card={{ name: card?.printedName || card?.name || '', image: card?.imageNormal || null, type: card?.typeLine }}>
        <button
          onClick={onTap}
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
        </button>
      </WithHoverPreview>

      <div className={cn(
        "absolute opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 z-10",
        card.tapped ? "top-1/2 -right-1 -translate-y-1/2 flex-col" : "-bottom-1 left-1/2 -translate-x-1/2"
      )}>
        <button onClick={(e) => { e.stopPropagation(); onTap(); }} className="p-0.5 bg-arcane-600/90 text-white rounded" title="Tap">
          <RotateCw className="w-2.5 h-2.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onBounce(); }} className="p-0.5 bg-blue-600/90 text-white rounded" title="Main">
          <Undo2 className="w-2.5 h-2.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onGraveyard(); }} className="p-0.5 bg-dragon-600/90 text-white rounded" title="Cimetière">
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  )
}

// Opponent battlefield card - Clean, no borders
function OpponentBattlefieldCard({
  card,
  small = false
}: {
  card: BattlefieldCardInfo
  small?: boolean
}) {
  const size = small ? "w-[45px] h-[63px]" : "w-[65px] h-[91px]"

  return (
    <WithHoverPreview card={{ name: card.name, image: card.image, type: card.type }}>
      <div
        className={cn(
          size,
          "rounded overflow-hidden relative cursor-pointer",
          card.tapped && "rotate-90"
        )}
      >
        {card.image ? (
          <Image src={card.image} alt={card.name} fill className="object-cover" sizes={small ? "45px" : "65px"} />
        ) : (
          <div className="w-full h-full bg-dungeon-800 flex items-center justify-center p-1">
            <span className="text-[6px] text-center text-parchment-500 leading-tight">{card.name}</span>
          </div>
        )}
        {card.tapped && <div className="absolute inset-0 bg-black/20" />}
      </div>
    </WithHoverPreview>
  )
}
