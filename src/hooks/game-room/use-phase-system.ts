'use client'

import { useState, useCallback, useMemo } from 'react'
import { GAME_PHASES, COMBAT_SUB_PHASES, GamePhase } from '@/lib/game-room/constants'

export interface PhaseSystem {
  currentPhase: GamePhase
  setCurrentPhase: React.Dispatch<React.SetStateAction<GamePhase>>
  advancePhase: () => void
  jumpToPhase: (phase: GamePhase) => void
  beginTurn: () => void
  isInCombat: boolean
}

export function usePhaseSystem(): PhaseSystem {
  const [currentPhase, setCurrentPhase] = useState<GamePhase>('main1')

  const advancePhase = useCallback(() => {
    setCurrentPhase(prev => {
      const idx = GAME_PHASES.indexOf(prev)
      if (idx === GAME_PHASES.length - 1) return 'untap' // wrap to new turn
      return GAME_PHASES[idx + 1]
    })
  }, [])

  const jumpToPhase = useCallback((phase: GamePhase) => {
    setCurrentPhase(phase)
  }, [])

  const beginTurn = useCallback(() => {
    setCurrentPhase('untap')
  }, [])

  const isInCombat = useMemo(
    () => (COMBAT_SUB_PHASES as readonly GamePhase[]).includes(currentPhase),
    [currentPhase]
  )

  return {
    currentPhase,
    setCurrentPhase,
    advancePhase,
    jumpToPhase,
    beginTurn,
    isInCombat,
  }
}
