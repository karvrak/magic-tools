'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { useActiveOwner } from '@/contexts/active-owner'

type DeckStatus = 'building' | 'active' | 'locked'

type QuickAddTargetType = 'deck' | 'collection'

interface QuickAddDeck {
  id: string
  name: string
  format: string | null
  status: DeckStatus
  cardCount: number
  owner?: {
    id: string
    name: string
    color: string
  } | null
}

interface QuickAddTarget {
  type: QuickAddTargetType
  deck?: QuickAddDeck
}

interface QuickAddContextType {
  // Current active target (deck or collection)
  activeTarget: QuickAddTarget | null
  // Current active deck for quick add (legacy, for backward compatibility)
  activeDeck: QuickAddDeck | null
  // All available decks (non-locked, filtered by active owner if set)
  availableDecks: QuickAddDeck[]
  // All decks without owner filter (for cases where we need all)
  allDecks: QuickAddDeck[]
  // Loading state
  isLoading: boolean
  // Set the active deck
  setActiveDeck: (deck: QuickAddDeck | null) => void
  setActiveDeckById: (deckId: string) => void
  // Set collection as target
  setActiveCollection: () => void
  // Quick add function - returns true if successful
  quickAdd: (cardId: string, cardName: string, quantity?: number, category?: string) => Promise<boolean>
  // Check if quick add is ready
  isReady: boolean
  // Refresh decks list
  refreshDecks: () => void
}

const QuickAddContext = createContext<QuickAddContextType | undefined>(undefined)

const STORAGE_KEY = 'magictools-quick-add-deck'
const STORAGE_KEY_TYPE = 'magictools-quick-add-type'

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null)
  const [targetType, setTargetType] = useState<QuickAddTargetType>('deck')
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { activeOwner, isReady: ownerReady } = useActiveOwner()

  // Fetch available decks (non-locked)
  const { data: decksData, isLoading, refetch } = useQuery<{ decks: QuickAddDeck[] }>({
    queryKey: ['decks-quick-add'],
    queryFn: async () => {
      const response = await fetch('/api/decks')
      if (!response.ok) throw new Error('Failed to fetch decks')
      return response.json()
    },
    staleTime: 30 * 1000, // 30 seconds
  })

  // All decks (non-locked)
  const allDecks = (decksData?.decks || [])
    .filter((deck) => deck.status !== 'locked')
    .sort((a, b) => {
      // Building decks first
      if (a.status === 'building' && b.status !== 'building') return -1
      if (a.status !== 'building' && b.status === 'building') return 1
      return 0
    })

  // Filter by active owner if set
  const availableDecks = activeOwner
    ? allDecks.filter((deck) => deck.owner?.id === activeOwner.id)
    : allDecks

  // Find active deck object
  const activeDeck = activeDeckId
    ? availableDecks.find(d => d.id === activeDeckId) || null
    : null

  // Load active deck ID and target type from localStorage on mount
  useEffect(() => {
    const storedDeck = localStorage.getItem(STORAGE_KEY)
    const storedType = localStorage.getItem(STORAGE_KEY_TYPE)
    if (storedDeck) {
      setActiveDeckId(storedDeck)
    }
    if (storedType === 'collection' || storedType === 'deck') {
      setTargetType(storedType)
    }
  }, [])

  // Auto-select first building deck if no active deck and decks are loaded
  useEffect(() => {
    if (!activeDeckId && availableDecks.length > 0 && !isLoading && ownerReady) {
      const firstBuilding = availableDecks.find(d => d.status === 'building')
      const toSelect = firstBuilding || availableDecks[0]
      setActiveDeckId(toSelect.id)
      localStorage.setItem(STORAGE_KEY, toSelect.id)
    }
  }, [availableDecks, activeDeckId, isLoading, ownerReady])

  // If active deck ID is set but deck is not in filtered list, reset to first available
  useEffect(() => {
    if (activeDeckId && !isLoading && ownerReady && availableDecks.length > 0) {
      const exists = availableDecks.some(d => d.id === activeDeckId)
      if (!exists) {
        const firstBuilding = availableDecks.find(d => d.status === 'building')
        const toSelect = firstBuilding || availableDecks[0]
        setActiveDeckId(toSelect.id)
        localStorage.setItem(STORAGE_KEY, toSelect.id)
      }
    }
  }, [activeDeckId, availableDecks, isLoading, ownerReady])

  // Reset active deck when owner changes and current deck doesn't match
  useEffect(() => {
    if (ownerReady && activeOwner && activeDeckId) {
      const currentDeck = allDecks.find(d => d.id === activeDeckId)
      if (currentDeck && currentDeck.owner?.id !== activeOwner.id) {
        // Current deck belongs to different owner, switch to first deck of new owner
        const ownerDecks = allDecks.filter(d => d.owner?.id === activeOwner.id)
        if (ownerDecks.length > 0) {
          const firstBuilding = ownerDecks.find(d => d.status === 'building')
          const toSelect = firstBuilding || ownerDecks[0]
          setActiveDeckId(toSelect.id)
          localStorage.setItem(STORAGE_KEY, toSelect.id)
        }
      }
    }
  }, [activeOwner, activeDeckId, allDecks, ownerReady])

  // Add card to deck mutation
  const addCardToDeckMutation = useMutation({
    mutationFn: async ({
      deckId,
      cardId,
      quantity,
      category
    }: {
      deckId: string
      cardId: string
      quantity: number
      category: string
    }) => {
      const response = await fetch(`/api/decks/${deckId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, quantity, category }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add card')
      }
      return response.json()
    },
    onSuccess: (_, variables) => {
      // Invalidate deck queries to refresh card counts
      queryClient.invalidateQueries({ queryKey: ['deck', variables.deckId] })
      queryClient.invalidateQueries({ queryKey: ['decks'] })
      queryClient.invalidateQueries({ queryKey: ['decks-quick-add'] })
    },
  })

  // Add card to collection mutation
  const addCardToCollectionMutation = useMutation({
    mutationFn: async ({
      cardId,
      quantity,
      ownerId
    }: {
      cardId: string
      quantity: number
      ownerId?: string | null
    }) => {
      const response = await fetch('/api/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, quantity, ownerId }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add card to collection')
      }
      return response.json()
    },
    onSuccess: () => {
      // Invalidate collection queries
      queryClient.invalidateQueries({ queryKey: ['collection'] })
    },
  })

  // Set active deck
  const setActiveDeck = useCallback((deck: QuickAddDeck | null) => {
    if (deck) {
      setActiveDeckId(deck.id)
      setTargetType('deck')
      localStorage.setItem(STORAGE_KEY, deck.id)
      localStorage.setItem(STORAGE_KEY_TYPE, 'deck')
    } else {
      setActiveDeckId(null)
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  // Set active deck by ID
  const setActiveDeckById = useCallback((deckId: string) => {
    setActiveDeckId(deckId)
    setTargetType('deck')
    localStorage.setItem(STORAGE_KEY, deckId)
    localStorage.setItem(STORAGE_KEY_TYPE, 'deck')
  }, [])

  // Set collection as active target
  const setActiveCollection = useCallback(() => {
    setTargetType('collection')
    localStorage.setItem(STORAGE_KEY_TYPE, 'collection')
  }, [])

  // Quick add function
  const quickAdd = useCallback(async (
    cardId: string,
    cardName: string,
    quantity: number = 1,
    category: string = 'mainboard'
  ): Promise<boolean> => {
    // Handle collection target
    if (targetType === 'collection') {
      try {
        await addCardToCollectionMutation.mutateAsync({
          cardId,
          quantity,
          ownerId: activeOwner?.id || null,
        })

        toast({
          title: 'Added to collection',
          description: `${quantity}x ${cardName}`,
        })

        return true
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Unable to add card',
          variant: 'destructive',
        })
        return false
      }
    }

    // Handle deck target
    if (!activeDeck) {
      toast({
        title: 'No active deck',
        description: 'Select a deck in the Quick Add menu.',
        variant: 'destructive',
      })
      return false
    }

    try {
      await addCardToDeckMutation.mutateAsync({
        deckId: activeDeck.id,
        cardId,
        quantity,
        category,
      })

      toast({
        title: `Added to ${activeDeck.name}`,
        description: `${quantity}x ${cardName}`,
      })

      return true
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unable to add card',
        variant: 'destructive',
      })
      return false
    }
  }, [activeDeck, targetType, activeOwner, addCardToDeckMutation, addCardToCollectionMutation, toast])

  // Refresh decks
  const refreshDecks = useCallback(() => {
    refetch()
  }, [refetch])

  // Build active target object
  const activeTarget: QuickAddTarget | null = targetType === 'collection'
    ? { type: 'collection' }
    : activeDeck
      ? { type: 'deck', deck: activeDeck }
      : null

  // Ready if we have a valid target (collection is always valid, deck needs to be selected)
  const isReady = !isLoading && ownerReady && (targetType === 'collection' || activeDeck !== null)

  return (
    <QuickAddContext.Provider
      value={{
        activeTarget,
        activeDeck,
        availableDecks,
        allDecks,
        isLoading,
        setActiveDeck,
        setActiveDeckById,
        setActiveCollection,
        quickAdd,
        isReady,
        refreshDecks,
      }}
    >
      {children}
    </QuickAddContext.Provider>
  )
}

export function useQuickAdd() {
  const context = useContext(QuickAddContext)
  if (context === undefined) {
    throw new Error('useQuickAdd must be used within a QuickAddProvider')
  }
  return context
}
