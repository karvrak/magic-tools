'use client'

import { use, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { Layers, Scroll, Sparkles, ExternalLink } from 'lucide-react'
import { formatPrice, getBestPrice, getRarityColor } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface SharedCard {
  quantity: number
  category: string
  card: {
    name: string
    printedName: string | null
    manaCost: string | null
    cmc: number
    typeLine: string
    printedTypeLine: string | null
    rarity: string
    setCode: string
    setName: string
    imageSmall: string | null
    imageNormal: string | null
    colors: string[]
    colorIdentity: string[]
    power: string | null
    toughness: string | null
    loyalty: string | null
    price: {
      eur: number | null
      eurFoil: number | null
      usd: number | null
      usdFoil: number | null
    } | null
  }
}

interface SharedDeck {
  name: string
  description: string | null
  format: string | null
  coverImage: string | null
  owner: { name: string; color: string } | null
  tags: { name: string; color: string }[]
  cards: SharedCard[]
  totalPrice: number
}

export default function SharedDeckPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const { data, isLoading, error } = useQuery<{ deck: SharedDeck }>({
    queryKey: ['shared-deck', token],
    queryFn: async () => {
      const response = await fetch(`/api/shared/${token}`)
      if (!response.ok) throw new Error('Deck not found')
      return response.json()
    },
  })

  const deck = data?.deck

  const stats = useMemo(() => {
    if (!deck) return null
    const mainboard = deck.cards.filter((c) => c.category === 'mainboard')
    const sideboard = deck.cards.filter((c) => c.category === 'sideboard')
    const commander = deck.cards.filter((c) => c.category === 'commander')

    const totalMainboard = mainboard.reduce((s, c) => s + c.quantity, 0)
    const totalSideboard = sideboard.reduce((s, c) => s + c.quantity, 0)
    const totalCommander = commander.reduce((s, c) => s + c.quantity, 0)
    const totalCards = totalMainboard + totalSideboard + totalCommander

    // Count lands
    const lands = mainboard.filter((c) =>
      c.card.typeLine.toLowerCase().includes('land')
    )
    const totalLands = lands.reduce((s, c) => s + c.quantity, 0)

    return { totalCards, totalMainboard, totalSideboard, totalCommander, totalLands }
  }, [deck])

  const groupedCards = useMemo(() => {
    if (!deck) return {}
    const groups: Record<string, SharedCard[]> = {}
    for (const card of deck.cards) {
      const cat = card.category
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(card)
    }
    return groups
  }, [deck])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dungeon-950 flex items-center justify-center">
        <div className="text-center">
          <Scroll className="w-12 h-12 text-gold-500 animate-pulse mx-auto mb-4" />
          <p className="text-parchment-400">Loading deck...</p>
        </div>
      </div>
    )
  }

  if (error || !deck) {
    return (
      <div className="min-h-screen bg-dungeon-950 flex items-center justify-center">
        <div className="text-center">
          <Layers className="w-12 h-12 text-dungeon-600 mx-auto mb-4" />
          <h1 className="text-xl text-parchment-200 mb-2">Deck not found</h1>
          <p className="text-parchment-500">This shared link may have been revoked or is invalid.</p>
        </div>
      </div>
    )
  }

  const categoryOrder = ['commander', 'mainboard', 'sideboard', 'maybeboard']
  const categoryLabels: Record<string, string> = {
    commander: 'Commander',
    mainboard: 'Mainboard',
    sideboard: 'Sideboard',
    maybeboard: 'Maybeboard',
  }

  return (
    <div className="min-h-screen bg-dungeon-950">
      {/* Header */}
      <header className="border-b-2 border-gold-700/30 bg-dungeon-900/98 backdrop-blur-md">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gold-600/50 to-transparent" />
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold-500 via-gold-600 to-gold-700 flex items-center justify-center">
              <Scroll className="w-5 h-5 text-dungeon-900" />
            </div>
            <div>
              <span className="font-display text-lg text-gold-400 tracking-wide">magicTools</span>
              <p className="text-xs text-dungeon-400 -mt-0.5">Shared Deck</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Deck Header */}
        <div className="flex gap-4 mb-6">
          {deck.coverImage && (
            <div className="relative w-20 h-28 rounded-lg overflow-hidden border-2 border-dungeon-600 flex-shrink-0">
              <Image
                src={deck.coverImage}
                alt={deck.name}
                fill
                className="object-cover"
                sizes="80px"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-display text-gold-400 mb-1 truncate">{deck.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-parchment-400">
              {deck.format && (
                <span className="px-2 py-0.5 rounded bg-dungeon-800 border border-dungeon-600 capitalize">
                  {deck.format}
                </span>
              )}
              {deck.owner && (
                <span style={{ color: deck.owner.color }}>
                  by {deck.owner.name}
                </span>
              )}
            </div>
            {deck.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {deck.tags.map((tag) => (
                  <span
                    key={tag.name}
                    className="px-2 py-0.5 rounded-full text-xs border"
                    style={{ color: tag.color, borderColor: tag.color + '40' }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
            {deck.description && (
              <p className="text-sm text-parchment-500 mt-2">{deck.description}</p>
            )}
          </div>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-dungeon-800 border border-dungeon-600 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gold-400">{stats.totalCards}</p>
              <p className="text-xs text-parchment-500">Cards</p>
            </div>
            <div className="bg-dungeon-800 border border-dungeon-600 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{stats.totalLands}</p>
              <p className="text-xs text-parchment-500">Lands</p>
            </div>
            <div className="bg-dungeon-800 border border-dungeon-600 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-arcane-400">{stats.totalMainboard - stats.totalLands}</p>
              <p className="text-xs text-parchment-500">Spells</p>
            </div>
            <div className="bg-dungeon-800 border border-dungeon-600 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gold-400">{formatPrice(deck.totalPrice)}</p>
              <p className="text-xs text-parchment-500">Value</p>
            </div>
          </div>
        )}

        {/* Card List by Category */}
        {categoryOrder.map((cat) => {
          const cards = groupedCards[cat]
          if (!cards || cards.length === 0) return null
          const total = cards.reduce((s, c) => s + c.quantity, 0)

          return (
            <section key={cat} className="mb-6">
              <h2 className="text-sm font-semibold text-parchment-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                {categoryLabels[cat] || cat}
                <span className="text-parchment-600">({total})</span>
              </h2>
              <div className="bg-dungeon-800 border border-dungeon-600 rounded-lg overflow-hidden divide-y divide-dungeon-700">
                {cards.map((dc, i) => {
                  const card = dc.card
                  const best = getBestPrice(card.price)
                  const displayName = card.printedName || card.name

                  return (
                    <div
                      key={`${cat}-${i}`}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-dungeon-700/50 transition-colors"
                    >
                      {/* Quantity */}
                      <span className="text-sm font-mono text-parchment-400 w-6 text-right flex-shrink-0">
                        {dc.quantity}x
                      </span>

                      {/* Card image thumbnail */}
                      {card.imageSmall && (
                        <div className="relative w-8 h-11 rounded overflow-hidden flex-shrink-0">
                          <Image
                            src={card.imageSmall}
                            alt={displayName}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        </div>
                      )}

                      {/* Card info */}
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm truncate', getRarityColor(card.rarity))}>
                          {displayName}
                        </p>
                        <p className="text-xs text-parchment-600 truncate">
                          {card.printedTypeLine || card.typeLine}
                          <span className="ml-2 opacity-60">{card.setCode.toUpperCase()}</span>
                        </p>
                      </div>

                      {/* Mana cost */}
                      {card.manaCost && (
                        <span className="text-xs text-parchment-500 hidden sm:block flex-shrink-0">
                          {card.manaCost}
                        </span>
                      )}

                      {/* Price */}
                      <span className="text-xs text-parchment-500 flex-shrink-0 w-16 text-right">
                        {best ? formatPrice(best.value * dc.quantity, best.currency) : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}

        {/* Footer */}
        <div className="text-center py-8 border-t border-dungeon-700">
          <div className="flex items-center justify-center gap-2 text-parchment-500 text-sm">
            <Sparkles className="w-4 h-4 text-gold-500" />
            <span>Shared via magicTools</span>
          </div>
        </div>
      </main>
    </div>
  )
}
