'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Database, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react'
import type { SyncStatus } from '@/lib/sync-status'

const POLL_INTERVAL_MS = 2000

interface SyncProgressBarProps {
  /** Whether a sync operation is currently active (triggers polling). */
  isActive: boolean
}

export function SyncProgressBar({ isActive }: SyncProgressBarProps) {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isActive) {
      // Do one final poll to catch the "done" state
      fetchStatus()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Start polling immediately
    fetchStatus()
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isActive])

  async function fetchStatus() {
    try {
      const res = await fetch('/api/sync/status')
      if (res.ok) {
        const data: SyncStatus = await res.json()
        setStatus(data)

        // Stop polling once we reach a terminal state
        if (data.phase === 'done' || data.phase === 'error' || data.phase === 'idle') {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
      }
    } catch {
      // Silently ignore fetch errors during polling
    }
  }

  const shouldShow =
    status &&
    status.phase !== 'idle' &&
    (isActive || status.phase === 'done' || status.phase === 'error')

  return (
    <AnimatePresence>
      {shouldShow && status && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="mt-3 p-3 rounded-lg bg-dungeon-900/70 border border-dungeon-600/50">
            {/* Status header */}
            <div className="flex items-center gap-2 mb-2">
              <StatusIcon type={status.type} phase={status.phase} />
              <span className="text-xs font-medium text-parchment-300">
                {status.type === 'cards' ? 'Card Sync' : 'Price Sync'}
              </span>
              {status.phase === 'done' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 ml-auto" />
              )}
              {status.phase === 'error' && (
                <AlertCircle className="w-3.5 h-3.5 text-dragon-400 ml-auto" />
              )}
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-dungeon-700 rounded-full overflow-hidden">
              <motion.div
                className={getBarColorClass(status.phase)}
                initial={{ width: 0 }}
                animate={{ width: `${status.progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{ height: '100%', borderRadius: '9999px' }}
              />
            </div>

            {/* Status message */}
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[10px] text-parchment-500 truncate flex-1">
                {status.message}
              </p>
              <span className="text-[10px] text-parchment-500 ml-2 tabular-nums">
                {status.progress}%
              </span>
            </div>

            {/* Elapsed time */}
            {status.startedAt && status.phase !== 'done' && status.phase !== 'error' && (
              <ElapsedTime startedAt={status.startedAt} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function StatusIcon({ type, phase }: { type: string | null; phase: string }) {
  const iconClass = phase === 'done'
    ? 'text-green-400'
    : phase === 'error'
      ? 'text-dragon-400'
      : 'text-arcane-400 animate-pulse'

  if (type === 'prices') {
    return <DollarSign className={`w-3.5 h-3.5 ${iconClass}`} />
  }
  return <Database className={`w-3.5 h-3.5 ${iconClass}`} />
}

function getBarColorClass(phase: string): string {
  switch (phase) {
    case 'done':
      return 'bg-green-500'
    case 'error':
      return 'bg-dragon-500'
    default:
      return 'bg-arcane-500'
  }
}

function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const update = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const formatted = minutes > 0
    ? `${minutes}m ${seconds.toString().padStart(2, '0')}s`
    : `${seconds}s`

  return (
    <p className="text-[10px] text-parchment-600 mt-1">
      Elapsed: {formatted}
    </p>
  )
}
