'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DiceRollAnimationProps {
  players: { id: string; deckName: string; playerOrder: number }[]
  onComplete: (results: { playerId: string; roll: number }[], startingPlayerId: string) => void
}

interface DiceResult {
  playerId: string
  deckName: string
  playerOrder: number
  roll: number | null
  isRolling: boolean
  hasRolled: boolean
}

export function DiceRollAnimation({ players, onComplete }: DiceRollAnimationProps) {
  const [diceResults, setDiceResults] = useState<DiceResult[]>(
    players.map((p) => ({
      playerId: p.id,
      deckName: p.deckName,
      playerOrder: p.playerOrder,
      roll: null,
      isRolling: false,
      hasRolled: false,
    }))
  )
  const [phase, setPhase] = useState<'waiting' | 'rolling' | 'complete'>('waiting')
  const [winner, setWinner] = useState<DiceResult | null>(null)

  // Roll all dice simultaneously
  const rollAllDice = useCallback(() => {
    // Reduced animation duration (800ms)
    const rollDuration = 800

    // Mark all as "rolling" at the same time
    setDiceResults((prev) =>
      prev.map((result) => ({ ...result, isRolling: true }))
    )

    // Animation of value change for all dice
    const intervalId = setInterval(() => {
      setDiceResults((prev) =>
        prev.map((result) => ({
          ...result,
          roll: Math.floor(Math.random() * 20) + 1,
        }))
      )
    }, 60)

    // Final results for all at the same time
    setTimeout(() => {
      clearInterval(intervalId)
      setDiceResults((prev) =>
        prev.map((result) => ({
          ...result,
          roll: Math.floor(Math.random() * 20) + 1,
          isRolling: false,
          hasRolled: true,
        }))
      )
      setPhase('complete')
    }, rollDuration)
  }, [])

  // Start simultaneous rolls
  const startRolling = useCallback(() => {
    setPhase('rolling')
    rollAllDice()
  }, [rollAllDice])

  // Determine the winner when all have rolled
  useEffect(() => {
    if (phase !== 'complete') return

    const allRolled = diceResults.every((r) => r.hasRolled && r.roll !== null)
    if (!allRolled) return

    // Find the highest score
    const maxRoll = Math.max(...diceResults.map((r) => r.roll || 0))
    const winners = diceResults.filter((r) => r.roll === maxRoll)

    // In case of a tie, take the first one (or could re-roll)
    const finalWinner = winners[0]
    setWinner(finalWinner)

    // Notify after a short delay
    setTimeout(() => {
      onComplete(
        diceResults.map((r) => ({ playerId: r.playerId, roll: r.roll || 0 })),
        finalWinner.playerId
      )
    }, 1000)
  }, [phase, diceResults, onComplete])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dungeon-950/95 backdrop-blur-sm">
      <div className="max-w-4xl w-full px-4">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h2 className="font-display text-3xl md:text-4xl text-gold-400 mb-2">
            🎲 Who goes first?
          </h2>
          <p className="text-parchment-400 font-body">
            {phase === 'waiting' && 'Roll the dice to determine the play order!'}
            {phase === 'rolling' && 'The dice are rolling...'}
            {phase === 'complete' && winner && (
              <span className="text-gold-300">
                <span className="font-medieval">{winner.deckName}</span> goes first with a{' '}
                <span className="text-2xl font-bold">{winner.roll}</span> !
              </span>
            )}
          </p>
        </motion.div>

        {/* Dice Grid */}
        <div
          className={cn(
            'grid gap-6 mb-8',
            players.length === 2 && 'grid-cols-2',
            players.length === 3 && 'grid-cols-3',
            players.length === 4 && 'grid-cols-2 md:grid-cols-4'
          )}
        >
          {diceResults.map((result, index) => (
            <motion.div
              key={result.playerId}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'flex flex-col items-center p-6 rounded-xl',
                'bg-dungeon-800/50 border-2',
                winner?.playerId === result.playerId
                  ? 'border-gold-500 bg-gold-600/10 shadow-gold-glow'
                  : 'border-dungeon-600/50'
              )}
            >
              {/* Player name */}
              <p className="font-medieval text-lg text-parchment-300 mb-4">
                {result.deckName}
              </p>

              {/* D20 */}
              <div className="relative w-24 h-24 mb-4">
                <motion.svg
                  viewBox="0 0 100 100"
                  className="w-full h-full"
                  animate={
                    result.isRolling
                      ? {
                          rotateX: [0, 360],
                          rotateY: [0, 180, 360],
                          rotateZ: [0, 90, 180, 270, 360],
                        }
                      : {}
                  }
                  transition={
                    result.isRolling
                      ? {
                          duration: 0.5,
                          repeat: Infinity,
                          ease: 'linear',
                        }
                      : {}
                  }
                  style={{
                    transformStyle: 'preserve-3d',
                    filter: winner?.playerId === result.playerId
                      ? 'drop-shadow(0 0 20px rgba(212, 164, 24, 0.8))'
                      : 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))',
                  }}
                >
                  <defs>
                    <linearGradient id={`diceGrad-${result.playerId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={winner?.playerId === result.playerId ? '#fcd34d' : '#d4a418'} />
                      <stop offset="50%" stopColor={winner?.playerId === result.playerId ? '#d4a418' : '#92400e'} />
                      <stop offset="100%" stopColor={winner?.playerId === result.playerId ? '#b8860b' : '#78350f'} />
                    </linearGradient>
                  </defs>
                  <polygon
                    points="50,5 95,30 95,70 50,95 5,70 5,30"
                    fill={`url(#diceGrad-${result.playerId})`}
                    stroke={winner?.playerId === result.playerId ? '#fcd34d' : '#78350f'}
                    strokeWidth="2"
                  />
                  <g stroke="#78350f" strokeWidth="0.5" opacity="0.4" fill="none">
                    <line x1="50" y1="5" x2="50" y2="50" />
                    <line x1="5" y1="30" x2="50" y2="50" />
                    <line x1="95" y1="30" x2="50" y2="50" />
                    <line x1="5" y1="70" x2="50" y2="50" />
                    <line x1="95" y1="70" x2="50" y2="50" />
                    <line x1="50" y1="95" x2="50" y2="50" />
                  </g>
                </motion.svg>

                {/* Roll number */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <AnimatePresence mode="popLayout">
                    {result.roll !== null ? (
                      <motion.span
                        key={result.roll}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        className={cn(
                          'font-display font-bold text-3xl',
                          winner?.playerId === result.playerId
                            ? 'text-dungeon-900'
                            : 'text-dungeon-900'
                        )}
                        style={{
                          textShadow: result.isRolling
                            ? 'none'
                            : '0 1px 2px rgba(255,255,255,0.3)',
                        }}
                      >
                        {result.roll}
                      </motion.span>
                    ) : (
                      <motion.span
                        className="text-3xl text-dungeon-700"
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        ?
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Status */}
              <div className="text-center">
                {!result.hasRolled && !result.isRolling && (
                  <span className="text-sm text-parchment-500">Waiting...</span>
                )}
                {result.isRolling && (
                  <motion.span
                    className="text-sm text-gold-400 font-medieval"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    Rolling...
                  </motion.span>
                )}
                {result.hasRolled && !result.isRolling && winner?.playerId === result.playerId && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-sm font-bold text-gold-400"
                  >
                    🏆 FIRST!
                  </motion.span>
                )}
                {result.hasRolled && !result.isRolling && winner?.playerId !== result.playerId && (
                  <span className="text-sm text-parchment-500">
                    Score: {result.roll}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Start button */}
        {phase === 'waiting' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startRolling}
              className={cn(
                'px-8 py-4 rounded-xl font-display text-xl',
                'bg-gradient-to-b from-gold-500 to-gold-600',
                'text-dungeon-900 font-bold',
                'border-2 border-gold-400',
                'shadow-lg hover:shadow-gold-glow',
                'transition-all duration-300'
              )}
            >
              🎲 Roll the Dice!
            </motion.button>
          </motion.div>
        )}

        {/* Loading indicator during complete phase */}
        {phase === 'complete' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <p className="text-parchment-400 text-sm">
              Preparing the arena...
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
