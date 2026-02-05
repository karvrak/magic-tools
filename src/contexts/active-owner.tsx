'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export interface Owner {
  id: string
  name: string
  color: string
  isDefault: boolean
}

interface ActiveOwnerContextType {
  // Current active owner for filtering (null = "Tous")
  activeOwner: Owner | null
  // All available owners
  owners: Owner[]
  // Loading state
  isLoading: boolean
  // Set the active owner (null = "Tous")
  setActiveOwner: (owner: Owner | null) => void
  setActiveOwnerById: (ownerId: string | null) => void
  // Refresh owners list
  refreshOwners: () => void
  // Check if ready
  isReady: boolean
}

const ActiveOwnerContext = createContext<ActiveOwnerContextType | undefined>(undefined)

const STORAGE_KEY = 'magictools-active-owner'
const ALL_VALUE = 'all' // Special value for "All"

export function ActiveOwnerProvider({ children }: { children: ReactNode }) {
  const [activeOwnerId, setActiveOwnerId] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isExplicitlyAll, setIsExplicitlyAll] = useState(false)
  const queryClient = useQueryClient()

  // Fetch all owners
  const { data: ownersData, isLoading, refetch } = useQuery<{ owners: Owner[] }>({
    queryKey: ['owners'],
    queryFn: async () => {
      const response = await fetch('/api/owners')
      if (!response.ok) throw new Error('Failed to fetch owners')
      return response.json()
    },
    staleTime: 60 * 1000, // 1 minute
  })

  const owners = ownersData?.owners || []

  // Find active owner object
  const activeOwner = activeOwnerId
    ? owners.find(o => o.id === activeOwnerId) || null
    : null

  // Load active owner ID from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === ALL_VALUE) {
      setIsExplicitlyAll(true)
      setActiveOwnerId(null)
    } else if (stored && stored !== 'null') {
      setActiveOwnerId(stored)
    }
    setIsInitialized(true)
  }, [])

  // Auto-select default owner only if user hasn't explicitly chosen "Tous"
  useEffect(() => {
    if (isInitialized && !activeOwnerId && !isExplicitlyAll && owners.length > 0 && !isLoading) {
      const defaultOwner = owners.find(o => o.isDefault)
      if (defaultOwner) {
        setActiveOwnerId(defaultOwner.id)
        localStorage.setItem(STORAGE_KEY, defaultOwner.id)
      }
    }
  }, [owners, activeOwnerId, isLoading, isInitialized, isExplicitlyAll])

  // If active owner ID is set but owner doesn't exist, reset to "Tous"
  useEffect(() => {
    if (isInitialized && activeOwnerId && !isLoading && owners.length > 0) {
      const exists = owners.some(o => o.id === activeOwnerId)
      if (!exists) {
        setActiveOwnerId(null)
        setIsExplicitlyAll(true)
        localStorage.setItem(STORAGE_KEY, ALL_VALUE)
      }
    }
  }, [activeOwnerId, owners, isLoading, isInitialized])

  // Set active owner
  const setActiveOwner = useCallback((owner: Owner | null) => {
    if (owner) {
      setActiveOwnerId(owner.id)
      setIsExplicitlyAll(false)
      localStorage.setItem(STORAGE_KEY, owner.id)
    } else {
      setActiveOwnerId(null)
      setIsExplicitlyAll(true)
      localStorage.setItem(STORAGE_KEY, ALL_VALUE)
    }
    // Invalidate queries that depend on owner
    queryClient.invalidateQueries({ queryKey: ['wantlist'] })
    queryClient.invalidateQueries({ queryKey: ['decks-quick-add'] })
    queryClient.invalidateQueries({ queryKey: ['decks'] })
  }, [queryClient])

  // Set active owner by ID (null = "Tous")
  const setActiveOwnerById = useCallback((ownerId: string | null) => {
    if (ownerId) {
      setActiveOwnerId(ownerId)
      setIsExplicitlyAll(false)
      localStorage.setItem(STORAGE_KEY, ownerId)
    } else {
      setActiveOwnerId(null)
      setIsExplicitlyAll(true)
      localStorage.setItem(STORAGE_KEY, ALL_VALUE)
    }
    // Invalidate queries that depend on owner
    queryClient.invalidateQueries({ queryKey: ['wantlist'] })
    queryClient.invalidateQueries({ queryKey: ['decks-quick-add'] })
    queryClient.invalidateQueries({ queryKey: ['decks'] })
  }, [queryClient])

  // Refresh owners
  const refreshOwners = useCallback(() => {
    refetch()
  }, [refetch])

  const isReady = isInitialized && !isLoading

  return (
    <ActiveOwnerContext.Provider
      value={{
        activeOwner,
        owners,
        isLoading,
        setActiveOwner,
        setActiveOwnerById,
        refreshOwners,
        isReady,
      }}
    >
      {children}
    </ActiveOwnerContext.Provider>
  )
}

export function useActiveOwner() {
  const context = useContext(ActiveOwnerContext)
  if (context === undefined) {
    throw new Error('useActiveOwner must be used within an ActiveOwnerProvider')
  }
  return context
}
