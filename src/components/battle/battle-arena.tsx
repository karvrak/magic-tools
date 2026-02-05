'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Swords, RotateCcw, Flag, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PlayerCard } from './player-card'
import { BattleResultModal } from './battle-result-modal'
import { DiceRollAnimation } from './dice-roll-animation'
import type { PlayerState, GameModeConfig, BattleResult } from '@/types/battle'

interface BattleArenaProps {
  battleId: string
  modeConfig: GameModeConfig
  initialPlayers: PlayerState[]
  onFinish: (players: PlayerState[]) => Promise<BattleResult>
  onRematch: () => void
  onNewBattle: () => void
}

export function BattleArena({
  battleId,
  modeConfig,
  initialPlayers,
  onFinish,
  onRematch,
  onNewBattle,
}: BattleArenaProps) {
  const [players, setPlayers] = useState<PlayerState[]>(initialPlayers)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null)
  const [isFinishing, setIsFinishing] = useState(false)
  const [showDiceRoll, setShowDiceRoll] = useState(true) // Show dice roll at start
  const [startingPlayerId, setStartingPlayerId] = useState<string | null>(null)

  // Handle initial dice roll
  const handleDiceRollComplete = useCallback(
    (results: { playerId: string; roll: number }[], winnerId: string) => {
      setPlayers((prev) =>
        prev.map((p) => {
          const result = results.find((r) => r.playerId === p.id)
          return {
            ...p,
            diceRoll: result?.roll,
          }
        })
      )
      setStartingPlayerId(winnerId)
      setShowDiceRoll(false)
    },
    []
  )

  // Handle life changes - allows resurrection
  const handleLifeChange = useCallback(
    (playerId: string, newLife: number) => {
      setPlayers((prev) => {
        const playerIndex = prev.findIndex((p) => p.id === playerId)
        if (playerIndex === -1) return prev

        const player = prev[playerIndex]
        const updated = [...prev]

        // 2v2 mode: life transfer if drops to 0
        if (modeConfig.hasTeams && newLife <= 0 && !player.isEliminated) {
          const ally = prev.find(
            (p) => p.team === player.team && p.id !== playerId && !p.isEliminated
          )

          if (ally && ally.currentLife > 1) {
            // Transfer 1 HP from ally
            const allyIndex = prev.findIndex((p) => p.id === ally.id)
            updated[allyIndex] = {
              ...ally,
              currentLife: ally.currentLife - 1,
            }
            updated[playerIndex] = {
              ...player,
              currentLife: 1, // Returns to 1 LP
            }
            return updated
          } else if (ally && ally.currentLife === 1) {
            // Ally doesn't have enough LP, player is eliminated
            updated[playerIndex] = {
              ...player,
              currentLife: 0,
              isEliminated: true,
            }
            return updated
          }
        }

        // Normal case - ALLOWS RESURRECTION if adding HP to an eliminated player
        const wasEliminated = player.isEliminated
        const willBeAlive = newLife > 0

        updated[playerIndex] = {
          ...player,
          currentLife: newLife,
          // If the player was eliminated and we give them HP, they come back to life
          isEliminated: wasEliminated && !willBeAlive ? true : !willBeAlive,
        }

        return updated
      })
    },
    [modeConfig.hasTeams]
  )

  const handleVictoryPointsChange = useCallback(
    (playerId: string, newPoints: number) => {
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, victoryPoints: newPoints } : p))
      )
    },
    []
  )

  const handleCommanderDamageChange = useCallback(
    (playerId: string, fromPlayer: number, damage: number) => {
      setPlayers((prev) =>
        prev.map((p) => {
          if (p.id !== playerId) return p

          const newCommanderDamage = {
            ...p.commanderDamage,
            [fromPlayer.toString()]: damage,
          }

          // Check if player is eliminated by commander damage
          const isLethal = damage >= (modeConfig.commanderDamageThreshold || 21)

          return {
            ...p,
            commanderDamage: newCommanderDamage,
            isEliminated: isLethal || p.isEliminated,
          }
        })
      )
    },
    [modeConfig.commanderDamageThreshold]
  )

  const handleReset = useCallback(() => {
    if (!confirm('Reset all life points?')) return

    setPlayers(
      initialPlayers.map((p) => ({
        ...p,
        currentLife: p.startingLife,
        victoryPoints: 0,
        isEliminated: false,
        commanderDamage: {},
      }))
    )
  }, [initialPlayers])

  const handleEndBattle = useCallback(async () => {
    if (!confirm('End battle and save results?')) return

    setIsFinishing(true)
    try {
      const result = await onFinish(players)
      setBattleResult(result)
      setShowResult(true)
    } catch (error) {
      console.error('Failed to finish battle:', error)
    } finally {
      setIsFinishing(false)
    }
  }, [players, onFinish])

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Check if the battle is automatically over
  const activePlayers = players.filter((p) => !p.isEliminated)
  const isGameOver = modeConfig.hasTeams
    ? players.filter((p) => p.team === 1 && p.isEliminated).length >= 2 ||
      players.filter((p) => p.team === 2 && p.isEliminated).length >= 2
    : activePlayers.length <= 1

  // Grid layout based on number of players
  const gridClass = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-2',
  }[modeConfig.players]

  // Sort players by order (dice winner first if applicable)
  const sortedPlayers = startingPlayerId
    ? [...players].sort((a, b) => {
        if (a.id === startingPlayerId) return -1
        if (b.id === startingPlayerId) return 1
        return a.playerOrder - b.playerOrder
      })
    : players

  // Display dice roll animation
  if (showDiceRoll) {
    return (
      <DiceRollAnimation
        players={players.map((p) => ({
          id: p.id,
          deckName: p.deckName,
          playerOrder: p.playerOrder,
        }))}
        onComplete={handleDiceRollComplete}
      />
    )
  }

  return (
    <div
      className={cn(
        'min-h-screen flex flex-col',
        isFullscreen && 'bg-dungeon-950'
      )}
    >
      {/* Header */}
      <header
        className={cn(
          'sticky top-0 z-40 px-4 py-3',
          'bg-dungeon-900/95 backdrop-blur-md',
          'border-b border-gold-600/30'
        )}
      >
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Swords className="w-6 h-6 text-gold-500" />
            <div>
              <h1 className="font-display text-xl text-gold-400">
                {modeConfig.name}
              </h1>
              <p className="text-xs text-parchment-500">{modeConfig.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEndBattle}
              disabled={isFinishing}
            >
              <Flag className="w-4 h-4 mr-2" />
              {isFinishing ? 'Saving...' : 'End Battle'}
            </Button>
          </div>
        </div>
      </header>

      {/* Starting player indicator */}
      {startingPlayerId && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gold-600/20 border-b border-gold-600/30 px-4 py-2 text-center"
        >
          <span className="text-sm text-gold-400">
            🎲{' '}
            <span className="font-medieval">
              {players.find((p) => p.id === startingPlayerId)?.deckName}
            </span>{' '}
            starts the game!
          </span>
        </motion.div>
      )}

      {/* Arena */}
      <main className="flex-1 p-4 md:p-6">
        <div className={cn('grid gap-4 md:gap-6 max-w-6xl mx-auto', gridClass)}>
          {sortedPlayers.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              modeConfig={modeConfig}
              allPlayers={players}
              onLifeChange={handleLifeChange}
              onVictoryPointsChange={handleVictoryPointsChange}
              onCommanderDamageChange={handleCommanderDamageChange}
              isCompact={isFullscreen}
              deckImageUrl={player.deckImageUrl}
            />
          ))}
        </div>

        {/* Game Over Alert */}
        {isGameOver && !showResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="px-6 py-3 rounded-xl bg-gold-600/90 text-dungeon-900 font-medieval shadow-lg">
              🏆 Battle finished! Click &quot;End Battle&quot; to save results.
            </div>
          </motion.div>
        )}
      </main>

      {/* Result Modal */}
      <BattleResultModal
        open={showResult}
        onClose={() => setShowResult(false)}
        result={battleResult}
        modeConfig={modeConfig}
        onRematch={() => {
          setShowResult(false)
          onRematch()
        }}
        onNewBattle={() => {
          setShowResult(false)
          onNewBattle()
        }}
      />
    </div>
  )
}
