'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, X } from 'lucide-react'

interface ResponseAlertProps {
  isVisible: boolean
  opponentAction: string
  opponentName: string
  opponentColor: string
  onRespond: () => void
  onPass: () => void
  timeoutSeconds?: number
}

const DEFAULT_TIMEOUT = 10

export function ResponseAlert({
  isVisible,
  opponentAction,
  opponentName,
  opponentColor,
  onRespond,
  onPass,
  timeoutSeconds = DEFAULT_TIMEOUT,
}: ResponseAlertProps) {
  const [remaining, setRemaining] = useState(timeoutSeconds)

  // Reset timer when alert becomes visible
  useEffect(() => {
    if (isVisible) {
      setRemaining(timeoutSeconds)
    }
  }, [isVisible, timeoutSeconds])

  // Countdown timer
  useEffect(() => {
    if (!isVisible || remaining <= 0) return

    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isVisible, remaining])

  // Auto-pass when timer reaches zero
  const handleAutoPass = useCallback(() => {
    onPass()
  }, [onPass])

  useEffect(() => {
    if (isVisible && remaining === 0) {
      handleAutoPass()
    }
  }, [isVisible, remaining, handleAutoPass])

  const progressPercent = (remaining / timeoutSeconds) * 100

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] w-[420px] max-w-[90vw]"
        >
          <div className="bg-dungeon-900/95 border-2 border-gold-500/60 rounded-xl shadow-2xl shadow-gold-500/10 backdrop-blur-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-dungeon-700">
              <Shield className="w-4 h-4 text-gold-400" />
              <span className="text-sm font-medium text-gold-400">Priority Window</span>
              <span className="text-xs text-parchment-500 ml-auto">{remaining}s</span>
            </div>

            {/* Action description */}
            <div className="px-4 py-3">
              <p className="text-sm text-parchment-200">
                <span
                  className="font-bold"
                  style={{ color: opponentColor }}
                >
                  {opponentName}
                </span>{' '}
                <span className="text-parchment-400">{opponentAction}</span>
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 px-4 pb-3">
              <button
                onClick={onRespond}
                className="flex-1 py-2.5 px-4 bg-gold-600 hover:bg-gold-500 text-dungeon-900 font-bold text-sm rounded-lg transition-colors active:scale-95"
              >
                I respond!
              </button>
              <button
                onClick={onPass}
                className="flex-1 py-2.5 px-4 bg-dungeon-700 hover:bg-dungeon-600 text-parchment-400 font-medium text-sm rounded-lg transition-colors active:scale-95"
              >
                No response
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-dungeon-800">
              <motion.div
                className="h-full bg-gold-500/60"
                initial={{ width: '100%' }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3, ease: 'linear' }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
