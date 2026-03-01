'use client'

import { use, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Package, Scroll, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SharedCustomCard {
  id: string
  name: string
  printedName: string | null
  typeLine: string
  printedTypeLine: string | null
  rarity: string
  setCode: string
  setName: string
  imageNormal: string | null
  manaCost: string | null
  cmc: number
  colors: string[]
  power: string | null
  toughness: string | null
  loyalty: string | null
  oracleText: string | null
  printedText: string | null
}

interface SharedCustomSetData {
  setName: string
  setCode: string
  cards: SharedCustomCard[]
  stats: {
    total: number
    commons: number
    uncommons: number
    rares: number
    mythics: number
  }
}

export default function SharedCustomSetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [selectedCard, setSelectedCard] = useState<SharedCustomCard | null>(null)

  const { data, isLoading, error } = useQuery<SharedCustomSetData>({
    queryKey: ['shared-custom-set', token],
    queryFn: async () => {
      const response = await fetch(`/api/shared/custom/${token}`)
      if (!response.ok) throw new Error('Set not found')
      return response.json()
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dungeon-950 flex items-center justify-center">
        <div className="text-center">
          <Scroll className="w-12 h-12 text-gold-500 animate-pulse mx-auto mb-4" />
          <p className="text-parchment-400">Loading set...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-dungeon-950 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 text-dungeon-600 mx-auto mb-4" />
          <h1 className="text-xl text-parchment-200 mb-2">Set not found</h1>
          <p className="text-parchment-500">This shared link may have been revoked or is invalid.</p>
        </div>
      </div>
    )
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
              <p className="text-xs text-dungeon-400 -mt-0.5">Shared Custom Set</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Set Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Package className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-display text-gold-400">{data.setName}</h1>
            <span className="text-parchment-600 text-sm">({data.setCode})</span>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-3">
            <div className="bg-dungeon-800 border border-dungeon-600 rounded-lg px-4 py-2 text-center">
              <p className="text-xl font-bold text-gold-400">{data.stats.total}</p>
              <p className="text-xs text-parchment-500">Cards</p>
            </div>
            <div className="bg-dungeon-800 border border-dungeon-600 rounded-lg px-4 py-2 text-center">
              <p className="text-xl font-bold text-gray-400">{data.stats.commons}</p>
              <p className="text-xs text-parchment-500">Common</p>
            </div>
            <div className="bg-dungeon-800 border border-dungeon-600 rounded-lg px-4 py-2 text-center">
              <p className="text-xl font-bold text-gray-300">{data.stats.uncommons}</p>
              <p className="text-xs text-parchment-500">Uncommon</p>
            </div>
            <div className="bg-dungeon-800 border border-dungeon-600 rounded-lg px-4 py-2 text-center">
              <p className="text-xl font-bold text-yellow-400">{data.stats.rares}</p>
              <p className="text-xs text-parchment-500">Rare</p>
            </div>
            <div className="bg-dungeon-800 border border-dungeon-600 rounded-lg px-4 py-2 text-center">
              <p className="text-xl font-bold text-orange-400">{data.stats.mythics}</p>
              <p className="text-xs text-parchment-500">Mythic</p>
            </div>
          </div>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {data.cards.map((card) => (
            <SharedCardItem
              key={card.id}
              card={card}
              onClick={() => setSelectedCard(card)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="text-center py-8 border-t border-dungeon-700 mt-8">
          <div className="flex items-center justify-center gap-2 text-parchment-500 text-sm">
            <Sparkles className="w-4 h-4 text-gold-500" />
            <span>Shared via magicTools</span>
          </div>
        </div>
      </main>

      {/* Image Modal */}
      {selectedCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedCard(null)}
        >
          <div
            className="relative max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedCard(null)}
              className="absolute -top-10 right-0 text-parchment-400 hover:text-parchment-200 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            {selectedCard.imageNormal ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedCard.imageNormal}
                alt={selectedCard.printedName || selectedCard.name}
                className="w-full rounded-xl"
              />
            ) : (
              <div className="bg-dungeon-800 border border-dungeon-600 rounded-xl p-8 text-center">
                <p className="text-parchment-200 font-medium">{selectedCard.printedName || selectedCard.name}</p>
                <p className="text-parchment-500 text-sm mt-1">{selectedCard.printedTypeLine || selectedCard.typeLine}</p>
              </div>
            )}
            <div className="mt-3 text-center">
              <p className="text-parchment-200 font-medium">{selectedCard.printedName || selectedCard.name}</p>
              <p className="text-parchment-500 text-sm">{selectedCard.printedTypeLine || selectedCard.typeLine}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Simplified card item without QuickAdd/UserPreferences contexts
function SharedCardItem({ card, onClick }: { card: SharedCustomCard; onClick: () => void }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const rarityGlow: Record<string, string> = {
    mythic: 'rgba(220, 38, 38, 0.4)',
    rare: 'rgba(212, 164, 24, 0.4)',
    uncommon: 'rgba(192, 192, 192, 0.3)',
    common: 'rgba(100, 116, 139, 0.2)',
  }

  const rarityColor: Record<string, string> = {
    mythic: 'text-orange-400',
    rare: 'text-yellow-400',
    uncommon: 'text-gray-300',
    common: 'text-gray-500',
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 focus:ring-offset-dungeon-900 transition-transform duration-200 hover:-translate-y-2"
    >
      <div className="relative aspect-[488/680] bg-dungeon-800 rounded-lg overflow-hidden">
        {/* Loading skeleton */}
        {!imageLoaded && card.imageNormal && (
          <div className="absolute inset-0 animate-pulse bg-dungeon-700" />
        )}

        {card.imageNormal ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.imageNormal}
            alt={card.printedName || card.name}
            className={cn(
              "absolute inset-0 w-full h-full object-cover rounded-lg transition-all duration-500",
              imageLoaded ? "opacity-100" : "opacity-0",
              isHovered && "scale-105"
            )}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-dungeon-500 p-2">
            <span className="text-xs text-center">{card.printedName || card.name}</span>
          </div>
        )}

        {/* Hover overlay with card info */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-300 pointer-events-none",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-dungeon-900/95 via-dungeon-900/40 to-transparent" />
          <div
            className="absolute inset-0"
            style={{
              boxShadow: `inset 0 0 30px ${rarityGlow[card.rarity] || rarityGlow.common}`,
            }}
          />
        </div>

        {/* Card name on hover */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 p-3 transition-all duration-300",
            isHovered ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          )}
        >
          <p className="text-sm font-medium text-parchment-100 truncate">
            {card.printedName || card.name}
          </p>
          <p className={cn('text-xs', rarityColor[card.rarity] || 'text-gray-500')}>
            {card.setName}
          </p>
        </div>

        {/* Rarity indicator bar */}
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 h-1 transition-transform duration-300',
            card.rarity === 'mythic' && 'bg-gradient-to-r from-orange-600 via-orange-400 to-orange-600',
            card.rarity === 'rare' && 'bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600',
            card.rarity === 'uncommon' && 'bg-gradient-to-r from-gray-500 via-gray-300 to-gray-500',
            card.rarity === 'common' && 'bg-dungeon-500',
            isHovered ? 'scale-x-100' : 'scale-x-[0.3]'
          )}
          style={{ transformOrigin: 'left' }}
        />
      </div>
    </button>
  )
}
