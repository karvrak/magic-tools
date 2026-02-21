'use client'

import { useState, useCallback } from 'react'

export interface LogEntry {
  id: string
  type: 'action' | 'phase' | 'turn' | 'response' | 'emote' | 'system'
  playerName?: string
  playerColor?: string
  message: string
  timestamp: number
}

/** Generate a short random ID for log entries */
function generateLogId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export interface GameLog {
  entries: LogEntry[]
  addEntry: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void
  addActionLog: (playerName: string, playerColor: string, action: string) => void
  addPhaseLog: (phase: string) => void
  addTurnLog: (playerName: string, turn: number) => void
  addResponseLog: (playerName: string, playerColor: string, responds: boolean) => void
  addEmoteLog: (playerName: string, playerColor: string, emote: string) => void
}

export function useGameLog(): GameLog {
  const [entries, setEntries] = useState<LogEntry[]>([])

  const addEntry = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setEntries(prev => [...prev, { ...entry, id: generateLogId(), timestamp: Date.now() }])
  }, [])

  const addActionLog = useCallback((playerName: string, playerColor: string, action: string) => {
    addEntry({ type: 'action', playerName, playerColor, message: action })
  }, [addEntry])

  const addPhaseLog = useCallback((phase: string) => {
    addEntry({ type: 'phase', message: `\u2014 ${phase} \u2014` })
  }, [addEntry])

  const addTurnLog = useCallback((playerName: string, turn: number) => {
    addEntry({ type: 'turn', message: `--- Turn ${turn} : ${playerName} ---` })
  }, [addEntry])

  const addResponseLog = useCallback((playerName: string, playerColor: string, responds: boolean) => {
    addEntry({
      type: 'response',
      playerName,
      playerColor,
      message: responds ? 'I respond!' : 'No response',
    })
  }, [addEntry])

  const addEmoteLog = useCallback((playerName: string, playerColor: string, emote: string) => {
    addEntry({ type: 'emote', playerName, playerColor, message: emote })
  }, [addEntry])

  return { entries, addEntry, addActionLog, addPhaseLog, addTurnLog, addResponseLog, addEmoteLog }
}
