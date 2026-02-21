'use client'

import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  GAME_PHASES,
  COMBAT_SUB_PHASES,
  PHASE_DISPLAY_NAMES,
  GamePhase,
} from '@/lib/game-room/constants'

interface PhaseBarProps {
  currentPhase: GamePhase
  isMyTurn: boolean
  onAdvancePhase: () => void
  onJumpToPhase: (phase: GamePhase) => void
}

/** Short labels for the phase pills to keep the bar compact */
const PHASE_SHORT_LABELS: Record<GamePhase, string> = {
  untap: 'Untap',
  upkeep: 'Upkeep',
  draw: 'Draw',
  main1: 'Main 1',
  combat_begin: 'Begin',
  combat_attackers: 'Attackers',
  combat_blockers: 'Blockers',
  combat_damage: 'Damage',
  combat_end: 'End',
  main2: 'Main 2',
  end: 'End',
  cleanup: 'Cleanup',
}

type DisplayItem =
  | { type: 'phase'; phase: GamePhase }
  | { type: 'combat_collapsed' }
  | { type: 'combat_phase'; phase: GamePhase }

export function PhaseBar({
  currentPhase,
  isMyTurn,
  onAdvancePhase,
  onJumpToPhase,
}: PhaseBarProps) {
  const isInCombat = (COMBAT_SUB_PHASES as readonly GamePhase[]).includes(currentPhase)
  const currentIndex = GAME_PHASES.indexOf(currentPhase)

  /** Build the list of items to display */
  const displayItems: DisplayItem[] = useMemo(() => {
    const items: DisplayItem[] = []

    // Phases before combat
    items.push({ type: 'phase', phase: 'untap' })
    items.push({ type: 'phase', phase: 'upkeep' })
    items.push({ type: 'phase', phase: 'draw' })
    items.push({ type: 'phase', phase: 'main1' })

    if (isInCombat) {
      // Expanded combat sub-phases
      for (const cp of COMBAT_SUB_PHASES) {
        items.push({ type: 'combat_phase', phase: cp })
      }
    } else {
      // Collapsed combat pill
      items.push({ type: 'combat_collapsed' })
    }

    // Phases after combat
    items.push({ type: 'phase', phase: 'main2' })
    items.push({ type: 'phase', phase: 'end' })
    items.push({ type: 'phase', phase: 'cleanup' })

    return items
  }, [isInCombat])

  const getPhaseStatus = (phase: GamePhase): 'past' | 'active' | 'future' => {
    const idx = GAME_PHASES.indexOf(phase)
    if (idx < currentIndex) return 'past'
    if (idx === currentIndex) return 'active'
    return 'future'
  }

  const isCombatPast = currentIndex > GAME_PHASES.indexOf('combat_end')
  const isCombatActive = isInCombat
  const isCombatFuture = currentIndex < GAME_PHASES.indexOf('combat_begin')

  return (
    <div className="flex items-center justify-center gap-0.5 px-2 py-1">
      {displayItems.map((item, i) => {
        const showChevron = i < displayItems.length - 1

        if (item.type === 'combat_collapsed') {
          // Collapsed combat pill
          return (
            <div key="combat-collapsed" className="flex items-center gap-0.5">
              <button
                onClick={() => isMyTurn && onJumpToPhase('combat_begin')}
                disabled={!isMyTurn}
                title={PHASE_DISPLAY_NAMES.combat_begin}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all',
                  'whitespace-nowrap select-none',
                  !isMyTurn && 'cursor-default',
                  isCombatPast && 'bg-dungeon-800/40 text-parchment-600 border-dungeon-700/50',
                  isCombatFuture && 'bg-dungeon-800/60 text-parchment-400 border-dungeon-600/50 hover:border-dungeon-500/60',
                  isCombatActive && 'bg-gold-500/20 text-gold-400 border-gold-500/40 shadow-[0_0_8px_rgba(234,179,8,0.2)]',
                )}
              >
                Combat
              </button>
              {showChevron && (
                <ChevronRight className="w-2.5 h-2.5 text-dungeon-600 flex-shrink-0" />
              )}
            </div>
          )
        }

        // Regular phase or combat sub-phase
        const phase = item.phase
        const status = getPhaseStatus(phase)
        const label = PHASE_SHORT_LABELS[phase]

        return (
          <div key={phase} className="flex items-center gap-0.5">
            <motion.button
              layout
              onClick={() => isMyTurn && onJumpToPhase(phase)}
              disabled={!isMyTurn}
              title={PHASE_DISPLAY_NAMES[phase]}
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all',
                'whitespace-nowrap select-none',
                !isMyTurn && 'cursor-default',
                status === 'past' && 'bg-dungeon-800/40 text-parchment-600 border-dungeon-700/50',
                status === 'future' && 'bg-dungeon-800/60 text-parchment-400 border-dungeon-600/50 hover:border-dungeon-500/60',
                status === 'active' && 'bg-gold-500/20 text-gold-400 border-gold-500/40 shadow-[0_0_8px_rgba(234,179,8,0.2)]',
              )}
            >
              {label}
            </motion.button>
            {showChevron && (
              <ChevronRight className="w-2.5 h-2.5 text-dungeon-600 flex-shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}
