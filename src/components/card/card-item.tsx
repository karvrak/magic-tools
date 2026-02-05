'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { CardWithPrice } from '@/types/scryfall'
import { formatBestPrice, getBestPrice, getRarityColor } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Sparkles, Layers, TrendingUp, RotateCw, Plus, Loader2 } from 'lucide-react'
import { useUserPreferences } from '@/contexts/user-preferences'
import { useQuickAdd } from '@/contexts/quick-add'

interface CardItemProps {
  card: CardWithPrice
  onClick: () => void
  index?: number
}

export function CardItem({ card, onClick, index = 0 }: CardItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [showQuantityMenu, setShowQuantityMenu] = useState(false)
  const { preferences } = useUserPreferences()
  const { quickAdd, activeDeck, isReady } = useQuickAdd()
  const bestPrice = getBestPrice(card.price)
  const showPrice = preferences.showPrices && bestPrice
  const hasMultipleVersions = (card.versionCount || 1) > 1
  
  // Check if card is double-faced (has back image or specific layout)
  const isDoubleFaced = card.imageNormalBack || ['transform', 'modal_dfc', 'double_faced_token', 'reversible_card'].includes(card.layout)

  // Handle quick add with quantity
  const handleQuickAdd = useCallback(async (e: React.MouseEvent, quantity: number = 1) => {
    e.stopPropagation() // Don't trigger the card click
    if (!isReady || isAdding) return
    
    setIsAdding(true)
    setShowQuantityMenu(false)
    await quickAdd(card.id, card.printedName || card.name, quantity)
    setIsAdding(false)
  }, [quickAdd, card.id, card.printedName, card.name, isReady, isAdding])

  // Rarity glow colors
  const rarityGlow = {
    mythic: 'rgba(220, 38, 38, 0.4)',
    rare: 'rgba(212, 164, 24, 0.4)',
    uncommon: 'rgba(192, 192, 192, 0.3)',
    common: 'rgba(100, 116, 139, 0.2)',
  }

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 focus:ring-offset-dungeon-900"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: index * 0.03,
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ 
        y: -8,
        transition: { type: 'spring', stiffness: 300, damping: 20 }
      }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Card Image Container */}
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
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-dungeon-500 p-2">
            <span className="text-xs text-center font-body">{card.printedName || card.name}</span>
          </div>
        )}

        {/* Magical hover overlay */}
        <motion.div 
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-dungeon-900/95 via-dungeon-900/40 to-transparent" />
          
          {/* Rarity glow */}
          <div 
            className="absolute inset-0"
            style={{
              boxShadow: `inset 0 0 30px ${rarityGlow[card.rarity as keyof typeof rarityGlow] || rarityGlow.common}`,
            }}
          />
        </motion.div>

        {/* Price Badge - Bottom Left */}
        {showPrice && (
          <motion.div 
            className={cn(
              "absolute bottom-2 left-2 px-2 py-1 rounded bg-dungeon-900/90 backdrop-blur-sm z-10 flex items-center gap-1",
              card.isReferencePrice 
                ? "border border-parchment-600/40" 
                : "border border-gold-600/40"
            )}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            title={card.isReferencePrice ? "Reference price (other edition)" : "Price for this edition"}
          >
            {card.isReferencePrice && (
              <TrendingUp className="w-3 h-3 text-parchment-500" />
            )}
            <span className={cn(
              "text-xs font-semibold font-medieval",
              card.isReferencePrice ? "text-parchment-400" : "text-gold-400"
            )}>
              {formatBestPrice(card.price)}
            </span>
          </motion.div>
        )}

        {/* Top badges container - Version count + Double-faced indicator */}
        <div className="absolute top-2 left-2 z-10 flex gap-1">
          {/* Version count badge */}
          {hasMultipleVersions && (
            <motion.div 
              className="px-1.5 py-0.5 rounded bg-dungeon-900/90 backdrop-blur-sm border border-arcane-600/40 flex items-center gap-1"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              title={`${card.versionCount} versions available`}
            >
              <Layers className="w-3 h-3 text-arcane-400" />
              <span className="text-[10px] font-semibold text-arcane-300">
                {card.versionCount}
              </span>
            </motion.div>
          )}
          
          {/* Double-faced card indicator */}
          {isDoubleFaced && (
            <motion.div 
              className="p-1 rounded bg-dungeon-900/90 backdrop-blur-sm border border-gold-600/40"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              title="Double-faced card"
            >
              <RotateCw className="w-3 h-3 text-gold-400" />
            </motion.div>
          )}
        </div>

        {/* Quick Add Button with Quantity Menu - appears on hover */}
        <AnimatePresence>
          {isHovered && isReady && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="absolute top-2 right-2 z-20"
              onMouseEnter={() => setShowQuantityMenu(true)}
              onMouseLeave={() => setShowQuantityMenu(false)}
            >
              {/* Main Quick Add Button */}
              <button
                onClick={(e) => handleQuickAdd(e, 1)}
                disabled={isAdding}
                className={cn(
                  "w-8 h-8 rounded-full",
                  "bg-arcane-600 hover:bg-arcane-500 active:bg-arcane-700",
                  "border-2 border-arcane-400/50",
                  "flex items-center justify-center",
                  "shadow-lg shadow-arcane-900/50",
                  "transition-colors duration-150",
                  isAdding && "cursor-wait"
                )}
                title={activeDeck ? `Add to ${activeDeck.name}` : 'Quick Add'}
              >
                {isAdding ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 text-white" />
                )}
              </button>

              {/* Quantity Menu */}
              <AnimatePresence>
                {showQuantityMenu && !isAdding && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.1 }}
                    className="absolute top-0 right-10 flex gap-1"
                  >
                    {[4, 3, 2].map((qty) => (
                      <button
                        key={qty}
                        onClick={(e) => handleQuickAdd(e, qty)}
                        className={cn(
                          "w-7 h-7 rounded-full",
                          "bg-dungeon-800/95 hover:bg-arcane-600",
                          "border border-arcane-500/50 hover:border-arcane-400",
                          "flex items-center justify-center",
                          "shadow-md",
                          "transition-all duration-100",
                          "text-xs font-bold text-arcane-300 hover:text-white"
                        )}
                        title={`Add x${qty}`}
                      >
                        x{qty}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mythic/Rare sparkle effect */}
        {(card.rarity === 'mythic' || card.rarity === 'rare') && isHovered && !isReady && (
          <motion.div
            className="absolute top-2 right-2"
            initial={{ opacity: 0, rotate: -45 }}
            animate={{ opacity: 1, rotate: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Sparkles className={cn(
              'w-4 h-4',
              card.rarity === 'mythic' ? 'text-dragon-400' : 'text-gold-400'
            )} />
          </motion.div>
        )}

        {/* Card Info on Hover */}
        <motion.div 
          className="absolute bottom-0 left-0 right-0 p-3"
          initial={{ y: 20, opacity: 0 }}
          animate={{ 
            y: isHovered ? 0 : 20, 
            opacity: isHovered ? 1 : 0 
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <p className="text-sm font-medium text-parchment-100 truncate font-body">
            {card.printedName || card.name}
          </p>
          <p className={cn('text-xs font-medieval', getRarityColor(card.rarity))}>
            {card.setName}
          </p>
        </motion.div>

        {/* Rarity indicator bar */}
        <motion.div
          className={cn(
            'absolute bottom-0 left-0 right-0 h-1',
            card.rarity === 'mythic' && 'bg-gradient-to-r from-dragon-600 via-dragon-400 to-dragon-600',
            card.rarity === 'rare' && 'bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600',
            card.rarity === 'uncommon' && 'bg-gradient-to-r from-gray-500 via-gray-300 to-gray-500',
            card.rarity === 'common' && 'bg-dungeon-500'
          )}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: isHovered ? 1 : 0.3 }}
          transition={{ duration: 0.3 }}
          style={{ transformOrigin: 'left' }}
        />
      </div>

      {/* Hover glow effect */}
      <motion.div
        className="absolute inset-0 rounded-lg pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: isHovered ? 1 : 0,
          boxShadow: isHovered 
            ? `0 8px 30px ${rarityGlow[card.rarity as keyof typeof rarityGlow] || 'rgba(212, 164, 24, 0.3)'}` 
            : '0 0 0 transparent'
        }}
        transition={{ duration: 0.3 }}
      />
    </motion.button>
  )
}
