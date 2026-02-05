'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lightbulb,
  Plus,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { formatPrice, cn, getRarityColor } from '@/lib/utils'

interface SuggestionCard {
  id: string
  oracleId: string
  name: string
  typeLine: string
  manaCost: string | null
  colorIdentity: string[]
  keywords: string[]
  rarity: string
  setCode: string
  setName: string
  imageSmall: string | null
  imageNormal: string | null
  priceEur: number | null
  priceUsd: number | null
  score: number
  reasons: string[]
}

interface SuggestionsResponse {
  suggestions: SuggestionCard[]
  analysis: {
    archetype?: string
    synergies?: string[]
    deckColors?: string[]
    topCreatureTypes?: string[]
    topKeywords?: string[]
  }
}

interface DeckSuggestionsProps {
  deckId: string
}

export function DeckSuggestions({ deckId }: DeckSuggestionsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<SuggestionCard | null>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data, isLoading, error } = useQuery<SuggestionsResponse>({
    queryKey: ['deck-suggestions', deckId],
    queryFn: async () => {
      const response = await fetch(`/api/decks/${deckId}/suggestions?limit=20`)
      if (!response.ok) throw new Error('Failed to fetch suggestions')
      return response.json()
    },
    enabled: isExpanded, // Only fetch when expanded
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  const addCardMutation = useMutation({
    mutationFn: async ({ cardId, category }: { cardId: string; category: string }) => {
      const response = await fetch(`/api/decks/${deckId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, quantity: 1, category }),
      })
      if (!response.ok) throw new Error('Failed to add card')
      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deck', deckId] })
      queryClient.invalidateQueries({ queryKey: ['deck-suggestions', deckId] })
      toast({
        title: 'Card added',
        description: 'Card has been added to the deck.',
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to add card.',
        variant: 'destructive',
      })
    },
  })

  const handleAddCard = (card: SuggestionCard) => {
    // Determine category based on card type
    const typeLine = card.typeLine.toLowerCase()
    let category = 'mainboard'
    if (typeLine.includes('creature')) category = 'creature'
    else if (typeLine.includes('instant')) category = 'instant'
    else if (typeLine.includes('sorcery')) category = 'sorcery'
    else if (typeLine.includes('artifact')) category = 'artifact'
    else if (typeLine.includes('enchantment')) category = 'enchantment'
    else if (typeLine.includes('planeswalker')) category = 'planeswalker'

    addCardMutation.mutate({ cardId: card.id, category })
  }

  return (
    <div className="card-frame overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-dungeon-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-gold-400" />
          <h3 className="font-medieval text-gold-400">Card suggestions</h3>
          <span className="text-xs text-parchment-500">(based on synergies)</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-parchment-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-parchment-400" />
        )}
      </button>

      {/* Content - Expandable */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-dungeon-700">
              {/* Analysis summary */}
              {data?.analysis && (
                <div className="py-3 flex flex-wrap gap-2 text-xs border-b border-dungeon-700 mb-3">
                  {data.analysis.archetype && (
                    <div className="flex items-center gap-1">
                      <span className="text-parchment-500">Archetype:</span>
                      <span className="px-2 py-0.5 bg-arcane-600/30 text-arcane-300 rounded font-medium">
                        {data.analysis.archetype}
                      </span>
                    </div>
                  )}
                  {data.analysis.synergies && data.analysis.synergies.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-parchment-500">Synergies:</span>
                      {data.analysis.synergies.slice(0, 4).map((syn) => (
                        <span key={syn} className="px-1.5 py-0.5 bg-gold-600/20 text-gold-400 rounded">
                          {syn}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Loading state */}
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gold-400" />
                  <span className="ml-2 text-parchment-400">Analyzing synergies...</span>
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className="text-center py-8 text-dragon-400">
                  Error loading suggestions
                </div>
              )}

              {/* Empty state */}
              {data?.suggestions.length === 0 && !isLoading && (
                <div className="text-center py-8 text-parchment-500">
                  Not enough cards to generate suggestions.
                  <br />
                  Add more cards to the deck.
                </div>
              )}

              {/* Suggestions grid */}
              {data?.suggestions && data.suggestions.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {data.suggestions.map((card) => (
                    <div
                      key={card.id}
                      className="relative group"
                      onMouseEnter={() => setHoveredCard(card)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      {/* Card image */}
                      <div className="relative aspect-[5/7] rounded-lg overflow-hidden border-2 border-dungeon-600 hover:border-gold-500/50 transition-colors">
                        {card.imageSmall ? (
                          <Image
                            src={card.imageSmall}
                            alt={card.name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-dungeon-700 flex items-center justify-center">
                            <span className="text-xs text-parchment-500 text-center px-2">
                              {card.name}
                            </span>
                          </div>
                        )}

                        {/* Overlay with info */}
                        <div className="absolute inset-0 bg-gradient-to-t from-dungeon-900 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <p className="text-xs text-parchment-200 font-medium truncate">
                              {card.name}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className={cn('text-[10px]', getRarityColor(card.rarity))}>
                                {card.setCode.toUpperCase()}
                              </span>
                              <span className="text-[10px] text-gold-400">
                                {card.priceEur
                                  ? formatPrice(card.priceEur, 'EUR')
                                  : card.priceUsd
                                    ? formatPrice(card.priceUsd, 'USD')
                                    : '-'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Add button */}
                        <button
                          onClick={() => handleAddCard(card)}
                          disabled={addCardMutation.isPending}
                          className="absolute top-1 right-1 p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                          title="Add to deck"
                        >
                          <Plus className="w-3 h-3" />
                        </button>

                        {/* Score badge */}
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-dungeon-900/80 text-[10px] text-gold-400 font-medium">
                          {card.score}pts
                        </div>
                      </div>

                      {/* Reasons tooltip on hover */}
                      {hoveredCard?.id === card.id && card.reasons.length > 0 && (
                        <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-dungeon-800 border border-dungeon-600 rounded shadow-lg whitespace-nowrap">
                          <div className="text-[10px] text-parchment-300">
                            {card.reasons.slice(0, 3).map((reason, i) => (
                              <div key={i}>{reason}</div>
                            ))}
                          </div>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-dungeon-600" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
