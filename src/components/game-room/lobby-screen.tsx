'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { GamePlayer } from '@/lib/game-room/types'

interface LobbyScreenProps {
  players: GamePlayer[]
  playerId: string
  currentPlayer: GamePlayer
  countdown: number | null
  allPlayersReady: boolean
  onSetReady: (ready: boolean) => void
  decks?: { id: string; name: string }[]
  selectedDeckId?: string
  onSelectDeck?: (deckId: string) => void
}

export function LobbyScreen({
  players,
  playerId,
  currentPlayer,
  countdown,
  allPlayersReady,
  onSetReady,
  decks,
  selectedDeckId,
  onSelectDeck,
}: LobbyScreenProps) {
  const hasDeck = !!selectedDeckId
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
                {player.id === playerId && decks && onSelectDeck ? (
                  <Select value={selectedDeckId || ''} onValueChange={onSelectDeck}>
                    <SelectTrigger className="mt-1 h-8 text-sm w-[200px]">
                      <SelectValue placeholder="Select a deck..." />
                    </SelectTrigger>
                    <SelectContent>
                      {decks.map((deck) => (
                        <SelectItem key={deck.id} value={deck.id}>
                          {deck.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : player.deckName ? (
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
            disabled={!hasDeck}
            className="min-w-[200px]"
          >
            <Check className="w-5 h-5 mr-2" />
            I'm ready!
          </Button>
        )}

        {!hasDeck && !currentPlayer.isReady && (
          <p className="text-amber-400 text-sm mt-3">
            Select a deck to get ready
          </p>
        )}
        {hasDeck && !allPlayersReady && (
          <p className="text-parchment-500 text-sm mt-3">
            Waiting for all players to be ready...
          </p>
        )}
      </div>
    </div>
  )
}
