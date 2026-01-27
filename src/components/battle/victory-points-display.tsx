'use client'

import { motion } from 'framer-motion'
import { Trophy, Swords } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VictoryPointsDisplayProps {
  victoryPoints: number
  onChange: (newPoints: number) => void
  isEliminated: boolean
  showControls?: boolean
  size?: 'sm' | 'md'
}

export function VictoryPointsDisplay({
  victoryPoints,
  onChange,
  isEliminated,
  showControls = true,
  size = 'md',
}: VictoryPointsDisplayProps) {
  const handleChange = (delta: number) => {
    if (isEliminated) return
    onChange(Math.max(0, victoryPoints + delta))
  }

  const sizes = {
    sm: {
      icon: 'w-3 h-3',
      text: 'text-sm',
      value: 'text-lg',
      button: 'w-6 h-6 text-xs',
    },
    md: {
      icon: 'w-4 h-4',
      text: 'text-base',
      value: 'text-2xl',
      button: 'w-8 h-8 text-sm',
    },
  }

  const s = sizes[size]

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Label */}
      <div className="flex items-center gap-1.5 text-gold-500">
        <Swords className={s.icon} />
        <span className={cn('font-medieval', s.text)}>Victory Points</span>
      </div>

      {/* Value with controls */}
      <div className="flex items-center gap-2">
        {showControls && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => handleChange(-1)}
            disabled={isEliminated || victoryPoints === 0}
            className={cn(
              'rounded-full flex items-center justify-center',
              'bg-dungeon-700 text-parchment-400 border border-dungeon-600',
              'hover:bg-dungeon-600 transition-colors',
              'disabled:opacity-30 disabled:cursor-not-allowed',
              s.button
            )}
          >
            -
          </motion.button>
        )}

        <motion.div
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-lg',
            'bg-gold-600/10 border border-gold-600/30'
          )}
          animate={{
            boxShadow: victoryPoints > 0
              ? '0 0 15px rgba(212, 164, 24, 0.3)'
              : 'none',
          }}
        >
          <Trophy className={cn(s.icon, 'text-gold-500')} />
          <span className={cn('font-display font-bold text-gold-400', s.value)}>
            {victoryPoints}
          </span>
        </motion.div>

        {showControls && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => handleChange(1)}
            disabled={isEliminated}
            className={cn(
              'rounded-full flex items-center justify-center',
              'bg-gold-600/20 text-gold-400 border border-gold-600/30',
              'hover:bg-gold-600/30 transition-colors',
              'disabled:opacity-30 disabled:cursor-not-allowed',
              s.button
            )}
          >
            +
          </motion.button>
        )}
      </div>

      {/* Quick add buttons */}
      {showControls && (
        <div className="flex gap-1">
          {[1, 3, 5].map((amount) => (
            <motion.button
              key={amount}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleChange(amount)}
              disabled={isEliminated}
              className={cn(
                'px-2 py-0.5 rounded text-xs font-medieval',
                'bg-gold-600/10 text-gold-500 border border-gold-600/20',
                'hover:bg-gold-600/20 transition-colors',
                'disabled:opacity-30 disabled:cursor-not-allowed'
              )}
            >
              +{amount}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}
