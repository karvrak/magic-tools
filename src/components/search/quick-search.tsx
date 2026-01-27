'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, CornerDownLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

const FILTERS_STORAGE_KEY = 'magic-tools-search-filters'

// Default filters structure (must match search-page.tsx)
const defaultSearchFilters = {
  name: '',
  text: '',
  type: '',
  colors: [],
  colorIdentity: [],
  colorMode: 'include',
  cmcMin: null,
  cmcMax: null,
  cmcExact: null,
  rarity: [],
  set: '',
  format: '',
  priceMinEur: null,
  priceMaxEur: null,
  keywords: [],
}

export function QuickSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  const isOnSearchPage = pathname === '/'

  // Open modal with "/" key (or focus search if on search page)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is in an input
      const isInInput = 
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement

      // Handle Esc key
      if (e.key === 'Escape') {
        // If modal is open, close it
        if (isOpen) {
          e.preventDefault()
          setIsOpen(false)
          setQuery('')
          return
        }
        
        // If on search page (and not in quick search modal), reset filters
        if (isOnSearchPage && !isInInput) {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('reset-search'))
          return
        }
      }

      // Ignore "/" if in an input
      if (isInInput) {
        return
      }

      // "/" - Open quick search or focus existing search
      if (e.key === '/') {
        e.preventDefault()
        
        if (isOnSearchPage) {
          // Just focus the search input on the page
          window.dispatchEvent(new CustomEvent('focus-search'))
        } else {
          // Open the quick search modal
          setIsOpen(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isOnSearchPage])

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Handle search submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    
    if (!query.trim()) {
      setIsOpen(false)
      return
    }

    // Reset all filters and set only the name
    try {
      const newFilters = { ...defaultSearchFilters, name: query.trim() }
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(newFilters))
    } catch (error) {
      console.error('Failed to update search filters:', error)
    }

    // Close modal
    setIsOpen(false)
    setQuery('')

    // Navigate to search page (filters will be loaded from localStorage)
    router.push('/')
  }, [query, router])

  // Handle Esc key inside input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      setQuery('')
    }
  }

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false)
      setQuery('')
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
          onClick={handleBackdropClick}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-dungeon-900/80 backdrop-blur-sm" />

          {/* Search Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-lg"
          >
            {/* Outer glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-gold-600/20 via-arcane-500/20 to-gold-600/20 rounded-xl blur-md" />
            
            <form 
              onSubmit={handleSubmit}
              className="relative bg-dungeon-800 border-2 border-gold-600/40 rounded-xl overflow-hidden shadow-2xl"
            >
              {/* Top decorative bar */}
              <div className="h-1 bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />

              <div className="p-4">
                {/* Search Input */}
                <div className="relative flex items-center gap-3">
                  <Search className="w-5 h-5 text-gold-500 flex-shrink-0" />
                  
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Rechercher une carte..."
                    className={cn(
                      'flex-1 bg-transparent border-none outline-none',
                      'text-parchment-200 placeholder:text-dungeon-400',
                      'text-lg font-body'
                    )}
                    autoComplete="off"
                    spellCheck={false}
                  />

                  {/* Submit hint */}
                  <div className="flex items-center gap-1.5 text-dungeon-400">
                    <CornerDownLeft className="w-4 h-4" />
                    <span className="text-xs font-mono">Entrée</span>
                  </div>
                </div>

                {/* Help text */}
                <div className="mt-3 flex items-center justify-between text-xs text-dungeon-500">
                  <span>Les filtres seront réinitialisés</span>
                  <kbd className="px-1.5 py-0.5 bg-dungeon-700 border border-dungeon-600 rounded text-dungeon-400">
                    Esc
                  </kbd>
                </div>
              </div>

              {/* Bottom decorative bar */}
              <div className="h-0.5 bg-gradient-to-r from-transparent via-gold-500/30 to-transparent" />
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
