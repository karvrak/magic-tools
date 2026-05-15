'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn, formatPrice } from '@/lib/utils'

interface SuggestionItem {
  cardId: string
  oracleId: string
  name: string
  manaCost: string | null
  typeLine: string
  imageNormal: string | null
  priceEur: number | null
  score: number
  similarity: number
  explanation: string
}

interface DeckEvaluationItem {
  cardId: string
  oracleId: string
  name: string
  manaCost: string | null
  typeLine: string
  imageNormal: string | null
  priceEur: number | null
  category: string
  quantity: number
  score: number
  explanation: string
}

interface CompleteResult {
  deckId: string
  format: 'vintage' | 'commander'
  detectedArchetype: string | null
  archetypeConfidence: number
  archetypeNote: string | null
  computedAt?: string
  cached?: boolean
  groups: Array<{
    role: string
    severity: 'critical' | 'low' | 'optimal' | 'overflow'
    needed: number
    current: number
    target: { min: number; ideal: number; max: number }
    suggestions: SuggestionItem[]
  }>
  miscSuggestions: SuggestionItem[]
  deckEvaluation: DeckEvaluationItem[]
}

interface DeckAIProps {
  deckId: string
}

const ROLE_LABEL: Record<string, string> = {
  ramp: 'Ramp',
  draw: 'Card draw',
  tutor: 'Tutors',
  removal: 'Removal',
  counter: 'Counterspells',
  finisher: 'Finishers',
  utility: 'Utility',
  protection: 'Protection',
  recursion: 'Recursion',
  wipe: 'Board wipes',
}

export function DeckAIComplete({ deckId }: DeckAIProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [shouldFetch, setShouldFetch] = useState(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data, isLoading, error } = useQuery<CompleteResult>({
    queryKey: ['deck-ai-complete', deckId],
    queryFn: async () => {
      const r = await fetch(
        `/api/decks/${deckId}/complete?max_candidates=100&per_role_limit=20`
      )
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.message ?? 'Erreur lors de l’appel IA')
      }
      return r.json()
    },
    enabled: shouldFetch,
    staleTime: Infinity, // cache server-side persistant — on ne reflood pas
    refetchOnWindowFocus: false,
  })

  const rerunMutation = useMutation<CompleteResult>({
    mutationFn: async () => {
      const r = await fetch(
        `/api/decks/${deckId}/complete?max_candidates=100&per_role_limit=20&force=true`
      )
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.message ?? 'Erreur lors du recalcul IA')
      }
      return r.json()
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData<CompleteResult>(['deck-ai-complete', deckId], fresh)
      toast({ title: 'Analyse IA mise à jour' })
    },
    onError: (err) => {
      toast({
        title: 'Erreur',
        description: (err as Error).message,
        variant: 'destructive',
      })
    },
  })

  const addCardMutation = useMutation({
    mutationFn: async ({ cardId, category }: { cardId: string; category: string }) => {
      const r = await fetch(`/api/decks/${deckId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, quantity: 1, category }),
      })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deck', deckId] })
      toast({ title: 'Carte ajoutée' })
    },
    onError: () => {
      toast({ title: 'Erreur', description: 'Impossible d’ajouter', variant: 'destructive' })
    },
  })

  const categoryFor = (typeLine: string) => {
    const t = typeLine.toLowerCase()
    if (t.includes('creature')) return 'creature'
    if (t.includes('instant')) return 'instant'
    if (t.includes('sorcery')) return 'sorcery'
    if (t.includes('artifact')) return 'artifact'
    if (t.includes('enchantment')) return 'enchantment'
    if (t.includes('planeswalker')) return 'planeswalker'
    if (t.includes('land')) return 'land'
    return 'mainboard'
  }

  const allCount =
    (data?.miscSuggestions.length ?? 0) +
    (data?.groups.reduce((acc, g) => acc + g.suggestions.length, 0) ?? 0)

  const formatComputedAt = (iso?: string) => {
    if (!iso) return null
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  const computedLabel = formatComputedAt(data?.computedAt)

  return (
    <div className="card-frame overflow-hidden">
      <button
        onClick={() => {
          if (!isExpanded) {
            setIsExpanded(true)
            setShouldFetch(true)
          } else {
            setIsExpanded(false)
          }
        }}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-dungeon-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-arcane-300" />
          <h3 className="font-medieval text-arcane-300">AI deck completion</h3>
          <span className="text-xs text-parchment-500">
            (Sonnet 4.6 · jusqu’à 100 cartes)
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isExpanded && data && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                rerunMutation.mutate()
              }}
              disabled={rerunMutation.isPending}
              className="flex items-center gap-1.5 text-xs text-arcane-300 hover:text-arcane-200 disabled:opacity-50 px-2 py-1 rounded border border-arcane-400/30 hover:border-arcane-400/60 transition-colors"
              title="Recalculer l’analyse IA (coûteux, ~50s)"
            >
              <RefreshCw
                className={cn(
                  'w-3.5 h-3.5',
                  rerunMutation.isPending && 'animate-spin'
                )}
              />
              {rerunMutation.isPending ? 'Recalcul…' : 'Re-run'}
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-parchment-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-parchment-400" />
          )}
        </div>
      </button>

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
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-arcane-300" />
                  <span className="ml-2 text-parchment-400">
                    Analyse du deck en cours (~50s)…
                  </span>
                </div>
              )}

              {error && (
                <div className="text-center py-6 text-dragon-400 text-sm">
                  {(error as Error).message}
                </div>
              )}

              {data && (
                <div className="pt-3 space-y-4">
                  {/* Header: archetype + cache info */}
                  <div className="flex items-start justify-between gap-3 flex-wrap text-xs">
                    <div className="text-parchment-300">
                      {data.detectedArchetype && (
                        <span className="inline-flex items-center gap-1 mr-3">
                          <span className="text-parchment-500">Archetype:</span>
                          <span className="px-2 py-0.5 bg-arcane-600/30 text-arcane-300 rounded font-medium">
                            {data.detectedArchetype} (
                            {Math.round(data.archetypeConfidence * 100)}%)
                          </span>
                        </span>
                      )}
                      {data.archetypeNote && (
                        <div className="mt-2 italic text-parchment-400">
                          {data.archetypeNote}
                        </div>
                      )}
                    </div>
                    {computedLabel && (
                      <span
                        className="text-[11px] text-parchment-500 whitespace-nowrap"
                        title="Date du dernier calcul. Clique Re-run pour relancer l'analyse."
                      >
                        Analysé le {computedLabel}
                      </span>
                    )}
                  </div>

                  {allCount === 0 && (
                    <div className="text-center py-6 text-parchment-500 text-sm">
                      Aucune suggestion. Le deck est trop petit ou hors-format.
                    </div>
                  )}

                  {/* Best / worst cards du deck (note IA par carte) */}
                  {data.deckEvaluation && data.deckEvaluation.length > 0 && (
                    <DeckEvaluationSection items={data.deckEvaluation} />
                  )}

                  {/* Role groups */}
                  {data.groups.map((g) => (
                    <SuggestionGroup
                      key={g.role}
                      title={`${ROLE_LABEL[g.role] ?? g.role} · ${g.severity}`}
                      subtitle={`current=${g.current}, ideal=${g.target.ideal}, needed +${g.needed}`}
                      suggestions={g.suggestions}
                      onAdd={(c) =>
                        addCardMutation.mutate({
                          cardId: c.cardId,
                          category: categoryFor(c.typeLine),
                        })
                      }
                      isPending={addCardMutation.isPending}
                    />
                  ))}

                  {/* Misc */}
                  {data.miscSuggestions.length > 0 && (
                    <SuggestionGroup
                      title={`Cartes synergiques · ${data.miscSuggestions.length}`}
                      subtitle="Triées par score IA décroissant. La liste est volontairement large pour te permettre de choisir."
                      suggestions={data.miscSuggestions}
                      onAdd={(c) =>
                        addCardMutation.mutate({
                          cardId: c.cardId,
                          category: categoryFor(c.typeLine),
                        })
                      }
                      isPending={addCardMutation.isPending}
                    />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

type EvaluationFilter = 'best' | 'worst' | 'all'

function DeckEvaluationSection({ items }: { items: DeckEvaluationItem[] }) {
  const [filter, setFilter] = useState<EvaluationFilter>('best')
  const sorted = [...items].sort((a, b) => b.score - a.score)
  const visible =
    filter === 'best'
      ? sorted.slice(0, 10)
      : filter === 'worst'
        ? [...sorted].reverse().slice(0, 10)
        : sorted

  const avg =
    items.length > 0
      ? items.reduce((acc, c) => acc + c.score, 0) / items.length
      : 0
  const top3 = sorted.slice(0, 3).map((c) => c.name).join(', ')
  const bottom3 = [...sorted]
    .reverse()
    .slice(0, 3)
    .map((c) => c.name)
    .join(', ')

  return (
    <section className="rounded-lg border border-arcane-500/20 bg-arcane-900/10 p-3">
      <header className="mb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-sm font-medium text-arcane-300">
            Cartes du deck notées par l’IA · {items.length}
          </h4>
          <div className="flex items-center gap-1 text-[11px]">
            <FilterPill
              label={`Top (${Math.min(10, items.length)})`}
              active={filter === 'best'}
              onClick={() => setFilter('best')}
            />
            <FilterPill
              label={`Flop (${Math.min(10, items.length)})`}
              active={filter === 'worst'}
              onClick={() => setFilter('worst')}
            />
            <FilterPill
              label="Tout"
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
          </div>
        </div>
        <p className="mt-1 text-[11px] text-parchment-500">
          Score moyen {Math.round(avg * 100)} · Piliers : {top3 || '–'} · Maillons
          faibles : {bottom3 || '–'}
        </p>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {visible.map((c) => (
          <DeckEvaluationCard key={c.cardId} card={c} />
        ))}
      </div>
    </section>
  )
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2 py-0.5 rounded transition-colors',
        active
          ? 'bg-arcane-500/30 text-arcane-200 border border-arcane-400/50'
          : 'bg-dungeon-700/40 text-parchment-400 border border-dungeon-600 hover:bg-dungeon-700/70'
      )}
    >
      {label}
    </button>
  )
}

function DeckEvaluationCard({ card }: { card: DeckEvaluationItem }) {
  const scorePct = Math.round(card.score * 100)
  const scoreColor =
    card.score >= 0.7
      ? 'text-emerald-400 bg-emerald-900/60'
      : card.score >= 0.5
        ? 'text-gold-400 bg-dungeon-900/85'
        : card.score >= 0.3
          ? 'text-amber-400 bg-dungeon-900/85'
          : 'text-dragon-400 bg-dragon-900/60'
  return (
    <div className="relative">
      <div className="relative aspect-[5/7] rounded-lg overflow-hidden border-2 border-dungeon-600">
        {card.imageNormal ? (
          <Image
            src={card.imageNormal}
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

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-1">
          <span
            className={cn(
              'px-1.5 py-0.5 rounded text-[10px] font-medium',
              scoreColor
            )}
          >
            {scorePct}
          </span>
          {card.quantity > 1 && (
            <span className="px-1.5 py-0.5 rounded bg-dungeon-900/85 text-[10px] text-parchment-200 font-medium">
              ×{card.quantity}
            </span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-dungeon-900 via-dungeon-900/80 to-transparent p-2">
          <p className="text-[11px] text-parchment-100 font-medium truncate">
            {card.name}
          </p>
          <div className="flex items-center justify-between text-[10px] text-parchment-400">
            <span className="truncate">{card.manaCost ?? ''}</span>
            <span className="text-gold-400">
              {card.priceEur ? formatPrice(card.priceEur, 'EUR') : '–'}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-parchment-400 line-clamp-3">
        {card.explanation}
      </p>
    </div>
  )
}

function SuggestionGroup({
  title,
  subtitle,
  suggestions,
  onAdd,
  isPending,
}: {
  title: string
  subtitle?: string
  suggestions: SuggestionItem[]
  onAdd: (s: SuggestionItem) => void
  isPending: boolean
}) {
  if (suggestions.length === 0) return null
  return (
    <section>
      <header className="mb-2">
        <h4 className="text-sm font-medium text-gold-300">{title}</h4>
        {subtitle && (
          <p className="text-[11px] text-parchment-500">{subtitle}</p>
        )}
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {suggestions.map((c) => (
          <SuggestionCard
            key={c.cardId}
            card={c}
            onAdd={() => onAdd(c)}
            isPending={isPending}
          />
        ))}
      </div>
    </section>
  )
}

function SuggestionCard({
  card,
  onAdd,
  isPending,
}: {
  card: SuggestionItem
  onAdd: () => void
  isPending: boolean
}) {
  const scorePct = Math.round(card.score * 100)
  const scoreColor =
    card.score >= 0.7
      ? 'text-emerald-400'
      : card.score >= 0.4
        ? 'text-gold-400'
        : 'text-parchment-500'
  return (
    <div className="relative group">
      <div className="relative aspect-[5/7] rounded-lg overflow-hidden border-2 border-dungeon-600 hover:border-arcane-400/60 transition-colors">
        {card.imageNormal ? (
          <Image
            src={card.imageNormal}
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

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-1">
          <span
            className={cn(
              'px-1.5 py-0.5 rounded bg-dungeon-900/85 text-[10px] font-medium',
              scoreColor
            )}
          >
            {scorePct}
          </span>
          <button
            onClick={onAdd}
            disabled={isPending}
            className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
            title="Ajouter au deck"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-dungeon-900 via-dungeon-900/80 to-transparent p-2">
          <p className="text-[11px] text-parchment-100 font-medium truncate">
            {card.name}
          </p>
          <div className="flex items-center justify-between text-[10px] text-parchment-400">
            <span className="truncate">{card.manaCost ?? ''}</span>
            <span className="text-gold-400">
              {card.priceEur ? formatPrice(card.priceEur, 'EUR') : '–'}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-parchment-400 line-clamp-3">
        {card.explanation}
      </p>
    </div>
  )
}
