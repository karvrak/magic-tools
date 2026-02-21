'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Plus,
  BookOpen,
  Filter,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { EmptyState } from '@/components/ui/empty-state'
import { DiceLoader } from '@/components/ui/dice-loader'
import { FadeIn } from '@/components/layout/page-transition'
import { useActiveOwner } from '@/contexts/active-owner'
import { DeckFilters } from '@/components/deck/deck-filters'
import { DeckGridView } from '@/components/deck/deck-grid-view'
import { DeckListView } from '@/components/deck/deck-list-view'
import { CreateDeckModal } from '@/components/deck/create-deck-modal'
import { AddOwnerModal } from '@/components/deck/add-owner-modal'
import type { Owner, Tag, Deck, DeckStatus, ViewMode, SortField, SortDirection } from '@/components/deck/types'

// Cookie helpers
const VIEW_MODE_COOKIE = 'deck_view_mode'
const SORT_FIELD_COOKIE = 'deck_sort_field'
const SORT_DIR_COOKIE = 'deck_sort_dir'

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

function setCookie(name: string, value: string, days: number = 30) {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`
}

export default function DecksPage() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showOwnerModal, setShowOwnerModal] = useState(false)
  const [filterColors, setFilterColors] = useState<string[]>([])
  const { activeOwner } = useActiveOwner()
  const [filterColorMode, setFilterColorMode] = useState<'any' | 'all' | 'exact'>('any')
  const [filterCardName, setFilterCardName] = useState('')
  const [filterStatus, setFilterStatus] = useState<DeckStatus | 'all'>('all')
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortField, setSortField] = useState<SortField>('updatedAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Load preferences from cookies on mount
  useEffect(() => {
    const savedViewMode = getCookie(VIEW_MODE_COOKIE) as ViewMode | null
    if (savedViewMode && (savedViewMode === 'grid' || savedViewMode === 'list')) {
      setViewMode(savedViewMode)
    }
    const savedSortField = getCookie(SORT_FIELD_COOKIE) as SortField | null
    if (savedSortField && ['name', 'price', 'status', 'updatedAt', 'cardCount', 'avgCmc', 'tags'].includes(savedSortField)) {
      setSortField(savedSortField)
    }
    const savedSortDir = getCookie(SORT_DIR_COOKIE) as SortDirection | null
    if (savedSortDir && (savedSortDir === 'asc' || savedSortDir === 'desc')) {
      setSortDirection(savedSortDir)
    }
  }, [])

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    setCookie(VIEW_MODE_COOKIE, mode)
  }

  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      const newDir = sortDirection === 'asc' ? 'desc' : 'asc'
      setSortDirection(newDir)
      setCookie(SORT_DIR_COOKIE, newDir)
    } else {
      setSortField(field)
      setSortDirection('asc')
      setCookie(SORT_FIELD_COOKIE, field)
      setCookie(SORT_DIR_COOKIE, 'asc')
    }
  }

  // Fetch owners
  const { data: ownersData } = useQuery<{ owners: Owner[] }>({
    queryKey: ['owners'],
    queryFn: async () => {
      const response = await fetch('/api/owners')
      if (!response.ok) throw new Error('Failed to fetch owners')
      return response.json()
    },
  })

  // Fetch tags
  const { data: tagsData } = useQuery<{ tags: Tag[] }>({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await fetch('/api/tags')
      if (!response.ok) throw new Error('Failed to fetch tags')
      return response.json()
    },
  })

  // Build query params for deck filtering
  const buildDeckQueryParams = () => {
    const params = new URLSearchParams()
    if (activeOwner?.id) {
      params.set('ownerId', activeOwner.id)
    }
    if (filterColors.length > 0) {
      params.set('colors', filterColors.join(','))
      params.set('colorMode', filterColorMode)
    }
    if (filterCardName) {
      params.set('cardName', filterCardName)
    }
    if (filterTags.length > 0) {
      params.set('tags', filterTags.join(','))
    }
    return params.toString()
  }

  // Fetch decks (with filters)
  const { data, isLoading } = useQuery<{ decks: Deck[] }>({
    queryKey: ['decks', activeOwner?.id, filterColors, filterColorMode, filterCardName, filterTags],
    queryFn: async () => {
      const queryString = buildDeckQueryParams()
      const url = queryString ? `/api/decks?${queryString}` : '/api/decks'
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch decks')
      return response.json()
    },
    staleTime: 0,
  })

  // Create deck mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string
      format: string
      description: string
      ownerId: string
      status: DeckStatus
    }) => {
      const response = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          ownerId: data.ownerId || undefined,
        }),
      })
      if (!response.ok) throw new Error('Failed to create deck')
      return response.json()
    },
    onError: () => {
      toast({
        title: 'Enchantment Failed',
        description: 'The binding ritual was interrupted. Please try again.',
        variant: 'destructive',
      })
    },
  })

  // Delete deck mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/decks/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete deck')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decks'] })
      queryClient.invalidateQueries({ queryKey: ['owners'] })
      toast({
        title: 'Spellbook Destroyed',
        description: 'The grimoire has been consumed by flames.',
      })
    },
    onError: () => {
      toast({
        title: 'Destruction Failed',
        description: 'The spellbook resists your attempts.',
        variant: 'destructive',
      })
    },
  })

  // Create owner mutation
  const createOwnerMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const response = await fetch('/api/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create owner')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owners'] })
      setShowOwnerModal(false)
      toast({
        title: 'Owner Added',
        description: 'A new keeper has joined the guild.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Add Owner',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Update deck status mutation
  const updateDeckStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DeckStatus }) => {
      const response = await fetch(`/api/decks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error('Failed to update deck status')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decks'] })
    },
    onError: () => {
      toast({
        title: 'Update Failed',
        description: 'Could not update deck status.',
        variant: 'destructive',
      })
    },
  })

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create tag')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create tag',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Import decklist mutation
  const importDecklistMutation = useMutation({
    mutationFn: async ({ deckId, decklist }: { deckId: string; decklist: string }) => {
      const response = await fetch(`/api/decks/${deckId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decklist }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to import decklist')
      }
      return response.json()
    },
  })

  const handleCreateDeck = async (formData: {
    name: string
    format: string
    description: string
    ownerId: string
    status: DeckStatus
    decklist: string
  }) => {
    if (!formData.name.trim()) return

    createMutation.mutate({
      name: formData.name,
      format: formData.format,
      description: formData.description,
      ownerId: formData.ownerId,
      status: formData.status,
    }, {
      onSuccess: async (data) => {
        const hasDecklist = formData.decklist.trim().length > 0

        if (hasDecklist && data.deck?.id) {
          try {
            const result = await importDecklistMutation.mutateAsync({
              deckId: data.deck.id,
              decklist: formData.decklist,
            })

            queryClient.invalidateQueries({ queryKey: ['decks'] })
            queryClient.invalidateQueries({ queryKey: ['owners'] })

            if (result.notFound > 0) {
              toast({
                title: `Deck created with ${result.imported} cards`,
                description: `${result.notFound} card(s) not found: ${result.details.notFound.slice(0, 3).join(', ')}${result.details.notFound.length > 3 ? '...' : ''}`,
              })
            } else {
              toast({
                title: `Deck created with ${result.imported} cards`,
                description: 'All cards were found and added to your deck.',
              })
            }
          } catch {
            queryClient.invalidateQueries({ queryKey: ['decks'] })
            queryClient.invalidateQueries({ queryKey: ['owners'] })
            toast({
              title: 'Deck Created',
              description: 'Deck created but decklist import failed.',
              variant: 'destructive',
            })
          }
        } else {
          queryClient.invalidateQueries({ queryKey: ['decks'] })
          queryClient.invalidateQueries({ queryKey: ['owners'] })
          toast({
            title: 'Spellbook Created',
            description: 'Your new grimoire has been bound and is ready for spells.',
          })
        }

        setShowCreateModal(false)
      },
    })
  }

  const handleCreateOwner = (data: { name: string; color: string }) => {
    createOwnerMutation.mutate(data)
  }

  const handleDeleteDeck = (id: string, name: string) => {
    if (confirm(`Are you sure you want to destroy "${name}"? This cannot be undone.`)) {
      deleteMutation.mutate(id)
    }
  }

  // Calculate total value of all displayed decks (excluding "building" status)
  const totalCollectionValue = data?.decks?.reduce((sum, deck) => {
    if (deck.status === 'building') return sum
    return sum + deck.totalPrice
  }, 0) || 0

  // Filter and sort decks
  const sortedDecks = useMemo(() => {
    if (!data?.decks) return []

    let filtered = data.decks
    if (filterStatus !== 'all') {
      filtered = data.decks.filter(deck => deck.status === filterStatus)
    }

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
          break
        case 'price':
          comparison = a.totalPrice - b.totalPrice
          break
        case 'status':
          const statusOrder = { building: 0, active: 1, locked: 2 }
          comparison = statusOrder[a.status] - statusOrder[b.status]
          break
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          break
        case 'cardCount':
          comparison = a.cardCount - b.cardCount
          break
        case 'avgCmc':
          comparison = a.avgCmc - b.avgCmc
          break
        case 'tags':
          const aFirstTag = a.tags[0]?.name || '\uffff'
          const bFirstTag = b.tags[0]?.name || '\uffff'
          comparison = aFirstTag.localeCompare(bFirstTag, 'fr', { sensitivity: 'base' })
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [data?.decks, sortField, sortDirection, filterStatus])

  // Cycle deck status
  const cycleDeckStatus = (deck: Deck, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const statusOrder: DeckStatus[] = ['building', 'active', 'locked']
    const currentIndex = statusOrder.indexOf(deck.status)
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length]
    updateDeckStatusMutation.mutate({ id: deck.id, status: nextStatus })
  }

  const defaultOwner = ownersData?.owners?.find(o => o.isDefault)

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-6 h-6 text-arcane-500" />
              <h1 className="font-display text-2xl text-gold-400">Your Spellbooks</h1>
            </div>
            <p className="text-parchment-500 text-sm">
              Manage your collection of magical grimoires
            </p>
          </div>
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="outline" onClick={() => setShowOwnerModal(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Owner
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Spellbook
              </Button>
            </motion.div>
          </div>
        </div>
      </FadeIn>

      {/* Filters & Stats Bar */}
      <DeckFilters
        activeOwner={activeOwner}
        decks={data?.decks}
        sortedDecksCount={sortedDecks.length}
        totalCollectionValue={totalCollectionValue}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        filterColors={filterColors}
        onFilterColorsChange={setFilterColors}
        filterColorMode={filterColorMode}
        onFilterColorModeChange={setFilterColorMode}
        filterCardName={filterCardName}
        onFilterCardNameChange={setFilterCardName}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        filterTags={filterTags}
        onFilterTagsChange={setFilterTags}
        tags={tagsData?.tags}
        onCreateTag={(name) => createTagMutation.mutate(name)}
        isCreatingTag={createTagMutation.isPending}
      />

      {/* Loading State */}
      {isLoading && (
        <DiceLoader message="Summoning your grimoires from the vault..." />
      )}

      {/* Empty State */}
      {!isLoading && (!data?.decks || data.decks.length === 0) && (
        <EmptyState
          variant="decks"
          action={{
            label: 'Create Your First Spellbook',
            onClick: () => setShowCreateModal(true),
          }}
        />
      )}

      {/* Empty State for filtered results */}
      {!isLoading && data?.decks && data.decks.length > 0 && sortedDecks.length === 0 && (
        <div className="card-frame p-8 text-center">
          <Filter className="w-12 h-12 text-dungeon-500 mx-auto mb-4" />
          <h3 className="font-medieval text-lg text-parchment-300 mb-2">No matching decks</h3>
          <p className="text-sm text-parchment-500 mb-4">
            No decks match your current filters. Try adjusting your criteria.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setFilterStatus('all')
              setFilterColors([])
              setFilterCardName('')
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}

      {/* Decks Grid View */}
      {sortedDecks.length > 0 && viewMode === 'grid' && (
        <DeckGridView
          decks={sortedDecks}
          activeOwnerId={activeOwner?.id}
          onDeleteDeck={handleDeleteDeck}
          onCycleDeckStatus={cycleDeckStatus}
        />
      )}

      {/* Decks List View */}
      {sortedDecks.length > 0 && viewMode === 'list' && (
        <DeckListView
          decks={sortedDecks}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          onDeleteDeck={handleDeleteDeck}
          onCycleDeckStatus={cycleDeckStatus}
        />
      )}

      {/* Create Deck Modal */}
      <CreateDeckModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        owners={ownersData?.owners}
        defaultOwner={defaultOwner}
        onCreateDeck={handleCreateDeck}
        isCreating={createMutation.isPending}
        isImporting={importDecklistMutation.isPending}
      />

      {/* Add Owner Modal */}
      <AddOwnerModal
        open={showOwnerModal}
        onOpenChange={setShowOwnerModal}
        onCreateOwner={handleCreateOwner}
        isCreating={createOwnerMutation.isPending}
      />
    </div>
  )
}
