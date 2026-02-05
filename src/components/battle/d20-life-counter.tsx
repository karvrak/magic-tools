'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface D20LifeCounterProps {
  life: number
  startingLife: number
  onChange: (newLife: number) => void
  isEliminated?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function D20LifeCounter({
  life,
  startingLife,
  onChange,
  isEliminated = false,
  size = 'md',
  className,
}: D20LifeCounterProps) {
  // Allow modifying life even when eliminated (to correct errors)
  const handleChange = (delta: number) => {
    onChange(life + delta)
  }

  const lifePercentage = Math.max(0, Math.min(100, (life / startingLife) * 100))

  // Color based on life points
  const getLifeColor = () => {
    if (life <= 0) return { fill: '#4a4035', text: '#6b5b45', glow: 'rgba(107, 91, 69, 0.3)' }
    if (lifePercentage <= 25) return { fill: '#dc2626', text: '#fca5a5', glow: 'rgba(220, 38, 38, 0.6)' }
    if (lifePercentage <= 50) return { fill: '#ea580c', text: '#fed7aa', glow: 'rgba(234, 88, 12, 0.5)' }
    return { fill: '#16a34a', text: '#bbf7d0', glow: 'rgba(22, 163, 74, 0.4)' }
  }

  const colors = getLifeColor()

  const sizes = {
    sm: {
      container: 'gap-3',
      d20: 'w-20 h-20',
      life: 'text-2xl',
      button: 'w-10 h-10',
      quickButtons: 'text-xs px-2 py-1',
    },
    md: {
      container: 'gap-4',
      d20: 'w-28 h-28',
      life: 'text-4xl',
      button: 'w-12 h-12',
      quickButtons: 'text-sm px-3 py-1.5',
    },
    lg: {
      container: 'gap-5',
      d20: 'w-36 h-36',
      life: 'text-5xl',
      button: 'w-14 h-14',
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
          className={cn(
            'rounded-md font-medieval transition-all',
            'bg-dragon-600/20 text-dragon-400 border border-dragon-600/30',
            'hover:bg-dragon-600/30 hover:border-dragon-500/50',
            s.quickButtons
          )}
        >
          -5
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleChange(5)}
          className={cn(
            'rounded-md font-medieval transition-all',
            'bg-nature-600/20 text-nature-400 border border-nature-600/30',
            'hover:bg-nature-600/30 hover:border-nature-500/50',
            s.quickButtons
          )}
        >
          +5
        </motion.button>
      </div>

      {/* Main counter with D20 */}
      <div className={cn('flex items-center', s.container)}>
        {/* Minus button - semi-transparent white circle */}
        <motion.button
          whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleChange(-1)}
          className={cn(
            'rounded-full flex items-center justify-center font-bold transition-all',
            'bg-white/10 backdrop-blur-sm',
            'text-white/80 border border-white/20',
            'hover:text-white hover:border-white/40',
            s.button
          )}
        >
          <Minus className="w-1/2 h-1/2" />
        </motion.button>

        {/* D20 Life Display */}
        <div className={cn('relative', s.d20)}>
          {/* D20 SVG Shape */}
          <motion.svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full"
            animate={{
              filter: isEliminated 
                ? 'drop-shadow(0 0 0px transparent)' 
                : `drop-shadow(0 0 15px ${colors.glow})`,
            }}
            transition={{ duration: 0.3 }}
          >
            <defs>
              <linearGradient id={`d20Grad-${life}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={colors.fill} stopOpacity="0.9" />
                <stop offset="50%" stopColor={colors.fill} stopOpacity="0.7" />
                <stop offset="100%" stopColor={colors.fill} stopOpacity="0.5" />
              </linearGradient>
              <filter id="d20Shadow">
                <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.4" />
              </filter>
            </defs>
            
            {/* D20 icosahedron shape (simplified 2D representation) */}
            <polygon
              points="50,5 95,30 95,70 50,95 5,70 5,30"
              fill={`url(#d20Grad-${life})`}
              stroke={colors.text}
              strokeWidth="2"
              filter="url(#d20Shadow)"
              className="transition-all duration-300"
            />
            
            {/* Inner facet lines */}
            <g stroke={colors.text} strokeWidth="1" opacity="0.4" fill="none">
              <line x1="50" y1="5" x2="50" y2="50" />
              <line x1="5" y1="30" x2="50" y2="50" />
              <line x1="95" y1="30" x2="50" y2="50" />
              <line x1="5" y1="70" x2="50" y2="50" />
              <line x1="95" y1="70" x2="50" y2="50" />
              <line x1="50" y1="95" x2="50" y2="50" />
              {/* Additional lines for more D20 feel */}
              <line x1="50" y1="5" x2="5" y2="30" />
              <line x1="50" y1="5" x2="95" y2="30" />
              <line x1="5" y1="70" x2="50" y2="95" />
              <line x1="95" y1="70" x2="50" y2="95" />
            </g>
          </motion.svg>

          {/* Life number in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={life}
                initial={{ y: -10, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 10, opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={cn(
                  'font-display font-bold tabular-nums',
                  s.life,
                  isEliminated ? 'text-dungeon-500' : 'text-white'
                )}
                style={{
                  textShadow: isEliminated
                    ? 'none'
                    : `0 2px 4px rgba(0,0,0,0.5), 0 0 20px ${colors.glow}`,
                }}
              >
                {life}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Eliminated overlay */}
          {isEliminated && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-dungeon-900/60 rounded-full" />
              <span className="relative text-2xl">☠️</span>
            </motion.div>
          )}
        </div>

        {/* Plus button - semi-transparent white circle */}
        <motion.button
          whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleChange(1)}
          className={cn(
            'rounded-full flex items-center justify-center font-bold transition-all',
            'bg-white/10 backdrop-blur-sm',
            'text-white/80 border border-white/20',
            'hover:text-white hover:border-white/40',
            s.button
          )}
        >
          <Plus className="w-1/2 h-1/2" />
        </motion.button>
      </div>

      {/* Revive hint when eliminated */}
      {isEliminated && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-parchment-500 italic text-center"
        >
          Use + to revive
        </motion.p>
      )}
    </div>
  )
}
