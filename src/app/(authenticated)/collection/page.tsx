'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Archive, Search, Coins, User, Heart, CheckCircle2, ChevronLeft, ChevronRight, Upload, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { formatPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { DiceLoader } from '@/components/ui/dice-loader'
import { FadeIn } from '@/components/layout/page-transition'
import { CardDetailModal } from '@/components/card/card-detail-modal'
import { CardWithPrice } from '@/types/scryfall'
import { useActiveOwner } from '@/contexts/active-owner'
import { CollectionFiltersPanel, CollectionFilters, DEFAULT_COLLECTION_FILTERS } from '@/components/collection/collection-filters'
import { ImportDecksModal } from '@/components/collection/import-decks-modal'
import { CollectionCardItem } from '@/components/collection/collection-card-item'
import { CardScannerModal } from '@/components/scanner'
import { useAuthUser } from '@/contexts/auth-user'

interface Owner {
  id: string
  name: string
  color: string
}

interface DeckInfo {
  id: string
  name: string
  quantity: number
}

interface CollectionItem {
  id: string
  cardId: string
  ownerId: string | null
  owner: Owner | null
  quantity: number
  type: 'owned' | 'wanted'
  condition: string | null
  isFoil: boolean
  priority: string | null
  isOrdered: boolean | null
  orderedAt: string | null
  isReceived: boolean | null
  receivedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string | null
  decksContaining: DeckInfo[]
  card: CardWithPrice
}

interface CollectionResponse {
  items: CollectionItem[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
  owned: {
    count: number
    cards: number
    price: number
  }
  wanted: {
    count: number
    cards: number
    price: number
  }
}

type FilterType = 'all' | 'owned' | 'wanted'

export default function CollectionPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null)
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [page, setPage] = useState(1)
  const pageSize = 24
  const { activeOwner } = useActiveOwner()
  const { isAdmin } = useAuthUser()
  const [cardFilters, setCardFilters] = useState<CollectionFilters>(DEFAULT_COLLECTION_FILTERS)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showScannerModal, setShowScannerModal] = useState(false)
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null)

  // Read filter from URL params
  useEffect(() => {
    const urlFilter = searchParams.get('filter') as FilterType
    if (urlFilter && ['all', 'owned', 'wanted'].includes(urlFilter)) {
      setFilterType(urlFilter)
    }
  }, [searchParams])

  // Reset page when owner changes
  useEffect(() => {
    setPage(1)
  }, [activeOwner?.id])

  // Update URL when filter changes
  const handleFilterChange = (newFilter: FilterType) => {
    setFilterType(newFilter)
    setPage(1)
    if (newFilter === 'all') {
      router.replace('/collection')
    } else {
      router.replace(`/collection?filter=${newFilter}`)
    }
  }

  // Check if any card filters are active
  const hasActiveCardFilters = cardFilters.name !== '' ||
    cardFilters.colors.length > 0 ||
    cardFilters.rarity.length > 0 ||
    cardFilters.type !== '' ||
    cardFilters.set !== '' ||
    cardFilters.cmcMin !== null ||
    cardFilters.cmcMax !== null ||
    cardFilters.condition !== 'all' ||
    cardFilters.isFoil !== 'all'

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [cardFilters])

  // Fetch collection
  const { data, isLoading, isFetching } = useQuery<CollectionResponse>({
    queryKey: ['collection', activeOwner?.id, filterType, page, pageSize, cardFilters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (activeOwner) params.set('ownerId', activeOwner.id)
      if (filterType !== 'all') params.set('filter', filterType)
      params.set('page', page.toString())
      params.set('pageSize', pageSize.toString())

      // Add card filters
      if (cardFilters.name) params.set('name', cardFilters.name)
      if (cardFilters.colors.length > 0) params.set('colors', cardFilters.colors.join(','))
      if (cardFilters.colorMode !== 'include') params.set('colorMode', cardFilters.colorMode)
      if (cardFilters.rarity.length > 0) params.set('rarity', cardFilters.rarity.join(','))
      if (cardFilters.type) params.set('type', cardFilters.type)
      if (cardFilters.set) params.set('set', cardFilters.set)
      if (cardFilters.cmcMin !== null) params.set('cmcMin', cardFilters.cmcMin.toString())
      if (cardFilters.cmcMax !== null) params.set('cmcMax', cardFilters.cmcMax.toString())
      if (cardFilters.condition && cardFilters.condition !== 'all') params.set('condition', cardFilters.condition)
      if (cardFilters.isFoil !== 'all') params.set('isFoil', cardFilters.isFoil)
      params.set('sortBy', cardFilters.sortBy)
      params.set('sortDir', cardFilters.sortDir)

      const response = await fetch(`/api/collection?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch collection')
      return response.json()
    },
    placeholderData: (previousData) => previousData,
  })

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0
  const selectedItem = selectedCardIndex !== null && data?.items[selectedCardIndex]
    ? data.items[selectedCardIndex]
    : null
  const selectedCard = selectedItem?.card ?? null

  // Build wantlist item data if the selected item is a wantlist item
  const selectedWantlistItem = selectedItem?.type === 'wanted' && selectedItem
    ? {
        id: selectedItem.id,
        quantity: selectedItem.quantity,
        priority: selectedItem.priority || 'medium',
        isOrdered: selectedItem.isOrdered || false,
        orderedAt: selectedItem.orderedAt,
        isReceived: selectedItem.isReceived || false,
        receivedAt: selectedItem.receivedAt,
        notes: selectedItem.notes,
      }
    : null

  // Update collection item mutation
  const updateCollectionMutation = useMutation({
    mutationFn: async (updateData: { id: string; quantity?: number; condition?: string; isFoil?: boolean }) => {
      const response = await fetch('/api/collection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })
      if (!response.ok) throw new Error('Failed to update item')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] })
      setUpdatingItemId(null)
    },
    onError: () => {
      toast({
        title: 'Error',
        description: "Update failed.",
        variant: 'destructive',
      })
      setUpdatingItemId(null)
    },
  })

  // Update wantlist item mutation
  const updateWantlistMutation = useMutation({
    mutationFn: async (updateData: { id: string; quantity?: number; priority?: string }) => {
      const response = await fetch('/api/wantlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })
      if (!response.ok) throw new Error('Failed to update item')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] })
      setUpdatingItemId(null)
    },
    onError: () => {
      toast({
        title: 'Error',
        description: "Update failed.",
        variant: 'destructive',
      })
      setUpdatingItemId(null)
    },
  })

  // Handle quantity change
  const handleQuantityChange = useCallback((item: CollectionItem, delta: number) => {
    const newQuantity = item.quantity + delta
    setUpdatingItemId(item.id)

    if (item.type === 'owned') {
      updateCollectionMutation.mutate({ id: item.id, quantity: newQuantity })
    } else {
      updateWantlistMutation.mutate({ id: item.id, quantity: newQuantity })
    }
  }, [updateCollectionMutation, updateWantlistMutation])

  // Navigation in modal
  const handlePrevCard = useCallback(() => {
    if (selectedCardIndex !== null && selectedCardIndex > 0) {
      setSelectedCardIndex(selectedCardIndex - 1)
    }
  }, [selectedCardIndex])

  const handleNextCard = useCallback(() => {
    if (selectedCardIndex !== null && data?.items && selectedCardIndex < data.items.length - 1) {
      setSelectedCardIndex(selectedCardIndex + 1)
    }
  }, [selectedCardIndex, data?.items])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedCardIndex === null) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrevCard()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNextCard()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCardIndex, handlePrevCard, handleNextCard])

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Archive className="w-6 h-6 text-arcane-500" />
              <h1 className="font-display text-2xl text-gold-400">Collection</h1>
              {activeOwner && (
                <span
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm border"
                  style={{
                    color: activeOwner.color,
                    borderColor: `${activeOwner.color}40`,
                    backgroundColor: `${activeOwner.color}10`,
                  }}
                >
                  <User className="w-3.5 h-3.5" />
                  {activeOwner.name}
                </span>
              )}
            </div>
            <p className="text-parchment-500 text-sm">
              Your cards and wishlist in one place
            </p>
          </div>
          <div className="flex items-center gap-4">
            {data && (data.owned.count > 0 || data.wanted.count > 0) && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-right card-frame px-4 py-2"
              >
                <div className="flex items-center gap-4">
                  {data.owned.count > 0 && (
                    <div>
                      <p className="text-xs text-emerald-400 flex items-center gap-1">
                        <Archive className="w-3 h-3" />
                        {data.owned.cards} owned
                      </p>
                      <p className="text-sm font-semibold text-gold-400 flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5" />
                        {formatPrice(data.owned.price, 'EUR')}
                      </p>
                    </div>
                  )}
                  {data.wanted.count > 0 && (
                    <div>
                      <p className="text-xs text-pink-400 flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {data.wanted.cards} wanted
                      </p>
                      <p className="text-sm font-semibold text-pink-300 flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5" />
                        {formatPrice(data.wanted.price, 'EUR')}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            <Link href="/">
              <Button>
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* Scanner Button - Always visible, prominent on mobile */}
      <FadeIn delay={0.05}>
        <div className="flex flex-wrap items-center gap-2">
          {/* Scanner button - first on mobile, admin only */}
          {isAdmin && (
            <Button
              onClick={() => setShowScannerModal(true)}
              className="h-10 gap-2 bg-arcane-600 hover:bg-arcane-500 text-white order-first sm:order-none"
            >
              <ScanLine className="w-5 h-5" />
              <span>Scanner</span>
            </Button>
          )}

          {/* Filter tabs - only if has cards */}
          {data && (data.owned.count > 0 || data.wanted.count > 0) && (
            <>
              <button
                onClick={() => handleFilterChange('all')}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5',
                  filterType === 'all'
                    ? 'bg-gold-600/20 text-gold-400 border border-gold-600/30'
                    : 'text-parchment-400 hover:text-parchment-200 hover:bg-dungeon-700/50'
                )}
              >
                <Archive className="w-4 h-4" />
                <span className="hidden sm:inline">All</span>
                <span className="text-xs opacity-70">({data.total})</span>
              </button>
              <button
                onClick={() => handleFilterChange('owned')}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5',
                  filterType === 'owned'
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                    : 'text-parchment-400 hover:text-parchment-200 hover:bg-dungeon-700/50'
                )}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span className="hidden sm:inline">Owned</span>
                <span className="text-xs opacity-70">({data.owned.count})</span>
              </button>
              <button
                onClick={() => handleFilterChange('wanted')}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5',
                  filterType === 'wanted'
                    ? 'bg-pink-600/20 text-pink-400 border border-pink-600/30'
                    : 'text-parchment-400 hover:text-parchment-200 hover:bg-dungeon-700/50'
                )}
              >
                <Heart className="w-4 h-4" />
                <span className="hidden sm:inline">Wanted</span>
                <span className="text-xs opacity-70">({data.wanted.count})</span>
              </button>
            </>
          )}

          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportModal(true)}
            className="h-9 gap-2 hidden sm:flex"
          >
            <Upload className="w-4 h-4" />
            Import decks
          </Button>
        </div>
      </FadeIn>

      {/* Card Filters */}
      <FadeIn delay={0.08}>
        <CollectionFiltersPanel
          filters={cardFilters}
          onChange={setCardFilters}
          onReset={() => setCardFilters(DEFAULT_COLLECTION_FILTERS)}
          hasActiveFilters={hasActiveCardFilters}
        />
      </FadeIn>

      {/* Results count & Pagination */}
      {data && data.total > 0 && (
        <FadeIn delay={0.1}>
          <div className="flex items-center justify-between">
            <p className="text-sm text-parchment-400">
              {isFetching && !isLoading ? (
                <span className="animate-pulse">Loading...</span>
              ) : (
                <><span className="text-gold-400 font-semibold">{data.total}</span> cards</>
              )}
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isFetching}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-parchment-300 font-medieval min-w-[80px] text-center">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || isFetching}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </FadeIn>
      )}

      {/* Loading State */}
      {isLoading && (
        <DiceLoader message="Loading your collection..." />
      )}

      {/* Empty State */}
      {!isLoading && data?.total === 0 && (
        <EmptyState
          variant="collection"
          action={{
            label: 'Add cards',
            onClick: () => window.location.href = '/',
          }}
        />
      )}

      {/* Card Grid */}
      {data?.items && data.items.length > 0 && (
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {data.items.map((item, index) => (
            <CollectionCardItem
              key={item.id}
              card={item.card}
              quantity={item.quantity}
              type={item.type}
              isFoil={item.isFoil}
              condition={item.condition || undefined}
              decksContaining={item.decksContaining}
              onClick={() => setSelectedCardIndex(index)}
              onQuantityChange={(delta) => handleQuantityChange(item, delta)}
              isUpdating={updatingItemId === item.id}
              index={index}
            />
          ))}
        </motion.div>
      )}

      {/* Bottom Pagination */}
      {data && totalPages > 1 && (
        <FadeIn>
          <div className="flex justify-center items-center gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-10 px-4"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-parchment-300 font-medieval min-w-[80px] text-center">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-10 px-4"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </FadeIn>
      )}

      {/* Card Detail Modal with Navigation */}
      <CardDetailModal
        card={selectedCard}
        onClose={() => setSelectedCardIndex(null)}
        onPrev={selectedCardIndex !== null && selectedCardIndex > 0 ? handlePrevCard : undefined}
        onNext={selectedCardIndex !== null && data?.items && selectedCardIndex < data.items.length - 1 ? handleNextCard : undefined}
        currentIndex={selectedCardIndex !== null ? selectedCardIndex + 1 : undefined}
        totalCards={data?.items.length}
        wantlistItem={selectedWantlistItem}
        onWantlistUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ['collection'] })
        }}
      />

      {/* Import Decks Modal */}
      <ImportDecksModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        ownerId={activeOwner?.id}
      />

      {/* Card Scanner Modal - Admin only */}
      {isAdmin && (
        <CardScannerModal
          open={showScannerModal}
          onClose={() => setShowScannerModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['collection'] })
          }}
        />
      )}
    </div>
  )
}
