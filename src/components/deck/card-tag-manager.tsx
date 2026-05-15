'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Check, X, Globe, Folder } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { CARD_TAG_COLORS, type CardTagWithUsage } from './card-tags-types'

interface Props {
  deckId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Scope = 'all' | 'global' | 'deck'

export function CardTagManager({ deckId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [scope, setScope] = useState<Scope>('all')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>(CARD_TAG_COLORS[0])
  const [newIsDeckScoped, setNewIsDeckScoped] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  const { data, isLoading } = useQuery<{ tags: CardTagWithUsage[] }>({
    queryKey: ['card-tags', deckId],
    queryFn: async () => {
      const res = await fetch(`/api/card-tags?deckId=${deckId}`)
      if (!res.ok) throw new Error('Failed to fetch card tags')
      return res.json()
    },
    enabled: open,
  })

  const tags = data?.tags ?? []
  const filtered = tags.filter((t) =>
    scope === 'all' ? true : scope === 'global' ? t.scope === 'global' : t.scope === 'deck'
  )

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/card-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          color: newColor,
          deckId: newIsDeckScoped ? deckId : null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'Failed to create tag')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-tags', deckId] })
      queryClient.invalidateQueries({ queryKey: ['deck', deckId] })
      setNewName('')
      toast({ title: 'Tag créé' })
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const res = await fetch(`/api/card-tags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'Failed to update tag')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-tags', deckId] })
      queryClient.invalidateQueries({ queryKey: ['deck', deckId] })
      setEditingId(null)
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/card-tags/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete tag')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-tags', deckId] })
      queryClient.invalidateQueries({ queryKey: ['deck', deckId] })
      toast({ title: 'Tag supprimé' })
    },
    onError: () => {
      toast({ title: 'Erreur', description: 'Suppression impossible.', variant: 'destructive' })
    },
  })

  const startEdit = (tag: CardTagWithUsage) => {
    setEditingId(tag.id)
    setEditName(tag.name)
    setEditColor(tag.color)
  }

  const saveEdit = () => {
    if (!editingId) return
    updateMutation.mutate({ id: editingId, name: editName.trim(), color: editColor })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gérer les tags de cartes</DialogTitle>
        </DialogHeader>

        {/* Onglets de portée */}
        <div className="flex gap-2 border-b border-dungeon-700 pb-2">
          {(['all', 'global', 'deck'] as Scope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-t transition-colors flex items-center gap-1.5',
                scope === s
                  ? 'bg-dungeon-700 text-gold-400'
                  : 'text-parchment-400 hover:text-parchment-200'
              )}
            >
              {s === 'global' && <Globe className="w-3.5 h-3.5" />}
              {s === 'deck' && <Folder className="w-3.5 h-3.5" />}
              {s === 'all' && 'Tous'}
              {s === 'global' && 'Globaux'}
              {s === 'deck' && 'Ce deck'}
              <span className="text-xs text-parchment-500">
                ({s === 'all' ? tags.length : tags.filter((t) => t.scope === s).length})
              </span>
            </button>
          ))}
        </div>

        {/* Création */}
        <div className="border border-dungeon-700 rounded p-3 space-y-2">
          <p className="text-xs text-parchment-400">Nouveau tag</p>
          <div className="flex gap-2">
            <Input
              placeholder="Nom du tag (Pioche, Removal, Ramp...)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) createMutation.mutate()
              }}
              className="flex-1"
            />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newName.trim() || createMutation.isPending}
            >
              <Plus className="w-4 h-4 mr-1" />
              Créer
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-1.5 items-center">
              {CARD_TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={cn(
                    'w-5 h-5 rounded-full border-2 transition-all',
                    newColor === c ? 'border-parchment-100 scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-parchment-300 cursor-pointer">
              <input
                type="checkbox"
                checked={newIsDeckScoped}
                onChange={(e) => setNewIsDeckScoped(e.target.checked)}
                className="accent-arcane-500"
              />
              Spécifique à ce deck (sinon réutilisable partout)
            </label>
          </div>
        </div>

        {/* Liste */}
        <div className="space-y-1.5">
          {isLoading && <p className="text-sm text-parchment-400">Chargement…</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="text-sm text-parchment-500 italic text-center py-4">
              Aucun tag {scope === 'global' ? 'global' : scope === 'deck' ? 'spécifique à ce deck' : ''} pour l&apos;instant.
            </p>
          )}
          {filtered.map((tag) => {
            const isEditing = editingId === tag.id
            return (
              <div
                key={tag.id}
                className="flex items-center gap-2 p-2 rounded bg-dungeon-800/50 hover:bg-dungeon-700/30"
              >
                {isEditing ? (
                  <>
                    <div className="flex gap-1 items-center">
                      {CARD_TAG_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditColor(c)}
                          className={cn(
                            'w-4 h-4 rounded-full border-2',
                            editColor === c ? 'border-parchment-100' : 'border-transparent'
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit()
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="flex-1 h-7 text-sm"
                      autoFocus
                    />
                    <button
                      onClick={saveEdit}
                      className="p-1 rounded hover:bg-emerald-900/40 text-emerald-400"
                      title="Enregistrer"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 rounded hover:bg-dungeon-600 text-parchment-400"
                      title="Annuler"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium border"
                      style={{ borderColor: tag.color, color: tag.color }}
                    >
                      {tag.name}
                    </span>
                    {tag.scope === 'deck' ? (
                      <Folder className="w-3 h-3 text-parchment-500" />
                    ) : (
                      <Globe className="w-3 h-3 text-parchment-500" />
                    )}
                    <span className="text-xs text-parchment-500 ml-1">
                      {tag.scope === 'deck' ? 'spécifique à ce deck' : 'global'}
                    </span>
                    {typeof tag.usageCount === 'number' && tag.usageCount > 0 && (
                      <span className="text-xs text-parchment-500 ml-1">
                        · utilisé sur {tag.usageCount} carte{tag.usageCount > 1 ? 's' : ''}
                      </span>
                    )}
                    <div className="flex-1" />
                    <button
                      onClick={() => startEdit(tag)}
                      className="p-1 rounded hover:bg-dungeon-600 text-parchment-400 hover:text-parchment-200"
                      title="Éditer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Supprimer le tag "${tag.name}" ? Il sera retiré de toutes les cartes.`)) {
                          deleteMutation.mutate(tag.id)
                        }
                      }}
                      className="p-1 rounded hover:bg-dragon-600/40 text-parchment-400 hover:text-dragon-400"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
