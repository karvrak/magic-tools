'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { CardWithPrice } from '@/types/scryfall'
import { formatPrice, formatBestPrice, getBestPrice, getRarityColor, parseManaSymbols, getManaSymbolUrl, PriceData } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus, Minus, Heart, Archive, ExternalLink, Loader2, Sparkles, Crown, Star, TrendingDown, TrendingUp, Coins, RotateCw, ChevronLeft, ChevronRight, Zap, ShoppingCart, PackageCheck, Trash2, ArrowRightCircle, Layers } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { AddToDeckModal } from './add-to-deck-modal'
import { useQuickAdd } from '@/contexts/quick-add'
import { useActiveOwner } from '@/contexts/active-owner'

interface CardVersion {
  id: string
  name: string
  printedName: string | null
  setCode: string
  setName: string
  collectorNumber: string
  rarity: string
  illustrationId: string | null
  imageSmall: string | null
  imageNormal: string | null
  imageLarge: string | null
  imageArtCrop: string | null
  // Back face images for double-faced cards
  imageNormalBack: string | null
  imageLargeBack: string | null
  lang: string
  layout: string
  // Art variant fields
  isPromo: boolean
  isBooster: boolean
  frameEffects: string[]
  isFullArt: boolean
  isTextless: boolean
  isVariation: boolean
  // Card-specific prices
  priceEur: number | null
  priceEurFoil: number | null
  priceUsd: number | null
  priceUsdFoil: number | null
}

// Wantlist item data for wantlist-specific actions
interface WantlistItemData {
  id: string
  quantity: number
  priority: string
  isOrdered: boolean
  orderedAt: string | null
  isReceived: boolean
  receivedAt: string | null
  notes: string | null
}

interface DeckCardData {
  deckId: string
  cardId: string
  quantity: number
  category: string
}

interface CardDetailModalProps {
  card: CardWithPrice | null
  onClose: () => void
  onCardAddedToDeck?: () => void
  // Navigation props (legacy)
  cards?: CardWithPrice[]
  onNavigate?: (card: CardWithPrice) => void
  // Simple navigation props
  onPrev?: () => void
  onNext?: () => void
  currentIndex?: number
  totalCards?: number
  // Deck-specific props
  deckCard?: DeckCardData | null
  onDeckCardUpdate?: () => void
  onDeckCardRemoved?: () => void
  // Wantlist-specific props
  wantlistItem?: WantlistItemData | null
  onWantlistUpdate?: () => void
}

// Helper to convert version prices to PriceData format
function versionToPriceData(version: CardVersion): PriceData {
  return {
    eur: version.priceEur,
    eurFoil: version.priceEurFoil,
    usd: version.priceUsd,
    usdFoil: version.priceUsdFoil,
  }
}

// Helper to get a human-readable label for frame effects
function getFrameLabel(version: CardVersion): string | null {
  if (version.frameEffects?.includes('showcase')) return 'Showcase'
  if (version.frameEffects?.includes('extendedart')) return 'Extended Art'
  if (version.frameEffects?.includes('borderless')) return 'Borderless'
  if (version.frameEffects?.includes('etched')) return 'Etched'
  if (version.isFullArt) return 'Full Art'
  if (version.isTextless) return 'Textless'
  if (version.isPromo) return 'Promo'
  if (version.isVariation) return 'Variant'
  return null
}

// Helper to get icon for special versions
function getFrameIcon(version: CardVersion) {
  if (version.frameEffects?.includes('showcase')) return <Sparkles className="w-3 h-3" />
  if (version.frameEffects?.includes('borderless')) return <Crown className="w-3 h-3" />
  if (version.frameEffects?.includes('extendedart')) return <Star className="w-3 h-3" />
  if (version.isPromo) return <Star className="w-3 h-3" />
  return null
}

export function CardDetailModal({
  card,
  onClose,
  onCardAddedToDeck,
  cards,
  onNavigate,
  onPrev,
  onNext,
  currentIndex: propCurrentIndex,
  totalCards,
  deckCard,
  onDeckCardUpdate,
  onDeckCardRemoved,
  wantlistItem,
  onWantlistUpdate
}: CardDetailModalProps) {
  const [showAddToDeck, setShowAddToDeck] = useState(false)
  const [versions, setVersions] = useState<CardVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<CardVersion | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isQuickAdding, setIsQuickAdding] = useState(false)
  const [isWantlistUpdating, setIsWantlistUpdating] = useState(false)
  const [isDeckUpdating, setIsDeckUpdating] = useState(false)
  const [currentDeckQuantity, setCurrentDeckQuantity] = useState(deckCard?.quantity ?? 0)
  const { toast } = useToast()
  const { quickAdd, activeDeck, isReady: quickAddReady } = useQuickAdd()
  const { activeOwner } = useActiveOwner()

  // Sync deck quantity when deckCard prop changes
  useEffect(() => {
    setCurrentDeckQuantity(deckCard?.quantity ?? 0)
  }, [deckCard?.quantity])

  // Deck card handlers
  const handleDeckQuantityChange = async (newQuantity: number) => {
    if (!deckCard || isDeckUpdating) return
    if (newQuantity <= 0) {
      handleRemoveFromDeck()
      return
    }
    setIsDeckUpdating(true)
    setCurrentDeckQuantity(newQuantity)
    try {
      const response = await fetch(`/api/decks/${deckCard.deckId}/cards`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: deckCard.cardId,
          quantity: newQuantity,
          category: deckCard.category,
        }),
      })
      if (response.ok) {
        onDeckCardUpdate?.()
      } else {
        setCurrentDeckQuantity(deckCard.quantity)
        toast({ title: 'Error', description: 'Failed to update quantity', variant: 'destructive' })
      }
    } catch {
      setCurrentDeckQuantity(deckCard.quantity)
      toast({ title: 'Error', description: 'Failed to update quantity', variant: 'destructive' })
    } finally {
      setIsDeckUpdating(false)
    }
  }

  const handleRemoveFromDeck = async () => {
    if (!deckCard || isDeckUpdating) return
    setIsDeckUpdating(true)
    try {
      const response = await fetch(`/api/decks/${deckCard.deckId}/cards?cardId=${deckCard.cardId}&category=${deckCard.category}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast({
          title: 'Removed from deck',
          description: card?.printedName || card?.name,
        })
        onDeckCardRemoved?.()
      } else {
        toast({ title: 'Error', description: 'Failed to remove card', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to remove card', variant: 'destructive' })
    } finally {
      setIsDeckUpdating(false)
    }
  }

  // Calculate current index and navigation availability (support both legacy and simple props)
  const legacyCurrentIndex = cards && card ? cards.findIndex(c => c.id === card.id) : -1
  const currentIndex = propCurrentIndex ?? (legacyCurrentIndex >= 0 ? legacyCurrentIndex + 1 : undefined)
  const total = totalCards ?? cards?.length

  // Navigation availability
  const canGoPrev = onPrev ? true : (cards && legacyCurrentIndex > 0)
  const canGoNext = onNext ? true : (cards && legacyCurrentIndex >= 0 && legacyCurrentIndex < cards.length - 1)

  // Navigation handlers
  const goToPrev = useCallback(() => {
    if (onPrev) {
      onPrev()
    } else if (canGoPrev && cards && onNavigate && legacyCurrentIndex > 0) {
      onNavigate(cards[legacyCurrentIndex - 1])
    }
  }, [onPrev, canGoPrev, cards, legacyCurrentIndex, onNavigate])

  const goToNext = useCallback(() => {
    if (onNext) {
      onNext()
    } else if (canGoNext && cards && onNavigate && legacyCurrentIndex >= 0) {
      onNavigate(cards[legacyCurrentIndex + 1])
    }
  }, [onNext, canGoNext, cards, legacyCurrentIndex, onNavigate])

  // Handle quick add with keyboard shortcut and quantity
  const handleQuickAdd = useCallback(async (quantity: number = 1) => {
    if (!card || !quickAddReady || isQuickAdding) return
    
    const cardIdToAdd = selectedVersion?.id || card.id
    const cardNameToShow = selectedVersion?.printedName || selectedVersion?.name || card.printedName || card.name
    
    setIsQuickAdding(true)
    const success = await quickAdd(cardIdToAdd, cardNameToShow, quantity)
    setIsQuickAdding(false)
    
    if (success) {
      onCardAddedToDeck?.()
    }
  }, [card, selectedVersion, quickAdd, quickAddReady, isQuickAdding, onCardAddedToDeck])

  // Keyboard navigation and shortcuts
  useEffect(() => {
    if (!card) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is in an input or the add-to-deck modal is open
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        showAddToDeck
      ) {
        return
      }

      // A - Quick Add x1 to active deck
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        handleQuickAdd(1)
        return
      }

      // 1, 2, 3, 4 - Quick Add with specific quantity
      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault()
        handleQuickAdd(parseInt(e.key))
        return
      }

      // Navigation shortcuts only work if we have cards and onNavigate
      if (!cards || !onNavigate) return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [card, cards, onNavigate, goToPrev, goToNext, showAddToDeck, handleQuickAdd])

  // Fetch versions when card changes
  useEffect(() => {
    if (!card) {
      setVersions([])
      setSelectedVersion(null)
      return
    }

    const fetchVersions = async () => {
      setLoadingVersions(true)
      try {
        const response = await fetch(`/api/cards/${card.id}/versions`)
        if (response.ok) {
          const data = await response.json()
          setVersions(data.versions || [])
        }
      } catch (error) {
        console.error('Failed to fetch card versions:', error)
      } finally {
        setLoadingVersions(false)
      }
    }

    fetchVersions()
    setSelectedVersion(null)
    setIsFlipped(false) // Reset flip state when card changes
  }, [card])

  if (!card) return null

  // Check if card is double-faced
  const isDoubleFaced = selectedVersion 
    ? (selectedVersion.imageNormalBack || selectedVersion.imageLargeBack)
    : (card.imageNormalBack || card.imageLargeBack || ['transform', 'modal_dfc', 'double_faced_token', 'reversible_card'].includes(card.layout))

  // Get front and back images
  const frontImage = selectedVersion?.imageLarge || selectedVersion?.imageNormal || card.imageLarge || card.imageNormal
  const backImage = selectedVersion?.imageLargeBack || selectedVersion?.imageNormalBack || card.imageLargeBack || card.imageNormalBack

  // Use selected version for display, fallback to original card
  const displayImage = isFlipped && backImage ? backImage : frontImage
  const displaySetCode = selectedVersion?.setCode || card.setCode
  const displaySetName = selectedVersion?.setName || card.setName
  const displayCollectorNumber = selectedVersion?.collectorNumber || card.collectorNumber
  const displayRarity = selectedVersion?.rarity || card.rarity

  // Get prices - prefer selected version's specific prices, fallback to card's oracle price
  const displayPriceEur = selectedVersion?.priceEur ?? card.price?.eur ?? null
  const displayPriceEurFoil = selectedVersion?.priceEurFoil ?? card.price?.eurFoil ?? null
  const displayPriceUsd = selectedVersion?.priceUsd ?? card.price?.usd ?? null
  const displayPriceUsdFoil = selectedVersion?.priceUsdFoil ?? card.price?.usdFoil ?? null

  const manaSymbols = parseManaSymbols(card.manaCost)

  const handleAddToDeck = () => {
    setShowAddToDeck(true)
  }

  const handleAddToWantlist = async () => {
    // Use selected version's ID if available
    const cardIdToAdd = selectedVersion?.id || card.id
    const cardNameToShow = selectedVersion?.printedName || selectedVersion?.name || card.printedName || card.name

    try {
      const response = await fetch('/api/wantlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: cardIdToAdd,
          priority: 'medium',
          ownerId: activeOwner?.id || null,
        }),
      })

      if (response.ok) {
        toast({
          title: 'Added to Wantlist',
          description: `${cardNameToShow} (${displaySetCode.toUpperCase()}) has been added to your wantlist.`,
          variant: 'default',
        })
      } else {
        const data = await response.json()
        toast({
          title: 'Error',
          description: data.error || 'Failed to add to wantlist',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to add to wantlist',
        variant: 'destructive',
      })
    }
  }

  const handleAddToCollection = async () => {
    // Use selected version's ID if available
    const cardIdToAdd = selectedVersion?.id || card.id
    const cardNameToShow = selectedVersion?.printedName || selectedVersion?.name || card.printedName || card.name

    try {
      const response = await fetch('/api/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: cardIdToAdd,
          condition: 'nm',
          isFoil: false,
          ownerId: activeOwner?.id || null,
        }),
      })

      if (response.ok) {
        toast({
          title: 'Added to Collection',
          description: `${cardNameToShow} (${displaySetCode.toUpperCase()}) has been added to your collection.`,
          variant: 'default',
        })
      } else {
        const data = await response.json()
        toast({
          title: 'Error',
          description: data.error || 'Failed to add to collection',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to add to collection',
        variant: 'destructive',
      })
    }
  }

  const handleVersionClick = (version: CardVersion) => {
    // Toggle selection - if clicking the same version, deselect
    if (selectedVersion?.id === version.id) {
      setSelectedVersion(null)
    } else {
      setSelectedVersion(version)
      setIsFlipped(false) // Reset flip when changing version
    }
  }

  const handleFlip = () => {
    setIsFlipped(!isFlipped)
  }

  // Wantlist action handlers
  const handleMarkOrdered = async () => {
    if (!wantlistItem || isWantlistUpdating) return
    setIsWantlistUpdating(true)
    try {
      const response = await fetch('/api/wantlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: wantlistItem.id,
          isOrdered: !wantlistItem.isOrdered,
        }),
      })
      if (response.ok) {
        toast({
          title: wantlistItem.isOrdered ? 'Order cancelled' : 'Marked as ordered',
          description: card?.printedName || card?.name,
        })
        onWantlistUpdate?.()
      }
    } catch {
      toast({ title: 'Error', variant: 'destructive' })
    } finally {
      setIsWantlistUpdating(false)
    }
  }

  const handleMarkReceived = async () => {
    if (!wantlistItem || isWantlistUpdating) return
    setIsWantlistUpdating(true)
    try {
      const response = await fetch('/api/wantlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: wantlistItem.id,
          isReceived: !wantlistItem.isReceived,
        }),
      })
      if (response.ok) {
        toast({
          title: wantlistItem.isReceived ? 'Receipt cancelled' : 'Marked as received',
          description: card?.printedName || card?.name,
        })
        onWantlistUpdate?.()
      }
    } catch {
      toast({ title: 'Error', variant: 'destructive' })
    } finally {
      setIsWantlistUpdating(false)
    }
  }

  const handleMoveToCollection = async () => {
    if (!wantlistItem || !card || isWantlistUpdating) return
    setIsWantlistUpdating(true)
    try {
      // Add to collection
      const addResponse = await fetch('/api/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: card.id,
          quantity: wantlistItem.quantity,
          condition: 'nm',
          isFoil: false,
          ownerId: activeOwner?.id || null,
        }),
      })

      if (!addResponse.ok) {
        throw new Error('Failed to add to collection')
      }

      // Delete from wantlist
      const deleteResponse = await fetch(`/api/wantlist?id=${wantlistItem.id}`, {
        method: 'DELETE',
      })

      if (deleteResponse.ok) {
        toast({
          title: 'Moved to collection',
          description: `${wantlistItem.quantity}x ${card.printedName || card.name}`,
        })
        onWantlistUpdate?.()
        onClose()
      }
    } catch {
      toast({ title: 'Error', variant: 'destructive' })
    } finally {
      setIsWantlistUpdating(false)
    }
  }

  const handleDeleteFromWantlist = async () => {
    if (!wantlistItem || isWantlistUpdating) return
    setIsWantlistUpdating(true)
    try {
      const response = await fetch(`/api/wantlist?id=${wantlistItem.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast({
          title: 'Removed from wantlist',
          description: card?.printedName || card?.name,
        })
        onWantlistUpdate?.()
        onClose()
      }
    } catch {
      toast({ title: 'Error', variant: 'destructive' })
    } finally {
      setIsWantlistUpdating(false)
    }
  }

  const handleChangePriority = async (newPriority: string) => {
    if (!wantlistItem || isWantlistUpdating) return
    setIsWantlistUpdating(true)
    try {
      const response = await fetch('/api/wantlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: wantlistItem.id,
          priority: newPriority,
        }),
      })
      if (response.ok) {
        toast({
          title: 'Priority updated',
          description: `${card?.printedName || card?.name} → ${newPriority}`,
        })
        onWantlistUpdate?.()
      }
    } catch {
      toast({ title: 'Error', variant: 'destructive' })
    } finally {
      setIsWantlistUpdating(false)
    }
  }

  // Separate base versions from alternate arts
  const baseVersions = versions.filter(v => 
    v.isBooster && 
    !v.isPromo && 
    !v.isVariation &&
    (!v.frameEffects || v.frameEffects.length === 0 || 
     !v.frameEffects.some(f => ['showcase', 'extendedart', 'borderless', 'etched'].includes(f)))
  )
  const altArtVersions = versions.filter(v => !baseVersions.includes(v))

  const showNavigation = (onPrev || onNext) || (cards && cards.length > 1 && onNavigate)

  return (
    <Dialog open={!!card} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
        {/* Navigation Arrows */}
        {showNavigation && (
          <>
            {/* Left Arrow */}
            <button
              onClick={goToPrev}
              disabled={!canGoPrev}
              className={cn(
                "fixed left-2 sm:left-4 top-1/2 -translate-y-1/2 z-[60]",
                "w-10 h-10 sm:w-12 sm:h-12 rounded-full",
                "bg-dungeon-800/90 backdrop-blur-sm border-2 border-gold-600/40",
                "flex items-center justify-center",
                "transition-all duration-200",
                canGoPrev 
                  ? "text-gold-400 hover:bg-gold-600/20 hover:border-gold-500 hover:scale-110 active:scale-95" 
                  : "text-dungeon-600 cursor-not-allowed opacity-50"
              )}
              title="Previous card (←)"
            >
              <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>

            {/* Right Arrow */}
            <button
              onClick={goToNext}
              disabled={!canGoNext}
              className={cn(
                "fixed right-2 sm:right-4 top-1/2 -translate-y-1/2 z-[60]",
                "w-10 h-10 sm:w-12 sm:h-12 rounded-full",
                "bg-dungeon-800/90 backdrop-blur-sm border-2 border-gold-600/40",
                "flex items-center justify-center",
                "transition-all duration-200",
                canGoNext 
                  ? "text-gold-400 hover:bg-gold-600/20 hover:border-gold-500 hover:scale-110 active:scale-95" 
                  : "text-dungeon-600 cursor-not-allowed opacity-50"
              )}
              title="Next card (→)"
            >
              <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>

            {/* Card Counter */}
            {currentIndex !== undefined && total !== undefined && (
              <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] px-3 py-1.5 rounded-full bg-dungeon-800/90 backdrop-blur-sm border border-gold-600/30 text-xs sm:text-sm text-parchment-400">
                <span className="text-gold-400 font-medium">{currentIndex}</span>
                <span className="mx-1">/</span>
                <span>{total}</span>
              </div>
            )}
          </>
        )}

        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="text-base sm:text-lg">{card.printedName || card.name}</span>
            {manaSymbols.length > 0 && (
              <span className="flex gap-0.5">
                {manaSymbols.map((symbol, i) => (
                  <img
                    key={i}
                    src={getManaSymbolUrl(symbol)}
                    alt={symbol}
                    className="w-4 h-4 sm:w-5 sm:h-5"
                  />
                ))}
              </span>
            )}
          </DialogTitle>
          {card.printedName && card.printedName !== card.name && (
            <p className="text-xs sm:text-sm text-parchment-400">{card.name}</p>
          )}
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
          {/* Left Column: Card Image + Versions Gallery */}
          <div className="space-y-3 sm:space-y-4">
            {/* Main Card Image - Smaller on mobile */}
            <div className="relative aspect-[488/680] rounded-lg overflow-hidden bg-dungeon-800 max-w-[200px] sm:max-w-none mx-auto sm:mx-0">
              {displayImage ? (
                <Image
                  src={displayImage}
                  alt={card.name}
                  fill
                  className="object-contain"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-dungeon-500">
                  No image
                </div>
              )}
              
              {/* Frame effect badge on main image */}
              {selectedVersion && getFrameLabel(selectedVersion) && (
                <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-arcane-600/90 backdrop-blur-sm text-white text-[10px] sm:text-xs font-medium flex items-center gap-1">
                  {getFrameIcon(selectedVersion)}
                  {getFrameLabel(selectedVersion)}
                </div>
              )}
              
              {/* Flip indicator for double-faced cards */}
              {isDoubleFaced && backImage && (
                <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-gold-600/90 backdrop-blur-sm text-white text-[10px] sm:text-xs font-medium flex items-center gap-1">
                  <RotateCw className="w-3 h-3" />
                  {isFlipped ? 'Back' : 'Front'}
                </div>
              )}
            </div>
            
            {/* Flip Button for double-faced cards */}
            {isDoubleFaced && backImage && (
              <button
                onClick={handleFlip}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-gold-600/20 hover:bg-gold-600/30 border border-gold-600/40 text-gold-400 transition-colors"
              >
                <RotateCw className={cn(
                  "w-4 h-4 transition-transform duration-300",
                  isFlipped && "rotate-180"
                )} />
                <span className="text-sm font-medium">
                  {isFlipped ? 'View front' : 'Flip card'}
                </span>
              </button>
            )}

            {/* Base Versions Gallery - Responsive grid */}
            {baseVersions.length > 1 && (
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-parchment-400 mb-1.5 sm:mb-2 flex items-center gap-2">
                  Editions
                  <span className="text-[10px] sm:text-xs text-dungeon-400">({baseVersions.length})</span>
                  {loadingVersions && <Loader2 className="w-3 h-3 animate-spin" />}
                </h3>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 sm:gap-2 max-h-[100px] sm:max-h-[120px] overflow-y-auto pr-1">
                  {baseVersions.map((version) => {
                    const isSelected = selectedVersion?.id === version.id
                    const isOriginal = version.id === card.id && !selectedVersion
                    
                    return (
                      <button
                        key={version.id}
                        onClick={() => handleVersionClick(version)}
                        className={cn(
                          'relative aspect-[488/680] rounded overflow-hidden bg-dungeon-700 transition-all',
                          'active:scale-95',
                          isSelected && 'ring-2 ring-gold-400',
                          isOriginal && !selectedVersion && 'ring-2 ring-parchment-400/50'
                        )}
                        title={`${version.setName} (${version.setCode.toUpperCase()})`}
                      >
                        {version.imageSmall || version.imageNormal ? (
                          <Image
                            src={version.imageSmall || version.imageNormal!}
                            alt={`${version.name} - ${version.setCode}`}
                            fill
                            className="object-cover"
                            sizes="60px"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-[8px] text-dungeon-500">
                            ?
                          </div>
                        )}
                        {/* Set code + price overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-0.5 sm:p-1">
                          <span className="text-[7px] sm:text-[8px] text-parchment-200 uppercase font-medium block">
                            {version.setCode}
                          </span>
                          {getBestPrice(versionToPriceData(version)) && (
                            <span className="text-[6px] sm:text-[7px] text-gold-400 font-medium">
                              {formatBestPrice(versionToPriceData(version))}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Alternate Art Versions Gallery - Collapsible on mobile */}
            {altArtVersions.length > 0 && (
              <details className="group" open={altArtVersions.length <= 5}>
                <summary className="text-xs sm:text-sm font-semibold text-arcane-400 mb-1.5 sm:mb-2 flex items-center gap-2 cursor-pointer list-none">
                  <span className="group-open:rotate-90 transition-transform text-[10px]">▶</span>
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                  Alternate Arts
                  <span className="text-[10px] sm:text-xs text-dungeon-400">({altArtVersions.length})</span>
                </summary>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 sm:gap-2 max-h-[120px] sm:max-h-[180px] overflow-y-auto pr-1 mt-1.5">
                  {altArtVersions.map((version) => {
                    const isSelected = selectedVersion?.id === version.id
                    const frameLabel = getFrameLabel(version)
                    
                    return (
                      <button
                        key={version.id}
                        onClick={() => handleVersionClick(version)}
                        className={cn(
                          'relative aspect-[488/680] rounded overflow-hidden bg-dungeon-700 transition-all',
                          'active:scale-95',
                          isSelected && 'ring-2 ring-arcane-400',
                        )}
                        title={`${frameLabel ? `[${frameLabel}] ` : ''}${version.setCode.toUpperCase()}`}
                      >
                        {version.imageSmall || version.imageNormal ? (
                          <Image
                            src={version.imageSmall || version.imageNormal!}
                            alt={`${version.name} - ${version.setCode}`}
                            fill
                            className="object-cover"
                            sizes="60px"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-[8px] text-dungeon-500">
                            ?
                          </div>
                        )}
                        
                        {/* Frame effect indicator */}
                        {frameLabel && (
                          <div className="absolute top-0 right-0 p-0.5 bg-arcane-600/90 rounded-bl">
                            {getFrameIcon(version) || <Sparkles className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white" />}
                          </div>
                        )}
                        
                        {/* Set code + price overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-0.5 sm:p-1">
                          <span className="text-[7px] sm:text-[8px] text-parchment-200 uppercase font-medium block truncate">
                            {version.setCode}
                          </span>
                          {getBestPrice(versionToPriceData(version)) && (
                            <span className="text-[6px] sm:text-[7px] text-arcane-300 font-medium">
                              {formatBestPrice(versionToPriceData(version))}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </details>
            )}
            
            {loadingVersions && versions.length === 0 && (
              <div className="flex items-center justify-center py-3 sm:py-4 text-parchment-400 text-xs sm:text-sm">
                <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin mr-2" />
                Loading...
              </div>
            )}
          </div>

          {/* Right Column: Card Details */}
          <div className="space-y-3 sm:space-y-4">
            {/* Type Line */}
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-parchment-400 mb-0.5 sm:mb-1">Type</h3>
              <p className="text-parchment-200 text-sm sm:text-base">{card.printedTypeLine || card.typeLine}</p>
              {card.printedTypeLine && card.printedTypeLine !== card.typeLine && (
                <p className="text-[10px] sm:text-xs text-parchment-500 mt-0.5">{card.typeLine}</p>
              )}
            </div>

            {/* Card Text - Collapsible on mobile if long */}
            {(card.printedText || card.oracleText) && (
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-parchment-400 mb-0.5 sm:mb-1">Text</h3>
                <p className="text-parchment-200 whitespace-pre-line text-xs sm:text-sm max-h-[120px] sm:max-h-none overflow-y-auto">
                  {card.printedText || card.oracleText}
                </p>
                {card.printedText && card.oracleText && card.printedText !== card.oracleText && (
                  <details className="mt-1.5 sm:mt-2">
                    <summary className="text-[10px] sm:text-xs text-parchment-500 cursor-pointer hover:text-parchment-400">
                      Oracle Text (EN)
                    </summary>
                    <p className="text-parchment-400 whitespace-pre-line text-[10px] sm:text-xs mt-1 pl-2 border-l border-dungeon-600">
                      {card.oracleText}
                    </p>
                  </details>
                )}
              </div>
            )}

            {/* Flavor Text - Hidden on mobile by default */}
            {card.flavorText && (
              <details className="sm:block" open>
                <summary className="text-xs sm:text-sm font-semibold text-parchment-400 mb-0.5 sm:mb-1 cursor-pointer sm:cursor-default list-none sm:pointer-events-none">
                  <span className="sm:hidden text-[10px] mr-1">▶</span>
                  Flavor
                </summary>
                <p className="text-parchment-400 italic text-xs sm:text-sm">{card.flavorText}</p>
              </details>
            )}

            {/* Stats - Compact grid */}
            <div className="grid grid-cols-4 sm:grid-cols-2 gap-2 sm:gap-4">
              {/* Power/Toughness */}
              {(card.power || card.toughness) && (
                <div>
                  <h3 className="text-[10px] sm:text-sm font-semibold text-parchment-400 mb-0.5 sm:mb-1">P/T</h3>
                  <p className="text-parchment-200 text-sm sm:text-base">
                    {card.power}/{card.toughness}
                  </p>
                </div>
              )}

              {/* Loyalty */}
              {card.loyalty && (
                <div>
                  <h3 className="text-[10px] sm:text-sm font-semibold text-parchment-400 mb-0.5 sm:mb-1">Loyalty</h3>
                  <p className="text-parchment-200 text-sm sm:text-base">{card.loyalty}</p>
                </div>
              )}

              {/* CMC */}
              <div>
                <h3 className="text-[10px] sm:text-sm font-semibold text-parchment-400 mb-0.5 sm:mb-1">CMC</h3>
                <p className="text-parchment-200 text-sm sm:text-base">{card.cmc}</p>
              </div>

              {/* Rarity */}
              <div>
                <h3 className="text-[10px] sm:text-sm font-semibold text-parchment-400 mb-0.5 sm:mb-1">Rarity</h3>
                <p className={cn('capitalize text-sm sm:text-base', getRarityColor(displayRarity))}>
                  {displayRarity}
                </p>
              </div>
            </div>

            {/* Set Info - Updates based on selected version */}
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-parchment-400 mb-0.5 sm:mb-1">Set</h3>
              <p className="text-parchment-200 text-xs sm:text-base">
                {displaySetName} <span className="text-parchment-400">({displaySetCode.toUpperCase()}) #{displayCollectorNumber}</span>
              </p>
              {/* Show frame effect if selected version has one */}
              {selectedVersion && getFrameLabel(selectedVersion) && (
                <p className="text-[10px] sm:text-xs text-arcane-400 mt-0.5 flex items-center gap-1">
                  {getFrameIcon(selectedVersion)}
                  {getFrameLabel(selectedVersion)}
                </p>
              )}
            </div>

            {/* Prices Section - Enhanced with price comparison */}
            <PriceSection 
              versions={versions}
              selectedVersion={selectedVersion}
              card={card}
              displayPriceEur={displayPriceEur}
              displayPriceEurFoil={displayPriceEurFoil}
              displayPriceUsd={displayPriceUsd}
              displayPriceUsdFoil={displayPriceUsdFoil}
              onVersionSelect={handleVersionClick}
            />

            {/* Deck Actions - Only shown for deck items */}
            {deckCard && (
              <div className="bg-arcane-900/20 border border-arcane-600/30 rounded-lg p-3 sm:p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4 text-arcane-400" />
                  <h3 className="text-sm font-semibold text-arcane-300">In Deck</h3>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-arcane-600/30 text-arcane-300 capitalize">
                    {deckCard.category}
                  </span>
                </div>

                {/* Quantity controls */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-dungeon-800/50 rounded-lg p-1">
                    <button
                      onClick={() => handleDeckQuantityChange(currentDeckQuantity - 1)}
                      disabled={isDeckUpdating}
                      className="p-1.5 rounded hover:bg-dungeon-600 text-parchment-400 hover:text-parchment-200 transition-colors disabled:opacity-50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center text-parchment-200 font-medium text-sm">
                      {currentDeckQuantity}
                    </span>
                    <button
                      onClick={() => handleDeckQuantityChange(currentDeckQuantity + 1)}
                      disabled={isDeckUpdating}
                      className="p-1.5 rounded hover:bg-dungeon-600 text-parchment-400 hover:text-parchment-200 transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <Button
                    onClick={handleRemoveFromDeck}
                    disabled={isDeckUpdating}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-dragon-600/50 text-dragon-400 hover:bg-dragon-900/30"
                  >
                    {isDeckUpdating ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Trash2 className="w-3 h-3 mr-1" />
                    )}
                    Remove
                  </Button>
                </div>
              </div>
            )}

            {/* Wantlist Actions - Only shown for wantlist items */}
            {wantlistItem && (
              <div className="bg-pink-900/20 border border-pink-600/30 rounded-lg p-3 sm:p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-pink-400" fill="currentColor" />
                  <h3 className="text-sm font-semibold text-pink-300">Wantlist</h3>
                  <span className="text-xs text-pink-400/70">
                    {wantlistItem.quantity}x
                  </span>
                </div>

                {/* Status & Priority */}
                <div className="flex flex-wrap gap-2 text-xs">
                  {/* Priority selector */}
                  <div className="flex items-center gap-1 bg-dungeon-800/50 rounded px-2 py-1">
                    <span className="text-parchment-400">Priority:</span>
                    <select
                      value={wantlistItem.priority}
                      onChange={(e) => handleChangePriority(e.target.value)}
                      disabled={isWantlistUpdating}
                      className="bg-transparent text-parchment-200 text-xs focus:outline-none cursor-pointer"
                    >
                      <option value="high" className="bg-dungeon-800">High</option>
                      <option value="medium" className="bg-dungeon-800">Medium</option>
                      <option value="low" className="bg-dungeon-800">Low</option>
                    </select>
                  </div>

                  {/* Order status */}
                  {wantlistItem.isOrdered && (
                    <div className="flex items-center gap-1 bg-amber-900/30 text-amber-400 rounded px-2 py-1">
                      <ShoppingCart className="w-3 h-3" />
                      <span>Ordered</span>
                      {wantlistItem.orderedAt && (
                        <span className="text-amber-400/60">
                          • {new Date(wantlistItem.orderedAt).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Received status */}
                  {wantlistItem.isReceived && (
                    <div className="flex items-center gap-1 bg-emerald-900/30 text-emerald-400 rounded px-2 py-1">
                      <PackageCheck className="w-3 h-3" />
                      <span>Received</span>
                      {wantlistItem.receivedAt && (
                        <span className="text-emerald-400/60">
                          • {new Date(wantlistItem.receivedAt).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleMarkOrdered}
                    disabled={isWantlistUpdating}
                    variant={wantlistItem.isOrdered ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-8 text-xs",
                      wantlistItem.isOrdered
                        ? "bg-amber-600 hover:bg-amber-500 text-white"
                        : "border-amber-600/50 text-amber-400 hover:bg-amber-900/30"
                    )}
                  >
                    {isWantlistUpdating ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <ShoppingCart className="w-3 h-3 mr-1" />
                    )}
                    {wantlistItem.isOrdered ? 'Ordered' : 'Mark ordered'}
                  </Button>

                  <Button
                    onClick={handleMarkReceived}
                    disabled={isWantlistUpdating}
                    variant={wantlistItem.isReceived ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-8 text-xs",
                      wantlistItem.isReceived
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "border-emerald-600/50 text-emerald-400 hover:bg-emerald-900/30"
                    )}
                  >
                    {isWantlistUpdating ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <PackageCheck className="w-3 h-3 mr-1" />
                    )}
                    {wantlistItem.isReceived ? 'Received' : 'Mark received'}
                  </Button>

                  <Button
                    onClick={handleMoveToCollection}
                    disabled={isWantlistUpdating}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-arcane-600/50 text-arcane-400 hover:bg-arcane-900/30"
                  >
                    {isWantlistUpdating ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <ArrowRightCircle className="w-3 h-3 mr-1" />
                    )}
                    To collection
                  </Button>

                  <Button
                    onClick={handleDeleteFromWantlist}
                    disabled={isWantlistUpdating}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-dragon-600/50 text-dragon-400 hover:bg-dragon-900/30"
                  >
                    {isWantlistUpdating ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Trash2 className="w-3 h-3 mr-1" />
                    )}
                    Remove
                  </Button>
                </div>

                {/* Notes */}
                {wantlistItem.notes && (
                  <div className="text-xs text-parchment-400 italic bg-dungeon-800/30 rounded p-2">
                    {wantlistItem.notes}
                  </div>
                )}
              </div>
            )}

            {/* Actions - Stack on mobile */}
            <div className="flex flex-col sm:flex-row gap-2 pt-3 sm:pt-4 border-t border-dungeon-700">
              <div className="flex gap-2 flex-1 flex-wrap">
                {/* Quick Add with Quantity Buttons */}
                {quickAddReady && activeDeck && (
                  <div className="flex gap-1 items-center">
                    {/* Deck name indicator */}
                    <div className="flex items-center gap-1 px-2 py-1 bg-arcane-600/20 rounded-l-md border border-arcane-500/30 border-r-0">
                      <Zap className="w-3 h-3 text-arcane-400" />
                      <span className="text-xs text-arcane-300 truncate max-w-[60px] sm:max-w-[80px]">
                        {activeDeck.name}
                      </span>
                    </div>
                    {/* Quantity buttons */}
                    {[1, 2, 3, 4].map((qty, idx) => (
                      <Button
                        key={qty}
                        onClick={() => handleQuickAdd(qty)}
                        disabled={isQuickAdding}
                        size="sm"
                        className={cn(
                          "h-8 w-8 sm:h-9 sm:w-9 p-0 text-xs font-bold",
                          "bg-arcane-600 hover:bg-arcane-500 border-arcane-500/50",
                          idx === 0 && "rounded-l-none",
                          idx === 3 && "rounded-r-md",
                          idx > 0 && idx < 3 && "rounded-none"
                        )}
                        title={`Add x${qty} (key ${qty})`}
                      >
                        {isQuickAdding ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          `x${qty}`
                        )}
                      </Button>
                    ))}
                  </div>
                )}
                
                {/* Regular Add to Deck Button */}
                <Button 
                  onClick={handleAddToDeck} 
                  variant={quickAddReady ? "outline" : "default"}
                  className={cn(
                    "h-8 sm:h-9 text-sm",
                    quickAddReady ? "flex-shrink-0" : "flex-1"
                  )}
                  title="Choose a deck"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {!quickAddReady && "Deck"}
                </Button>
                
                <Button onClick={handleAddToCollection} variant="secondary" className="h-8 sm:h-9 text-sm flex-1 sm:flex-none">
                  <Archive className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Collection</span>
                </Button>
                <Button onClick={handleAddToWantlist} variant="secondary" className="h-8 sm:h-9 text-sm flex-1 sm:flex-none">
                  <Heart className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Wantlist</span>
                </Button>
              </div>
              <div className="flex gap-2 justify-center sm:justify-start">
                <Button
                  variant="outline"
                  size="icon"
                  asChild
                  title="Cardmarket"
                  className="h-9 w-9 sm:h-10 sm:w-10"
                >
                  <a
                    href={`https://www.cardmarket.com/en/Magic/Products/Search?searchString=${encodeURIComponent(card.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="text-xs font-bold">CM</span>
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  asChild
                  title="Scryfall"
                  className="h-9 w-9 sm:h-10 sm:w-10"
                >
                  <a
                    href={`https://scryfall.com/card/${displaySetCode}/${displayCollectorNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Add to Deck Modal - uses selected version if available */}
        <AddToDeckModal
          open={showAddToDeck}
          onClose={() => setShowAddToDeck(false)}
          cardId={selectedVersion?.id || card.id}
          cardName={selectedVersion?.printedName || selectedVersion?.name || card.printedName || card.name}
          onSuccess={onCardAddedToDeck}
        />
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Price Section Component
// ============================================
interface PriceSectionProps {
  versions: CardVersion[]
  selectedVersion: CardVersion | null
  card: CardWithPrice
  displayPriceEur: number | null
  displayPriceEurFoil: number | null
  displayPriceUsd: number | null
  displayPriceUsdFoil: number | null
  onVersionSelect: (version: CardVersion) => void
}

function PriceSection({ 
  versions, 
  selectedVersion, 
  card,
  displayPriceEur,
  displayPriceEurFoil,
  displayPriceUsd,
  displayPriceUsdFoil,
  onVersionSelect
}: PriceSectionProps) {
  // Calculate price statistics from all versions
  const pricesEur = versions
    .map(v => v.priceEur)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b)
  
  const pricesUsd = versions
    .map(v => v.priceUsd)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b)

  const hasAnyPrice = displayPriceEur || displayPriceEurFoil || displayPriceUsd || displayPriceUsdFoil || pricesEur.length > 0 || pricesUsd.length > 0

  if (!hasAnyPrice) {
    return (
      <div className="bg-dungeon-700/30 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-center">
        <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-dungeon-500 mx-auto mb-1" />
        <p className="text-xs sm:text-sm text-parchment-500">No price</p>
      </div>
    )
  }

  const minEur = pricesEur.length > 0 ? pricesEur[0] : null
  const maxEur = pricesEur.length > 0 ? pricesEur[pricesEur.length - 1] : null

  // Find cheapest version
  const cheapestVersionEur = versions.find(v => v.priceEur === minEur)

  // Versions with prices, sorted by price
  const versionsWithPrices = versions
    .filter(v => v.priceEur !== null || v.priceUsd !== null)
    .sort((a, b) => (a.priceEur ?? Infinity) - (b.priceEur ?? Infinity))

  return (
    <div className="space-y-2 sm:space-y-3">
      <h3 className="text-xs sm:text-sm font-semibold text-parchment-400 flex items-center gap-2">
        <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        Price
        {selectedVersion && (
          <span className="text-[10px] sm:text-xs text-arcane-400 font-normal">
            • {selectedVersion.setCode.toUpperCase()}
          </span>
        )}
      </h3>

      {/* Current/Selected Version Price - 2 columns on mobile */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        {displayPriceEur && (
          <div className="bg-dungeon-700/50 rounded px-2 sm:px-3 py-1.5 sm:py-2">
            <span className="text-[10px] sm:text-xs text-parchment-400">EUR</span>
            <p className="text-gold-400 font-semibold text-sm sm:text-base">
              {formatPrice(displayPriceEur, 'EUR')}
            </p>
          </div>
        )}
        {displayPriceEurFoil && (
          <div className="bg-dungeon-700/50 rounded px-2 sm:px-3 py-1.5 sm:py-2 border border-arcane-600/30">
            <span className="text-[10px] sm:text-xs text-parchment-400 flex items-center gap-1">
              Foil <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-arcane-400" />
            </span>
            <p className="text-gold-400 font-semibold text-sm sm:text-base">
              {formatPrice(displayPriceEurFoil, 'EUR')}
            </p>
          </div>
        )}
        {/* Only show USD on desktop or if no EUR */}
        {displayPriceUsd && !displayPriceEur && (
          <div className="bg-dungeon-700/50 rounded px-2 sm:px-3 py-1.5 sm:py-2">
            <span className="text-[10px] sm:text-xs text-parchment-400">USD</span>
            <p className="text-parchment-200 font-semibold text-sm sm:text-base">
              {formatPrice(displayPriceUsd, 'USD')}
            </p>
          </div>
        )}
      </div>

      {/* Price Range Summary - Compact on mobile */}
      {pricesEur.length > 1 && minEur !== maxEur && (
        <div className="bg-dungeon-800/50 rounded-lg p-2 sm:p-3 border border-dungeon-700">
          <div className="flex items-center justify-between text-[10px] sm:text-xs mb-1.5 sm:mb-2">
            <span className="text-parchment-400 flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-emerald-400" />
              Min
            </span>
            <span className="text-parchment-400 flex items-center gap-1">
              Max
              <TrendingUp className="w-3 h-3 text-dragon-400" />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-emerald-400 font-semibold text-xs sm:text-sm">{formatPrice(minEur, 'EUR')}</span>
            <div className="flex-1 mx-2 sm:mx-3 h-0.5 sm:h-1 bg-gradient-to-r from-emerald-600/50 via-gold-600/50 to-dragon-600/50 rounded" />
            <span className="text-dragon-400 font-semibold text-xs sm:text-sm">{formatPrice(maxEur, 'EUR')}</span>
          </div>
          {cheapestVersionEur && cheapestVersionEur.id !== (selectedVersion?.id || card.id) && (
            <button
              onClick={() => onVersionSelect(cheapestVersionEur)}
              className="mt-1.5 sm:mt-2 w-full text-[10px] sm:text-xs text-emerald-400 hover:text-emerald-300 flex items-center justify-center gap-1 py-1 rounded bg-emerald-900/20 active:bg-emerald-900/30 transition-colors"
            >
              <TrendingDown className="w-3 h-3" />
              Cheapest: {cheapestVersionEur.setCode.toUpperCase()}
            </button>
          )}
        </div>
      )}

      {/* Price Table by Version - Hidden by default on mobile */}
      {versionsWithPrices.length > 1 && (
        <details className="group">
          <summary className="text-[10px] sm:text-xs text-parchment-500 cursor-pointer hover:text-parchment-400 flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform">▶</span>
            Price by edition ({versionsWithPrices.length})
          </summary>
          <div className="mt-1.5 sm:mt-2 max-h-[150px] sm:max-h-[200px] overflow-y-auto">
            <table className="w-full text-[10px] sm:text-xs">
              <thead className="sticky top-0 bg-dungeon-800">
                <tr className="text-parchment-500 border-b border-dungeon-700">
                  <th className="text-left py-1 px-1.5 sm:px-2">Set</th>
                  <th className="text-right py-1 px-1.5 sm:px-2">EUR</th>
                  <th className="text-right py-1 px-1.5 sm:px-2 hidden sm:table-cell">USD</th>
                </tr>
              </thead>
              <tbody>
                {versionsWithPrices.map((version) => {
                  const isCheapest = version.priceEur === minEur
                  const isSelected = version.id === (selectedVersion?.id || card.id)
                  const frameLabel = getFrameLabel(version)
                  
                  return (
                    <tr 
                      key={version.id}
                      onClick={() => onVersionSelect(version)}
                      className={cn(
                        "border-b border-dungeon-700/50 cursor-pointer transition-colors",
                        isSelected 
                          ? "bg-gold-900/20" 
                          : "active:bg-dungeon-700/50"
                      )}
                    >
                      <td className="py-1 sm:py-1.5 px-1.5 sm:px-2">
                        <div className="flex items-center gap-1">
                          <span className={cn(
                            "uppercase font-medium",
                            isSelected ? "text-gold-400" : "text-parchment-300"
                          )}>
                            {version.setCode}
                          </span>
                          {frameLabel && (
                            <span className="text-[8px] sm:text-[10px] text-dungeon-400 hidden sm:inline">({frameLabel})</span>
                          )}
                          {isCheapest && !isSelected && (
                            <TrendingDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400" />
                          )}
                        </div>
                      </td>
                      <td className={cn(
                        "text-right py-1 sm:py-1.5 px-1.5 sm:px-2 font-medium",
                        isCheapest ? "text-emerald-400" : "text-parchment-300"
                      )}>
                        {version.priceEur ? formatPrice(version.priceEur, 'EUR') : '-'}
                      </td>
                      <td className="text-right py-1 sm:py-1.5 px-1.5 sm:px-2 text-parchment-400 hidden sm:table-cell">
                        {version.priceUsd ? formatPrice(version.priceUsd, 'USD') : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
