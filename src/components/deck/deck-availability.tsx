'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, Heart, Check, X, AlertTriangle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface CardAvailability {
  cardId: string
  cardName: string
  needed: number
  owned: number
  missing: number
  category: string
}

interface AvailabilityData {
  deckId: string
  deckName: string
  ownerId: string | null
  summary: {
    totalCards: number
    uniqueCards: number
    ownedCards: number
    missingCards: number
    coveragePercent: number
    isComplete: boolean
  }
  cards: CardAvailability[]
}

interface DeckAvailabilityProps {
  deckId: string
}

export function DeckAvailability({ deckId }: DeckAvailabilityProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showMissingCards, setShowMissingCards] = useState(false)

  // Fetch availability data
  const { data, isLoading, error } = useQuery<AvailabilityData>({
    queryKey: ['deck-availability', deckId],
    queryFn: async () => {
      const response = await fetch(`/api/decks/${deckId}/availability`)
      if (!response.ok) throw new Error('Failed to fetch availability')
      return response.json()
    },
    staleTime: 30 * 1000, // 30 seconds
  })

  // Add missing cards to wantlist mutation
  const addToWantlistMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/decks/${deckId}/add-missing-to-wantlist`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to add cards to wantlist')
      return response.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['wantlist'] })
      queryClient.invalidateQueries({ queryKey: ['collection'] })
      toast({
        title: 'Cartes ajoutées',
        description: result.message,
      })
    },
    onError: () => {
      toast({
        title: 'Erreur',
        description: "Impossible d'ajouter les cartes à la wantlist.",
        variant: 'destructive',
      })
    },
  })

  if (isLoading) {
    return (
      <div className="card-frame p-4 animate-pulse">
        <div className="h-6 bg-dungeon-700 rounded w-48 mb-2" />
        <div className="h-4 bg-dungeon-700 rounded w-32" />
      </div>
    )
  }

  if (error || !data) {
    return null // Silently fail - availability is optional feature
  }

  const { summary, cards } = data
  const missingCards = cards.filter((c) => c.missing > 0)

  // Determine status color and icon
  let statusColor = 'text-emerald-400'
  let bgColor = 'bg-emerald-900/20 border-emerald-600/30'
  let StatusIcon = Check

  if (summary.coveragePercent < 100 && summary.coveragePercent >= 50) {
    statusColor = 'text-amber-400'
    bgColor = 'bg-amber-900/20 border-amber-600/30'
    StatusIcon = AlertTriangle
  } else if (summary.coveragePercent < 50) {
    statusColor = 'text-dragon-400'
    bgColor = 'bg-dragon-900/20 border-dragon-600/30'
    StatusIcon = X
  }

  return (
    <div className={cn('card-frame p-4 border', bgColor)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Archive className={cn('w-5 h-5', statusColor)} />
          <h3 className="font-medieval text-lg text-parchment-200">Disponibilité Collection</h3>
        </div>

        {/* Coverage badge */}
        <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full', bgColor)}>
          <StatusIcon className={cn('w-4 h-4', statusColor)} />
          <span className={cn('text-sm font-bold', statusColor)}>
            {summary.coveragePercent}%
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-dungeon-800/50 rounded p-2 text-center">
          <p className="text-xs text-parchment-500">Cartes nécessaires</p>
          <p className="text-lg font-bold text-parchment-200">{summary.totalCards}</p>
        </div>
        <div className="bg-dungeon-800/50 rounded p-2 text-center">
          <p className="text-xs text-parchment-500">Possédées</p>
          <p className="text-lg font-bold text-emerald-400">{summary.ownedCards}</p>
        </div>
        <div className="bg-dungeon-800/50 rounded p-2 text-center">
          <p className="text-xs text-parchment-500">Manquantes</p>
          <p className={cn(
            'text-lg font-bold',
            summary.missingCards > 0 ? 'text-dragon-400' : 'text-parchment-400'
          )}>
            {summary.missingCards}
          </p>
        </div>
        <div className="bg-dungeon-800/50 rounded p-2 text-center">
          <p className="text-xs text-parchment-500">Cartes uniques</p>
          <p className="text-lg font-bold text-parchment-200">{summary.uniqueCards}</p>
        </div>
      </div>

      {/* Missing cards action */}
      {summary.missingCards > 0 && (
        <div className="space-y-3">
          {/* Add to wantlist button */}
          <Button
            onClick={() => addToWantlistMutation.mutate()}
            disabled={addToWantlistMutation.isPending}
            variant="outline"
            className="w-full border-pink-600/50 text-pink-400 hover:bg-pink-900/30"
          >
            {addToWantlistMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Heart className="w-4 h-4 mr-2" />
            )}
            Ajouter {summary.missingCards} carte{summary.missingCards > 1 ? 's' : ''} manquante{summary.missingCards > 1 ? 's' : ''} à la wantlist
          </Button>

          {/* Toggle missing cards list */}
          <button
            onClick={() => setShowMissingCards(!showMissingCards)}
            className="w-full flex items-center justify-center gap-2 text-sm text-parchment-400 hover:text-parchment-200 py-2"
          >
            {showMissingCards ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Masquer les cartes manquantes
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Voir les cartes manquantes ({missingCards.length})
              </>
            )}
          </button>

          {/* Missing cards list */}
          {showMissingCards && (
            <div className="max-h-48 overflow-y-auto rounded-lg bg-dungeon-800/50 p-2 space-y-1">
              {missingCards.map((card) => (
                <div
                  key={`${card.cardId}-${card.category}`}
                  className="flex items-center justify-between px-2 py-1.5 rounded bg-dungeon-700/50 text-sm"
                >
                  <span className="text-parchment-200 truncate flex-1">{card.cardName}</span>
                  <div className="flex items-center gap-3 text-xs ml-2">
                    <span className="text-parchment-500">
                      {card.owned}/{card.needed}
                    </span>
                    <span className="text-dragon-400 font-medium">
                      -{card.missing}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Complete deck message */}
      {summary.isComplete && (
        <div className="flex items-center gap-2 text-emerald-400 text-sm">
          <Check className="w-4 h-4" />
          <span>Vous possédez toutes les cartes de ce deck !</span>
        </div>
      )}
    </div>
  )
}
