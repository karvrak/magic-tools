'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { SearchBar } from './search-bar'
import { SearchFiltersPanel } from './search-filters'
import { CardGrid } from '../card/card-grid'
import { CardDetailModal } from '../card/card-detail-modal'
import { SearchFilters, defaultSearchFilters, NewnessFilter } from '@/types/search'
import { CardWithPrice } from '@/types/scryfall'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { DiceLoader } from '@/components/ui/dice-loader'
import { ChevronLeft, ChevronRight, Filter, X, Sparkles, Star, Palette, Search as SearchIcon } from 'lucide-react'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/layout/page-transition'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

interface SearchResult {
  cards: CardWithPrice[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

interface NewnessStats {
  newCards: number
  newArt: number
  total: number
  latestDetection: string | null
}

// Debounce delay in milliseconds - prevents API calls while user is still typing
const SEARCH_DEBOUNCE_MS = 350

// LocalStorage key for persisting filters
const FILTERS_STORAGE_KEY = 'magic-tools-search-filters'

// Load filters from localStorage
function loadFiltersFromStorage(): SearchFilters {
  if (typeof window === 'undefined') return defaultSearchFilters
  try {
    const stored = localStorage.getItem(FILTERS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Merge with defaults to ensure all fields exist (in case of schema changes)
      return { ...defaultSearchFilters, ...parsed }
    }
  } catch (e) {
    console.error('Failed to load filters from storage:', e)
  }
  return defaultSearchFilters
}

// Save filters to localStorage
function saveFiltersToStorage(filters: SearchFilters): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
  } catch (e) {
    console.error('Failed to save filters to storage:', e)
  }
}

export function SearchPage() {
  // Initialize with default, then load from storage on mount
  const [filters, setFilters] = useState<SearchFilters>(defaultSearchFilters)
  const [isInitialized, setIsInitialized] = useState(false)

  // Ref for the search input
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Load filters from localStorage on mount
  useEffect(() => {
    const storedFilters = loadFiltersFromStorage()
    setFilters(storedFilters)
    setIsInitialized(true)
  }, [])

  // Listen for focus-search event (triggered by "/" on search page)
  useEffect(() => {
    const handleFocusSearch = () => {
      searchInputRef.current?.focus()
      // Scroll to top smoothly
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    window.addEventListener('focus-search', handleFocusSearch)
    return () => window.removeEventListener('focus-search', handleFocusSearch)
  }, [])

  // Listen for reset-search event (triggered by "Esc" on search page)
  useEffect(() => {
    const handleResetSearch = () => {
      // Reset all filters
      setFilters(defaultSearchFilters)
      setPage(1)
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' })
      // Focus the search input after a small delay (to let state update)
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    }

    window.addEventListener('reset-search', handleResetSearch)
    return () => window.removeEventListener('reset-search', handleResetSearch)
  }, [])

  // Save filters to localStorage when they change (after initialization)
  useEffect(() => {
    if (isInitialized) {
      saveFiltersToStorage(filters)
    }
  }, [filters, isInitialized])
  const [page, setPage] = useState(1)
  const [selectedCard, setSelectedCard] = useState<CardWithPrice | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const pageSize = 24

  // Debounce text-based filters to avoid firing requests on every keystroke
  const debouncedName = useDebouncedValue(filters.name, SEARCH_DEBOUNCE_MS)
  const debouncedText = useDebouncedValue(filters.text, SEARCH_DEBOUNCE_MS)
  const debouncedType = useDebouncedValue(filters.type, SEARCH_DEBOUNCE_MS)

  // Create debounced filters object for the actual API call
  const debouncedFilters = useMemo(() => ({
    ...filters,
    name: debouncedName,
    text: debouncedText,
    type: debouncedType,
  }), [filters, debouncedName, debouncedText, debouncedType])

  // Build query string from debounced filters (for API calls)
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams()
    params.set('page', page.toString())
    params.set('pageSize', pageSize.toString())

    if (debouncedFilters.name) params.set('name', debouncedFilters.name)
    if (debouncedFilters.text) params.set('text', debouncedFilters.text)
    if (debouncedFilters.type) params.set('type', debouncedFilters.type)
    if (debouncedFilters.colors.length) params.set('colors', debouncedFilters.colors.join(','))
    if (debouncedFilters.colorIdentity.length) params.set('colorIdentity', debouncedFilters.colorIdentity.join(','))
    if (debouncedFilters.colorMode !== 'include') params.set('colorMode', debouncedFilters.colorMode)
    if (debouncedFilters.cmcMin !== null) params.set('cmcMin', debouncedFilters.cmcMin.toString())
    if (debouncedFilters.cmcMax !== null) params.set('cmcMax', debouncedFilters.cmcMax.toString())
    if (debouncedFilters.cmcExact !== null) params.set('cmcExact', debouncedFilters.cmcExact.toString())
    if (debouncedFilters.rarity.length) params.set('rarity', debouncedFilters.rarity.join(','))
    if (debouncedFilters.set) params.set('set', debouncedFilters.set)
    if (debouncedFilters.format) params.set('format', debouncedFilters.format)
    if (debouncedFilters.priceMinEur !== null) params.set('priceMinEur', debouncedFilters.priceMinEur.toString())
    if (debouncedFilters.priceMaxEur !== null) params.set('priceMaxEur', debouncedFilters.priceMaxEur.toString())
    if (debouncedFilters.keywords.length) params.set('keywords', debouncedFilters.keywords.join(','))
    // Newness filter
    if (debouncedFilters.newness) params.set('newness', debouncedFilters.newness)
    if (debouncedFilters.newnessSince) params.set('newnessSince', debouncedFilters.newnessSince)

    return params.toString()
  }, [debouncedFilters, page, pageSize])

  // Check if any filter is active (use immediate filters for UI feedback)
  const hasActiveFilters = Boolean(
    filters.name ||
    filters.text ||
    filters.type ||
    filters.colors.length > 0 ||
    filters.colorIdentity.length > 0 ||
    filters.cmcMin !== null ||
    filters.cmcMax !== null ||
    filters.cmcExact !== null ||
    filters.rarity.length > 0 ||
    filters.set ||
    filters.format ||
    filters.priceMinEur !== null ||
    filters.priceMaxEur !== null ||
    filters.keywords.length > 0 ||
    filters.newness !== null
  )

  // Check if debounced filters are ready for API call
  const hasDebouncedFilters = Boolean(
    debouncedFilters.name ||
    debouncedFilters.text ||
    debouncedFilters.type ||
    debouncedFilters.colors.length > 0 ||
    debouncedFilters.colorIdentity.length > 0 ||
    debouncedFilters.cmcMin !== null ||
    debouncedFilters.cmcMax !== null ||
    debouncedFilters.cmcExact !== null ||
    debouncedFilters.rarity.length > 0 ||
    debouncedFilters.set ||
    debouncedFilters.format ||
    debouncedFilters.priceMinEur !== null ||
    debouncedFilters.priceMaxEur !== null ||
    debouncedFilters.keywords.length > 0 ||
    debouncedFilters.newness !== null
  )

  // Fetch newness stats for the tabs
  const { data: newnessStats } = useQuery<NewnessStats>({
    queryKey: ['newness-stats'],
    queryFn: async () => {
      const response = await fetch('/api/newness')
      if (!response.ok) throw new Error('Failed to fetch newness stats')
      return response.json()
    },
    staleTime: 60 * 1000, // 1 minute
  })

  // Fetch search results with AbortController for request cancellation
  const { data, isLoading, isFetching, error } = useQuery<SearchResult>({
    queryKey: ['search', buildQueryString()],
    queryFn: async ({ signal }) => {
      // signal is provided by React Query and will abort when queryKey changes
      const response = await fetch(`/api/search?${buildQueryString()}`, { signal })
      if (!response.ok) throw new Error('Search failed')
      return response.json()
    },
    enabled: hasDebouncedFilters,
    staleTime: 30 * 1000, // 30 seconds
    // Keep previous data while fetching new results for smoother UX
    placeholderData: (previousData) => previousData,
  })

  // Handle newness tab change
  const handleNewnessTabChange = useCallback((newness: NewnessFilter | null) => {
    setFilters(prev => ({ ...prev, newness }))
    setPage(1)
  }, [])

  const handleFilterChange = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters)
    setPage(1) // Reset to first page on filter change
  }, [])

  const handleClearFilters = useCallback(() => {
    setFilters(defaultSearchFilters)
    setPage(1)
  }, [])

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0

  // Show loading state when:
  // 1. Actually fetching from API (isFetching)
  // 2. User is typing but debounce hasn't fired yet (filters differ from debounced)
  const isTyping = filters.name !== debouncedName || 
                   filters.text !== debouncedText || 
                   filters.type !== debouncedType
  const showLoading = (isLoading || isFetching || isTyping) && hasActiveFilters

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header - Compact on mobile */}
      <FadeIn>
        <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
          <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-gold-500" />
          <h1 className="font-display text-xl sm:text-2xl text-gold-400">Recherche</h1>
        </div>
        <p className="text-parchment-500 text-xs sm:text-sm hidden sm:block">
          Parcourir la collection de cartes
        </p>
      </FadeIn>

      {/* Newness Tabs - Show only if there are new items */}
      {newnessStats && newnessStats.total > 0 && (
        <FadeIn delay={0.05}>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filters.newness === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleNewnessTabChange(null)}
              className={filters.newness === null
                ? 'bg-dungeon-700 text-parchment-200 border-dungeon-600'
                : 'text-parchment-400 hover:text-parchment-200'
              }
            >
              <SearchIcon className="w-4 h-4 mr-1.5" />
              Toutes
            </Button>
            <Button
              variant={filters.newness === 'all_new' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleNewnessTabChange('all_new')}
              className={filters.newness === 'all_new'
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white border-emerald-500'
                : 'text-emerald-400 border-emerald-600/50 hover:bg-emerald-500/10 hover:text-emerald-300'
              }
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Nouveautés
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-emerald-500/20">
                {newnessStats.total}
              </span>
            </Button>
            <Button
              variant={filters.newness === 'new_card' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleNewnessTabChange('new_card')}
              className={filters.newness === 'new_card'
                ? 'bg-gradient-to-r from-gold-600 to-gold-700 text-white border-gold-500'
                : 'text-gold-400 border-gold-600/50 hover:bg-gold-500/10 hover:text-gold-300'
              }
            >
              <Star className="w-4 h-4 mr-1.5" />
              Nouvelles cartes
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-gold-500/20">
                {newnessStats.newCards}
              </span>
            </Button>
            <Button
              variant={filters.newness === 'new_art' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleNewnessTabChange('new_art')}
              className={filters.newness === 'new_art'
                ? 'bg-gradient-to-r from-violet-600 to-violet-700 text-white border-violet-500'
                : 'text-violet-400 border-violet-600/50 hover:bg-violet-500/10 hover:text-violet-300'
              }
            >
              <Palette className="w-4 h-4 mr-1.5" />
              Nouveaux artworks
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-violet-500/20">
                {newnessStats.newArt}
              </span>
            </Button>
          </div>
        </FadeIn>
      )}

      {/* Search Bar */}
      <FadeIn delay={0.1}>
        <div className="card-frame p-3 sm:p-4">
          <SearchBar
            ref={searchInputRef}
            value={filters.name}
            onChange={(name) => handleFilterChange({ ...filters, name })}
            onToggleFilters={() => setShowFilters(!showFilters)}
            showFiltersActive={showFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      </FadeIn>

      {/* Filters Panel - The Grimoire */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <div className="relative">
              {/* Grimoire outer frame - subtle on mobile */}
              <div className="absolute -inset-1 bg-gradient-to-br from-gold-600/20 via-transparent to-gold-600/20 rounded-xl blur-sm hidden sm:block" />
              
              <div className="relative bg-gradient-to-br from-dungeon-800 via-dungeon-850 to-dungeon-900 rounded-xl border border-gold-600/30 overflow-hidden">
                {/* Top decorative bar */}
                <div className="h-0.5 sm:h-1 bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />
                
                {/* Header - More compact on mobile */}
                <div className="px-3 sm:px-6 py-2 sm:py-4 border-b border-dungeon-700/50 bg-dungeon-900/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <motion.div
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                        className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-gold-600/20 to-gold-700/10 border border-gold-600/40"
                      >
                        <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gold-400" />
                      </motion.div>
                      <div>
                        <h2 className="font-display text-sm sm:text-lg text-gold-400 tracking-wide">
                          Filtres
                        </h2>
                        <p className="text-[10px] sm:text-xs text-dungeon-400 font-body hidden sm:block">
                          Affiner la recherche
                        </p>
                      </div>
                    </div>
                    
                    {hasActiveFilters && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleClearFilters}
                          className="text-dragon-400 hover:text-dragon-300 hover:bg-dragon-500/10 border border-dragon-600/30 text-xs sm:text-sm px-2 sm:px-3 h-8 sm:h-9"
                        >
                          <X className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                          <span className="hidden sm:inline">Effacer</span>
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </div>
                
                {/* Filters content - Less padding on mobile */}
                <div className="p-3 sm:p-6">
                  <SearchFiltersPanel filters={filters} onChange={handleFilterChange} />
                </div>
                
                {/* Bottom decorative bar */}
                <div className="h-0.5 sm:h-1 bg-gradient-to-r from-transparent via-gold-500/30 to-transparent" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Section */}
      <div className="space-y-3 sm:space-y-4">
        {/* Results Header - Stack on mobile */}
        {hasActiveFilters && (
          <FadeIn delay={0.2}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
              <p className="text-parchment-400 text-xs sm:text-sm font-body">
                {showLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-pulse">
                      {isTyping ? 'Recherche...' : 'Chargement...'}
                    </span>
                  </span>
                ) : error ? (
                  <span className="text-dragon-400">Erreur de recherche</span>
                ) : data ? (
                  <>
                    <span className="text-gold-400 font-semibold">{data.total.toLocaleString()}</span> cartes trouvées
                  </>
                ) : null}
              </p>

              {/* Pagination - Compact on mobile */}
              {data && totalPages > 1 && (
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs sm:text-sm text-parchment-300 font-medieval min-w-[80px] text-center">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </FadeIn>
        )}

        {/* Empty State - No Search Yet */}
        {!hasActiveFilters && (
          <EmptyState
            variant="search"
            action={{
              label: 'Open Arcane Filters',
              onClick: () => setShowFilters(true),
            }}
          />
        )}

        {/* Loading State */}
        <AnimatePresence>
          {showLoading && !data && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DiceLoader 
                message={isTyping 
                  ? "Awaiting your complete incantation..." 
                  : "The scribes are searching the ancient tomes..."
                }
                size="md"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Grid */}
        <AnimatePresence>
          {!isLoading && data && data.cards.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <CardGrid cards={data.cards} onCardClick={setSelectedCard} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* No Results */}
        {!isLoading && data && data.cards.length === 0 && hasActiveFilters && (
          <EmptyState
            variant="no-results"
            action={{
              label: 'Adjust Filters',
              onClick: () => setShowFilters(true),
            }}
          />
        )}

        {/* Bottom Pagination */}
        {data && totalPages > 1 && (
          <FadeIn>
            <div className="flex justify-center items-center gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-9 sm:h-10 px-3 sm:px-4"
              >
                <ChevronLeft className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Précédent</span>
              </Button>
              <span className="text-xs sm:text-sm text-parchment-300 font-medieval min-w-[60px] sm:min-w-[80px] text-center">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-9 sm:h-10 px-3 sm:px-4"
              >
                <span className="hidden sm:inline">Suivant</span>
                <ChevronRight className="w-4 h-4 sm:ml-1" />
              </Button>
            </div>
          </FadeIn>
        )}
      </div>

      {/* Card Detail Modal */}
      <CardDetailModal
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        onCardAddedToDeck={() => setSelectedCard(null)}
        cards={data?.cards}
        onNavigate={setSelectedCard}
      />
    </div>
  )
}
