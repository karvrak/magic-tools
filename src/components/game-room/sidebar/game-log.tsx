'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ScrollText, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LogEntry } from '@/hooks/game-room/use-game-log'

interface GameLogProps {
  entries: LogEntry[]
  isOpen: boolean
  onToggle: () => void
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
  if (entry.type === 'turn') {
    return (
      <div className="text-gold-400 font-medieval text-sm border-b border-dungeon-700 py-1.5 px-1 text-center">
        {entry.message}
      </div>
    )
  }

  if (entry.type === 'phase') {
    return (
      <div className="text-parchment-500 text-xs italic py-0.5 px-1 text-center">
        {entry.message}
      </div>
    )
  }

  if (entry.type === 'response') {
    const isRespond = entry.message === 'I respond!'
    return (
      <div className="flex items-start gap-1.5 py-0.5 px-1">
        {entry.playerColor && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
            style={{ backgroundColor: entry.playerColor }}
          />
        )}
        <span className="text-xs">
          <span className="text-parchment-300 font-medium">{entry.playerName}</span>{' '}
          <span className={cn(
            'font-bold',
            isRespond ? 'text-gold-400' : 'text-parchment-600'
          )}>
            {entry.message}
          </span>
        </span>
      </div>
    )
  }

  if (entry.type === 'emote') {
    return (
      <div className="flex items-start gap-1.5 py-0.5 px-1">
        {entry.playerColor && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
            style={{ backgroundColor: entry.playerColor }}
          />
        )}
        <span className="text-xs italic">
          <span className="text-parchment-300 font-medium">{entry.playerName}</span>{' '}
          <span className="text-arcane-400 bg-arcane-500/10 px-1.5 py-0.5 rounded-full">
            {entry.message}
          </span>
        </span>
      </div>
    )
  }

  if (entry.type === 'system') {
    return (
      <div className="text-parchment-600 text-xs py-0.5 px-1 italic text-center">
        {entry.message}
      </div>
    )
  }

  // Default: action
  return (
    <div className="flex items-start gap-1.5 py-0.5 px-1">
      {entry.playerColor && (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
          style={{ backgroundColor: entry.playerColor }}
        />
      )}
      <span className="text-xs">
        <span className="text-parchment-300 font-medium">{entry.playerName}</span>{' '}
        <span className="text-parchment-400">{entry.message}</span>
      </span>
      <span className="text-[9px] text-parchment-700 ml-auto flex-shrink-0">
        {formatTime(entry.timestamp)}
      </span>
    </div>
  )
}

export function GameLog({ entries, isOpen, onToggle }: GameLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries.length, isOpen])

  return (
    <>
      {/* Toggle tab on the right edge */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            onClick={onToggle}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-[105] bg-dungeon-800/90 hover:bg-dungeon-700 border border-r-0 border-dungeon-600 rounded-l-lg px-1.5 py-3 text-parchment-400 hover:text-parchment-200 transition-colors"
            title="Open game log"
          >
            <ScrollText className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: 288, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 288, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-72 flex-shrink-0 flex flex-col bg-dungeon-900/95 border-l border-dungeon-700 backdrop-blur-sm h-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-dungeon-700">
              <div className="flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-gold-400" />
                <span className="text-sm font-medium text-parchment-200">Game Log</span>
              </div>
              <button
                onClick={onToggle}
                className="p-1 text-parchment-500 hover:text-parchment-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable entries */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 py-1 scrollbar-thin scrollbar-track-dungeon-900 scrollbar-thumb-dungeon-700"
            >
              {entries.length === 0 ? (
                <p className="text-parchment-600 text-xs text-center py-4 italic">
                  No actions yet...
                </p>
              ) : (
                entries.map(entry => (
                  <LogEntryRow key={entry.id} entry={entry} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
