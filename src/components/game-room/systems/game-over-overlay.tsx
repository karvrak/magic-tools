'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Skull, RotateCcw, Home, Flag, Loader2, X, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GamePlayer } from '@/lib/game-room/types'

export type RematchState =
  | { status: 'idle' }
  | { status: 'requesting'; requesterId: string; requesterName: string }
  | { status: 'waiting_response'; timeLeft: number }
  | { status: 'declined'; responderName: string }
  | { status: 'cancelled' }

interface GameOverOverlayProps {
  isVisible: boolean
  winner: GamePlayer | null
  currentPlayerId: string
  players: GamePlayer[]
  rematchState?: RematchState
  onRematch?: () => void
  onRematchAccept?: () => void
  onRematchDecline?: () => void
  onRematchCancel?: () => void
  onNewGame?: () => void
  onLeave?: () => void
}

export function GameOverOverlay({
  isVisible,
  winner,
  currentPlayerId,
  players,
  rematchState = { status: 'idle' },
  onRematch,
  onRematchAccept,
  onRematchDecline,
  onRematchCancel,
  onNewGame,
  onLeave,
}: GameOverOverlayProps) {
  const isWinner = winner?.id === currentPlayerId
  const currentPlayer = players.find(p => p.id === currentPlayerId)

  // Check if we are the one receiving a rematch request
  const isReceivingRequest = rematchState.status === 'requesting' && rematchState.requesterId !== currentPlayerId
  // Check if we are waiting for response (we sent the request)
  const isWaitingForResponse = rematchState.status === 'waiting_response'

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-dungeon-950/90 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={cn(
              "relative w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden",
              isWinner
                ? "bg-gradient-to-b from-gold-500/20 via-dungeon-800 to-dungeon-900 border-2 border-gold-500/50"
                : "bg-gradient-to-b from-dragon-500/20 via-dungeon-800 to-dungeon-900 border-2 border-dragon-500/50"
            )}
          >
            {/* Header with icon */}
            <div className="text-center pt-8 pb-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className={cn(
                  "inline-flex items-center justify-center w-20 h-20 rounded-full mb-4",
                  isWinner ? "bg-gold-500/30" : "bg-dragon-500/30"
                )}
              >
                {isWinner ? (
                  <Trophy className="w-10 h-10 text-gold-400" />
                ) : (
                  <Skull className="w-10 h-10 text-dragon-400" />
                )}
              </motion.div>
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  "font-medieval text-3xl mb-2",
                  isWinner ? "text-gold-400" : "text-dragon-400"
                )}
              >
                {isWinner ? 'Victory!' : 'Defeat'}
              </motion.h2>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-parchment-400"
              >
                {winner ? (
                  isWinner
                    ? 'You have won the game!'
                    : `${winner.name} wins!`
                ) : (
                  'Game Over'
                )}
              </motion.p>
            </div>

            {/* Player stats */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="px-6 pb-4"
            >
              <div className="space-y-2">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg",
                      player.id === winner?.id
                        ? "bg-gold-500/20 border border-gold-500/30"
                        : player.isEliminated
                          ? "bg-dragon-500/10 border border-dragon-500/20"
                          : "bg-dungeon-700/50 border border-dungeon-600"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: player.color }}
                      >
                        {player.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className={cn(
                          "font-medium",
                          player.id === winner?.id ? "text-gold-400" : "text-parchment-200"
                        )}>
                          {player.name}
                          {player.id === currentPlayerId && (
                            <span className="text-xs text-parchment-500 ml-2">(you)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {player.id === winner?.id && (
                        <Trophy className="w-4 h-4 text-gold-400" />
                      )}
                      {player.isEliminated && player.id !== winner?.id && (
                        <Skull className="w-4 h-4 text-dragon-400" />
                      )}
                      <span className={cn(
                        "text-sm font-medium",
                        player.life <= 0 ? "text-dragon-400" : "text-parchment-300"
                      )}>
                        {player.life} HP
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Action buttons */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="px-6 pb-6 space-y-3"
            >
              {/* Rematch request received - show accept/decline */}
              {isReceivingRequest && rematchState.status === 'requesting' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-arcane-500/20 border border-arcane-500/30">
                    <Clock className="w-5 h-5 text-arcane-400 animate-pulse" />
                    <span className="text-parchment-200">
                      <span className="font-semibold text-arcane-400">{rematchState.requesterName}</span>
                      {' '}wants a rematch!
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={onRematchAccept}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                      size="lg"
                    >
                      <RotateCcw className="w-5 h-5 mr-2" />
                      Accept
                    </Button>
                    <Button
                      onClick={onRematchDecline}
                      variant="outline"
                      className="flex-1 text-dragon-400 border-dragon-500/30 hover:bg-dragon-500/10"
                      size="lg"
                    >
                      <X className="w-5 h-5 mr-2" />
                      Decline
                    </Button>
                  </div>
                </div>
              )}

              {/* Waiting for opponent response */}
              {isWaitingForResponse && rematchState.status === 'waiting_response' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-gold-500/20 border border-gold-500/30">
                    <Loader2 className="w-5 h-5 text-gold-400 animate-spin" />
                    <span className="text-parchment-200">
                      Waiting for opponent...
                    </span>
                    <span className="text-gold-400 font-mono font-bold">
                      {rematchState.timeLeft}s
                    </span>
                  </div>
                  <Button
                    onClick={onRematchCancel}
                    variant="outline"
                    className="w-full text-parchment-400"
                    size="lg"
                  >
                    <X className="w-5 h-5 mr-2" />
                    Cancel
                  </Button>
                </div>
              )}

              {/* Rematch was declined */}
              {rematchState.status === 'declined' && (
                <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-dragon-500/20 border border-dragon-500/30 mb-3">
                  <X className="w-5 h-5 text-dragon-400" />
                  <span className="text-parchment-200">
                    <span className="font-semibold text-dragon-400">{rematchState.responderName}</span>
                    {' '}declined the rematch
                  </span>
                </div>
              )}

              {/* Normal state - show rematch button */}
              {rematchState.status === 'idle' && onRematch && (
                <Button
                  onClick={onRematch}
                  className="w-full bg-gold-600 hover:bg-gold-500 text-dungeon-900 font-semibold"
                  size="lg"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Rematch
                </Button>
              )}

              {/* New game and leave buttons - always show unless receiving request */}
              {!isReceivingRequest && !isWaitingForResponse && (
                <div className="flex gap-3">
                  {onNewGame && (
                    <Button
                      onClick={onNewGame}
                      variant="outline"
                      className="flex-1"
                      size="lg"
                    >
                      <Home className="w-5 h-5 mr-2" />
                      New Game
                    </Button>
                  )}
                  {onLeave && (
                    <Button
                      onClick={onLeave}
                      variant="outline"
                      className="flex-1 text-parchment-400"
                      size="lg"
                    >
                      Leave
                    </Button>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface AbandonButtonProps {
  onAbandon: () => void
  disabled?: boolean
}

export function AbandonButton({ onAbandon, disabled }: AbandonButtonProps) {
  return (
    <Button
      onClick={onAbandon}
      variant="outline"
      size="sm"
      disabled={disabled}
      className="text-dragon-400 border-dragon-500/30 hover:bg-dragon-500/10 hover:border-dragon-500/50"
    >
      <Flag className="w-4 h-4 mr-1" />
      Abandon
    </Button>
  )
}
