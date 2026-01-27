'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface RuneLoaderProps {
  message?: string
  variant?: 'gold' | 'arcane' | 'fire'
  className?: string
}

const runeSequences = {
  gold: ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ'],
  arcane: ['☽', '★', '◇', '△', '○', '☆', '☾'],
  fire: ['🜂', '🜁', '🜄', '🜃', '⚶', '☉', '⚷'],
}

const colorVariants = {
  gold: {
    base: 'text-gold-600/40',
    glow: 'rgba(212, 164, 24, 0.8)',
    active: 'text-gold-400',
  },
  arcane: {
    base: 'text-arcane-600/40',
    glow: 'rgba(168, 85, 247, 0.8)',
    active: 'text-arcane-400',
  },
  fire: {
    base: 'text-dragon-600/40',
    glow: 'rgba(232, 93, 4, 0.8)',
    active: 'text-dragon-400',
  },
}

export function RuneLoader({ 
  message = "Channeling ancient power...",
  variant = 'gold',
  className 
}: RuneLoaderProps) {
  const runes = runeSequences[variant]
  const colors = colorVariants[variant]

  return (
    <div className={cn('flex flex-col items-center justify-center gap-6 p-8', className)}>
      {/* Rune circle */}
      <div className="relative w-32 h-32">
        {/* Outer rotating ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-dashed"
          style={{ borderColor: colors.glow.replace('0.8', '0.3') }}
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />

        {/* Inner pulsing ring */}
        <motion.div
          className="absolute inset-4 rounded-full border"
          style={{ borderColor: colors.glow.replace('0.8', '0.5') }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Center rune */}
        <motion.div
          className="absolute inset-8 flex items-center justify-center"
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.span
            className={cn('text-4xl font-medieval', colors.active)}
            animate={{
              textShadow: [
                `0 0 10px transparent`,
                `0 0 30px ${colors.glow}`,
                `0 0 10px transparent`,
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            ᛟ
          </motion.span>
        </motion.div>

        {/* Orbiting runes */}
        {runes.map((rune, i) => {
          const angle = (i * 360) / runes.length
          const delay = i * 0.15

          return (
            <motion.div
              key={i}
              className="absolute w-full h-full"
              animate={{ rotate: [angle, angle + 360] }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <motion.span
                className={cn('absolute text-xl', colors.base)}
                style={{
                  top: '0%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                }}
                animate={{
                  opacity: [0.3, 1, 0.3],
                  textShadow: [
                    '0 0 5px transparent',
                    `0 0 20px ${colors.glow}`,
                    '0 0 5px transparent',
                  ],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay,
                }}
              >
                {rune}
              </motion.span>
            </motion.div>
          )
        })}
      </div>

      {/* Message */}
      <motion.p
        className="font-body text-parchment-400 italic text-center"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {message}
      </motion.p>
    </div>
  )
}

// Horizontal rune sequence loader
export function RuneLoaderHorizontal({ 
  variant = 'gold',
  className 
}: { variant?: 'gold' | 'arcane' | 'fire', className?: string }) {
  const runes = runeSequences[variant].slice(0, 5)
  const colors = colorVariants[variant]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {runes.map((rune, i) => (
        <motion.span
          key={i}
          className={cn('text-lg', colors.base)}
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [1, 1.2, 1],
            textShadow: [
              '0 0 5px transparent',
              `0 0 15px ${colors.glow}`,
              '0 0 5px transparent',
            ],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.15,
          }}
        >
          {rune}
        </motion.span>
      ))}
    </div>
  )
}
