'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shuffle,
  RotateCcw,
  ChevronDown,
  Mountain,
  Sparkles,
  Layers,
  Hand,
  Library,
  Trash2,
  Eye,
  EyeOff,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  RotateCw,
  Skull,
  Zap,
  ArrowDown,
  Sword,
  Undo2,
  ArrowUp,
  Play,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CardWithPrice } from '@/types/scryfall'

interface DeckCard {
  id: string
  cardId: string
  quantity: number
  category: string
  card: CardWithPrice
}

interface PlaytestViewProps {
  deckName: string
  cards: DeckCard[]
  format?: string | null
}

interface BattlefieldCard extends CardWithPrice {
  uniqueId: string
  tapped: boolean
}

// Expand deck cards into individual cards for shuffling
function expandDeck(cards: DeckCard[]): CardWithPrice[] {
  const expanded: CardWithPrice[] = []
  for (const dc of cards) {
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
function isLand(card: CardWithPrice): boolean {
  return card.typeLine.toLowerCase().includes('land')
}

// Check if a card is a creature
function isCreature(card: CardWithPrice): boolean {
  return card.typeLine.toLowerCase().includes('creature')
}

// Get mana symbols from cost
function parseManaSymbols(manaCost: string | null | undefined): string[] {
  if (!manaCost) return []
  const matches = manaCost.match(/\{[^}]+\}/g)
  return matches || []
}

// Generate unique ID
function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export function PlaytestView({ deckName, cards, format }: PlaytestViewProps) {
  // Initial life based on format
  const initialLife = format?.toLowerCase() === 'commander' ? 40 : 20

  // Game state
  const [library, setLibrary] = useState<CardWithPrice[]>([])
  const [hand, setHand] = useState<CardWithPrice[]>([])
  const [graveyard, setGraveyard] = useState<CardWithPrice[]>([])
  const [exile, setExile] = useState<CardWithPrice[]>([])
  const [battlefield, setBattlefield] = useState<BattlefieldCard[]>([])
  const [mulliganCount, setMulliganCount] = useState(0)
  const [turn, setTurn] = useState(0)
  const [life, setLife] = useState(initialLife)
  const [manaPool, setManaPool] = useState(0)
  const [gameStarted, setGameStarted] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showGraveyard, setShowGraveyard] = useState(false)
  const [showExile, setShowExile] = useState(false)
  const [showScry, setShowScry] = useState(false)
  const [scryCount, setScryCount] = useState(1)
  const [selectedHandIndices, setSelectedHandIndices] = useState<Set<number>>(new Set())
  const [actionLog, setActionLog] = useState<string[]>([])

  // Full deck for stats
  const fullDeck = useMemo(() => expandDeck(cards), [cards])
  const deckSize = fullDeck.length

  // Log action helper
  const logAction = useCallback((action: string) => {
    setActionLog(prev => [`T${turn}: ${action}`, ...prev.slice(0, 19)])
  }, [turn])

  // Start a new game
  const startGame = useCallback(() => {
    const shuffled = shuffleArray(fullDeck)
    const initialHand = shuffled.slice(0, 7)
    const remainingLibrary = shuffled.slice(7)
    
    setLibrary(remainingLibrary)
    setHand(initialHand)
    setGraveyard([])
    setExile([])
    setBattlefield([])
    setMulliganCount(0)
    setTurn(0)
    setLife(initialLife)
    setManaPool(0)
    setGameStarted(true)
    setSelectedHandIndices(new Set())
    setActionLog(['Game started - 7 card hand'])
  }, [fullDeck, initialLife])

  // London Mulligan
  const mulligan = useCallback(() => {
    const newMulliganCount = mulliganCount + 1
    
    // Reshuffle entire deck
    const shuffled = shuffleArray(fullDeck)
    const newHand = shuffled.slice(0, 7)
    const newLibrary = shuffled.slice(7)
    
    setLibrary(newLibrary)
    setHand(newHand)
    setMulliganCount(newMulliganCount)
    setSelectedHandIndices(new Set())
    logAction(`Mulligan to ${7 - newMulliganCount}`)
  }, [fullDeck, mulliganCount, logAction])

  // Put selected cards on bottom (London mulligan final step)
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
    setLibrary([...library, ...bottomCards])
    setSelectedHandIndices(new Set())
    setMulliganCount(0)
    setTurn(1)
    logAction('Hand kept, game started')
  }, [hand, library, selectedHandIndices, mulliganCount, logAction])

  // Draw a card
  const draw = useCallback((count: number = 1) => {
    if (library.length === 0) return
    
    const drawCount = Math.min(count, library.length)
    const drawnCards = library.slice(0, drawCount)
    const remainingLibrary = library.slice(drawCount)
    
    setHand([...hand, ...drawnCards])
    setLibrary(remainingLibrary)
    logAction(`Draw ${drawCount} card${drawCount > 1 ? 's' : ''}`)
  }, [library, hand, logAction])

  // Next turn (untap, draw, increment)
  const nextTurn = useCallback(() => {
    if (turn === 0) {
      setTurn(1)
      logAction('Turn 1 begins')
      return
    }
    
    // Untap all permanents
    setBattlefield(prev => prev.map(card => ({ ...card, tapped: false })))
    
    // Update mana pool based on lands
    const landCount = battlefield.filter(c => isLand(c)).length
    setManaPool(landCount)
    
    // Draw
    if (library.length > 0) {
      const [drawnCard, ...remainingLibrary] = library
      setHand([...hand, drawnCard])
      setLibrary(remainingLibrary)
    }
    
    setTurn(turn + 1)
    logAction(`Turn ${turn + 1} - Untap, draw`)
  }, [turn, library, hand, battlefield, logAction])

  // Play a card from hand to battlefield
  const playCard = useCallback((index: number) => {
    const card = hand[index]
    const newHand = hand.filter((_, i) => i !== index)
    const battlefieldCard: BattlefieldCard = {
      ...card,
      uniqueId: generateUniqueId(),
      tapped: false,
    }
    
    setHand(newHand)
    setBattlefield([...battlefield, battlefieldCard])
    
    // Auto-update mana if land
    if (isLand(card)) {
      setManaPool(prev => prev + 1)
    }
    
    logAction(`Play ${card.name}`)
  }, [hand, battlefield, logAction])

  // Discard a card
  const discardCard = useCallback((index: number) => {
    const card = hand[index]
    const newHand = hand.filter((_, i) => i !== index)
    setHand(newHand)
    setGraveyard([card, ...graveyard])
    logAction(`Discard ${card.name}`)
  }, [hand, graveyard, logAction])

  // Exile a card from hand
  const exileFromHand = useCallback((index: number) => {
    const card = hand[index]
    const newHand = hand.filter((_, i) => i !== index)
    setHand(newHand)
    setExile([card, ...exile])
    logAction(`Exile ${card.name} (hand)`)
  }, [hand, exile, logAction])

  // Toggle tap state
  const toggleTap = useCallback((uniqueId: string) => {
    setBattlefield(prev => prev.map(card => 
      card.uniqueId === uniqueId 
        ? { ...card, tapped: !card.tapped }
        : card
    ))
  }, [])

  // Send to graveyard from battlefield
  const sendToGraveyard = useCallback((uniqueId: string) => {
    const card = battlefield.find(c => c.uniqueId === uniqueId)
    if (!card) return
    
    setBattlefield(prev => prev.filter(c => c.uniqueId !== uniqueId))
    setGraveyard([card, ...graveyard])
    logAction(`${card.name} → graveyard`)
  }, [battlefield, graveyard, logAction])

  // Send to exile from battlefield
  const sendToExile = useCallback((uniqueId: string) => {
    const card = battlefield.find(c => c.uniqueId === uniqueId)
    if (!card) return
    
    setBattlefield(prev => prev.filter(c => c.uniqueId !== uniqueId))
    setExile([card, ...exile])
    logAction(`${card.name} → exile`)
  }, [battlefield, exile, logAction])

  // Bounce: return from battlefield to hand
  const bounceToHand = useCallback((uniqueId: string) => {
    const card = battlefield.find(c => c.uniqueId === uniqueId)
    if (!card) return
    
    setBattlefield(prev => prev.filter(c => c.uniqueId !== uniqueId))
    setHand([...hand, card])
    logAction(`${card.name} → hand (bounce)`)
  }, [battlefield, hand, logAction])

  // Return from graveyard to hand
  const graveyardToHand = useCallback((index: number) => {
    const card = graveyard[index]
    if (!card) return
    
    setGraveyard(prev => prev.filter((_, i) => i !== index))
    setHand([...hand, card])
    logAction(`${card.name} → hand (graveyard)`)
  }, [graveyard, hand, logAction])

  // Return from graveyard to battlefield (reanimate)
  const graveyardToBattlefield = useCallback((index: number) => {
    const card = graveyard[index]
    if (!card) return
    
    const battlefieldCard: BattlefieldCard = {
      ...card,
      uniqueId: generateUniqueId(),
      tapped: false,
    }
    
    setGraveyard(prev => prev.filter((_, i) => i !== index))
    setBattlefield([...battlefield, battlefieldCard])
    logAction(`${card.name} → battlefield (reanimate)`)
  }, [graveyard, battlefield, logAction])

  // Return from graveyard to library (top or shuffle)
  const graveyardToLibrary = useCallback((index: number, toTop: boolean = true) => {
    const card = graveyard[index]
    if (!card) return
    
    setGraveyard(prev => prev.filter((_, i) => i !== index))
    if (toTop) {
      setLibrary([card, ...library])
      logAction(`${card.name} → top of library`)
    } else {
      setLibrary(shuffleArray([...library, card]))
      logAction(`${card.name} → library (shuffled)`)
    }
  }, [graveyard, library, logAction])

  // Return from exile to hand
  const exileToHand = useCallback((index: number) => {
    const card = exile[index]
    if (!card) return
    
    setExile(prev => prev.filter((_, i) => i !== index))
    setHand([...hand, card])
    logAction(`${card.name} → hand (exile)`)
  }, [exile, hand, logAction])

  // Return from exile to battlefield
  const exileToBattlefield = useCallback((index: number) => {
    const card = exile[index]
    if (!card) return
    
    const battlefieldCard: BattlefieldCard = {
      ...card,
      uniqueId: generateUniqueId(),
      tapped: false,
    }
    
    setExile(prev => prev.filter((_, i) => i !== index))
    setBattlefield([...battlefield, battlefieldCard])
    logAction(`${card.name} → battlefield (exile)`)
  }, [exile, battlefield, logAction])

  // Return from exile to library
  const exileToLibrary = useCallback((index: number, toTop: boolean = true) => {
    const card = exile[index]
    if (!card) return
    
    setExile(prev => prev.filter((_, i) => i !== index))
    if (toTop) {
      setLibrary([card, ...library])
      logAction(`${card.name} → top of library (exile)`)
    } else {
      setLibrary(shuffleArray([...library, card]))
      logAction(`${card.name} → library shuffled (exile)`)
    }
  }, [exile, library, logAction])

  // Scry
  const performScry = useCallback((keepOnTop: boolean[], bottomCards: CardWithPrice[]) => {
    const topCards = library.slice(0, scryCount).filter((_, i) => keepOnTop[i])
    const newLibrary = [...topCards, ...library.slice(scryCount), ...bottomCards]
    setLibrary(newLibrary)
    setShowScry(false)
    logAction(`Scry ${scryCount}`)
  }, [library, scryCount, logAction])

  // Toggle card selection for mulligan
  const toggleCardSelection = useCallback((index: number) => {
    const newSelection = new Set(selectedHandIndices)
    if (newSelection.has(index)) {
      newSelection.delete(index)
    } else if (newSelection.size < mulliganCount) {
      newSelection.add(index)
    }
    setSelectedHandIndices(newSelection)
  }, [selectedHandIndices, mulliganCount])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameStarted || e.target instanceof HTMLInputElement) return
      
      switch (e.key.toLowerCase()) {
        case 'd':
          if (turn > 0 && library.length > 0) draw(1)
          break
        case 'n':
          if (!inMulliganPhase) nextTurn()
          break
        case 'r':
          startGame()
          break
        case 'm':
          if (turn === 0 && !inMulliganPhase) mulligan()
          break
        case 'l':
          setShowLibrary(prev => !prev)
          break
        case 'g':
          setShowGraveyard(prev => !prev)
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameStarted, turn, library.length, draw, nextTurn, startGame, mulligan])

  // Hand statistics
  const handStats = useMemo(() => {
    const lands = hand.filter(isLand).length
    const nonLands = hand.length - lands
    const totalCmc = hand.reduce((sum, c) => sum + (isLand(c) ? 0 : c.cmc), 0)
    const avgCmc = nonLands > 0 ? totalCmc / nonLands : 0
    
    return { lands, nonLands, avgCmc }
  }, [hand])

  // Battlefield separated
  const battlefieldLands = battlefield.filter(c => isLand(c))
  const battlefieldCreatures = battlefield.filter(c => isCreature(c) && !isLand(c))
  const battlefieldOther = battlefield.filter(c => !isLand(c) && !isCreature(c))

  // Mulligan phase check
  const inMulliganPhase = mulliganCount > 0 && turn === 0

  // Not started yet
  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6">
        <div className="text-center space-y-2">
          <Layers className="w-16 h-16 text-gold-500 mx-auto mb-4" />
          <h2 className="font-medieval text-2xl text-gold-400">Goldfish Mode</h2>
          <p className="text-parchment-400 max-w-md">
            Test your deck by simulating opening hands and turns.
            Ideal for checking your mana curve and openers.
          </p>
          <p className="text-sm text-parchment-500">
            {deckSize} cards • {initialLife} LP
          </p>
        </div>
        
        <Button size="lg" onClick={startGame} className="gap-2">
          <Shuffle className="w-5 h-5" />
          Draw a hand
        </Button>

        <div className="text-xs text-parchment-600 text-center space-y-1">
          <p className="font-medium">Keyboard shortcuts</p>
          <p><kbd className="px-1.5 py-0.5 bg-dungeon-700 rounded">D</kbd> Draw • <kbd className="px-1.5 py-0.5 bg-dungeon-700 rounded">N</kbd> Next turn • <kbd className="px-1.5 py-0.5 bg-dungeon-700 rounded">R</kbd> Restart</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top bar with life, mana, and controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Life and Mana counters */}
        <div className="flex items-center gap-3">
          {/* Life counter */}
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-dragon-500/20 border border-dragon-500/30">
            <button 
              onClick={() => setLife(l => l - 1)}
              className="p-1 hover:bg-dragon-500/30 rounded transition-colors"
            >
              <Minus className="w-3 h-3 text-dragon-400" />
            </button>
            <div className="flex items-center gap-1.5 min-w-[50px] justify-center">
              <Heart className="w-4 h-4 text-dragon-400" />
              <span className="font-bold text-dragon-300">{life}</span>
            </div>
            <button 
              onClick={() => setLife(l => l + 1)}
              className="p-1 hover:bg-dragon-500/30 rounded transition-colors"
            >
              <Plus className="w-3 h-3 text-dragon-400" />
            </button>
          </div>

          {/* Mana pool */}
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-arcane-500/20 border border-arcane-500/30">
            <button 
              onClick={() => setManaPool(m => Math.max(0, m - 1))}
              className="p-1 hover:bg-arcane-500/30 rounded transition-colors"
            >
              <Minus className="w-3 h-3 text-arcane-400" />
            </button>
            <div className="flex items-center gap-1.5 min-w-[50px] justify-center">
              <Zap className="w-4 h-4 text-arcane-400" />
              <span className="font-bold text-arcane-300">{manaPool}</span>
            </div>
            <button 
              onClick={() => setManaPool(m => m + 1)}
              className="p-1 hover:bg-arcane-500/30 rounded transition-colors"
            >
              <Plus className="w-3 h-3 text-arcane-400" />
            </button>
          </div>

          {/* Turn counter */}
          {turn > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-gold-500/20 border border-gold-500/30">
              <span className="text-gold-400 font-medium">Turn {turn}</span>
            </div>
          )}
        </div>

        {/* Zone counters */}
        <div className="flex items-center gap-2 text-sm">
          <button 
            onClick={() => setShowLibrary(!showLibrary)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded transition-colors",
              showLibrary ? "bg-dungeon-600 text-parchment-200" : "text-parchment-400 hover:text-parchment-200"
            )}
          >
            <Library className="w-4 h-4" />
            <span>{library.length}</span>
          </button>
          
          <button 
            onClick={() => setShowGraveyard(!showGraveyard)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded transition-colors",
              showGraveyard ? "bg-dungeon-600 text-parchment-200" : "text-parchment-400 hover:text-parchment-200"
            )}
          >
            <Trash2 className="w-4 h-4" />
            <span>{graveyard.length}</span>
          </button>

          {exile.length > 0 && (
            <button 
              onClick={() => setShowExile(!showExile)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded transition-colors",
                showExile ? "bg-dungeon-600 text-parchment-200" : "text-parchment-400 hover:text-parchment-200"
              )}
            >
              <Skull className="w-4 h-4" />
              <span>{exile.length}</span>
            </button>
          )}
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        {turn === 0 && !inMulliganPhase && (
          <Button variant="outline" size="sm" onClick={mulligan} className="gap-1.5">
            <Shuffle className="w-4 h-4" />
            Mulligan
          </Button>
        )}
        
        {turn > 0 && (
          <>
            <Button variant="outline" size="sm" onClick={() => draw(1)} disabled={library.length === 0} className="gap-1.5">
              <ChevronDown className="w-4 h-4" />
              Draw
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowScry(true)} 
              disabled={library.length === 0}
              className="gap-1.5"
            >
              <Eye className="w-4 h-4" />
              Scry
            </Button>
          </>
        )}
        
        <Button 
          size="sm" 
          onClick={nextTurn}
          disabled={inMulliganPhase}
          className="gap-1.5"
        >
          <ChevronRight className="w-4 h-4" />
          {turn === 0 ? 'Keep' : 'Next turn'}
        </Button>
        
        <Button variant="secondary" size="sm" onClick={startGame} className="gap-1.5">
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
      </div>

      {/* Mulligan instructions */}
      {inMulliganPhase && (
        <div className="p-4 rounded-lg bg-gold-500/10 border border-gold-500/30">
          <p className="text-gold-400 text-center">
            <strong>Mulligan to {7 - mulliganCount}</strong> — Select {mulliganCount} card{mulliganCount > 1 ? 's' : ''} to put on bottom
            <span className="text-parchment-400 ml-2">
              ({selectedHandIndices.size}/{mulliganCount})
            </span>
          </p>
          {selectedHandIndices.size === mulliganCount && (
            <div className="flex justify-center mt-3">
              <Button size="sm" onClick={putOnBottom} className="gap-1.5">
                <ArrowDown className="w-4 h-4" />
                Put on bottom and start
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Hand statistics */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="p-2 rounded-lg bg-dungeon-800 border border-dungeon-600">
          <div className="text-xs text-parchment-500 flex items-center justify-center gap-1">
            <Mountain className="w-3 h-3" /> Lands
          </div>
          <p className="text-lg font-bold text-parchment-200">{handStats.lands}</p>
        </div>
        <div className="p-2 rounded-lg bg-dungeon-800 border border-dungeon-600">
          <div className="text-xs text-parchment-500 flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3" /> Spells
          </div>
          <p className="text-lg font-bold text-parchment-200">{handStats.nonLands}</p>
        </div>
        <div className="p-2 rounded-lg bg-dungeon-800 border border-dungeon-600">
          <div className="text-xs text-parchment-500 flex items-center justify-center gap-1">
            <Hand className="w-3 h-3" /> Hand
          </div>
          <p className="text-lg font-bold text-parchment-200">{hand.length}</p>
        </div>
        <div className="p-2 rounded-lg bg-dungeon-800 border border-dungeon-600">
          <div className="text-xs text-parchment-500">Avg CMC</div>
          <p className="text-lg font-bold text-parchment-200">{handStats.avgCmc.toFixed(1)}</p>
        </div>
      </div>

      {/* Hand display */}
      <div className="card-frame p-4">
        <h3 className="font-medieval text-lg text-gold-400 mb-3 flex items-center gap-2">
          <Hand className="w-5 h-5" />
          Hand ({hand.length})
        </h3>
        
        <div className="flex flex-wrap gap-2 justify-center min-h-[180px]">
          <AnimatePresence mode="popLayout">
            {hand.map((card, index) => {
              const isSelected = selectedHandIndices.has(index)
              return (
                <motion.div
                  key={`hand-${card.id}-${index}`}
                  layout
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ 
                    opacity: 1, 
                    scale: isSelected ? 0.95 : 1, 
                    y: isSelected ? 8 : 0 
                  }}
                  exit={{ opacity: 0, scale: 0.8, y: -20 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="relative group"
                >
                  <button
                    onClick={() => inMulliganPhase ? toggleCardSelection(index) : null}
                    className={cn(
                      "relative w-[110px] h-[154px] sm:w-[130px] sm:h-[182px] rounded-lg overflow-hidden transition-all",
                      inMulliganPhase && "cursor-pointer hover:ring-2 hover:ring-gold-500/50",
                      isSelected && "ring-2 ring-gold-500 brightness-75"
                    )}
                  >
                    {card.imageNormal ? (
                      <Image
                        src={card.imageNormal}
                        alt={card.name}
                        fill
                        className="object-cover"
                        sizes="130px"
                      />
                    ) : (
                      <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-2">
                        <span className="text-xs text-center text-parchment-400">{card.name}</span>
                      </div>
                    )}
                    
                    {isSelected && (
                      <div className="absolute inset-0 bg-gold-500/30 flex items-center justify-center">
                        <ArrowDown className="w-8 h-8 text-gold-400" />
                      </div>
                    )}
                  </button>
                  
                  {/* Action buttons */}
                  {!inMulliganPhase && turn > 0 && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 z-10">
                      <button
                        onClick={() => playCard(index)}
                        className="px-1.5 py-1 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-l"
                        title="Play"
                      >
                        Play
                      </button>
                      <button
                        onClick={() => discardCard(index)}
                        className="px-1.5 py-1 text-[10px] bg-dragon-600 hover:bg-dragon-500 text-white"
                        title="Discard"
                      >
                        Def.
                      </button>
                      <button
                        onClick={() => exileFromHand(index)}
                        className="px-1.5 py-1 text-[10px] bg-dungeon-600 hover:bg-dungeon-500 text-white rounded-r"
                        title="Exile"
                      >
                        Exile
                      </button>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
          
          {hand.length === 0 && (
            <p className="text-parchment-500 italic py-8">Empty hand</p>
          )}
        </div>
      </div>

      {/* Battlefield */}
      {battlefield.length > 0 && (
        <div className="card-frame p-4 space-y-4">
          <h3 className="font-medieval text-lg text-gold-400 flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Battlefield ({battlefield.length})
          </h3>

          {/* Lands row */}
          {battlefieldLands.length > 0 && (
            <div>
              <p className="text-xs text-parchment-500 mb-2 flex items-center gap-1">
                <Mountain className="w-3 h-3" /> Lands ({battlefieldLands.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {battlefieldLands.map((card) => (
                  <BattlefieldCardComponent
                    key={card.uniqueId}
                    card={card}
                    onTap={() => toggleTap(card.uniqueId)}
                    onGraveyard={() => sendToGraveyard(card.uniqueId)}
                    onExile={() => sendToExile(card.uniqueId)}
                    onBounce={() => bounceToHand(card.uniqueId)}
                    small
                  />
                ))}
              </div>
            </div>
          )}

          {/* Creatures row */}
          {battlefieldCreatures.length > 0 && (
            <div>
              <p className="text-xs text-parchment-500 mb-2 flex items-center gap-1">
                <Sword className="w-3 h-3" /> Creatures ({battlefieldCreatures.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {battlefieldCreatures.map((card) => (
                  <BattlefieldCardComponent
                    key={card.uniqueId}
                    card={card}
                    onTap={() => toggleTap(card.uniqueId)}
                    onGraveyard={() => sendToGraveyard(card.uniqueId)}
                    onExile={() => sendToExile(card.uniqueId)}
                    onBounce={() => bounceToHand(card.uniqueId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other permanents */}
          {battlefieldOther.length > 0 && (
            <div>
              <p className="text-xs text-parchment-500 mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Others ({battlefieldOther.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {battlefieldOther.map((card) => (
                  <BattlefieldCardComponent
                    key={card.uniqueId}
                    card={card}
                    onTap={() => toggleTap(card.uniqueId)}
                    onGraveyard={() => sendToGraveyard(card.uniqueId)}
                    onExile={() => sendToExile(card.uniqueId)}
                    onBounce={() => bounceToHand(card.uniqueId)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Library peek */}
      {showLibrary && (
        <div className="card-frame p-4">
          <h3 className="font-medieval text-lg text-gold-400 mb-3 flex items-center gap-2">
            <Library className="w-5 h-5" />
            Library ({library.length})
            <button onClick={() => setShowLibrary(false)} className="ml-auto text-parchment-400 hover:text-parchment-200">
              <EyeOff className="w-4 h-4" />
            </button>
          </h3>
          
          <div className="max-h-[250px] overflow-y-auto">
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
              {library.map((card, index) => (
                <div
                  key={`lib-${card.id}-${index}`}
                  className="relative aspect-[5/7] rounded overflow-hidden opacity-60 hover:opacity-100 transition-opacity"
                >
                  {card.imageNormal ? (
                    <Image src={card.imageNormal} alt={card.name} fill className="object-cover" sizes="80px" />
                  ) : (
                    <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-1">
                      <span className="text-[8px] text-center text-parchment-400">{card.name}</span>
                    </div>
                  )}
                  <div className="absolute top-0.5 left-0.5 px-1 py-0.5 bg-dungeon-900/80 rounded text-[8px] text-parchment-400">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Graveyard */}
      {showGraveyard && graveyard.length > 0 && (
        <div className="card-frame p-4">
          <h3 className="font-medieval text-lg text-gold-400 mb-3 flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Graveyard ({graveyard.length})
            <button onClick={() => setShowGraveyard(false)} className="ml-auto text-parchment-400 hover:text-parchment-200">
              <EyeOff className="w-4 h-4" />
            </button>
          </h3>
          
          <div className="flex flex-wrap gap-2">
            {graveyard.map((card, index) => (
              <div
                key={`gy-${card.id}-${index}`}
                className="relative group"
              >
                <div className="w-[70px] h-[98px] rounded overflow-hidden opacity-70 group-hover:opacity-100 transition-opacity">
                  {card.imageNormal ? (
                    <Image src={card.imageNormal} alt={card.name} fill className="object-cover" sizes="70px" />
                  ) : (
                    <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-1">
                      <span className="text-[8px] text-center text-parchment-400">{card.name}</span>
                    </div>
                  )}
                </div>
                {/* Actions on hover */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 z-10">
                  <button
                    onClick={() => graveyardToHand(index)}
                    className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[8px]"
                    title="Return to hand"
                  >
                    <Hand className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => graveyardToBattlefield(index)}
                    className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[8px]"
                    title="Reanimate"
                  >
                    <Play className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => graveyardToLibrary(index, true)}
                    className="p-1 bg-arcane-600 hover:bg-arcane-500 text-white rounded text-[8px]"
                    title="Top of library"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exile */}
      {showExile && exile.length > 0 && (
        <div className="card-frame p-4">
          <h3 className="font-medieval text-lg text-gold-400 mb-3 flex items-center gap-2">
            <Skull className="w-5 h-5" />
            Exile ({exile.length})
            <button onClick={() => setShowExile(false)} className="ml-auto text-parchment-400 hover:text-parchment-200">
              <EyeOff className="w-4 h-4" />
            </button>
          </h3>
          
          <div className="flex flex-wrap gap-2">
            {exile.map((card, index) => (
              <div
                key={`ex-${card.id}-${index}`}
                className="relative group"
              >
                <div className="w-[70px] h-[98px] rounded overflow-hidden grayscale opacity-70 group-hover:opacity-100 group-hover:grayscale-0 transition-all">
                  {card.imageNormal ? (
                    <Image src={card.imageNormal} alt={card.name} fill className="object-cover" sizes="70px" />
                  ) : (
                    <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-1">
                      <span className="text-[8px] text-center text-parchment-400">{card.name}</span>
                    </div>
                  )}
                </div>
                {/* Actions on hover */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 z-10">
                  <button
                    onClick={() => exileToHand(index)}
                    className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[8px]"
                    title="Return to hand"
                  >
                    <Hand className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => exileToBattlefield(index)}
                    className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[8px]"
                    title="Put into play"
                  >
                    <Play className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => exileToLibrary(index, true)}
                    className="p-1 bg-arcane-600 hover:bg-arcane-500 text-white rounded text-[8px]"
                    title="Top of library"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scry Modal */}
      {showScry && (
        <ScryModal
          cards={library.slice(0, scryCount)}
          scryCount={scryCount}
          setScryCount={setScryCount}
          maxScry={Math.min(library.length, 5)}
          onConfirm={performScry}
          onCancel={() => setShowScry(false)}
        />
      )}

      {/* Action log */}
      {actionLog.length > 0 && (
        <div className="text-xs text-parchment-600 border-t border-dungeon-700 pt-3 mt-4">
          <p className="font-medium mb-1">History:</p>
          <div className="max-h-16 overflow-y-auto space-y-0.5">
            {actionLog.slice(0, 5).map((log, i) => (
              <p key={i} className={i === 0 ? "text-parchment-400" : ""}>{log}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Battlefield card component
function BattlefieldCardComponent({ 
  card, 
  onTap, 
  onGraveyard, 
  onExile,
  onBounce,
  small = false 
}: { 
  card: BattlefieldCard
  onTap: () => void
  onGraveyard: () => void
  onExile: () => void
  onBounce: () => void
  small?: boolean
}) {
  const size = small ? "w-[60px] h-[84px]" : "w-[80px] h-[112px]"
  
  return (
    <div className="relative group">
      <button
        onClick={onTap}
        className={cn(
          size,
          "rounded overflow-hidden transition-transform",
          card.tapped && "rotate-90"
        )}
      >
        {card.imageNormal ? (
          <Image
            src={card.imageNormal}
            alt={card.name}
            fill
            className="object-cover"
            sizes={small ? "60px" : "80px"}
          />
        ) : (
          <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-1">
            <span className="text-[8px] text-center text-parchment-400">{card.name}</span>
          </div>
        )}
        
        {/* Tap indicator */}
        {card.tapped && (
          <div className="absolute inset-0 bg-dungeon-900/40" />
        )}
      </button>
      
      {/* Actions on hover */}
      <div className={cn(
        "absolute opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 z-10",
        card.tapped ? "top-1/2 -right-1 -translate-y-1/2 flex-col" : "-bottom-1 left-1/2 -translate-x-1/2 flex-row"
      )}>
        <button
          onClick={onTap}
          className="p-1 bg-arcane-600 hover:bg-arcane-500 text-white rounded text-[8px]"
          title={card.tapped ? "Untap" : "Tap"}
        >
          <RotateCw className="w-3 h-3" />
        </button>
        <button
          onClick={onBounce}
          className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[8px]"
          title="Return to hand"
        >
          <Undo2 className="w-3 h-3" />
        </button>
        <button
          onClick={onGraveyard}
          className="p-1 bg-dragon-600 hover:bg-dragon-500 text-white rounded text-[8px]"
          title="Graveyard"
        >
          <Trash2 className="w-3 h-3" />
        </button>
        <button
          onClick={onExile}
          className="p-1 bg-dungeon-600 hover:bg-dungeon-500 text-white rounded text-[8px]"
          title="Exile"
        >
          <Skull className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// Scry Modal
function ScryModal({
  cards,
  scryCount,
  setScryCount,
  maxScry,
  onConfirm,
  onCancel,
}: {
  cards: CardWithPrice[]
  scryCount: number
  setScryCount: (n: number) => void
  maxScry: number
  onConfirm: (keepOnTop: boolean[], bottomCards: CardWithPrice[]) => void
  onCancel: () => void
}) {
  const [decisions, setDecisions] = useState<boolean[]>(cards.map(() => true))

  const toggleDecision = (index: number) => {
    setDecisions(prev => {
      const newDecisions = [...prev]
      newDecisions[index] = !newDecisions[index]
      return newDecisions
    })
  }

  const handleConfirm = () => {
    const bottomCards = cards.filter((_, i) => !decisions[i])
    onConfirm(decisions, bottomCards)
  }

  // Reset decisions when scry count changes
  useEffect(() => {
    setDecisions(cards.map(() => true))
  }, [cards.length])

  return (
    <div className="fixed inset-0 bg-dungeon-900/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dungeon-800 border border-dungeon-600 rounded-xl p-6 max-w-lg w-full">
        <h3 className="font-medieval text-xl text-gold-400 mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Scry {scryCount}
        </h3>

        {/* Scry count selector */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-parchment-400">Count:</span>
          {[1, 2, 3, 4, 5].filter(n => n <= maxScry).map(n => (
            <button
              key={n}
              onClick={() => setScryCount(n)}
              className={cn(
                "w-8 h-8 rounded-full text-sm font-medium transition-colors",
                scryCount === n 
                  ? "bg-arcane-500 text-white" 
                  : "bg-dungeon-700 text-parchment-400 hover:bg-dungeon-600"
              )}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Cards */}
        <div className="flex justify-center gap-3 mb-6">
          {cards.map((card, index) => (
            <button
              key={`scry-${card.id}-${index}`}
              onClick={() => toggleDecision(index)}
              className={cn(
                "relative w-[100px] h-[140px] rounded-lg overflow-hidden transition-all",
                decisions[index] 
                  ? "ring-2 ring-emerald-500" 
                  : "ring-2 ring-dragon-500 opacity-60"
              )}
            >
              {card.imageNormal ? (
                <Image src={card.imageNormal} alt={card.name} fill className="object-cover" sizes="100px" />
              ) : (
                <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-2">
                  <span className="text-xs text-center text-parchment-400">{card.name}</span>
                </div>
              )}
              <div className={cn(
                "absolute bottom-0 left-0 right-0 py-1 text-center text-xs font-medium",
                decisions[index] ? "bg-emerald-500/90 text-white" : "bg-dragon-500/90 text-white"
              )}>
                {decisions[index] ? "↑ Top" : "↓ Bottom"}
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs text-parchment-500 text-center mb-4">
          Click a card to change its destination
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  )
}
