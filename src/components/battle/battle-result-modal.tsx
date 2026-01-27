'use client'

import { motion } from 'framer-motion'
import { Trophy, Skull, Crown, Users, RotateCcw, Home } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { BattleResult, GameModeConfig } from '@/types/battle'

interface BattleResultModalProps {
  open: boolean
  onClose: () => void
  result: BattleResult | null
  modeConfig: GameModeConfig
  onRematch: () => void
  onNewBattle: () => void
}

export function BattleResultModal({
  open,
  onClose,
  result,
  modeConfig,
  onRematch,
  onNewBattle,
}: BattleResultModalProps) {
  if (!result) return null

  const sortedPlayers = [...result.players].sort((a, b) => {
    // Gagnants en premier
    if (modeConfig.hasTeams) {
      if (a.team === result.winnerTeam && b.team !== result.winnerTeam) return -1
      if (b.team === result.winnerTeam && a.team !== result.winnerTeam) return 1
    } else {
      if (a.id === result.winnerId) return -1
      if (b.id === result.winnerId) return 1
    }
    // Puis par score/PV
    if (modeConfig.hasVictoryPoints) {
      return (b.score || 0) - (a.score || 0)
    }
    return b.finalLife - a.finalLife
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <motion.div
              initial={{ rotate: -20, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              <Trophy className="w-8 h-8 text-gold-400" />
            </motion.div>
            <span className="font-display text-gold-400">Battle Complete!</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Winner announcement */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              'text-center p-6 rounded-xl',
              'bg-gradient-to-b from-gold-600/20 to-gold-700/10',
              'border-2 border-gold-500/40'
            )}
          >
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                textShadow: [
                  '0 0 20px rgba(212, 164, 24, 0.5)',
                  '0 0 40px rgba(212, 164, 24, 0.8)',
                  '0 0 20px rgba(212, 164, 24, 0.5)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Crown className="w-12 h-12 text-gold-400 mx-auto mb-3" />
            </motion.div>
            <h3 className="font-display text-3xl text-gold-300 mb-2">
              {result.winnerName || 'Victory!'}
            </h3>
            {modeConfig.hasTeams && result.winnerTeam && (
              <p className="text-parchment-400 flex items-center justify-center gap-2">
                <Users className="w-4 h-4" />
                Team {result.winnerTeam} Wins!
              </p>
            )}
          </motion.div>

          {/* Players results */}
          <div className="space-y-2">
            <h4 className="font-medieval text-sm text-parchment-500 uppercase tracking-wider">
              Final Standings
            </h4>
            <div className="space-y-2">
              {sortedPlayers.map((player, index) => {
                const isWinner = modeConfig.hasTeams
                  ? player.team === result.winnerTeam
                  : player.id === result.winnerId

                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg',
                      isWinner
                        ? 'bg-gold-600/15 border border-gold-500/30'
                        : 'bg-dungeon-800/50 border border-dungeon-700/30'
                    )}
                  >
                    {/* Rank */}
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
                        isWinner
                          ? 'bg-gold-500 text-dungeon-900'
                          : player.isEliminated
                          ? 'bg-dragon-600/30 text-dragon-400'
                          : 'bg-dungeon-700 text-parchment-400'
                      )}
                    >
                      {isWinner ? (
                        <Crown className="w-4 h-4" />
                      ) : player.isEliminated ? (
                        <Skull className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                    </div>

                    {/* Player info */}
                    <div className="flex-1">
                      <p
                        className={cn(
                          'font-medieval',
                          isWinner ? 'text-gold-300' : 'text-parchment-300'
                        )}
                      >
                        {player.deckName}
                      </p>
                      {player.team && (
                        <p className="text-xs text-parchment-500">
                          Équipe {player.team}
                        </p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="text-right">
                      <p
                        className={cn(
                          'font-mono font-bold',
                          player.finalLife > 0 ? 'text-nature-400' : 'text-dragon-400'
                        )}
                      >
                        {player.finalLife} PV
                      </p>
                      {modeConfig.hasVictoryPoints && (
                        <p className="text-xs text-gold-500">
                          +{player.victoryPoints} VP = {player.score}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onNewBattle}
            >
              <Home className="w-4 h-4 mr-2" />
              New Battle
            </Button>
            <Button
              variant="arcane"
              className="flex-1"
              onClick={onRematch}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Rematch
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
