'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { CardWithPrice } from '@/types/scryfall'
import { formatBestPrice, getBestPrice, getRarityColor } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Sparkles,
  Plus,
  Minus,
  Loader2,
  Heart,
  Layers,
  Package
} from 'lucide-react'
import { useUserPreferences } from '@/contexts/user-preferences'

interface DeckInfo {
  id: string
  name: string
  quantity: number
}

interface CollectionCardItemProps {
  card: CardWithPrice
  quantity: number
  type: 'owned' | 'wanted'
  isFoil?: boolean
  condition?: string
  decksContaining?: DeckInfo[]
  onClick: () => void
  onQuantityChange: (delta: number) => void
  onAddToDeck?: () => void
  isUpdating?: boolean
  index?: number
}

export function CollectionCardItem({
  card,
  quantity,
  type,
  isFoil = false,
  condition,
  decksContaining = [],
  onClick,
  onQuantityChange,
  onAddToDeck,
  isUpdating = false,
  index = 0
}: CollectionCardItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const { preferences } = useUserPreferences()
  const bestPrice = getBestPrice(card.price, isFoil)
  const showPrice = preferences.showPrices && bestPrice

  const totalInDecks = decksContaining.reduce((sum, d) => sum + d.quantity, 0)

  // Rarity glow colors
  const rarityGlow = {
    mythic: 'rgba(220, 38, 38, 0.4)',
    rare: 'rgba(212, 164, 24, 0.4)',
    uncommon: 'rgba(192, 192, 192, 0.3)',
    common: 'rgba(100, 116, 139, 0.2)',
  }

  const handleIncrement = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onQuantityChange(1)
  }, [onQuantityChange])

  const handleDecrement = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onQuantityChange(-1)
  }, [onQuantityChange])

  const handleAddToDeck = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onAddToDeck?.()
  }, [onAddToDeck])

  return (
    <motion.div
      className="group relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.02,
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {/* Card Image */}
      <motion.button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="w-full rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 focus:ring-offset-dungeon-900"
        whileHover={{
          y: -4,
          transition: { type: 'spring', stiffness: 300, damping: 20 }
        }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="relative aspect-[488/680] bg-dungeon-800 rounded-lg overflow-hidden">
          {/* Loading skeleton */}
          {!imageLoaded && card.imageNormal && (
            <div className="absolute inset-0 skeleton" />
          )}

          {card.imageNormal ? (
            <Image
              src={card.imageNormal}
              alt={card.name}
              fill
              className={cn(
                "object-cover rounded-lg transition-all duration-500",
                imageLoaded ? "opacity-100" : "opacity-0",
                isHovered && "scale-105"
              )}
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-dungeon-500 p-2">
              <span className="text-xs text-center font-body">{card.name}</span>
            </div>
          )}

          {/* Hover overlay */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-dungeon-900/95 via-dungeon-900/40 to-transparent" />
            <div
              className="absolute inset-0"
              style={{
                boxShadow: `inset 0 0 30px ${rarityGlow[card.rarity as keyof typeof rarityGlow] || rarityGlow.common}`,
              }}
            />
          </motion.div>

          {/* Type badge - Owned/Wanted */}
          <div className="absolute top-2 left-2 z-10 flex gap-1">
            {type === 'wanted' && (
              <div className="p-1.5 rounded bg-pink-500/90 backdrop-blur-sm">
                <Heart className="w-3 h-3 text-white" fill="white" />
              </div>
            )}
            {isFoil && (
              <div className="p-1.5 rounded bg-yellow-500/90 backdrop-blur-sm">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
            )}
            {condition && condition !== 'nm' && (
              <div className="px-1.5 py-1 rounded bg-dungeon-900/90 backdrop-blur-sm text-[10px] font-bold text-parchment-300 uppercase">
                {condition}
              </div>
            )}
          </div>

          {/* Decks indicator - Top Right */}
          {totalInDecks > 0 && (
            <motion.div
              className="absolute top-2 right-2 z-10 px-1.5 py-1 rounded bg-arcane-600/90 backdrop-blur-sm flex items-center gap-1"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              title={`Dans ${decksContaining.length} deck(s): ${decksContaining.map(d => d.name).join(', ')}`}
            >
              <Layers className="w-3 h-3 text-white" />
              <span className="text-[10px] font-bold text-white">{totalInDecks}</span>
            </motion.div>
          )}

          {/* Price Badge */}
          {showPrice && (
            <motion.div
              className="absolute bottom-2 left-2 px-2 py-1 rounded bg-dungeon-900/90 backdrop-blur-sm z-10 border border-gold-600/40"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <span className="text-xs font-semibold font-medieval text-gold-400">
                {formatBestPrice(card.price, isFoil)}
              </span>
            </motion.div>
          )}

          {/* Add to Deck button on hover */}
          <AnimatePresence>
            {isHovered && onAddToDeck && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={handleAddToDeck}
                className="absolute bottom-2 right-2 z-10 p-2 rounded-full bg-arcane-600 hover:bg-arcane-500 border border-arcane-400/50 shadow-lg"
                title="Ajouter à un deck"
              >
                <Package className="w-4 h-4 text-white" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Card name on hover */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 p-2 pointer-events-none"
            initial={{ y: 10, opacity: 0 }}
            animate={{
              y: isHovered ? 0 : 10,
              opacity: isHovered ? 1 : 0
            }}
          >
            <p className="text-xs font-medium text-parchment-100 truncate">
              {card.name}
            </p>
            <p className={cn('text-[10px] font-medieval', getRarityColor(card.rarity))}>
              {card.setName}
            </p>
          </motion.div>

          {/* Rarity bar */}
          <motion.div
            className={cn(
              'absolute bottom-0 left-0 right-0 h-0.5',
              card.rarity === 'mythic' && 'bg-gradient-to-r from-dragon-600 via-dragon-400 to-dragon-600',
              card.rarity === 'rare' && 'bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600',
              card.rarity === 'uncommon' && 'bg-gradient-to-r from-gray-500 via-gray-300 to-gray-500',
              card.rarity === 'common' && 'bg-dungeon-500'
            )}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: isHovered ? 1 : 0.3 }}
            style={{ transformOrigin: 'left' }}
          />
        </div>

        {/* Hover glow */}
        <motion.div
          className="absolute inset-0 rounded-lg pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{
            opacity: isHovered ? 1 : 0,
            boxShadow: isHovered
              ? `0 8px 30px ${rarityGlow[card.rarity as keyof typeof rarityGlow] || 'rgba(212, 164, 24, 0.3)'}`
              : '0 0 0 transparent'
          }}
        />
      </motion.button>

      {/* Quantity Controls - Below card */}
      <div className="mt-2 flex items-center justify-center gap-2">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleDecrement}
          disabled={isUpdating}
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
            "bg-dungeon-700 hover:bg-dungeon-600 border border-dungeon-500",
            "text-parchment-300 hover:text-parchment-100",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isUpdating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Minus className="w-3 h-3" />
          )}
        </motion.button>

        <span className={cn(
          "min-w-[2rem] text-center font-medieval text-lg font-bold",
          type === 'wanted' ? 'text-pink-400' : 'text-gold-400'
        )}>
          {quantity}
        </span>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleIncrement}
          disabled={isUpdating}
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
            "bg-dungeon-700 hover:bg-dungeon-600 border border-dungeon-500",
            "text-parchment-300 hover:text-parchment-100",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isUpdating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Plus className="w-3 h-3" />
          )}
        </motion.button>
      </div>

      {/* Decks info - compact display */}
      {decksContaining.length > 0 && (
        <div className="mt-1 text-center">
          <p className="text-[10px] text-arcane-400 truncate px-1">
            {decksContaining.length === 1
              ? decksContaining[0].name
              : `${decksContaining.length} decks`
            }
          </p>
        </div>
      )}
    </motion.div>
  )
}
