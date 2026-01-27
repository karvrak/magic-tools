'use client'

import { useState, useMemo, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Package,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Layers,
  Play,
  Download,
  X,
  ChevronUp,
  Minus,
  Plus,
  AlertTriangle,
  BookOpen,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useActiveOwner } from '@/contexts/active-owner'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// Types
interface BoosterCard {
  id: string
  oracleId: string
  name: string
  printedName: string | null
  manaCost: string | null
  cmc: number
  typeLine: string
  printedTypeLine: string | null
  colors: string[]
  colorIdentity: string[]
  rarity: string
  imageNormal: string | null
  imageLarge: string | null
  imageNormalBack: string | null
  imageLargeBack: string | null
  power: string | null
  toughness: string | null
  loyalty: string | null
  oracleText: string | null
  printedText: string | null
  setCode: string
  setName: string
  layout: string
  slot: string
}

interface CollectionSetInfo {
  setCode: string
  setName: string
  totalCards: number
  availableCards: number
  commons: number
  uncommons: number
  rares: number
  mythics: number
  lands: number
  isViable: boolean
}

interface GeneratedPool {
  setCode: string
  setName: string
  pool: BoosterCard[]
  boosters: Array<{ packNumber: number; cards: BoosterCard[] }>
  stats: {
    commons: number
    uncommons: number
    rares: number
    mythics: number
    lands: number
  }
  collectionStats: {
    totalCommons: number
    totalUncommons: number
    totalRares: number
    totalMythics: number
    totalLands: number
  }
  warnings?: string[]
}

// Constants
const RARITY_ORDER = ['mythic', 'rare', 'uncommon', 'common']
const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G', 'multicolor', 'colorless']

const SORT_OPTIONS = [
  { key: 'rarity', label: 'Rareté' },
  { key: 'color', label: 'Couleur' },
  { key: 'cmc', label: 'CMC' },
  { key: 'type', label: 'Type' },
] as const

type SortKey = typeof SORT_OPTIONS[number]['key']

// Helpers
function getCardTypeCategory(typeLine: string): string {
  const lowerType = typeLine.toLowerCase()
  if (lowerType.includes('creature')) return 'creature'
  if (lowerType.includes('planeswalker')) return 'planeswalker'
  if (lowerType.includes('land')) return 'land'
  if (lowerType.includes('instant')) return 'instant'
  if (lowerType.includes('sorcery')) return 'sorcery'
  if (lowerType.includes('artifact')) return 'artifact'
  if (lowerType.includes('enchantment')) return 'enchantment'
  return 'other'
}

function getColorCategory(card: BoosterCard): string {
  if (card.colors.length > 1) return 'multicolor'
  if (card.colors.length === 0) return 'colorless'
  return card.colors[0]
}

function sortByCMC(a: BoosterCard, b: BoosterCard): number {
  return a.cmc - b.cmc || a.name.localeCompare(b.name)
}

// Deck Stats Component
function CMCTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-dungeon-800 border border-dungeon-600 rounded px-2 py-1 shadow-lg">
        <p className="text-parchment-200 text-xs">
          <span className="text-gold-400">CMC {label}:</span> {payload[0].value}
        </p>
      </div>
    )
  }
  return null
}

// Mobile Card Component
function MobilePoolCard({
  card,
  inDeckQty,
  maxQty,
  onAdd,
  onRemove,
}: {
  card: BoosterCard
  inDeckQty: number
  maxQty: number
  onAdd: () => void
  onRemove: () => void
}) {
  const [showBack, setShowBack] = useState(false)
  const hasBackFace = card.imageNormalBack || card.imageLargeBack
  const displayImage = showBack && hasBackFace
    ? (card.imageNormalBack || card.imageLargeBack)
    : (card.imageNormal || card.imageLarge)

  const isFullyInDeck = inDeckQty >= maxQty

  return (
    <div className="relative">
      {displayImage ? (
        <Image
          src={displayImage}
          alt={card.printedName || card.name}
          width={120}
          height={167}
          className={cn(
            "rounded-md shadow-md w-full h-auto",
            isFullyInDeck && "opacity-40 grayscale"
          )}
        />
      ) : (
        <div className="aspect-[5/7] bg-dungeon-700 rounded-md flex items-center justify-center">
          <span className="text-parchment-400 text-[10px] text-center px-1 leading-tight">
            {card.printedName || card.name}
          </span>
        </div>
      )}

      {/* Rarity indicator */}
      <div className={cn(
        "absolute top-1 right-1 w-2 h-2 rounded-full",
        card.rarity === 'mythic' && "bg-orange-500",
        card.rarity === 'rare' && "bg-yellow-500",
        card.rarity === 'uncommon' && "bg-gray-300",
        card.rarity === 'common' && "bg-gray-600",
      )} />

      {/* Quantity controls */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1 rounded-b-md">
        <div className="flex items-center justify-between">
          <button
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            disabled={inDeckQty === 0}
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold",
              inDeckQty > 0 ? "bg-red-500/80 active:bg-red-600" : "bg-dungeon-600/50"
            )}
          >
            <Minus className="w-3 h-3" />
          </button>

          <span className={cn(
            "text-xs font-bold",
            inDeckQty > 0 ? "text-gold-400" : "text-parchment-500"
          )}>
            {inDeckQty}/{maxQty}
          </span>

          <button
            onClick={(e) => { e.stopPropagation(); onAdd() }}
            disabled={isFullyInDeck}
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold",
              !isFullyInDeck ? "bg-green-500/80 active:bg-green-600" : "bg-dungeon-600/50"
            )}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Flip button for DFCs */}
      {hasBackFace && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowBack(!showBack)
          }}
          className="absolute top-1 left-1 bg-dungeon-900/80 text-parchment-200 p-1 rounded-full"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

// Main Page Component
export default function SealedCollectionPage() {
  // Context
  const { activeOwner } = useActiveOwner()

  // State
  const [selectedSet, setSelectedSet] = useState<string>('')
  const [generatedPool, setGeneratedPool] = useState<GeneratedPool | null>(null)
  const [deck, setDeck] = useState<Map<string, number>>(new Map())
  const [showBoosterAnimation, setShowBoosterAnimation] = useState(false)
  const [currentBoosterIndex, setCurrentBoosterIndex] = useState(0)
  const [showDeckPanel, setShowDeckPanel] = useState(false)

  // Sort
  const [sortBy, setSortBy] = useState<SortKey>('rarity')

  // Fetch available sets from collection
  const { data: setsData, isLoading: setsLoading } = useQuery({
    queryKey: ['sealed-collection-sets', activeOwner?.id],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (activeOwner?.id) params.set('ownerId', activeOwner.id)
      const res = await fetch(`/api/sealed/collection/sets?${params}`)
      if (!res.ok) throw new Error('Failed to fetch sets')
      return res.json() as Promise<{ sets: CollectionSetInfo[] }>
    },
  })

  // Filter to only viable sets and sort by card count
  const viableSets = useMemo(() => {
    if (!setsData?.sets) return []
    return setsData.sets.filter(s => s.isViable).sort((a, b) => b.totalCards - a.totalCards)
  }, [setsData])

  const nonViableSets = useMemo(() => {
    if (!setsData?.sets) return []
    return setsData.sets.filter(s => !s.isViable).sort((a, b) => b.totalCards - a.totalCards)
  }, [setsData])

  // Generate boosters mutation
  const generateMutation = useMutation({
    mutationFn: async (setCode: string) => {
      const res = await fetch('/api/sealed/collection/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setCode, ownerId: activeOwner?.id }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to generate pool')
      }
      return res.json() as Promise<GeneratedPool>
    },
    onSuccess: (data) => {
      setGeneratedPool(data)
      setDeck(new Map())
      setShowBoosterAnimation(true)
      setCurrentBoosterIndex(0)
    },
  })

  // Sorted pool
  const sortedPool = useMemo(() => {
    if (!generatedPool) return []

    // Group by oracleId
    const groups = new Map<string, { card: BoosterCard; quantity: number }>()
    for (const card of generatedPool.pool) {
      const existing = groups.get(card.oracleId)
      if (existing) {
        existing.quantity++
      } else {
        groups.set(card.oracleId, { card, quantity: 1 })
      }
    }

    const cards = Array.from(groups.values())

    // Sort
    switch (sortBy) {
      case 'rarity':
        cards.sort((a, b) => {
          const rarityDiff = RARITY_ORDER.indexOf(a.card.rarity) - RARITY_ORDER.indexOf(b.card.rarity)
          if (rarityDiff !== 0) return rarityDiff
          return sortByCMC(a.card, b.card)
        })
        break
      case 'color':
        cards.sort((a, b) => {
          const aColor = getColorCategory(a.card)
          const bColor = getColorCategory(b.card)
          const colorDiff = COLOR_ORDER.indexOf(aColor) - COLOR_ORDER.indexOf(bColor)
          if (colorDiff !== 0) return colorDiff
          return sortByCMC(a.card, b.card)
        })
        break
      case 'cmc':
        cards.sort((a, b) => sortByCMC(a.card, b.card))
        break
      case 'type':
        cards.sort((a, b) => {
          const typeOrder = ['creature', 'planeswalker', 'instant', 'sorcery', 'artifact', 'enchantment', 'land', 'other']
          const aType = getCardTypeCategory(a.card.typeLine)
          const bType = getCardTypeCategory(b.card.typeLine)
          const typeDiff = typeOrder.indexOf(aType) - typeOrder.indexOf(bType)
          if (typeDiff !== 0) return typeDiff
          return sortByCMC(a.card, b.card)
        })
        break
    }

    return cards
  }, [generatedPool, sortBy])

  // Deck cards
  const deckCards = useMemo(() => {
    if (!generatedPool) return []

    const cards: Array<{ card: BoosterCard; qty: number }> = []
    for (const [oracleId, qty] of deck) {
      const poolCard = generatedPool.pool.find(c => c.oracleId === oracleId)
      if (poolCard) {
        cards.push({ card: poolCard, qty })
      }
    }
    return cards.sort((a, b) => sortByCMC(a.card, b.card))
  }, [generatedPool, deck])

  // Deck stats
  const deckStats = useMemo(() => {
    const cmcData: Record<number, number> = {}
    let lands = 0
    let nonLands = 0
    let totalCMC = 0

    for (const { card, qty } of deckCards) {
      const typeCategory = getCardTypeCategory(card.typeLine)
      if (typeCategory === 'land') {
        lands += qty
      } else {
        nonLands += qty
        totalCMC += card.cmc * qty
        const cmc = Math.floor(card.cmc)
        const cmcKey = cmc >= 7 ? 7 : cmc
        cmcData[cmcKey] = (cmcData[cmcKey] || 0) + qty
      }
    }

    const cmcChartData = []
    for (let i = 0; i <= 7; i++) {
      cmcChartData.push({
        cmc: i === 7 ? '7+' : i.toString(),
        count: cmcData[i] || 0,
      })
    }

    const avgCMC = nonLands > 0 ? totalCMC / nonLands : 0

    return { cmcChartData, avgCMC, lands, nonLands }
  }, [deckCards])

  // Deck size
  const deckSize = useMemo(() => {
    let total = 0
    for (const qty of deck.values()) {
      total += qty
    }
    return total
  }, [deck])

  // Add card to deck
  const addToDeck = useCallback((oracleId: string, maxQty: number) => {
    setDeck(prev => {
      const newDeck = new Map(prev)
      const current = newDeck.get(oracleId) || 0
      if (current < maxQty) {
        newDeck.set(oracleId, current + 1)
      }
      return newDeck
    })
  }, [])

  // Remove card from deck
  const removeFromDeck = useCallback((oracleId: string) => {
    setDeck(prev => {
      const newDeck = new Map(prev)
      const current = newDeck.get(oracleId) || 0
      if (current <= 1) {
        newDeck.delete(oracleId)
      } else {
        newDeck.set(oracleId, current - 1)
      }
      return newDeck
    })
  }, [])

  // Export deck
  const exportDeck = useCallback(() => {
    if (!generatedPool) return

    const lines: string[] = []
    for (const [oracleId, qty] of deck) {
      const card = generatedPool.pool.find(c => c.oracleId === oracleId)
      if (card) {
        lines.push(`${qty} ${card.name}`)
      }
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sealed-collection-deck-${generatedPool.setCode}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [deck, generatedPool])

  // Selected set info
  const selectedSetInfo = useMemo(() => {
    if (!selectedSet || !setsData?.sets) return null
    return setsData.sets.find(s => s.setCode === selectedSet)
  }, [selectedSet, setsData])

  return (
    <div className="min-h-screen pb-20 lg:pb-6">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-dungeon-900/95 backdrop-blur-sm border-b border-dungeon-700 px-3 py-3 lg:px-6 lg:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-6 h-6 text-emerald-400 flex-shrink-0" />
            <h1 className="font-medieval text-xl lg:text-2xl text-emerald-400 truncate">
              {generatedPool ? generatedPool.setName : 'Sealed Collection'}
            </h1>
          </div>

          {generatedPool && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBoosterAnimation(true)}
                className="hidden sm:flex"
              >
                <Package className="w-4 h-4 mr-1" />
                Boosters
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setGeneratedPool(null)
                  setDeck(new Map())
                }}
              >
                <RotateCcw className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Nouveau</span>
              </Button>
            </div>
          )}
        </div>

        {/* Sort buttons - only when pool exists */}
        {generatedPool && !showBoosterAnimation && (
          <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1">
            <span className="text-parchment-500 text-xs mr-1 flex-shrink-0">Trier:</span>
            {SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                  sortBy === key
                    ? "bg-emerald-500 text-dungeon-900"
                    : "bg-dungeon-700 text-parchment-300 active:bg-dungeon-600"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-3 py-4 lg:px-6">
        {/* Set Selection */}
        {!generatedPool && (
          <div className="card-frame p-4 lg:p-6 max-w-lg mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              <h2 className="font-medieval text-lg text-emerald-400">Sealed avec ta collection</h2>
            </div>

            <p className="text-parchment-400 text-sm mb-4">
              Ouvre des boosters avec les cartes de ta collection. Les cartes dans tes decks sont exclues.
            </p>

            {activeOwner && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-dungeon-800 rounded-lg">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: activeOwner.color }}
                />
                <span className="text-parchment-200 text-sm">{activeOwner.name}</span>
              </div>
            )}

            {setsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Sparkles className="w-6 h-6 text-emerald-400 animate-pulse" />
                <span className="ml-2 text-parchment-400">Chargement...</span>
              </div>
            ) : viableSets.length === 0 && nonViableSets.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-parchment-600 mx-auto mb-3" />
                <p className="text-parchment-400 mb-4">
                  Aucune carte dans ta collection.
                </p>
                <Link href="/collection" className="text-emerald-400 underline text-sm">
                  Ajouter des cartes
                </Link>
              </div>
            ) : (
              <>
                <select
                  value={selectedSet}
                  onChange={(e) => setSelectedSet(e.target.value)}
                  className="w-full bg-dungeon-800 border border-dungeon-600 rounded-lg px-3 py-3 text-parchment-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
                >
                  <option value="">-- Sélectionne un set --</option>
                  {viableSets.length > 0 && (
                    <optgroup label="Sets disponibles">
                      {viableSets.map((set) => (
                        <option key={set.setCode} value={set.setCode}>
                          {set.setName} ({set.totalCards} cartes)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {nonViableSets.length > 0 && (
                    <optgroup label="Sets incomplets">
                      {nonViableSets.map((set) => (
                        <option key={set.setCode} value={set.setCode}>
                          {set.setName} ({set.totalCards} cartes)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {/* Set details */}
                {selectedSetInfo && (
                  <div className="bg-dungeon-800 rounded-lg p-3 mb-4 text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-parchment-300 font-medium">{selectedSetInfo.setName}</span>
                      {selectedSetInfo.isViable ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs">
                          <Check className="w-3 h-3" /> Prêt
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-400 text-xs">
                          <AlertTriangle className="w-3 h-3" /> Incomplet
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-2 text-xs">
                      <div className="text-center">
                        <div className="text-gray-500 font-bold">{selectedSetInfo.commons}</div>
                        <div className="text-parchment-500">C</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-300 font-bold">{selectedSetInfo.uncommons}</div>
                        <div className="text-parchment-500">U</div>
                      </div>
                      <div className="text-center">
                        <div className="text-yellow-400 font-bold">{selectedSetInfo.rares}</div>
                        <div className="text-parchment-500">R</div>
                      </div>
                      <div className="text-center">
                        <div className="text-orange-400 font-bold">{selectedSetInfo.mythics}</div>
                        <div className="text-parchment-500">M</div>
                      </div>
                      <div className="text-center">
                        <div className="text-green-400 font-bold">{selectedSetInfo.lands}</div>
                        <div className="text-parchment-500">T</div>
                      </div>
                    </div>
                    {!selectedSetInfo.isViable && (
                      <p className="text-amber-400 text-xs mt-2">
                        Pas assez de cartes pour un sealed complet. Les boosters seront partiellement remplis.
                      </p>
                    )}
                  </div>
                )}

                <Button
                  onClick={() => selectedSet && generateMutation.mutate(selectedSet)}
                  disabled={!selectedSet || generateMutation.isPending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                      Ouverture...
                    </>
                  ) : (
                    <>
                      <Package className="w-5 h-5 mr-2" />
                      Ouvrir 6 Boosters
                    </>
                  )}
                </Button>

                {generateMutation.isError && (
                  <p className="text-red-400 mt-3 text-center text-sm">
                    {generateMutation.error?.message}
                  </p>
                )}

                <div className="mt-4 pt-4 border-t border-dungeon-700">
                  <Link
                    href="/sealed"
                    className="flex items-center justify-center gap-2 text-parchment-400 text-sm hover:text-parchment-200"
                  >
                    <Package className="w-4 h-4" />
                    Simulateur de sealed (toutes cartes)
                  </Link>
                </div>
              </>
            )}
          </div>
        )}

        {/* Booster Opening Animation */}
        {showBoosterAnimation && generatedPool && (
          <div className="fixed inset-0 bg-dungeon-900/98 z-50 flex flex-col">
            {/* Header */}
            <div className="text-center py-4 border-b border-dungeon-700">
              <h2 className="font-medieval text-xl text-emerald-400">
                Booster {currentBoosterIndex + 1} / 6
              </h2>
              <p className="text-parchment-400 text-sm">{generatedPool.setName}</p>
            </div>

            {/* Warnings */}
            {generatedPool.warnings && generatedPool.warnings.length > 0 && currentBoosterIndex === 0 && (
              <div className="mx-4 mt-3 p-3 bg-amber-900/30 border border-amber-700 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-amber-200 text-xs">
                    {generatedPool.warnings.map((w, i) => (
                      <p key={i}>{w}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Cards */}
            <div className="flex-1 overflow-auto p-3">
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2 max-w-4xl mx-auto">
                {generatedPool.boosters[currentBoosterIndex]?.cards.map((card, idx) => (
                  <div
                    key={`${card.id}-${idx}`}
                    className="transition-all duration-300"
                    style={{
                      animationDelay: `${idx * 50}ms`,
                      animation: 'fadeInUp 0.3s ease-out forwards',
                    }}
                  >
                    {card.imageNormal ? (
                      <Image
                        src={card.imageNormal}
                        alt={card.printedName || card.name}
                        width={120}
                        height={167}
                        className={cn(
                          "rounded-md shadow-lg w-full h-auto",
                          card.rarity === 'mythic' && "ring-2 ring-orange-500",
                          card.rarity === 'rare' && "ring-2 ring-yellow-500",
                        )}
                      />
                    ) : (
                      <div className="aspect-[5/7] bg-dungeon-700 rounded-md flex items-center justify-center text-[10px] text-parchment-400 p-1 text-center">
                        {card.printedName || card.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="p-4 border-t border-dungeon-700 bg-dungeon-900">
              <div className="flex justify-center gap-3 max-w-md mx-auto">
                <Button
                  onClick={() => setCurrentBoosterIndex(prev => prev - 1)}
                  disabled={currentBoosterIndex === 0}
                  variant="outline"
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Préc.
                </Button>

                {currentBoosterIndex < 5 ? (
                  <Button
                    onClick={() => setCurrentBoosterIndex(prev => prev + 1)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Suiv.
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => setShowBoosterAnimation(false)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Layers className="w-4 h-4 mr-1" />
                    Construire
                  </Button>
                )}
              </div>

              <button
                onClick={() => setShowBoosterAnimation(false)}
                className="block mx-auto mt-3 text-parchment-500 text-sm underline"
              >
                Passer
              </button>
            </div>
          </div>
        )}

        {/* Deck Building Interface */}
        {generatedPool && !showBoosterAnimation && (
          <div className="lg:grid lg:grid-cols-[1fr,350px] lg:gap-6">
            {/* Pool Section */}
            <div>
              {/* Stats bar */}
              <div className="flex items-center gap-3 text-xs text-parchment-400 mb-3 flex-wrap">
                <span>{generatedPool.pool.length} cartes</span>
                <span className="text-orange-400">{generatedPool.stats.mythics}M</span>
                <span className="text-yellow-400">{generatedPool.stats.rares}R</span>
                <span className="text-gray-300">{generatedPool.stats.uncommons}U</span>
                <span className="text-gray-500">{generatedPool.stats.commons}C</span>
              </div>

              {/* Pool Cards Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {sortedPool.map(({ card, quantity }) => {
                  const inDeckQty = deck.get(card.oracleId) || 0
                  return (
                    <MobilePoolCard
                      key={card.oracleId}
                      card={card}
                      inDeckQty={inDeckQty}
                      maxQty={quantity}
                      onAdd={() => addToDeck(card.oracleId, quantity)}
                      onRemove={() => removeFromDeck(card.oracleId)}
                    />
                  )
                })}
              </div>
            </div>

            {/* Desktop Deck Panel */}
            <div className="hidden lg:block lg:sticky lg:top-32 lg:self-start space-y-4">
              <DeckPanel
                deckSize={deckSize}
                deckCards={deckCards}
                deckStats={deckStats}
                generatedPool={generatedPool}
                onRemove={removeFromDeck}
                onClear={() => setDeck(new Map())}
                onExport={exportDeck}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile Deck FAB */}
      {generatedPool && !showBoosterAnimation && (
        <button
          onClick={() => setShowDeckPanel(true)}
          className={cn(
            "lg:hidden fixed bottom-4 right-4 z-40",
            "w-14 h-14 rounded-full shadow-lg",
            "flex items-center justify-center",
            "transition-all active:scale-95",
            deckSize >= 40
              ? "bg-green-500 text-white"
              : "bg-emerald-500 text-white"
          )}
        >
          <div className="relative">
            <Layers className="w-6 h-6" />
            <span className="absolute -top-2 -right-2 bg-dungeon-900 text-emerald-400 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {deckSize}
            </span>
          </div>
        </button>
      )}

      {/* Mobile Deck Panel */}
      {showDeckPanel && generatedPool && (
        <div className="lg:hidden fixed inset-0 z-50 bg-dungeon-900/95 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-dungeon-700">
            <h2 className="font-medieval text-xl text-emerald-400">
              Deck ({deckSize}/40+)
            </h2>
            <button
              onClick={() => setShowDeckPanel(false)}
              className="p-2 text-parchment-400"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            <DeckPanel
              deckSize={deckSize}
              deckCards={deckCards}
              deckStats={deckStats}
              generatedPool={generatedPool}
              onRemove={removeFromDeck}
              onClear={() => setDeck(new Map())}
              onExport={exportDeck}
              isMobile
            />
          </div>

          <div className="p-4 border-t border-dungeon-700">
            <Button
              onClick={() => setShowDeckPanel(false)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <ChevronUp className="w-5 h-5 mr-2" />
              Retour au pool
            </Button>
          </div>
        </div>
      )}

      {/* Animation styles */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

// Deck Panel Component
function DeckPanel({
  deckSize,
  deckCards,
  deckStats,
  generatedPool,
  onRemove,
  onClear,
  onExport,
  isMobile = false,
}: {
  deckSize: number
  deckCards: Array<{ card: BoosterCard; qty: number }>
  deckStats: { cmcChartData: Array<{ cmc: string; count: number }>; avgCMC: number; lands: number; nonLands: number }
  generatedPool: GeneratedPool
  onRemove: (oracleId: string) => void
  onClear: () => void
  onExport: () => void
  isMobile?: boolean
}) {
  return (
    <div className="space-y-4">
      {/* Deck Status */}
      <div className={cn(
        "text-sm font-medium px-3 py-2 rounded",
        deckSize >= 40
          ? "bg-green-900/30 text-green-400"
          : "bg-yellow-900/30 text-yellow-400"
      )}>
        {deckSize >= 40 ? (
          <>Deck valide ({deckSize} cartes)</>
        ) : (
          <>Il manque {40 - deckSize} cartes</>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="bg-dungeon-700 rounded p-2 text-center">
          <div className="text-emerald-400 font-bold">{deckStats.lands}</div>
          <div className="text-parchment-500 text-xs">Terrains</div>
        </div>
        <div className="bg-dungeon-700 rounded p-2 text-center">
          <div className="text-emerald-400 font-bold">{deckStats.nonLands}</div>
          <div className="text-parchment-500 text-xs">Sorts</div>
        </div>
        <div className="bg-dungeon-700 rounded p-2 text-center">
          <div className="text-emerald-400 font-bold">{deckStats.avgCMC.toFixed(1)}</div>
          <div className="text-parchment-500 text-xs">CMC moy.</div>
        </div>
      </div>

      {/* Mana Curve */}
      {deckSize > 0 && (
        <div className="bg-dungeon-800 rounded-lg p-3">
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deckStats.cmcChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <XAxis
                  dataKey="cmc"
                  tick={{ fill: '#a8a29e', fontSize: 9 }}
                  axisLine={{ stroke: '#44403c' }}
                />
                <YAxis
                  tick={{ fill: '#a8a29e', fontSize: 9 }}
                  axisLine={{ stroke: '#44403c' }}
                  allowDecimals={false}
                  width={20}
                />
                <Tooltip content={<CMCTooltip />} />
                <Bar dataKey="count" fill="#10b981" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Deck Cards List */}
      <div className={cn(
        "bg-dungeon-800 rounded-lg overflow-hidden",
        isMobile ? "max-h-[40vh]" : "max-h-[300px]"
      )}>
        {deckCards.length === 0 ? (
          <p className="text-parchment-500 text-center py-6 text-sm">
            Ajoute des cartes depuis le pool
          </p>
        ) : (
          <div className="overflow-y-auto max-h-full divide-y divide-dungeon-700">
            {deckCards.map(({ card, qty }) => (
              <div
                key={card.oracleId}
                className="flex items-center gap-2 px-3 py-2 hover:bg-dungeon-700/50"
              >
                <span className="text-emerald-400 font-bold text-sm w-5">{qty}x</span>
                <span className={cn(
                  "w-2.5 h-2.5 rounded-full flex-shrink-0",
                  card.rarity === 'mythic' && "bg-orange-500",
                  card.rarity === 'rare' && "bg-yellow-500",
                  card.rarity === 'uncommon' && "bg-gray-300",
                  card.rarity === 'common' && "bg-gray-600",
                )} />
                <span className="text-parchment-200 text-sm flex-1 truncate">
                  {card.printedName || card.name}
                </span>
                <span className="text-parchment-500 text-xs w-4 text-right">
                  {card.cmc > 0 ? Math.floor(card.cmc) : ''}
                </span>
                <button
                  onClick={() => onRemove(card.oracleId)}
                  className="text-red-400 hover:text-red-300 p-1"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          disabled={deckCards.length === 0}
          className="flex-1"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Vider
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          disabled={deckCards.length === 0}
          className="flex-1"
        >
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>
      </div>

      {/* Playtest Button */}
      {deckSize >= 40 && (
        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled>
          <Play className="w-4 h-4 mr-2" />
          Tester (bientôt)
        </Button>
      )}
    </div>
  )
}
