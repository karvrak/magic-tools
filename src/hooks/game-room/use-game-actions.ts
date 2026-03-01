'use client'

import { useCallback } from 'react'
import { CardWithPrice } from '@/types/scryfall'
import { BattlefieldCard, LastAction, GamePlayer, ManaPoolColors, DEFAULT_MANA_POOL_COLORS } from '@/lib/game-room/types'
import { GamePhase } from '@/lib/game-room/constants'
import { PhaseSystem } from './use-phase-system'
import { GameState } from './use-game-state'
import { GameLog } from './use-game-log'

/** Fisher-Yates shuffle */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/** Check if a card is a land */
export function isLand(card: CardWithPrice | null | undefined): boolean {
  if (!card || !card.typeLine) return false
  return card.typeLine.toLowerCase().includes('land')
}

/** Check if a card is a creature */
export function isCreature(card: CardWithPrice | null | undefined): boolean {
  if (!card || !card.typeLine) return false
  return card.typeLine.toLowerCase().includes('creature')
}

/** Generate unique ID for battlefield cards */
export function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export interface GameActions {
  draw: (count?: number) => void
  playCard: (index: number) => void
  discardCard: (index: number) => void
  toggleTap: (uniqueId: string) => void
  sendToGraveyard: (uniqueId: string) => void
  bounceToHand: (uniqueId: string) => void
  putOnTopOfLibrary: (uniqueId: string) => void
  putOnBottomOfLibrary: (uniqueId: string) => void
  graveyardToHand: (index: number) => void
  graveyardToBattlefield: (index: number) => void
  graveyardToLibraryTop: (index: number) => void
  exileFromHand: (index: number) => void
  exileFromBattlefield: (uniqueId: string) => void
  exileToHand: (index: number) => void
  exileToBattlefield: (index: number) => void
  mill: (count?: number) => void
  exileTop: (count?: number) => void
  shuffleLibrary: () => void
  startScry: (count: number) => void
  scryPutTop: (index: number) => void
  scryPutBottom: (index: number) => void
  toggleDeckSearchSelection: (index: number) => void
  deckSearchToTop: () => void
  deckSearchToHand: () => void
  adjustLife: (amount: number) => void
  adjustPoison: (amount: number) => void
  adjustCounter: (uniqueId: string, type: 'plusOne' | 'minusOne', delta: number) => void
  openGenericCounterPopup: (uniqueId: string) => void
  confirmGenericCounter: () => void
  adjustGenericCounter: (uniqueId: string, label: string, delta: number) => void
  removeGenericCounter: (uniqueId: string, label: string) => void
  handleStartTurn: () => void
  handleEndTurn: () => void
  onAdvancePhase: () => void
  onJumpToPhase: (phase: GamePhase) => void
  toggleFullscreen: () => void
  doMulligan: () => void
  keepHand: () => void
  toggleMulliganSelection: (index: number) => void
  putOnBottom: () => void
  recordAction: (card: CardWithPrice | null | undefined, action: LastAction['action']) => void
  undo: () => void
  untapAll: () => void
  createToken: (tokenData: { name: string; power: string; toughness: string; type: string; color: string }) => void
  adjustManaColor: (color: keyof ManaPoolColors, delta: number) => void
}

export function useGameActions(
  state: GameState,
  currentPlayer: GamePlayer | undefined,
  onNextTurn: () => void,
  phaseSystem?: PhaseSystem,
  gameLog?: GameLog
): GameActions {
  const {
    library, setLibrary,
    hand, setHand,
    graveyard, setGraveyard,
    exile, setExile,
    battlefield, setBattlefield,
    setLife,
    manaPool, setManaPool,
    setPoisonCounters,
    mulliganCount, setMulliganCount,
    mulliganPhase, setMulliganPhase,
    selectedHandIndices, setSelectedHandIndices,
    setShowScry, setShowDeckSearch,
    scryCards, setScryCards,
    setScryCount,
    deckSearchQuery, setDeckSearchQuery,
    deckSearchSelected, setDeckSearchSelected,
    setGenericCounterPopup,
    genericCounterPopup,
    genericCounterLabel, setGenericCounterLabel,
    setLastAction,
    isHoveringAction,
    actionTimeoutRef,
    genericCounterInputRef,
    fullDeck,
    setIsFullscreen,
    manaPoolColors, setManaPoolColors,
    pushUndoSnapshot, popUndoSnapshot,
  } = state

  // Helper to record last action
  const recordAction = useCallback((
    card: CardWithPrice | null | undefined,
    action: LastAction['action']
  ) => {
    if (!card || !currentPlayer) return

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

    actionTimeoutRef.current = setTimeout(() => {
      if (!isHoveringAction) {
        setLastAction(null)
      }
    }, 3000)
  }, [currentPlayer, isHoveringAction, actionTimeoutRef, setLastAction])

  // Draw card(s)
  const draw = useCallback((count: number = 1) => {
    if (library.length === 0) return
    const drawCount = Math.min(count, library.length)
    const drawnCards = library.slice(0, drawCount)
    setHand(prev => [...prev, ...drawnCards])
    setLibrary(prev => prev.slice(drawCount))
    if (gameLog && currentPlayer) {
      gameLog.addActionLog(currentPlayer.name, currentPlayer.color, `draws ${drawCount} card(s)`)
    }
  }, [library, setHand, setLibrary, gameLog, currentPlayer])

  // Play card from hand
  const playCard = useCallback((index: number) => {
    const card = hand[index]
    if (!card) return
    pushUndoSnapshot()
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
    if (gameLog && currentPlayer) {
      gameLog.addActionLog(currentPlayer.name, currentPlayer.color, `plays ${card.printedName || card.name || 'Unknown'}`)
    }
  }, [hand, recordAction, setHand, setBattlefield, setManaPool, gameLog, currentPlayer, pushUndoSnapshot])

  // Discard card
  const discardCard = useCallback((index: number) => {
    const card = hand[index]
    if (!card) return
    pushUndoSnapshot()
    setHand(prev => prev.filter((_, i) => i !== index))
    setGraveyard(prev => [card, ...prev])
    recordAction(card, 'discard')
    if (gameLog && currentPlayer) {
      gameLog.addActionLog(currentPlayer.name, currentPlayer.color, `discards ${card.printedName || card.name || 'Unknown'}`)
    }
  }, [hand, recordAction, setHand, setGraveyard, gameLog, currentPlayer, pushUndoSnapshot])

  // Toggle tap
  const toggleTap = useCallback((uniqueId: string) => {
    setBattlefield(prev => prev.map(card =>
      card.uniqueId === uniqueId ? { ...card, tapped: !card.tapped } : card
    ))
  }, [setBattlefield])

  // Send to graveyard from battlefield
  const sendToGraveyard = useCallback((uniqueId: string) => {
    const card = battlefield.find(c => c.uniqueId === uniqueId)
    if (!card) return
    pushUndoSnapshot()
    setBattlefield(prev => prev.filter(c => c.uniqueId !== uniqueId))
    setGraveyard(prev => [card, ...prev])
    recordAction(card, 'destroy')
    if (gameLog && currentPlayer) {
      gameLog.addActionLog(currentPlayer.name, currentPlayer.color, `sends ${card.printedName || card.name || 'Unknown'} to graveyard`)
    }
  }, [battlefield, recordAction, setBattlefield, setGraveyard, gameLog, currentPlayer, pushUndoSnapshot])

  // Bounce to hand
  const bounceToHand = useCallback((uniqueId: string) => {
    const card = battlefield.find(c => c.uniqueId === uniqueId)
    if (!card) return
    pushUndoSnapshot()
    setBattlefield(prev => prev.filter(c => c.uniqueId !== uniqueId))
    setHand(prev => [...prev, card])
    recordAction(card, 'bounce')
    if (gameLog && currentPlayer) {
      gameLog.addActionLog(currentPlayer.name, currentPlayer.color, `bounces ${card.printedName || card.name || 'Unknown'}`)
    }
  }, [battlefield, recordAction, setBattlefield, setHand, gameLog, currentPlayer, pushUndoSnapshot])

  // Put on top of library from battlefield
  const putOnTopOfLibrary = useCallback((uniqueId: string) => {
    const card = battlefield.find(c => c.uniqueId === uniqueId)
    if (!card) return
    pushUndoSnapshot()
    setBattlefield(prev => prev.filter(c => c.uniqueId !== uniqueId))
    setLibrary(prev => [card, ...prev])
    if (gameLog && currentPlayer) {
      gameLog.addActionLog(currentPlayer.name, currentPlayer.color, `puts ${card.printedName || card.name || 'Unknown'} on top of library`)
    }
  }, [battlefield, setBattlefield, setLibrary, gameLog, currentPlayer, pushUndoSnapshot])

  // Put on bottom of library from battlefield
  const putOnBottomOfLibrary = useCallback((uniqueId: string) => {
    const card = battlefield.find(c => c.uniqueId === uniqueId)
    if (!card) return
    pushUndoSnapshot()
    setBattlefield(prev => prev.filter(c => c.uniqueId !== uniqueId))
    setLibrary(prev => [...prev, card])
    if (gameLog && currentPlayer) {
      gameLog.addActionLog(currentPlayer.name, currentPlayer.color, `puts ${card.printedName || card.name || 'Unknown'} on bottom of library`)
    }
  }, [battlefield, setBattlefield, setLibrary, gameLog, currentPlayer, pushUndoSnapshot])

  // Graveyard to hand
  const graveyardToHand = useCallback((index: number) => {
    const card = graveyard[index]
    if (!card) return
    setGraveyard(prev => prev.filter((_, i) => i !== index))
    setHand(prev => [...prev, card])
  }, [graveyard, setGraveyard, setHand])

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
  }, [graveyard, setGraveyard, setBattlefield])

  // Graveyard to library top
  const graveyardToLibraryTop = useCallback((index: number) => {
    const card = graveyard[index]
    if (!card) return
    pushUndoSnapshot()
    setGraveyard(prev => prev.filter((_, i) => i !== index))
    setLibrary(prev => [card, ...prev])
    if (gameLog && currentPlayer) {
      gameLog.addActionLog(currentPlayer.name, currentPlayer.color, `puts ${card.printedName || card.name || 'Unknown'} on top of library`)
    }
  }, [graveyard, setGraveyard, setLibrary, gameLog, currentPlayer, pushUndoSnapshot])

  // Start of turn - untap all, reset mana, draw, advance through phases
  const handleStartTurn = useCallback(() => {
    // Log the turn start (turn number is not available here, so we use a generic message)
    // Untap phase: untap all permanents and reset mana
    setBattlefield(prev => prev.map(card => ({ ...card, tapped: false })))
    const landCount = battlefield.filter(c => isLand(c)).length
    setManaPool(landCount)

    if (phaseSystem) {
      // Walk through untap -> upkeep -> draw (auto-draw) -> main1
      phaseSystem.beginTurn()
      // Small delay to visually step through early phases, then settle on main1
      setTimeout(() => {
        phaseSystem.jumpToPhase('upkeep')
        setTimeout(() => {
          phaseSystem.jumpToPhase('draw')
          draw(1)
          setTimeout(() => {
            phaseSystem.jumpToPhase('main1')
          }, 200)
        }, 200)
      }, 200)
    } else {
      draw(1)
    }
  }, [battlefield, draw, setBattlefield, setManaPool, phaseSystem, gameLog, currentPlayer])

  // End turn
  const handleEndTurn = useCallback(() => {
    onNextTurn()
  }, [onNextTurn])

  // Mill top card(s)
  const mill = useCallback((count: number = 1) => {
    if (library.length === 0) return
    pushUndoSnapshot()
    const millCount = Math.min(count, library.length)
    const milledCards = library.slice(0, millCount)
    setGraveyard(prev => [...milledCards, ...prev])
    setLibrary(prev => prev.slice(millCount))
    if (gameLog && currentPlayer) {
      gameLog.addActionLog(currentPlayer.name, currentPlayer.color, `mills ${millCount} card(s)`)
    }
  }, [library, setGraveyard, setLibrary, gameLog, currentPlayer, pushUndoSnapshot])

  // Exile top card(s)
  const exileTop = useCallback((count: number = 1) => {
    if (library.length === 0) return
    pushUndoSnapshot()
    const exileCount = Math.min(count, library.length)
    const exiledCards = library.slice(0, exileCount)
    setExile(prev => [...exiledCards, ...prev])
    setLibrary(prev => prev.slice(exileCount))
  }, [library, setExile, setLibrary, pushUndoSnapshot])

  // Shuffle library
  const shuffleLibrary = useCallback(() => {
    setLibrary(prev => shuffleArray(prev))
    if (gameLog && currentPlayer) {
      gameLog.addActionLog(currentPlayer.name, currentPlayer.color, 'shuffles library')
    }
  }, [setLibrary, gameLog, currentPlayer])

  // Start scry
  const startScry = useCallback((count: number) => {
    const n = Math.min(count, library.length)
    const cards = library.slice(0, n).map((card, i) => ({ card, originalIndex: i }))
    setScryCards(cards)
    setScryCount(count)
    setShowScry(true)
    setLibrary(prev => prev.slice(n))
  }, [library, setScryCards, setScryCount, setShowScry, setLibrary])

  // Scry: put card on top
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
  }, [scryCards, setLibrary, setShowScry, setScryCards])

  // Scry: put card on bottom
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
  }, [scryCards, setLibrary, setShowScry, setScryCards])

  // Deck search: toggle card selection
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
  }, [setDeckSearchSelected])

  // Deck search: put selected on top
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
  }, [library, deckSearchSelected, setLibrary, setShowDeckSearch, setDeckSearchQuery, setDeckSearchSelected])

  // Deck search: put selected in hand
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
  }, [library, deckSearchSelected, setHand, setLibrary, setShowDeckSearch, setDeckSearchQuery, setDeckSearchSelected])

  // Exile from hand
  const exileFromHand = useCallback((index: number) => {
    const card = hand[index]
    if (!card) return
    pushUndoSnapshot()
    setHand(prev => prev.filter((_, i) => i !== index))
    setExile(prev => [card, ...prev])
  }, [hand, setHand, setExile, pushUndoSnapshot])

  // Exile from battlefield
  const exileFromBattlefield = useCallback((uniqueId: string) => {
    const card = battlefield.find(c => c.uniqueId === uniqueId)
    if (!card) return
    pushUndoSnapshot()
    setBattlefield(prev => prev.filter(c => c.uniqueId !== uniqueId))
    setExile(prev => [card, ...prev])
    if (gameLog && currentPlayer) {
      gameLog.addActionLog(currentPlayer.name, currentPlayer.color, `exiles ${card.printedName || card.name || 'Unknown'}`)
    }
  }, [battlefield, setBattlefield, setExile, gameLog, currentPlayer, pushUndoSnapshot])

  // Exile to hand
  const exileToHand = useCallback((index: number) => {
    const card = exile[index]
    if (!card) return
    setExile(prev => prev.filter((_, i) => i !== index))
    setHand(prev => [...prev, card])
  }, [exile, setExile, setHand])

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
  }, [exile, setExile, setBattlefield])

  // Adjust life
  const adjustLife = useCallback((amount: number) => {
    setLife(l => l + amount)
  }, [setLife])

  // Adjust poison
  const adjustPoison = useCallback((amount: number) => {
    setPoisonCounters(p => Math.max(0, p + amount))
  }, [setPoisonCounters])

  // Adjust +1/+1 or -1/-1 counter
  const adjustCounter = useCallback((uniqueId: string, type: 'plusOne' | 'minusOne', delta: number) => {
    setBattlefield(prev => prev.map(card =>
      card.uniqueId === uniqueId
        ? { ...card, counters: { ...card.counters, [type]: Math.max(0, card.counters[type] + delta) } }
        : card
    ))
  }, [setBattlefield])

  // Open popup to add a named generic counter
  const openGenericCounterPopup = useCallback((uniqueId: string) => {
    setGenericCounterPopup({ uniqueId })
    setGenericCounterLabel('')
    setTimeout(() => genericCounterInputRef.current?.focus(), 50)
  }, [setGenericCounterPopup, setGenericCounterLabel, genericCounterInputRef])

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
  }, [genericCounterPopup, genericCounterLabel, setBattlefield, setGenericCounterPopup, setGenericCounterLabel])

  // Adjust existing generic counter
  const adjustGenericCounter = useCallback((uniqueId: string, label: string, delta: number) => {
    setBattlefield(prev => prev.map(card => {
      if (card.uniqueId !== uniqueId) return card
      const updatedGeneric = card.counters.genericCounters
        .map(c => c.label === label ? { ...c, count: c.count + delta } : c)
        .filter(c => c.count > 0)
      return { ...card, counters: { ...card.counters, genericCounters: updatedGeneric } }
    }))
  }, [setBattlefield])

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
  }, [setBattlefield])

  // Phase navigation
  const onAdvancePhase = useCallback(() => {
    phaseSystem?.advancePhase()
  }, [phaseSystem])

  const onJumpToPhase = useCallback((phase: GamePhase) => {
    phaseSystem?.jumpToPhase(phase)
  }, [phaseSystem])

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  // London Mulligan
  const doMulligan = useCallback(() => {
    if (mulliganCount >= 2) return
    const newCount = mulliganCount + 1
    const shuffled = shuffleArray(fullDeck)
    const newHand = shuffled.slice(0, 7)
    const newLibrary = shuffled.slice(7)
    setLibrary(newLibrary)
    setHand(newHand)
    setMulliganCount(newCount)
    setSelectedHandIndices(new Set())
    setMulliganPhase('choosing')
  }, [fullDeck, mulliganCount, setLibrary, setHand, setMulliganCount, setSelectedHandIndices, setMulliganPhase])

  // Keep hand
  const keepHand = useCallback(() => {
    if (mulliganCount > 0) {
      setMulliganPhase('selecting-bottom')
      setSelectedHandIndices(new Set())
    } else {
      setMulliganPhase('done')
    }
  }, [mulliganCount, setMulliganPhase, setSelectedHandIndices])

  // Toggle card selection for putting on bottom
  const toggleMulliganSelection = useCallback((index: number) => {
    const newSelection = new Set(selectedHandIndices)
    if (newSelection.has(index)) {
      newSelection.delete(index)
    } else if (newSelection.size < mulliganCount) {
      newSelection.add(index)
    }
    setSelectedHandIndices(newSelection)
  }, [selectedHandIndices, mulliganCount, setSelectedHandIndices])

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
  }, [hand, selectedHandIndices, mulliganCount, setHand, setLibrary, setSelectedHandIndices, setMulliganPhase])

  // Undo last action by restoring the most recent snapshot
  const undo = useCallback(() => {
    const snapshot = popUndoSnapshot()
    if (!snapshot) return
    setHand(snapshot.hand)
    setLibrary(snapshot.library)
    setGraveyard(snapshot.graveyard)
    setExile(snapshot.exile)
    setBattlefield(snapshot.battlefield)
    state.setLife(snapshot.life)
    setManaPoolColors(snapshot.manaPoolColors)
    state.setPoisonCounters(snapshot.poisonCounters)
    if (gameLog && currentPlayer) {
      gameLog.addActionLog(currentPlayer.name, currentPlayer.color, 'undoes last action')
    }
  }, [popUndoSnapshot, setHand, setLibrary, setGraveyard, setExile, setBattlefield, state, setManaPoolColors, gameLog, currentPlayer])

  // Untap all permanents (standalone, for keyboard shortcut)
  const untapAll = useCallback(() => {
    setBattlefield(prev => prev.map(card => ({ ...card, tapped: false })))
    if (gameLog && currentPlayer) {
      gameLog.addActionLog(currentPlayer.name, currentPlayer.color, 'untaps all permanents')
    }
  }, [setBattlefield, gameLog, currentPlayer])

  // Create a token on the battlefield
  const createToken = useCallback((tokenData: { name: string; power: string; toughness: string; type: string; color: string }) => {
    const isCreatureToken = tokenData.type.toLowerCase().includes('creature')
    const hasStats = tokenData.power && tokenData.toughness && isCreatureToken

    const tokenCard: BattlefieldCard = {
      id: `token-${generateUniqueId()}`,
      name: hasStats ? `${tokenData.name} (${tokenData.power}/${tokenData.toughness})` : tokenData.name,
      printedName: tokenData.name,
      typeLine: tokenData.type,
      printedTypeLine: tokenData.type,
      power: hasStats ? tokenData.power : undefined,
      toughness: hasStats ? tokenData.toughness : undefined,
      colors: tokenData.color === 'C' ? [] : [tokenData.color],
      colorIdentity: tokenData.color === 'C' ? [] : [tokenData.color],
      imageNormal: null,
      imageSmall: null,
      uniqueId: generateUniqueId(),
      tapped: false,
      counters: { plusOne: 0, minusOne: 0, genericCounters: [] },
      isToken: true,
    } as unknown as BattlefieldCard
    setBattlefield(prev => [...prev, tokenCard])
    if (gameLog && currentPlayer) {
      const statsText = hasStats ? `${tokenData.power}/${tokenData.toughness} ` : ''
      gameLog.addActionLog(currentPlayer.name, currentPlayer.color, `creates a ${statsText}${tokenData.name} token`)
    }
  }, [setBattlefield, gameLog, currentPlayer])

  // Adjust a specific mana color
  const adjustManaColor = useCallback((color: keyof ManaPoolColors, delta: number) => {
    setManaPoolColors(prev => ({
      ...prev,
      [color]: Math.max(0, prev[color] + delta),
    }))
  }, [setManaPoolColors])

  return {
    draw,
    playCard,
    discardCard,
    toggleTap,
    sendToGraveyard,
    bounceToHand,
    putOnTopOfLibrary,
    putOnBottomOfLibrary,
    graveyardToHand,
    graveyardToBattlefield,
    graveyardToLibraryTop,
    exileFromHand,
    exileFromBattlefield,
    exileToHand,
    exileToBattlefield,
    mill,
    exileTop,
    shuffleLibrary,
    startScry,
    scryPutTop,
    scryPutBottom,
    toggleDeckSearchSelection,
    deckSearchToTop,
    deckSearchToHand,
    adjustLife,
    adjustPoison,
    adjustCounter,
    openGenericCounterPopup,
    confirmGenericCounter,
    adjustGenericCounter,
    removeGenericCounter,
    handleStartTurn,
    handleEndTurn,
    onAdvancePhase,
    onJumpToPhase,
    toggleFullscreen,
    doMulligan,
    keepHand,
    toggleMulliganSelection,
    putOnBottom,
    recordAction,
    undo,
    untapAll,
    createToken,
    adjustManaColor,
  }
}
