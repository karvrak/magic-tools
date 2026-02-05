'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DiceLoaderProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const diceNumbers = [1, 4, 7, 11, 15, 18, 20]

export function DiceLoader({ 
  message = "The augurs are consulting the stars...",
  size = 'md',
  className 
}: DiceLoaderProps) {
  const sizes = {
    sm: { dice: 'w-10 h-10 text-lg', text: 'text-sm', runes: 'text-base gap-1' },
    md: { dice: 'w-14 h-14 text-2xl', text: 'text-base', runes: 'text-lg gap-2' },
    lg: { dice: 'w-20 h-20 text-3xl', text: 'text-lg', runes: 'text-xl gap-3' },
  }

  const config = sizes[size]

  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 p-8', className)}>
      {/* D20 Dice */}
      <motion.div
        className={cn(
          config.dice,
          'relative flex items-center justify-center',
          'font-medieval font-bold text-dungeon-900'
        )}
        animate={{
          rotateX: [0, 360],
          rotateY: [0, 180, 360],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* D20 Shape */}
        <svg 
          viewBox="0 0 48 48" 
          className="absolute inset-0 w-full h-full"
          style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}
        >
          <defs>
            <linearGradient id="diceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fcd34d"/>
              <stop offset="50%" stopColor="#d4a418"/>
              <stop offset="100%" stopColor="#92400e"/>
            </linearGradient>
          </defs>
          <polygon 
            points="24,4 44,16 44,32 24,44 4,32 4,16" 
            fill="url(#diceGrad)" 
            stroke="#78350f" 
            strokeWidth="1.5"
          />
          {/* Facet lines */}
          <g stroke="#78350f" strokeWidth="0.5" opacity="0.4" fill="none">
            <line x1="24" y1="4" x2="24" y2="24"/>
            <line x1="4" y1="16" x2="24" y2="24"/>
            <line x1="44" y1="16" x2="24" y2="24"/>
            <line x1="4" y1="32" x2="24" y2="24"/>
            <line x1="44" y1="32" x2="24" y2="24"/>
            <line x1="24" y1="44" x2="24" y2="24"/>
          </g>
        </svg>

        {/* Rolling number */}
        <motion.span
          className="relative z-10"
          animate={{
            opacity: [1, 0.5, 1],
          }}
          transition={{
            duration: 0.3,
            repeat: Infinity,
          }}
        >
          <motion.span
            key="dice-number"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.1 }}
          >
            20
          </motion.span>
        </motion.span>

        {/* Magic glow */}
        <motion.div
          className="absolute inset-0 rounded-lg pointer-events-none"
          animate={{
            boxShadow: [
              '0 0 10px rgba(212, 164, 24, 0.3)',
              '0 0 30px rgba(212, 164, 24, 0.6)',
              '0 0 10px rgba(212, 164, 24, 0.3)',
            ],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>

      {/* Narrative message */}
      <motion.p
        className={cn(
          config.text,
          'font-body text-parchment-400 italic text-center max-w-xs'
        )}
        animate={{
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {message}
      </motion.p>

      {/* Decorative runes */}
      <div className={cn('flex', config.runes)}>
        {['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ'].map((rune, i) => (
          <motion.span
            key={rune}
            className="text-gold-600/60"
            animate={{
              opacity: [0.3, 1, 0.3],
              textShadow: [
                '0 0 5px transparent',
                '0 0 15px rgba(212, 164, 24, 0.8)',
                '0 0 5px transparent',
              ],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2,
            }}
          >
            {rune}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

// Simple inline loader for buttons etc
export function DiceLoaderInline({ className }: { className?: string }) {
  return (
    <motion.span
      className={cn('inline-block w-5 h-5', className)}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    >
      <svg viewBox="0 0 24 24" className="w-full h-full">
        <polygon 
          points="12,2 22,8 22,16 12,22 2,16 2,8" 
          fill="currentColor" 
          opacity="0.8"
        />
      </svg>
    </motion.span>
  )
}
