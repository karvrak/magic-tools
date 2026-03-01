'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserCircle, Plus, Pencil, Trash2, Star, Layers, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthUser } from '@/contexts/auth-user'

interface Owner {
  id: string
  name: string
  color: string
  isDefault: boolean
  deckCount: number
}

const PRESET_COLORS = [
  '#D4AF37', '#3B82F6', '#EF4444', '#10B981', '#8B5CF6',
  '#F59E0B', '#EC4899', '#06B6D4', '#F97316', '#6366F1',
]

export default function ProfilesPage() {
  const queryClient = useQueryClient()
  const { refreshUser } = useAuthUser()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#D4AF37')
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['owners'],
    queryFn: async () => {
      const res = await fetch('/api/owners')
      if (!res.ok) throw new Error('Failed to fetch profiles')
      return res.json() as Promise<{ owners: Owner[] }>
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const res = await fetch('/api/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create profile')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owners'] })
      refreshUser()
      setShowCreateForm(false)
      setNewName('')
      setNewColor('#D4AF37')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; color?: string; isDefault?: boolean } }) => {
      const res = await fetch(`/api/owners/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update profile')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owners'] })
      refreshUser()
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/owners/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete profile')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owners'] })
      refreshUser()
      setDeleteConfirmId(null)
    },
  })

  const owners = data?.owners || []

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    createMutation.mutate({ name: newName.trim(), color: newColor })
  }

  const handleUpdate = (id: string) => {
    if (!editName.trim()) return
    updateMutation.mutate({ id, data: { name: editName.trim(), color: editColor } })
  }

  const startEdit = (owner: Owner) => {
    setEditingId(owner.id)
    setEditName(owner.name)
    setEditColor(owner.color)
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl text-gold-400 flex items-center gap-3">
            <UserCircle className="w-7 h-7" />
            Profiles
          </h1>
          <p className="text-parchment-400 text-sm mt-1">
            Manage your player profiles
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          New Profile
        </Button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <form
              onSubmit={handleCreate}
              className="p-4 rounded-lg border border-dungeon-600 bg-dungeon-800/50 space-y-4"
            >
              <div className="space-y-2">
                <Label className="text-parchment-300 font-medieval">Profile Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter a name..."
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="text-parchment-300 font-medieval">Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewColor(color)}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-all',
                        newColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-8 h-8 rounded-full cursor-pointer"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || !newName.trim()}>
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
              {createMutation.error && (
                <p className="text-sm text-dragon-400">{createMutation.error.message}</p>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profiles List */}
      {isLoading ? (
        <div className="text-center text-parchment-400 py-12">Loading profiles...</div>
      ) : owners.length === 0 ? (
        <div className="text-center text-parchment-400 py-12">
          <UserCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No profiles yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {owners.map((owner) => (
            <motion.div
              key={owner.id}
              layout
              className="p-4 rounded-lg border border-dungeon-600 bg-dungeon-800/50 flex items-center gap-4"
            >
              {editingId === owner.id ? (
                /* Edit mode */
                <div className="flex-1 space-y-3">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditColor(color)}
                        className={cn(
                          'w-6 h-6 rounded-full border-2 transition-all',
                          editColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-6 h-6 rounded-full cursor-pointer"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleUpdate(owner.id)}
                      disabled={updateMutation.isPending}
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <div
                    className="w-10 h-10 rounded-full flex-shrink-0"
                    style={{ backgroundColor: owner.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medieval text-lg" style={{ color: owner.color }}>
                        {owner.name}
                      </span>
                      {owner.isDefault && (
                        <Star className="w-4 h-4 text-gold-400 fill-gold-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-parchment-500">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {owner.deckCount} decks
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!owner.isDefault && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gold-500 hover:text-gold-400"
                        title="Set as default"
                        onClick={() => updateMutation.mutate({ id: owner.id, data: { isDefault: true } })}
                      >
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-parchment-400 hover:text-parchment-200"
                      onClick={() => startEdit(owner)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {deleteConfirmId === owner.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-dragon-400 hover:text-dragon-300"
                          onClick={() => deleteMutation.mutate(owner.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-dragon-400 hover:text-dragon-300"
                        onClick={() => setDeleteConfirmId(owner.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
