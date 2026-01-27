'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BattleArena } from '@/components/battle/battle-arena'
import { DiceLoader } from '@/components/ui/dice-loader'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/hooks/use-toast'
import { GAME_MODES, type PlayerState, type BattleResult, type Battle } from '@/types/battle'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function BattleArenaPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Fetch battle data
  const { data, isLoading, error } = useQuery<{ battle: Battle }>({
    queryKey: ['battle', id],
    queryFn: async () => {
      const response = await fetch(`/api/battles/${id}`)
      if (!response.ok) throw new Error('Battle not found')
      return response.json()
    },
  })

  // Finish battle mutation
  const finishMutation = useMutation({
    mutationFn: async (players: PlayerState[]): Promise<{ battle: Battle; result: BattleResult }> => {
      const response = await fetch(`/api/battles/${id}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          players: players.map((p) => ({
            id: p.id,
            finalLife: p.currentLife,
            victoryPoints: p.victoryPoints,
            isEliminated: p.isEliminated,
            commanderDamage: p.commanderDamage,
          })),
        }),
      })
      if (!response.ok) throw new Error('Failed to finish battle')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['battles'] })
      toast({
        title: '🏆 Battle Recorded!',
        description: 'The results have been saved to the archives.',
      })
    },
    onError: () => {
      toast({
        title: 'Failed to save battle',
        description: 'Please try again.',
        variant: 'destructive',
      })
    },
  })

  // Create rematch mutation
  const rematchMutation = useMutation({
    mutationFn: async () => {
      if (!data?.battle) throw new Error('No battle data')

      const response = await fetch('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: data.battle.mode,
          players: data.battle.players.map((p) => ({
            deckId: p.deckId,
            deckName: p.deckName,
            team: p.team,
          })),
        }),
      })
      if (!response.ok) throw new Error('Failed to create rematch')
      return response.json()
    },
    onSuccess: (newBattle) => {
      router.push(`/battle/${newBattle.battle.id}`)
    },
    onError: () => {
      toast({
        title: 'Failed to create rematch',
        description: 'Please try again.',
        variant: 'destructive',
      })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <DiceLoader message="Preparing the arena..." />
      </div>
    )
  }

  if (error || !data?.battle) {
    return (
      <EmptyState
        variant="search"
        title="Battle Not Found"
        description="This battle doesn't exist or has been deleted."
        action={{
          label: 'Return to Arena',
          onClick: () => router.push('/battle'),
        }}
      />
    )
  }

  const battle = data.battle
  const modeConfig = GAME_MODES[battle.mode]

  // Si la bataille est déjà terminée, rediriger vers l'historique
  if (battle.status === 'finished') {
    return (
      <EmptyState
        variant="decks"
        title="Battle Already Finished"
        description="This battle has already been completed."
        action={{
          label: 'View History',
          onClick: () => router.push('/battle/history'),
        }}
      />
    )
  }

  // Convertir les joueurs de la DB en état client
  const initialPlayers: PlayerState[] = battle.players.map((p) => ({
    id: p.id,
    deckId: p.deckId,
    deckName: p.deckName,
    deckImageUrl: (p as { deck?: { coverImage?: string | null } }).deck?.coverImage || null,
    playerOrder: p.playerOrder,
    team: p.team,
    currentLife: p.finalLife, // finalLife contient la valeur actuelle
    startingLife: p.startingLife,
    victoryPoints: p.victoryPoints,
    isEliminated: p.isEliminated,
    commanderDamage: (p.commanderDamage as Record<string, number>) || {},
  }))

  const handleFinish = async (players: PlayerState[]): Promise<BattleResult> => {
    const result = await finishMutation.mutateAsync(players)
    return result.result
  }

  return (
    <BattleArena
      battleId={id}
      modeConfig={modeConfig}
      initialPlayers={initialPlayers}
      onFinish={handleFinish}
      onRematch={() => rematchMutation.mutate()}
      onNewBattle={() => router.push('/battle')}
    />
  )
}
