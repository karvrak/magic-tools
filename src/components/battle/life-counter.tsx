'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LifeCounterProps {
  life: number
  startingLife: number
  onChange: (newLife: number) => void
  isEliminated?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LifeCounter({
  life,
  startingLife,
  onChange,
  isEliminated = false,
  size = 'md',
  className,
}: LifeCounterProps) {
  const handleChange = (delta: number) => {
    if (isEliminated) return
    onChange(life + delta)
  }

  const lifePercentage = Math.max(0, Math.min(100, (life / startingLife) * 100))

  // Couleur basée sur les PV
  const getLifeColor = () => {
    if (isEliminated || life <= 0) return 'text-dungeon-500'
    if (lifePercentage <= 25) return 'text-dragon-500'
    if (lifePercentage <= 50) return 'text-orange-500'
    return 'text-nature-500'
  }

  const getGlowColor = () => {
    if (isEliminated || life <= 0) return 'shadow-none'
    if (lifePercentage <= 25) return 'shadow-fire-glow'
    if (lifePercentage <= 50) return 'shadow-[0_0_20px_rgba(249,115,22,0.4)]'
    return 'shadow-[0_0_20px_rgba(34,197,94,0.3)]'
  }

  const sizes = {
    sm: {
      container: 'gap-2',
      button: 'w-10 h-10 text-lg',
      life: 'text-4xl min-w-[80px]',
      quickButtons: 'text-xs px-2 py-1',
    },
    md: {
      container: 'gap-3',
      button: 'w-14 h-14 text-2xl',
      life: 'text-6xl min-w-[120px]',
      quickButtons: 'text-sm px-3 py-1.5',
    },
    lg: {
      container: 'gap-4',
      button: 'w-20 h-20 text-4xl',
      life: 'text-8xl min-w-[180px]',
      quickButtons: 'text-base px-4 py-2',
    },
  }

  const s = sizes[size]

  return (
    <div className={cn('flex flex-col items-center', s.container, className)}>
      {/* Quick buttons -5 / +5 */}
      <div className="flex gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleChange(-5)}
          disabled={isEliminated}
          className={cn(
            'rounded-md font-medieval transition-all',
            'bg-dragon-600/20 text-dragon-400 border border-dragon-600/30',
            'hover:bg-dragon-600/30 hover:border-dragon-500/50',
            'disabled:opacity-30 disabled:cursor-not-allowed',
            s.quickButtons
          )}
        >
          -5
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleChange(5)}
          disabled={isEliminated}
          className={cn(
            'rounded-md font-medieval transition-all',
            'bg-nature-600/20 text-nature-400 border border-nature-600/30',
            'hover:bg-nature-600/30 hover:border-nature-500/50',
            'disabled:opacity-30 disabled:cursor-not-allowed',
            s.quickButtons
          )}
        >
          +5
        </motion.button>
      </div>

      {/* Main counter */}
      <div className={cn('flex items-center', s.container)}>
        {/* Minus button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleChange(-1)}
          disabled={isEliminated}
          className={cn(
            'rounded-full flex items-center justify-center font-bold transition-all',
            'bg-gradient-to-br from-dragon-600 to-dragon-700',
            'text-white border-2 border-dragon-500/50',
            'hover:from-dragon-500 hover:to-dragon-600',
            'hover:shadow-fire-glow',
            'disabled:opacity-30 disabled:cursor-not-allowed',
            'active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]',
            s.button
          )}
        >
          <Minus className="w-1/2 h-1/2" />
        </motion.button>

        {/* Life display */}
        <motion.div
          className={cn(
            'relative flex items-center justify-center',
            'font-display font-bold tabular-nums',
            'transition-all duration-300',
            getLifeColor(),
            s.life
          )}
          animate={{
            scale: isEliminated ? 0.8 : 1,
          }}
        >
          <AnimatePresence mode="popLayout">
            <motion.span
              key={life}
              initial={{ y: -20, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={cn(
                'relative',
                !isEliminated && life > 0 && getGlowColor()
              )}
              style={{
                textShadow: isEliminated
                  ? 'none'
                  : life <= 0
                  ? '0 0 20px rgba(220, 38, 38, 0.8)'
                  : lifePercentage <= 25
                  ? '0 0 30px rgba(220, 38, 38, 0.6)'
                  : lifePercentage <= 50
                  ? '0 0 20px rgba(249, 115, 22, 0.5)'
                  : '0 0 15px rgba(34, 197, 94, 0.4)',
              }}
            >
              {life}
            </motion.span>
          </AnimatePresence>

          {/* Eliminated overlay */}
          {isEliminated && (
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: -12 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="text-lg font-medieval text-dragon-500 bg-dungeon-900/80 px-3 py-1 rounded border border-dragon-600/50">
                ☠️ ÉLIMINÉ
              </span>
            </motion.div>
          )}
        </motion.div>

        {/* Plus button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleChange(1)}
          disabled={isEliminated}
          className={cn(
            'rounded-full flex items-center justify-center font-bold transition-all',
            'bg-gradient-to-br from-nature-600 to-nature-700',
            'text-white border-2 border-nature-500/50',
            'hover:from-nature-500 hover:to-nature-600',
            'hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]',
            'disabled:opacity-30 disabled:cursor-not-allowed',
            'active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]',
            s.button
          )}
        >
          <Plus className="w-1/2 h-1/2" />
        </motion.button>
      </div>

      {/* Life bar indicator */}
      <div className="w-full max-w-[200px] h-2 bg-dungeon-700 rounded-full overflow-hidden">
        <motion.div
          className={cn(
            'h-full rounded-full transition-colors duration-300',
            isEliminated || life <= 0
              ? 'bg-dungeon-600'
              : lifePercentage <= 25
              ? 'bg-gradient-to-r from-dragon-600 to-dragon-500'
              : lifePercentage <= 50
              ? 'bg-gradient-to-r from-orange-600 to-orange-500'
              : 'bg-gradient-to-r from-nature-600 to-nature-500'
          )}
          initial={false}
          animate={{ width: `${Math.max(0, lifePercentage)}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      </div>
    </div>
  )
}
