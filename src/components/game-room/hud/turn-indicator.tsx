'use client'

import { cn } from '@/lib/utils'
import { PHASE_DISPLAY_NAMES, GamePhase } from '@/lib/game-room/constants'

interface TurnIndicatorProps {
  isMyTurn: boolean
  currentTurn: number
  currentPhase?: GamePhase
}

export function TurnIndicator({ isMyTurn, currentTurn, currentPhase }: TurnIndicatorProps) {
  const phaseName = currentPhase ? PHASE_DISPLAY_NAMES[currentPhase] : null

  const turnLabel = isMyTurn
    ? `\u2694\uFE0F Turn ${currentTurn}${phaseName ? ` \u2014 ${phaseName}` : ' \u2014 Your turn'}`
    : `Turn ${currentTurn} \u2014 Waiting...`

  return (
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
        {turnLabel}
      </div>
      <div className={cn(
        "flex-1 h-px bg-gradient-to-r from-transparent to-transparent",
        isMyTurn ? "via-gold-500/60" : "via-dungeon-500"
      )} />
    </div>
  )
}
