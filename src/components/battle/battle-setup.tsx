'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Swords,
  Users,
  Crown,
  Shield,
  Trophy,
  Plus,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GAME_MODES, type GameMode, type GameModeConfig } from '@/types/battle'

interface BattleSetupProps {
  onStart: (mode: GameMode, players: { deckId: string | null; deckName: string; team?: number }[]) => void
  isLoading?: boolean
}

interface Deck {
  id: string
  name: string
  format: string | null
}

const MODE_ICONS: Record<GameMode, React.ReactNode> = {
  CLASSIC_1V1: <Swords className="w-6 h-6" />,
  FREE_FOR_ALL_3: <Trophy className="w-6 h-6" />,
  TWO_HEADED_GIANT: <Users className="w-6 h-6" />,
  COMMANDER: <Crown className="w-6 h-6" />,
}

const MODE_COLORS: Record<GameMode, string> = {
  CLASSIC_1V1: 'from-dragon-600/20 to-dragon-700/10 border-dragon-500/40 hover:border-dragon-400/60',
  FREE_FOR_ALL_3: 'from-gold-600/20 to-gold-700/10 border-gold-500/40 hover:border-gold-400/60',
  TWO_HEADED_GIANT: 'from-blue-600/20 to-blue-700/10 border-blue-500/40 hover:border-blue-400/60',
  COMMANDER: 'from-arcane-600/20 to-arcane-700/10 border-arcane-500/40 hover:border-arcane-400/60',
}

export function BattleSetup({ onStart, isLoading }: BattleSetupProps) {
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null)
  const [players, setPlayers] = useState<{ deckId: string | null; deckName: string; team?: number }[]>([])

  // Fetch existing decks
  const { data: decksData } = useQuery<{ decks: Deck[] }>({
    queryKey: ['decks'],
    queryFn: async () => {
      const response = await fetch('/api/decks')
      if (!response.ok) throw new Error('Failed to fetch decks')
      return response.json()
    },
  })

  const decks = decksData?.decks || []

  const handleModeSelect = (mode: GameMode) => {
    const config = GAME_MODES[mode]
    setSelectedMode(mode)

    // Initialiser les joueurs selon le mode
    const initialPlayers = Array.from({ length: config.players }, (_, i) => ({
      deckId: null as string | null,
      deckName: '',
      team: config.hasTeams ? (i < 2 ? 1 : 2) : undefined,
    }))
    setPlayers(initialPlayers)
  }

  const handlePlayerChange = (index: number, field: 'deckId' | 'deckName', value: string) => {
    setPlayers((prev) => {
      const updated = [...prev]
      if (field === 'deckId') {
        const deck = decks.find((d) => d.id === value)
        updated[index] = {
          ...updated[index],
          deckId: value === 'custom' ? null : value,
          deckName: value === 'custom' ? updated[index].deckName : (deck?.name || ''),
        }
      } else {
        updated[index] = { ...updated[index], [field]: value }
      }
      return updated
    })
  }

  const canStart = selectedMode && players.every((p) => p.deckName.trim().length > 0)

  const modeConfig = selectedMode ? GAME_MODES[selectedMode] : null

  return (
    <div className="space-y-8">
      {/* Mode Selection */}
      <section>
        <h2 className="font-display text-xl text-gold-400 mb-4 flex items-center gap-2">
          <Swords className="w-5 h-5" />
          Choose Your Battle Mode
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.entries(GAME_MODES) as [GameMode, GameModeConfig][]).map(([mode, config]) => (
            <motion.button
              key={mode}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleModeSelect(mode)}
              className={cn(
                'relative p-4 rounded-xl text-left transition-all duration-300',
                'bg-gradient-to-b border-2',
                MODE_COLORS[mode],
                selectedMode === mode && 'ring-2 ring-gold-500 ring-offset-2 ring-offset-dungeon-900'
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  'w-12 h-12 rounded-lg flex items-center justify-center mb-3',
                  'bg-dungeon-800/50',
                  selectedMode === mode ? 'text-gold-400' : 'text-parchment-400'
                )}
              >
                {MODE_ICONS[mode]}
              </div>

              {/* Info */}
              <h3 className="font-medieval text-lg text-parchment-200 mb-1">
                {config.name}
              </h3>
              <p className="text-xs text-parchment-500 mb-2">{config.description}</p>

              {/* Stats */}
              <div className="flex items-center gap-3 text-xs text-parchment-400">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {config.players}
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {config.startingLife} PV
                </span>
              </div>

              {/* Features badges */}
              <div className="flex flex-wrap gap-1 mt-2">
                {config.hasTeams && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-600/30 text-blue-400">
                    Teams
                  </span>
                )}
                {config.hasVictoryPoints && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-gold-600/30 text-gold-400">
                    VP
                  </span>
                )}
                {config.hasCommanderDamage && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-arcane-600/30 text-arcane-400">
                    Cmd Dmg
                  </span>
                )}
              </div>

              {/* Selected indicator */}
              {selectedMode === mode && (
                <motion.div
                  layoutId="mode-selected"
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gold-500 flex items-center justify-center"
                >
                  <Sparkles className="w-4 h-4 text-dungeon-900" />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </section>

      {/* Player Setup */}
      <AnimatePresence>
        {selectedMode && modeConfig && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="font-display text-xl text-gold-400 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Select Combatants
            </h2>

            <div
              className={cn(
                'grid gap-4',
                modeConfig.players === 2 && 'grid-cols-1 md:grid-cols-2',
                modeConfig.players === 3 && 'grid-cols-1 md:grid-cols-3',
                modeConfig.players === 4 && 'grid-cols-2'
              )}
            >
              {players.map((player, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    'p-4 rounded-xl',
                    'bg-dungeon-800/50 border',
                    modeConfig.hasTeams
                      ? player.team === 1
                        ? 'border-blue-500/30'
                        : 'border-orange-500/30'
                      : 'border-dungeon-600/30'
                  )}
                >
                  {/* Player header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm',
                        modeConfig.hasTeams
                          ? player.team === 1
                            ? 'bg-blue-600/30 text-blue-400'
                            : 'bg-orange-600/30 text-orange-400'
                          : 'bg-gold-600/20 text-gold-400'
                      )}
                    >
                      {index + 1}
                    </div>
                    <span className="font-medieval text-parchment-300">
                      Player {index + 1}
                    </span>
                    {modeConfig.hasTeams && (
                      <span
                        className={cn(
                          'ml-auto text-xs px-2 py-0.5 rounded',
                          player.team === 1
                            ? 'bg-blue-600/20 text-blue-400'
                            : 'bg-orange-600/20 text-orange-400'
                        )}
                      >
                        Team {player.team}
                      </span>
                    )}
                  </div>

                  {/* Deck selection */}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-parchment-500">Deck</Label>
                      <Select
                        value={player.deckId || 'custom'}
                        onValueChange={(value) => handlePlayerChange(index, 'deckId', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select a deck..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">
                            <span className="flex items-center gap-2">
                              <Plus className="w-3 h-3" />
                              Custom deck name
                            </span>
                          </SelectItem>
                          {decks.map((deck) => (
                            <SelectItem key={deck.id} value={deck.id}>
                              {deck.name}
                              {deck.format && (
                                <span className="ml-2 text-xs text-parchment-500">
                                  ({deck.format})
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom name input */}
                    {!player.deckId && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                      >
                        <Label className="text-xs text-parchment-500">Deck Name</Label>
                        <Input
                          value={player.deckName}
                          onChange={(e) => handlePlayerChange(index, 'deckName', e.target.value)}
                          placeholder="Enter deck name..."
                          className="mt-1"
                        />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Start button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex justify-center mt-6"
            >
              <Button
                size="xl"
                onClick={() => onStart(selectedMode, players)}
                disabled={!canStart || isLoading}
                className="min-w-[200px]"
              >
                {isLoading ? (
                  'Preparing Arena...'
                ) : (
                  <>
                    <Swords className="w-5 h-5 mr-2" />
                    Start Battle
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
