'use client'

import { useEffect, useMemo, useCallback, useState, useRef } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GameRoomProps, BattlefieldCardInfo, ZoneCardInfo } from '@/lib/game-room/types'
import { EMOTES, KEYBOARD_SHORTCUTS } from '@/lib/game-room/constants'
import { useGameState } from '@/hooks/game-room/use-game-state'
import { useGameActions, shuffleArray } from '@/hooks/game-room/use-game-actions'
import { usePhaseSystem } from '@/hooks/game-room/use-phase-system'
import { useGameLog } from '@/hooks/game-room/use-game-log'
import { useKeyboardShortcuts } from '@/hooks/game-room/use-keyboard-shortcuts'
import { HoverPreviewProvider } from '@/components/card/card-hover-preview'
import { GameLog } from './sidebar/game-log'
import { ChatEmotes } from './sidebar/chat-emotes'
import { ResponseAlert } from './systems/response-alert'
import { TokenCreator } from './systems/token-creator'
import { LobbyScreen } from './lobby-screen'
import { MulliganScreen } from './mulligan-screen'
import { OpponentBoard } from './board/opponent-board'
import { MyBoard } from './board/my-board'
import { TurnIndicator } from './hud/turn-indicator'
import { PhaseBar } from './hud/phase-bar'
import { HandZone } from './zones/hand-zone'
import { PlayerHud } from './hud/player-hud'
import { ZoneOverlay } from './zones/zone-overlay'

export function GameRoom({
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
  decks,
  selectedDeckId,
  onSelectDeck,
}: GameRoomProps) {
  const currentPlayer = players.find(p => p.id === playerId)
  const opponents = players.filter(p => p.id !== playerId)

  const state = useGameState(startingLife, cards)
  const phaseSystem = usePhaseSystem()
  const gameLog = useGameLog()
  const actions = useGameActions(state, currentPlayer, onNextTurn, phaseSystem, gameLog)

  // Game log sidebar state
  const [isLogOpen, setIsLogOpen] = useState(false)

  // Response alert state
  const [responseAlert, setResponseAlert] = useState<{
    isVisible: boolean
    opponentAction: string
    opponentName: string
    opponentColor: string
  } | null>(null)

  // Floating emote bubble state
  const [floatingEmote, setFloatingEmote] = useState<{
    playerName: string
    emote: string
  } | null>(null)

  const {
    library, hand, graveyard, exile, battlefield,
    life, manaPool, poisonCounters,
    gameInitialized, countdown,
    mulliganCount, mulliganPhase, selectedHandIndices,
    showLibrary, showGraveyard, showExile, showScry, showDeckMenu, showDeckSearch,
    scryCards, scryCount,
    deckSearchQuery, deckSearchSelected,
    previewCard,
    isFullscreen,
    viewingOpponentGraveyard, viewingOpponentExile,
    genericCounterPopup, genericCounterLabel,
    lastAction, isHoveringAction,
    gameContainerRef, onUpdateStatsRef, lastSyncRef,
    actionTimeoutRef, countdownRef, genericCounterInputRef,
    fullDeck,
    setCountdown, setLibrary, setHand, setGraveyard, setExile, setBattlefield,
    setLife, setManaPool, setPoisonCounters,
    setGameInitialized, setMulliganCount, setMulliganPhase, setSelectedHandIndices,
    setShowLibrary, setShowGraveyard, setShowExile, setShowScry, setShowDeckMenu, setShowDeckSearch,
    setScryCards, setScryCount,
    setDeckSearchQuery, setDeckSearchSelected,
    setPreviewCard,
    setIsFullscreen,
    setViewingOpponentGraveyard, setViewingOpponentExile,
    setGenericCounterPopup, setGenericCounterLabel,
    setLastAction, setIsHoveringAction,
    manaPoolColors, setManaPoolColors,
    showKeyboardHelp, setShowKeyboardHelp,
    showTokenCreator, setShowTokenCreator,
  } = state

  // Check if all players are ready
  const allPlayersReady = players.length >= 2 && players.every(p => p.isReady)

  // Whether we are still in mulligan
  const inMulliganScreen = gameInitialized && mulliganPhase !== 'done'

  // Track which turn we've already auto-started (to avoid re-triggering)
  const lastAutoStartedTurnRef = useRef<string | null>(null)

  // Keep onUpdateStats ref fresh
  onUpdateStatsRef.current = onUpdateStats

  // --- useEffect: Clear action when no longer hovering ---
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
  }, [isHoveringAction, lastAction, actionTimeoutRef, setLastAction])

  // --- useEffect: Start countdown when all ready ---
  useEffect(() => {
    if (allPlayersReady && gamePhase === 'lobby' && countdown === null) {
      setCountdown(3)
    }
    if (!allPlayersReady && countdown !== null && gamePhase === 'lobby') {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current)
        countdownRef.current = null
      }
      setCountdown(null)
    }
  }, [allPlayersReady, gamePhase, countdown, setCountdown, countdownRef])

  // --- useEffect: Countdown timer ---
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : prev))
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown, setCountdown])

  // --- useEffect: Initialize game when countdown reaches 0 ---
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
      setManaPoolColors({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 })
      setPoisonCounters(0)
      setMulliganCount(0)
      setMulliganPhase('choosing')
      setSelectedHandIndices(new Set())
      setGameInitialized(true)
    }
  }, [countdown, gameInitialized, fullDeck, startingLife, setLibrary, setHand, setGraveyard, setExile, setBattlefield, setLife, setManaPool, setPoisonCounters, setMulliganCount, setMulliganPhase, setSelectedHandIndices, setGameInitialized])

  // --- useEffect: Listen for fullscreen changes ---
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [setIsFullscreen])

  // --- useEffect: Close deck menu on outside click ---
  useEffect(() => {
    if (!showDeckMenu) return
    const handleClick = () => setShowDeckMenu(false)
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0)
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClick) }
  }, [showDeckMenu, setShowDeckMenu])

  // --- useEffect: Auto-start turn when it becomes our turn ---
  useEffect(() => {
    // Only auto-start if:
    // 1. Game is playing (not lobby/finished)
    // 2. Game is initialized
    // 3. Mulligan is done
    // 4. It's my turn
    // 5. We haven't already auto-started this specific turn
    if (
      gamePhase === 'playing' &&
      gameInitialized &&
      !inMulliganScreen &&
      isMyTurn &&
      currentTurn > 0
    ) {
      const turnKey = `${currentTurn}-${activePlayerId}`
      if (lastAutoStartedTurnRef.current !== turnKey) {
        lastAutoStartedTurnRef.current = turnKey
        // Small delay to ensure state is synced
        const timer = setTimeout(() => {
          // First player (turn 1) doesn't draw a card at the beginning of their first turn
          const isFirstTurn = currentTurn === 1
          actions.handleStartTurn(isFirstTurn)
        }, 300)
        return () => clearTimeout(timer)
      }
    }
  }, [gamePhase, gameInitialized, inMulliganScreen, isMyTurn, currentTurn, activePlayerId, actions])

  // --- Prepare battlefield/graveyard/exile cards info for sync ---
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

  // --- useEffect: Sync stats to server ---
  useEffect(() => {
    if (gamePhase !== 'playing' || !gameInitialized || inMulliganScreen) return

    const bfKey = battlefield.map(c => `${c.uniqueId}:${c.tapped}:${c.counters.plusOne}:${c.counters.minusOne}:${c.counters.genericCounters.map(g => `${g.label}=${g.count}`).join(';')}`).join(',')
    const gyKey = graveyard.map(c => c.name).join(',')
    const exKey = exile.map(c => c.name).join(',')
    const manaColorsKey = Object.values(manaPoolColors).join(':')
    const syncKey = `${life}-${manaPool}-${manaColorsKey}-${poisonCounters}-${hand.length}-${library.length}-${graveyard.length}-${exile.length}-${battlefield.length}-${bfKey}-${gyKey}-${exKey}`

    if (syncKey === lastSyncRef.current) return
    lastSyncRef.current = syncKey

    const timer = setTimeout(() => {
      onUpdateStatsRef.current?.({
        life,
        manaPool,
        manaPoolColors,
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
    }, 300)

    return () => clearTimeout(timer)
  }, [life, manaPool, manaPoolColors, poisonCounters, hand.length, library.length, graveyard.length, exile.length, battlefield, battlefieldCardsInfo, graveyardCardsInfo, exileCardsInfo, gamePhase, gameInitialized, inMulliganScreen, lastSyncRef, onUpdateStatsRef])

  // Callbacks for HUD that need to close deck menu
  const handleHudDraw = useCallback((count: number) => {
    actions.draw(count)
    setShowDeckMenu(false)
  }, [actions, setShowDeckMenu])

  const handleHudStartScry = useCallback((count: number) => {
    actions.startScry(count)
    setShowDeckMenu(false)
  }, [actions, setShowDeckMenu])

  const handleHudMill = useCallback((count: number) => {
    actions.mill(count)
    setShowDeckMenu(false)
  }, [actions, setShowDeckMenu])

  const handleHudExileTop = useCallback((count: number) => {
    actions.exileTop(count)
    setShowDeckMenu(false)
  }, [actions, setShowDeckMenu])

  const handleHudOpenDeckSearch = useCallback(() => {
    setShowDeckSearch(true)
    setDeckSearchQuery('')
    setDeckSearchSelected(new Set())
    setShowDeckMenu(false)
  }, [setShowDeckSearch, setDeckSearchQuery, setDeckSearchSelected, setShowDeckMenu])

  const handleHudToggleLibrary = useCallback(() => {
    setShowLibrary(!showLibrary)
    setShowDeckMenu(false)
  }, [showLibrary, setShowLibrary, setShowDeckMenu])

  const handleHudShuffleLibrary = useCallback(() => {
    actions.shuffleLibrary()
    setShowDeckMenu(false)
  }, [actions, setShowDeckMenu])

  const handleCancelScry = useCallback((remainingCards: { card: import('@/types/scryfall').CardWithPrice; originalIndex: number }[]) => {
    setLibrary(prev => [...remainingCards.map(e => e.card), ...prev])
    setScryCards([])
    setShowScry(false)
  }, [setLibrary, setScryCards, setShowScry])

  const handleCloseDeckSearch = useCallback(() => {
    setShowDeckSearch(false)
    actions.shuffleLibrary()
  }, [setShowDeckSearch, actions])

  // Close all overlays (for Escape key)
  const closeAllOverlays = useCallback(() => {
    setShowLibrary(false)
    setShowGraveyard(false)
    setShowExile(false)
    setShowScry(false)
    setShowDeckMenu(false)
    setShowDeckSearch(false)
    setShowKeyboardHelp(false)
    setShowTokenCreator(false)
    setViewingOpponentGraveyard(null)
    setViewingOpponentExile(null)
    setGenericCounterPopup(null)
  }, [setShowLibrary, setShowGraveyard, setShowExile, setShowScry, setShowDeckMenu, setShowDeckSearch, setShowKeyboardHelp, setShowTokenCreator, setViewingOpponentGraveyard, setViewingOpponentExile, setGenericCounterPopup])

  // Keyboard shortcuts
  const keyboardActions = useMemo(() => ({
    draw: () => actions.draw(1),
    untapAll: () => actions.untapAll(),
    advancePhase: () => actions.onAdvancePhase(),
    endTurn: () => actions.handleEndTurn(),
    shuffleLibrary: () => actions.shuffleLibrary(),
    createToken: () => setShowTokenCreator(true),
    openGraveyard: () => setShowGraveyard(prev => !prev),
    undo: () => actions.undo(),
    closeOverlays: closeAllOverlays,
    showHelp: () => setShowKeyboardHelp(prev => !prev),
  }), [actions, closeAllOverlays, setShowTokenCreator, setShowGraveyard, setShowKeyboardHelp])

  useKeyboardShortcuts(keyboardActions, gamePhase === 'playing' && !inMulliganScreen)

  // Handle sending emotes via SSE
  const handleSendEmote = useCallback((emoteId: string) => {
    if (!currentPlayer) return
    const emote = EMOTES.find(e => e.id === emoteId)
    if (!emote) return

    // Add to local log immediately
    gameLog.addEmoteLog(currentPlayer.name, currentPlayer.color, emote.label)

    // Broadcast via API (fire-and-forget)
    fetch(`/api/sessions/${(window as any).__gameSessionCode || ''}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'emote',
        playerId,
        emoteId,
        playerName: currentPlayer.name,
        playerColor: currentPlayer.color,
      }),
    }).catch(() => {})
  }, [currentPlayer, gameLog, playerId])

  // Handle response actions
  const handleRespond = useCallback(() => {
    if (!currentPlayer) return
    gameLog.addResponseLog(currentPlayer.name, currentPlayer.color, true)
    setResponseAlert(null)
  }, [currentPlayer, gameLog])

  const handlePassResponse = useCallback(() => {
    if (!currentPlayer) return
    gameLog.addResponseLog(currentPlayer.name, currentPlayer.color, false)
    setResponseAlert(null)
  }, [currentPlayer, gameLog])

  // Clear floating emote after 3 seconds
  useEffect(() => {
    if (!floatingEmote) return
    const timer = setTimeout(() => setFloatingEmote(null), 3000)
    return () => clearTimeout(timer)
  }, [floatingEmote])

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
      <LobbyScreen
        players={players}
        playerId={playerId}
        currentPlayer={currentPlayer}
        countdown={countdown}
        allPlayersReady={allPlayersReady}
        onSetReady={onSetReady}
        decks={decks}
        selectedDeckId={selectedDeckId}
        onSelectDeck={onSelectDeck}
      />
    )
  }

  // ========== MULLIGAN SCREEN ==========
  if (inMulliganScreen && gameInitialized) {
    return (
      <MulliganScreen
        hand={hand}
        mulliganCount={mulliganCount}
        mulliganPhase={mulliganPhase}
        selectedHandIndices={selectedHandIndices}
        onDoMulligan={actions.doMulligan}
        onKeepHand={actions.keepHand}
        onToggleMulliganSelection={actions.toggleMulliganSelection}
        onPutOnBottom={actions.putOnBottom}
      />
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
          onClick={actions.toggleFullscreen}
          className="fixed top-3 right-3 z-[110] p-2 bg-dungeon-800/90 hover:bg-dungeon-700 text-parchment-400 hover:text-parchment-200 rounded-lg border border-dungeon-600 transition-colors"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>

        {/* Response alert overlay */}
        <ResponseAlert
          isVisible={responseAlert?.isVisible ?? false}
          opponentAction={responseAlert?.opponentAction ?? ''}
          opponentName={responseAlert?.opponentName ?? ''}
          opponentColor={responseAlert?.opponentColor ?? ''}
          onRespond={handleRespond}
          onPass={handlePassResponse}
        />

        {/* Floating emote bubble */}
        {floatingEmote && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[115] animate-bounce">
            <div className="bg-dungeon-800/90 border border-arcane-500/40 rounded-full px-4 py-2 text-sm text-arcane-300 shadow-lg">
              <span className="font-medium text-parchment-200">{floatingEmote.playerName}:</span>{' '}
              {floatingEmote.emote}
            </div>
          </div>
        )}

        {/* Main game area */}
        <div className="flex-1 flex flex-col min-h-[calc(100vh-200px)]">
          {/* Opponent zone */}
          <OpponentBoard
            opponents={opponents}
            activePlayerId={activePlayerId}
            onPreviewCard={setPreviewCard}
            onViewOpponentGraveyard={setViewingOpponentGraveyard}
            onViewOpponentExile={setViewingOpponentExile}
          />

          {/* Turn indicator */}
          <TurnIndicator
            isMyTurn={isMyTurn}
            currentTurn={currentTurn}
            currentPhase={phaseSystem.currentPhase}
          />

          {/* Phase bar */}
          <PhaseBar
            currentPhase={phaseSystem.currentPhase}
            isMyTurn={isMyTurn}
            onAdvancePhase={actions.onAdvancePhase}
            onJumpToPhase={actions.onJumpToPhase}
          />

          {/* My battlefield */}
          <MyBoard
            battlefield={battlefield}
            fullDeckLength={fullDeck.length}
            onToggleTap={actions.toggleTap}
            onSendToGraveyard={actions.sendToGraveyard}
            onBounceToHand={actions.bounceToHand}
            onExileFromBattlefield={actions.exileFromBattlefield}
            onPutOnTopOfLibrary={actions.putOnTopOfLibrary}
            onAdjustCounter={actions.adjustCounter}
            onOpenGenericCounterPopup={actions.openGenericCounterPopup}
            onAdjustGenericCounter={actions.adjustGenericCounter}
            onRemoveGenericCounter={actions.removeGenericCounter}
            onPreviewCard={setPreviewCard}
          />

          {/* Zone overlays (library peek, graveyard, exile, scry, deck search, opponent zones, generic counter popup) */}
          <ZoneOverlay
            showLibrary={showLibrary}
            library={library}
            onCloseLibrary={() => setShowLibrary(false)}
            showGraveyard={showGraveyard}
            graveyard={graveyard}
            onCloseGraveyard={() => setShowGraveyard(false)}
            onGraveyardToHand={actions.graveyardToHand}
            onGraveyardToBattlefield={actions.graveyardToBattlefield}
            onGraveyardToLibraryTop={actions.graveyardToLibraryTop}
            showExile={showExile}
            exile={exile}
            onCloseExile={() => setShowExile(false)}
            onExileToHand={actions.exileToHand}
            onExileToBattlefield={actions.exileToBattlefield}
            showScry={showScry}
            scryCards={scryCards}
            scryCount={scryCount}
            onScryPutTop={actions.scryPutTop}
            onScryPutBottom={actions.scryPutBottom}
            onCloseScry={() => { setShowScry(false); setScryCards([]) }}
            onCancelScry={handleCancelScry}
            showDeckSearch={showDeckSearch}
            deckSearchQuery={deckSearchQuery}
            deckSearchSelected={deckSearchSelected}
            onDeckSearchQueryChange={setDeckSearchQuery}
            onToggleDeckSearchSelection={actions.toggleDeckSearchSelection}
            onDeckSearchToTop={actions.deckSearchToTop}
            onDeckSearchToHand={actions.deckSearchToHand}
            onCloseDeckSearch={handleCloseDeckSearch}
            viewingOpponentGraveyard={viewingOpponentGraveyard}
            opponents={opponents}
            onCloseOpponentGraveyard={() => setViewingOpponentGraveyard(null)}
            viewingOpponentExile={viewingOpponentExile}
            onCloseOpponentExile={() => setViewingOpponentExile(null)}
            genericCounterPopup={genericCounterPopup}
            genericCounterLabel={genericCounterLabel}
            genericCounterInputRef={genericCounterInputRef}
            onGenericCounterLabelChange={setGenericCounterLabel}
            onConfirmGenericCounter={actions.confirmGenericCounter}
            onCloseGenericCounterPopup={() => setGenericCounterPopup(null)}
            fullDeckLength={fullDeck.length}
          />

          {/* Token Creator Modal */}
          <TokenCreator
            isOpen={showTokenCreator}
            onClose={() => setShowTokenCreator(false)}
            onCreateToken={(tokenData) => {
              actions.createToken(tokenData)
              setShowTokenCreator(false)
            }}
          />

          {/* Keyboard Help Modal */}
          <AnimatePresence>
            {showKeyboardHelp && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={() => setShowKeyboardHelp(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-dungeon-800 border border-gold-500/30 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 py-3 border-b border-dungeon-600 bg-dungeon-900/50">
                    <h3 className="text-lg font-bold text-gold-400">Keyboard Shortcuts</h3>
                  </div>
                  <div className="p-4 space-y-1.5">
                    {Object.entries(KEYBOARD_SHORTCUTS).map(([key, desc]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm text-parchment-300">{desc}</span>
                        <kbd className="px-2 py-0.5 bg-dungeon-900 border border-dungeon-600 rounded text-xs text-gold-400 font-mono">
                          {key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t border-dungeon-600 text-center">
                    <button
                      onClick={() => setShowKeyboardHelp(false)}
                      className="text-sm text-parchment-500 hover:text-parchment-200 transition-colors"
                    >
                      Press Escape or click to close
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Player HUD (bottom) */}
          <PlayerHud
            life={life}
            poisonCounters={poisonCounters}
            graveyard={graveyard}
            exile={exile}
            library={library}
            fullDeckLength={fullDeck.length}
            isMyTurn={isMyTurn}
            showDeckMenu={showDeckMenu}
            showLibrary={showLibrary}
            showGraveyard={showGraveyard}
            showExile={showExile}
            manaPoolColors={manaPoolColors}
            onAdjustLife={actions.adjustLife}
            onAdjustPoison={actions.adjustPoison}
            onAdjustManaColor={actions.adjustManaColor}
            onToggleGraveyard={() => setShowGraveyard(!showGraveyard)}
            onToggleExile={() => setShowExile(!showExile)}
            onToggleDeckMenu={() => setShowDeckMenu(!showDeckMenu)}
            onDraw={handleHudDraw}
            onStartScry={handleHudStartScry}
            onMill={handleHudMill}
            onExileTop={handleHudExileTop}
            onOpenDeckSearch={handleHudOpenDeckSearch}
            onToggleLibrary={handleHudToggleLibrary}
            onShuffleLibrary={handleHudShuffleLibrary}
            onStartTurn={actions.handleStartTurn}
            onEndTurn={actions.handleEndTurn}
            onAdvancePhase={actions.onAdvancePhase}
            onToggleKeyboardHelp={() => setShowKeyboardHelp(prev => !prev)}
          />

          {/* Hand zone */}
          <HandZone
            hand={hand}
            fullDeckLength={fullDeck.length}
            onPlayCard={actions.playCard}
            onDiscardCard={actions.discardCard}
            onExileFromHand={actions.exileFromHand}
          />
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

        {/* Game log sidebar */}
        <div className="flex flex-col h-full">
          <GameLog
            entries={gameLog.entries}
            isOpen={isLogOpen}
            onToggle={() => setIsLogOpen(prev => !prev)}
          />
          {isLogOpen && (
            <ChatEmotes onSendEmote={handleSendEmote} />
          )}
        </div>
      </div>
    </HoverPreviewProvider>
  )
}
