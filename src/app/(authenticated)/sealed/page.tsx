'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Package,
  RotateCcw,
  Layers,
  X,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PlaytestView } from '@/components/deck/playtest-view'
import { SealedSimulationStats } from '@/components/deck/sealed-simulation-stats'
import { CardWithPrice } from '@/types/scryfall'
import {
  BoosterOpening,
  MobilePoolCard,
  SealedDeckPanel,
  VisualDeckDisplay,
  HoverPreview,
  SetSelection,
  BASIC_LANDS,
  DEFAULT_BASIC_LANDS,
  RARITY_ORDER,
  COLOR_ORDER,
  SORT_OPTIONS,
  getCardTypeCategory,
  getColorCategory,
  sortByCMC,
} from '@/components/sealed'
import type { BoosterCard, GeneratedPool, SortKey } from '@/components/sealed'

// Convert BoosterCard to CardWithPrice for PlaytestView
function boosterCardToCardWithPrice(card: BoosterCard): CardWithPrice {
  return {
    id: card.id,
    oracleId: card.oracleId,
    name: card.name,
    printedName: card.printedName,
    lang: 'en',
    layout: card.layout,
    manaCost: card.manaCost,
    cmc: card.cmc,
    typeLine: card.typeLine,
    printedTypeLine: card.printedTypeLine,
    oracleText: card.oracleText,
    printedText: card.printedText,
    colors: card.colors,
    colorIdentity: card.colorIdentity,
    keywords: [],
    setCode: card.setCode,
    setName: card.setName,
    collectorNumber: '',
    rarity: card.rarity,
    imageNormal: card.imageNormal,
    imageLarge: card.imageLarge,
    imageNormalBack: card.imageNormalBack,
    imageLargeBack: card.imageLargeBack,
    power: card.power,
    toughness: card.toughness,
    loyalty: card.loyalty,
    legalities: {},
    games: [],
    syncedAt: new Date(),
  }
}

export default function SealedPage() {
  // State
  const [selectedSet, setSelectedSet] = useState<string>('')
  const [generatedPool, setGeneratedPool] = useState<GeneratedPool | null>(null)
  const [deck, setDeck] = useState<Map<string, number>>(new Map())
  const [showBoosterAnimation, setShowBoosterAnimation] = useState(false)
  const [currentBoosterIndex, setCurrentBoosterIndex] = useState(0)
  const [showDeckPanel, setShowDeckPanel] = useState(false)
  const [showPlaytest, setShowPlaytest] = useState(false)

  // Basic lands
  const [basicLands, setBasicLands] = useState<Record<string, number>>({ ...DEFAULT_BASIC_LANDS })

  const addBasicLand = useCallback((name: string) => {
    setBasicLands(prev => ({ ...prev, [name]: (prev[name] || 0) + 1 }))
  }, [])

  const removeBasicLand = useCallback((name: string) => {
    setBasicLands(prev => ({ ...prev, [name]: Math.max(0, (prev[name] || 0) - 1) }))
  }, [])

  const totalBasicLands = useMemo(() => Object.values(basicLands).reduce((a, b) => a + b, 0), [basicLands])

  // Sort
  const [sortBy, setSortBy] = useState<SortKey>('rarity')

  // Hover preview
  const [hoveredCard, setHoveredCard] = useState<BoosterCard | null>(null)
  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number } | null>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Visual deck display
  const [showVisualDeck, setShowVisualDeck] = useState(true)

  const handleCardHover = useCallback((card: BoosterCard | null, event?: React.MouseEvent) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    if (card && event) {
      const rect = (event.target as HTMLElement).getBoundingClientRect()
      const previewWidth = 280
      const previewHeight = 390
      const padding = 16
      let x = rect.right + padding
      let y = rect.top
      if (x + previewWidth > window.innerWidth - padding) {
        x = rect.left - previewWidth - padding
      }
      if (y + previewHeight > window.innerHeight - padding) {
        y = window.innerHeight - previewHeight - padding
      }
      if (y < padding) y = padding
      setPreviewPosition({ x, y })
      setHoveredCard(card)
    } else {
      hideTimeoutRef.current = setTimeout(() => {
        setHoveredCard(null)
        setPreviewPosition(null)
      }, 50)
    }
  }, [])

  // Fetch available sets
  const { data: setsData, isLoading: setsLoading } = useQuery({
    queryKey: ['sealed-sets'],
    queryFn: async () => {
      const res = await fetch('/api/sealed/sets')
      if (!res.ok) throw new Error('Failed to fetch sets')
      return res.json() as Promise<{ sets: import('@/components/sealed').SetInfo[] }>
    },
  })

  // Generate boosters mutation
  const generateMutation = useMutation({
    mutationFn: async (setCode: string) => {
      const res = await fetch('/api/sealed/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setCode }),
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
      setBasicLands({ ...DEFAULT_BASIC_LANDS })
      setShowBoosterAnimation(true)
      setCurrentBoosterIndex(0)
    },
  })

  // Sorted pool
  const sortedPool = useMemo(() => {
    if (!generatedPool) return []

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

    lands += totalBasicLands
    const avgCMC = nonLands > 0 ? totalCMC / nonLands : 0

    return { cmcChartData, avgCMC, lands, nonLands }
  }, [deckCards, totalBasicLands])

  // Convert deck cards for PlaytestView
  const playtestCards = useMemo(() => {
    const cards = deckCards.map(({ card, qty }) => ({
      id: card.oracleId,
      cardId: card.id,
      quantity: qty,
      category: getCardTypeCategory(card.typeLine) === 'land' ? 'land' : 'main',
      card: boosterCardToCardWithPrice(card),
    }))

    for (const [name, qty] of Object.entries(basicLands)) {
      if (qty > 0) {
        const land = BASIC_LANDS.find(l => l.name === name)!
        cards.push({
          id: `basic-${name.toLowerCase()}`,
          cardId: `basic-${name.toLowerCase()}`,
          quantity: qty,
          category: 'land' as const,
          card: {
            id: `basic-${name.toLowerCase()}`,
            oracleId: `basic-${name.toLowerCase()}`,
            name,
            printedName: null,
            lang: 'en',
            layout: 'normal',
            manaCost: null,
            cmc: 0,
            typeLine: `Basic Land \u2014 ${name}`,
            printedTypeLine: null,
            oracleText: null,
            printedText: null,
            colors: [],
            colorIdentity: [land.color],
            keywords: [],
            setCode: '',
            setName: '',
            collectorNumber: '',
            rarity: 'common',
            imageNormal: null,
            imageLarge: null,
            imageNormalBack: null,
            imageLargeBack: null,
            power: null,
            toughness: null,
            loyalty: null,
            legalities: {},
            games: [],
            syncedAt: new Date(),
          },
        })
      }
    }

    return cards
  }, [deckCards, basicLands])

  // Deck size
  const deckSize = useMemo(() => {
    let total = 0
    for (const qty of deck.values()) {
      total += qty
    }
    return total + totalBasicLands
  }, [deck, totalBasicLands])

  // Add/remove card from deck
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

    for (const [name, qty] of Object.entries(basicLands)) {
      if (qty > 0) lines.push(`${qty} ${name}`)
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sealed-deck-${generatedPool.setCode}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [deck, generatedPool, basicLands])

  return (
    <div className="min-h-screen pb-20 lg:pb-6">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-dungeon-900/95 backdrop-blur-sm border-b border-dungeon-700 px-3 py-3 lg:px-6 lg:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="w-6 h-6 text-gold-400 flex-shrink-0" />
            <h1 className="font-medieval text-xl lg:text-2xl text-gold-400 truncate">
              {generatedPool ? generatedPool.setName : 'Sealed'}
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
                  setBasicLands({ ...DEFAULT_BASIC_LANDS })
                }}
              >
                <RotateCcw className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">New</span>
              </Button>
            </div>
          )}
        </div>

        {/* Sort buttons */}
        {generatedPool && !showBoosterAnimation && (
          <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1">
            <span className="text-parchment-500 text-xs mr-1 flex-shrink-0">Sort:</span>
            {SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                  sortBy === key
                    ? "bg-gold-500 text-dungeon-900"
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
          <SetSelection
            sets={setsData?.sets}
            isLoading={setsLoading}
            selectedSet={selectedSet}
            onSelectedSetChange={setSelectedSet}
            onGenerate={(setCode) => generateMutation.mutate(setCode)}
            isGenerating={generateMutation.isPending}
            generateError={generateMutation.isError ? generateMutation.error?.message : undefined}
          />
        )}

        {/* Booster Opening Animation */}
        {showBoosterAnimation && generatedPool && (
          <BoosterOpening
            generatedPool={generatedPool}
            currentBoosterIndex={currentBoosterIndex}
            onBoosterIndexChange={setCurrentBoosterIndex}
            onFinish={() => setShowBoosterAnimation(false)}
          />
        )}

        {/* Deck Building Interface */}
        {generatedPool && !showBoosterAnimation && (
          <div className="lg:grid lg:grid-cols-[1fr,350px] lg:gap-6">
            {/* Pool Section */}
            <div>
              {/* Stats bar */}
              <div className="flex items-center gap-3 text-xs text-parchment-400 mb-3 flex-wrap">
                <span>{generatedPool.pool.length} cards</span>
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
                      onHover={handleCardHover}
                    />
                  )
                })}
              </div>

              {/* Visual Deck Display */}
              {(deckCards.length > 0 || totalBasicLands > 0) && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowVisualDeck(!showVisualDeck)}
                    className="flex items-center gap-2 mb-3 text-sm font-medium text-gold-400 hover:text-gold-300 transition-colors"
                  >
                    <Layers className="w-4 h-4" />
                    <span>Deck ({deckSize} cards)</span>
                    {showVisualDeck ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showVisualDeck && (
                    <VisualDeckDisplay deckCards={deckCards} basicLands={basicLands} onHover={handleCardHover} />
                  )}
                </div>
              )}

              {/* Simulation Stats */}
              {deckSize >= 7 && (
                <div className="mt-6">
                  <SealedSimulationStats
                    deckCards={deckCards}
                    basicLands={basicLands}
                    deckSize={deckSize}
                  />
                </div>
              )}
            </div>

            {/* Desktop Deck Panel */}
            <div className="hidden lg:block lg:sticky lg:top-32 lg:self-start space-y-4">
              <SealedDeckPanel
                deckSize={deckSize}
                deckCards={deckCards}
                deckStats={deckStats}
                generatedPool={generatedPool}
                basicLands={basicLands}
                onRemove={removeFromDeck}
                onAddBasicLand={addBasicLand}
                onRemoveBasicLand={removeBasicLand}
                onClear={() => { setDeck(new Map()); setBasicLands({ ...DEFAULT_BASIC_LANDS }) }}
                onExport={exportDeck}
                onPlaytest={() => setShowPlaytest(true)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Playtest Overlay */}
      {showPlaytest && generatedPool && (
        <div className="fixed inset-0 bg-dungeon-900 z-50 flex flex-col overflow-auto">
          <div className="flex items-center justify-between p-3 border-b border-dungeon-700 bg-dungeon-900/95">
            <h2 className="font-medieval text-lg text-gold-400">
              Playtest &mdash; {generatedPool.setName}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPlaytest(false)}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to deck
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <PlaytestView
              deckName={`Sealed ${generatedPool.setName}`}
              cards={playtestCards}
            />
          </div>
        </div>
      )}

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
              : "bg-gold-500 text-dungeon-900"
          )}
        >
          <div className="relative">
            <Layers className="w-6 h-6" />
            <span className="absolute -top-2 -right-2 bg-dungeon-900 text-gold-400 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {deckSize}
            </span>
          </div>
        </button>
      )}

      {/* Mobile Deck Panel */}
      {showDeckPanel && generatedPool && (
        <div className="lg:hidden fixed inset-0 z-50 bg-dungeon-900/95 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-dungeon-700">
            <h2 className="font-medieval text-xl text-gold-400">
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
            <SealedDeckPanel
              deckSize={deckSize}
              deckCards={deckCards}
              deckStats={deckStats}
              generatedPool={generatedPool}
              basicLands={basicLands}
              onRemove={removeFromDeck}
              onAddBasicLand={addBasicLand}
              onRemoveBasicLand={removeBasicLand}
              onClear={() => { setDeck(new Map()); setBasicLands({ ...DEFAULT_BASIC_LANDS }) }}
              onExport={exportDeck}
              onPlaytest={() => { setShowDeckPanel(false); setShowPlaytest(true) }}
              isMobile
            />
          </div>

          <div className="p-4 border-t border-dungeon-700">
            <Button
              onClick={() => setShowDeckPanel(false)}
              className="w-full btn-primary"
            >
              <ChevronUp className="w-5 h-5 mr-2" />
              Back to pool
            </Button>
          </div>
        </div>
      )}

      {/* Hover Preview Overlay */}
      <HoverPreview hoveredCard={hoveredCard} previewPosition={previewPosition} />

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
