'use client'

import { motion } from 'framer-motion'
import { Shield, Users, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { D20LifeCounter } from './d20-life-counter'
import { CommanderDamageTracker } from './commander-damage-tracker'
import { VictoryPointsDisplay } from './victory-points-display'
import type { PlayerState, GameModeConfig } from '@/types/battle'

interface PlayerCardProps {
  player: PlayerState
  modeConfig: GameModeConfig
  allPlayers: PlayerState[]
  onLifeChange: (playerId: string, newLife: number) => void
  onVictoryPointsChange: (playerId: string, newPoints: number) => void
  onCommanderDamageChange: (playerId: string, fromPlayer: number, damage: number) => void
  isCompact?: boolean
  className?: string
  deckImageUrl?: string | null
}

export function PlayerCard({
  player,
  modeConfig,
  allPlayers,
  onLifeChange,
  onVictoryPointsChange,
  onCommanderDamageChange,
  isCompact = false,
  className,
  deckImageUrl,
}: PlayerCardProps) {
  const teamColors: Record<number, string> = {
    1: 'border-blue-500/50',
    2: 'border-orange-500/50',
  }

  const teamBgColors: Record<number, string> = {
    1: 'from-blue-900/30 to-blue-950/50',
    2: 'from-orange-900/30 to-orange-950/50',
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'relative rounded-xl overflow-hidden',
        'border-2 transition-all duration-300',
        player.isEliminated
          ? 'border-dungeon-700/50 opacity-75'
          : player.team
          ? teamColors[player.team]
          : 'border-gold-600/30 hover:border-gold-500/50',
        !player.isEliminated && 'hover:shadow-magic-glow',
        className
      )}
    >
      {/* Background Image (deck artwork) */}
      {deckImageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${deckImageUrl})` }}
        >
          {/* Dark overlay for readability */}
          <div className={cn(
            'absolute inset-0',
            player.isEliminated
              ? 'bg-dungeon-950/85'
              : player.team
              ? `bg-gradient-to-b ${teamBgColors[player.team]}`
              : 'bg-gradient-to-b from-dungeon-900/70 via-dungeon-900/80 to-dungeon-950/90'
          )} />
        </div>
      )}

      {/* Fallback gradient background if no image */}
      {!deckImageUrl && (
        <div className={cn(
          'absolute inset-0',
          player.isEliminated
            ? 'bg-dungeon-900/95'
            : player.team
            ? `bg-gradient-to-b ${teamBgColors[player.team]}`
            : 'bg-gradient-to-b from-dungeon-800/90 to-dungeon-900/95'
        )} />
      )}

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div
          className={cn(
            'px-4 py-3 border-b backdrop-blur-sm',
            player.isEliminated
              ? 'border-dungeon-700/50 bg-dungeon-900/50'
              : 'border-gold-600/20 bg-dungeon-900/40'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Player number */}
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm backdrop-blur-sm',
                  player.isEliminated
                    ? 'bg-dungeon-700/80 text-dungeon-500'
                    : player.team
                    ? player.team === 1
                      ? 'bg-blue-600/40 text-blue-300'
                      : 'bg-orange-600/40 text-orange-300'
                    : 'bg-gold-600/30 text-gold-300'
                )}
              >
                {player.playerOrder}
              </div>

              {/* Deck name */}
              <div>
                <h3
                  className={cn(
                    'font-medieval text-lg leading-tight drop-shadow-lg',
                    player.isEliminated ? 'text-dungeon-400' : 'text-white'
                  )}
                >
                  {player.deckName}
                </h3>
                {player.team && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Users className="w-3 h-3 text-parchment-400" />
                    <span className="text-xs text-parchment-400">
                      Équipe {player.team}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Status icons */}
            <div className="flex items-center gap-2">
              {modeConfig.hasCommanderDamage && (
                <Shield className="w-4 h-4 text-arcane-400" />
              )}
              {player.isEliminated && (
                <span className="text-dragon-500 text-lg">☠️</span>
              )}
            </div>
          </div>
        </div>

        {/* Life Counter - D20 Style */}
        <div className={cn('p-4', isCompact ? 'py-3' : 'py-6')}>
          <D20LifeCounter
            life={player.currentLife}
            startingLife={player.startingLife}
            onChange={(newLife) => onLifeChange(player.id, newLife)}
            isEliminated={player.isEliminated}
            size={isCompact ? 'sm' : 'md'}
          />
        </div>

        {/* Victory Points (mode 1v1v1) */}
        {modeConfig.hasVictoryPoints && (
          <div className="px-4 pb-4 border-t border-white/10 pt-3">
            <VictoryPointsDisplay
              victoryPoints={player.victoryPoints}
              onChange={(newPoints) => onVictoryPointsChange(player.id, newPoints)}
              isEliminated={player.isEliminated}
              size={isCompact ? 'sm' : 'md'}
            />
          </div>
        )}

        {/* Commander Damage (mode Commander) */}
        {modeConfig.hasCommanderDamage && (
          <div className="px-4 pb-4 border-t border-white/10 pt-3">
            <CommanderDamageTracker
              playerOrder={player.playerOrder}
              commanderDamage={player.commanderDamage}
              allPlayers={allPlayers.map((p) => ({
                playerOrder: p.playerOrder,
                deckName: p.deckName,
                isEliminated: p.isEliminated,
              }))}
              threshold={modeConfig.commanderDamageThreshold || 21}
              onDamageChange={(fromPlayer, damage) =>
                onCommanderDamageChange(player.id, fromPlayer, damage)
              }
              isEliminated={player.isEliminated}
              compact={isCompact}
            />
          </div>
        )}

        {/* Score display for FFA mode */}
        {modeConfig.hasVictoryPoints && !player.isEliminated && (
          <div className="absolute top-2 right-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-gold-600/30 border border-gold-500/40 backdrop-blur-sm">
              <Crown className="w-3 h-3 text-gold-400" />
              <span className="text-xs font-bold text-gold-300">
                {player.currentLife + player.victoryPoints}
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
