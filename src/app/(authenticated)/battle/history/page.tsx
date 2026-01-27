'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  History,
  Swords,
  Trophy,
  Users,
  Crown,
  Shield,
  Calendar,
  Clock,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DiceLoader } from '@/components/ui/dice-loader'
import { EmptyState } from '@/components/ui/empty-state'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/layout/page-transition'
import { GAME_MODES, type Battle, type GameMode } from '@/types/battle'

const MODE_ICONS: Record<GameMode, React.ReactNode> = {
  CLASSIC_1V1: <Swords className="w-4 h-4" />,
  FREE_FOR_ALL_3: <Trophy className="w-4 h-4" />,
  TWO_HEADED_GIANT: <Users className="w-4 h-4" />,
  COMMANDER: <Crown className="w-4 h-4" />,
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDuration(start: string, end: string | null) {
  if (!end) return 'En cours'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}min`
}

export default function BattleHistoryPage() {
  const { data, isLoading } = useQuery<{ battles: Battle[] }>({
    queryKey: ['battles', 'history'],
    queryFn: async () => {
      const response = await fetch('/api/battles?status=finished&limit=50')
      if (!response.ok) throw new Error('Failed to fetch battles')
      return response.json()
    },
  })

  const battles = data?.battles || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <History className="w-6 h-6 text-gold-500" />
              <h1 className="font-display text-2xl text-gold-400">Battle Archives</h1>
            </div>
            <p className="text-parchment-500 text-sm">
              Chronicle of past battles and their outcomes
            </p>
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link href="/battle">
              <Button>
                <Swords className="w-4 h-4 mr-2" />
                New Battle
              </Button>
            </Link>
          </motion.div>
        </div>
      </FadeIn>

      {/* Loading */}
      {isLoading && (
        <DiceLoader message="Consulting the archives..." />
      )}

      {/* Empty state */}
      {!isLoading && battles.length === 0 && (
        <EmptyState
          variant="search"
          title="No Battles Yet"
          description="Your battle history is empty. Start your first battle to see it here!"
          action={{
            label: 'Start a Battle',
            onClick: () => window.location.href = '/battle',
          }}
        />
      )}

      {/* Battle list */}
      {battles.length > 0 && (
        <StaggerContainer className="space-y-4">
          {battles.map((battle, index) => {
            const modeConfig = GAME_MODES[battle.mode]
            const winner = battle.winnerId
              ? battle.players.find((p) => p.id === battle.winnerId)
              : null
            const winnerTeamPlayers = battle.winnerTeam
              ? battle.players.filter((p) => p.team === battle.winnerTeam)
              : null

            return (
              <StaggerItem key={battle.id}>
                <motion.div
                  whileHover={{ y: -2 }}
                  className={cn(
                    'card-frame p-4 hover:border-gold-500/50 transition-all cursor-pointer'
                  )}
                >
                  <div className="flex items-start gap-4">
                    {/* Mode icon */}
                    <div
                      className={cn(
                        'w-12 h-12 rounded-lg flex items-center justify-center shrink-0',
                        'bg-dungeon-700/50 text-gold-500'
                      )}
                    >
                      {MODE_ICONS[battle.mode]}
                    </div>

                    {/* Battle info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medieval text-lg text-gold-400">
                          {modeConfig.name}
                        </h3>
                        <span className="text-xs text-parchment-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(battle.startedAt)}
                        </span>
                        {battle.finishedAt && (
                          <span className="text-xs text-parchment-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(battle.startedAt, battle.finishedAt)}
                          </span>
                        )}
                      </div>

                      {/* Players */}
                      <div className="flex flex-wrap gap-2 mb-2">
                        {battle.players.map((player) => {
                          const isWinner = modeConfig.hasTeams
                            ? player.team === battle.winnerTeam
                            : player.id === battle.winnerId

                          return (
                            <div
                              key={player.id}
                              className={cn(
                                'flex items-center gap-1.5 px-2 py-1 rounded text-sm',
                                isWinner
                                  ? 'bg-gold-600/20 text-gold-400 border border-gold-500/30'
                                  : player.isEliminated
                                  ? 'bg-dragon-600/10 text-parchment-500 line-through'
                                  : 'bg-dungeon-700/50 text-parchment-400'
                              )}
                            >
                              {isWinner && <Crown className="w-3 h-3" />}
                              <span>{player.deckName}</span>
                              <span className="text-xs opacity-70">
                                ({player.finalLife} PV
                                {modeConfig.hasVictoryPoints && ` +${player.victoryPoints} VP`})
                              </span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Winner */}
                      <div className="flex items-center gap-2 text-sm">
                        <Trophy className="w-4 h-4 text-gold-500" />
                        <span className="text-parchment-400">Winner:</span>
                        <span className="font-medieval text-gold-400">
                          {winner
                            ? winner.deckName
                            : winnerTeamPlayers
                            ? `Team ${battle.winnerTeam} (${winnerTeamPlayers.map((p) => p.deckName).join(' & ')})`
                            : 'Unknown'}
                        </span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-5 h-5 text-parchment-500 shrink-0" />
                  </div>
                </motion.div>
              </StaggerItem>
            )
          })}
        </StaggerContainer>
      )}
    </div>
  )
}
