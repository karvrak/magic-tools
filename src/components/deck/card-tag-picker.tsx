'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Tag as TagIcon, Plus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { CARD_TAG_COLORS, type CardTag } from './card-tags-types'

interface Props {
  deckId: string
  deckCardId: string
  assigned: CardTag[]
  available: CardTag[]
  className?: string
}

// Petit dropdown click-outside qui permet d'ajouter/retirer des tags sur une
// DeckCard et de créer un nouveau tag à la volée (global au user par défaut).
export function CardTagPicker({ deckId, deckCardId, assigned, available, className }: Props) {
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>(CARD_TAG_COLORS[0])
  // Sens d'ouverture du dropdown: par défaut sous le bouton, basculé au-dessus
  // si pas assez d'espace en bas de viewport (typique de la dernière ligne).
  const [openDirection, setOpenDirection] = useState<'down' | 'up'>('down')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Décide du sens d'ouverture en mesurant l'espace dispo sous le bouton.
  // Le dropdown fait max ~320px (max-h-80), on flip si l'espace en bas est
  // insuffisant ET qu'il y a plus de place au-dessus.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const dropdownMaxHeight = 320
    if (spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow) {
      setOpenDirection('up')
    } else {
      setOpenDirection('down')
    }
  }, [open])

  const syncMutation = useMutation({
    mutationFn: async (cardTagIds: string[]) => {
      const res = await fetch(`/api/decks/${deckId}/cards/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckCardId, cardTagIds }),
      })
      if (!res.ok) throw new Error('Failed to update tags')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deck', deckId] })
    },
    onError: () => {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour les tags.', variant: 'destructive' })
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/card-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, color: newColor, deckId: null }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'Failed to create tag')
      }
      return res.json() as Promise<{ tag: CardTag }>
    },
    onSuccess: async ({ tag }) => {
      // On invalide la liste et on assigne immédiatement le tag à la carte courante.
      await queryClient.invalidateQueries({ queryKey: ['card-tags', deckId] })
      const nextIds = [...assigned.map((t) => t.id), tag.id]
      syncMutation.mutate(nextIds)
      setNewName('')
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' })
    },
  })

  const assignedIds = new Set(assigned.map((t) => t.id))
  const toggle = (tagId: string) => {
    const next = assignedIds.has(tagId)
      ? assigned.filter((t) => t.id !== tagId).map((t) => t.id)
      : [...assigned.map((t) => t.id), tagId]
    syncMutation.mutate(next)
  }

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'p-1.5 rounded hover:bg-dungeon-600 transition-colors flex items-center gap-1',
          assigned.length > 0 ? 'text-arcane-400' : 'text-parchment-400 hover:text-parchment-200'
        )}
        title="Gérer les tags de cette carte"
      >
        <TagIcon className="w-4 h-4" />
        {assigned.length > 0 && (
          <span className="text-xs font-medium">{assigned.length}</span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 z-50 w-64 max-h-80 overflow-y-auto bg-dungeon-800 border border-dungeon-600 rounded shadow-xl p-2 space-y-1',
            openDirection === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'
          )}
        >
          {available.length === 0 && (
            <p className="text-xs text-parchment-500 italic px-2 py-1">
              Aucun tag. Créez-en un ci-dessous.
            </p>
          )}
          {available.map((tag) => {
            const isAssigned = assignedIds.has(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggle(tag.id)}
                disabled={syncMutation.isPending}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors',
                  isAssigned
                    ? 'bg-arcane-900/40 hover:bg-arcane-900/60'
                    : 'hover:bg-dungeon-700'
                )}
              >
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium border flex-1"
                  style={{ borderColor: tag.color, color: tag.color }}
                >
                  {tag.name}
                </span>
                {tag.scope === 'deck' && (
                  <span className="text-[10px] text-parchment-500">deck</span>
                )}
                {isAssigned && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
            )
          })}

          {/* Création rapide */}
          <div className="border-t border-dungeon-700 pt-2 mt-1 space-y-1.5">
            <div className="flex gap-1">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nouveau tag…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) createMutation.mutate()
                }}
                className="flex-1 px-2 py-1 text-xs rounded bg-dungeon-900 border border-dungeon-700 text-parchment-200 placeholder:text-parchment-500 focus:outline-none focus:border-arcane-500"
              />
              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim() || createMutation.isPending}
                className="p-1 rounded bg-arcane-700 hover:bg-arcane-600 text-parchment-100 disabled:opacity-50"
                title="Créer le tag"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-1 px-1">
              {CARD_TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={cn(
                    'w-3.5 h-3.5 rounded-full border-2',
                    newColor === c ? 'border-parchment-100' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Variante toujours-visible (pas de dropdown) pour les contextes où l'on
// dispose de plus de place verticale, notamment la card detail modal. Permet
// de toggle les tags par simple clic et de créer un tag global à la volée.
interface InlineProps {
  deckId: string
  deckCardId: string
  assigned: CardTag[]
  available: CardTag[]
  className?: string
}

export function CardTagInlinePicker({ deckId, deckCardId, assigned, available, className }: InlineProps) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>(CARD_TAG_COLORS[0])
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const syncMutation = useMutation({
    mutationFn: async (cardTagIds: string[]) => {
      const res = await fetch(`/api/decks/${deckId}/cards/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckCardId, cardTagIds }),
      })
      if (!res.ok) throw new Error('Failed to update tags')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deck', deckId] })
    },
    onError: () => {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour les tags.', variant: 'destructive' })
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/card-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, color: newColor, deckId: null }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'Failed to create tag')
      }
      return res.json() as Promise<{ tag: CardTag }>
    },
    onSuccess: async ({ tag }) => {
      await queryClient.invalidateQueries({ queryKey: ['card-tags', deckId] })
      const nextIds = [...assigned.map((t) => t.id), tag.id]
      syncMutation.mutate(nextIds)
      setNewName('')
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' })
    },
  })

  const assignedIds = new Set(assigned.map((t) => t.id))
  const toggle = (tagId: string) => {
    const next = assignedIds.has(tagId)
      ? assigned.filter((t) => t.id !== tagId).map((t) => t.id)
      : [...assigned.map((t) => t.id), tagId]
    syncMutation.mutate(next)
  }

  return (
    <div className={cn('space-y-2', className)}>
      {available.length === 0 ? (
        <p className="text-xs text-parchment-500 italic">
          Aucun tag disponible. Crée-en un ci-dessous.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {available.map((tag) => {
            const isAssigned = assignedIds.has(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggle(tag.id)}
                disabled={syncMutation.isPending}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border-2 transition-all',
                  isAssigned ? 'shadow-sm' : 'opacity-50 hover:opacity-90'
                )}
                style={{
                  borderColor: tag.color,
                  color: isAssigned ? '#fff' : tag.color,
                  backgroundColor: isAssigned ? tag.color : 'transparent',
                }}
                title={isAssigned ? `Retirer "${tag.name}"` : `Ajouter "${tag.name}"`}
              >
                {isAssigned && <Check className="w-2.5 h-2.5" />}
                {tag.name}
                {tag.scope === 'deck' && (
                  <span className="text-[9px] opacity-70">·deck</span>
                )}
              </button>
            )
          })}
        </div>
      )}
      <div className="flex items-center gap-1.5 pt-1 border-t border-dungeon-700/60">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nouveau tag (global)…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newName.trim()) createMutation.mutate()
          }}
          className="flex-1 px-2 py-1 text-xs rounded bg-dungeon-900 border border-dungeon-700 text-parchment-200 placeholder:text-parchment-500 focus:outline-none focus:border-arcane-500"
        />
        <div className="flex gap-0.5">
          {CARD_TAG_COLORS.slice(0, 6).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setNewColor(c)}
              className={cn(
                'w-3.5 h-3.5 rounded-full border-2',
                newColor === c ? 'border-parchment-100' : 'border-transparent'
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={!newName.trim() || createMutation.isPending}
          className="p-1 rounded bg-arcane-700 hover:bg-arcane-600 text-parchment-100 disabled:opacity-50"
          title="Créer le tag"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// Variante "carte hors deck" : agit sur l'oracleId via /api/card-tags/assignments.
// Permet d'assigner des tags globaux à une carte conceptuelle (oracle),
// utilisable depuis la modal de la recherche/collection. Pas d'accès aux tags
// deck-scoped (qui n'ont pas de sens sans deck contexte).
interface OracleProps {
  oracleId: string
  className?: string
}

export function OracleCardTagInlinePicker({ oracleId, className }: OracleProps) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>(CARD_TAG_COLORS[0])
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Liste des tags globaux de l'utilisateur (création + toggle).
  const { data: tagsData } = useQuery<{ tags: (CardTag & { usageCount?: number })[] }>({
    queryKey: ['card-tags', 'global'],
    queryFn: async () => {
      const res = await fetch('/api/card-tags')
      if (!res.ok) throw new Error('Failed to load card tags')
      return res.json()
    },
    staleTime: 60_000,
  })
  const available = (tagsData?.tags ?? []).filter((t) => t.scope === 'global')

  // Assignations actuelles pour cet oracleId.
  const { data: assignData } = useQuery<{ assignments: Record<string, CardTag[]> }>({
    queryKey: ['card-tag-assignments', oracleId],
    queryFn: async () => {
      const res = await fetch(`/api/card-tags/assignments?oracleIds=${oracleId}`)
      if (!res.ok) throw new Error('Failed to load assignments')
      return res.json()
    },
    enabled: !!oracleId,
  })
  const assigned: CardTag[] = assignData?.assignments?.[oracleId] ?? []

  const syncMutation = useMutation({
    mutationFn: async (cardTagIds: string[]) => {
      const res = await fetch('/api/card-tags/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oracleId, cardTagIds }),
      })
      if (!res.ok) throw new Error('Failed to update assignments')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-tag-assignments', oracleId] })
      // Invalide aussi les pages qui pourraient afficher ces tags (decks, search…).
      queryClient.invalidateQueries({ queryKey: ['deck'] })
      queryClient.invalidateQueries({ queryKey: ['search'] })
      queryClient.invalidateQueries({ queryKey: ['collection'] })
    },
    onError: () => {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour les tags.', variant: 'destructive' })
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/card-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, color: newColor, deckId: null }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'Failed to create tag')
      }
      return res.json() as Promise<{ tag: CardTag }>
    },
    onSuccess: async ({ tag }) => {
      await queryClient.invalidateQueries({ queryKey: ['card-tags', 'global'] })
      const nextIds = [...assigned.map((t) => t.id), tag.id]
      syncMutation.mutate(nextIds)
      setNewName('')
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' })
    },
  })

  const assignedIds = new Set(assigned.map((t) => t.id))
  const toggle = (tagId: string) => {
    const next = assignedIds.has(tagId)
      ? assigned.filter((t) => t.id !== tagId).map((t) => t.id)
      : [...assigned.map((t) => t.id), tagId]
    syncMutation.mutate(next)
  }

  return (
    <div className={cn('space-y-2', className)}>
      {available.length === 0 ? (
        <p className="text-xs text-parchment-500 italic">
          Aucun tag global. Crée-en un ci-dessous.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {available.map((tag) => {
            const isAssigned = assignedIds.has(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggle(tag.id)}
                disabled={syncMutation.isPending}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border-2 transition-all',
                  isAssigned ? 'shadow-sm' : 'opacity-50 hover:opacity-90'
                )}
                style={{
                  borderColor: tag.color,
                  color: isAssigned ? '#fff' : tag.color,
                  backgroundColor: isAssigned ? tag.color : 'transparent',
                }}
                title={isAssigned ? `Retirer "${tag.name}"` : `Ajouter "${tag.name}"`}
              >
                {isAssigned && <Check className="w-2.5 h-2.5" />}
                {tag.name}
              </button>
            )
          })}
        </div>
      )}
      <div className="flex items-center gap-1.5 pt-1 border-t border-dungeon-700/60">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nouveau tag (global)…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newName.trim()) createMutation.mutate()
          }}
          className="flex-1 px-2 py-1 text-xs rounded bg-dungeon-900 border border-dungeon-700 text-parchment-200 placeholder:text-parchment-500 focus:outline-none focus:border-arcane-500"
        />
        <div className="flex gap-0.5">
          {CARD_TAG_COLORS.slice(0, 6).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setNewColor(c)}
              className={cn(
                'w-3.5 h-3.5 rounded-full border-2',
                newColor === c ? 'border-parchment-100' : 'border-transparent'
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={!newName.trim() || createMutation.isPending}
          className="p-1 rounded bg-arcane-700 hover:bg-arcane-600 text-parchment-100 disabled:opacity-50"
          title="Créer le tag"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// Badge tag inline simple, utilisé sous le nom de carte.
export function CardTagBadge({ tag, onRemove }: { tag: CardTag; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[10px] font-medium border leading-tight"
      style={{ borderColor: tag.color, color: tag.color }}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 opacity-60 hover:opacity-100"
          aria-label="Retirer le tag"
        >
          ×
        </button>
      )}
    </span>
  )
}
