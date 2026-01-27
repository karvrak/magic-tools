'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

interface UserPreferences {
  showPrices: boolean
}

interface UserPreferencesContextType {
  preferences: UserPreferences
  togglePrices: () => void
  setShowPrices: (show: boolean) => void
}

const defaultPreferences: UserPreferences = {
  showPrices: true,
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined)

const STORAGE_KEY = 'magictools-preferences'

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences)
  const [isHydrated, setIsHydrated] = useState(false)

  // Load preferences from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setPreferences({ ...defaultPreferences, ...parsed })
      } catch {
        // Invalid JSON, use defaults
      }
    }
    setIsHydrated(true)
  }, [])

  // Save preferences to localStorage when they change
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    }
  }, [preferences, isHydrated])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      // P - Toggle prices
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        setPreferences(prev => ({ ...prev, showPrices: !prev.showPrices }))
      }

      // ? or H - Open help (handled by navigation)
      // We'll dispatch a custom event for this
      if (e.key === '?' || (e.key === 'h' && !e.ctrlKey && !e.metaKey)) {
        window.dispatchEvent(new CustomEvent('open-help'))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const togglePrices = useCallback(() => {
    setPreferences(prev => ({ ...prev, showPrices: !prev.showPrices }))
  }, [])

  const setShowPrices = useCallback((show: boolean) => {
    setPreferences(prev => ({ ...prev, showPrices: show }))
  }, [])

  return (
    <UserPreferencesContext.Provider value={{ preferences, togglePrices, setShowPrices }}>
      {children}
    </UserPreferencesContext.Provider>
  )
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext)
  if (context === undefined) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider')
  }
  return context
}
