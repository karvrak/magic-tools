'use client'

import { motion } from 'framer-motion'
import { Skull, Swords } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommanderDamageTrackerProps {
  playerOrder: number
  commanderDamage: Record<string, number>
  allPlayers: { playerOrder: number; deckName: string; isEliminated: boolean }[]
  threshold: number
  onDamageChange: (fromPlayer: number, damage: number) => void
  isEliminated: boolean
  compact?: boolean
}

export function CommanderDamageTracker({
  playerOrder,
  commanderDamage,
  allPlayers,
  threshold,
  onDamageChange,
  isEliminated,
  compact = false,
}: CommanderDamageTrackerProps) {
  const otherPlayers = allPlayers.filter((p) => p.playerOrder !== playerOrder)

  return (
    <div className={cn('space-y-2', compact && 'space-y-1')}>
      <div className="flex items-center gap-2 text-xs text-parchment-500">
        <Swords className="w-3 h-3" />
        <span className="font-medieval">Commander Damage</span>
      </div>

      <div className={cn('grid gap-2', compact ? 'grid-cols-3' : 'grid-cols-1')}>
        {otherPlayers.map((player) => {
          const damage = commanderDamage[player.playerOrder.toString()] || 0
          const isLethal = damage >= threshold

          return (
            <div
              key={player.playerOrder}
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg',
                'bg-dungeon-800/50 border border-dungeon-600/30',
                isLethal && 'border-dragon-500/50 bg-dragon-900/20'
              )}
            >
              {/* Player indicator */}
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                  player.isEliminated
                    ? 'bg-dungeon-700 text-dungeon-500'
                    : 'bg-arcane-600/30 text-arcane-400'
                )}
              >
                P{player.playerOrder}
              </div>

              {/* Damage counter */}
              <div className="flex items-center gap-1">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onDamageChange(player.playerOrder, Math.max(0, damage - 1))}
                  disabled={isEliminated || damage === 0}
                  className={cn(
                    'w-6 h-6 rounded flex items-center justify-center text-sm',
                    'bg-dungeon-700 text-parchment-400',
                    'hover:bg-dungeon-600 transition-colors',
                    'disabled:opacity-30 disabled:cursor-not-allowed'
                  )}
                >
                  -
                </motion.button>

                <span
                  className={cn(
                    'min-w-[32px] text-center font-mono font-bold',
                    isLethal ? 'text-dragon-400' : 'text-parchment-300'
                  )}
                >
                  {damage}
                </span>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onDamageChange(player.playerOrder, damage + 1)}
                  disabled={isEliminated}
                  className={cn(
                    'w-6 h-6 rounded flex items-center justify-center text-sm',
                    'bg-dungeon-700 text-parchment-400',
                    'hover:bg-dungeon-600 transition-colors',
                    'disabled:opacity-30 disabled:cursor-not-allowed'
                  )}
                >
                  +
                </motion.button>
              </div>

              {/* Lethal indicator */}
              {isLethal && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="ml-auto"
                >
                  <Skull className="w-4 h-4 text-dragon-500" />
                </motion.div>
              )}
            </div>
          )
        })}
      </div>

      {/* Threshold indicator */}
      <p className="text-xs text-dungeon-500 text-center">
        {threshold} = élimination
      </p>
    </div>
  )
}
