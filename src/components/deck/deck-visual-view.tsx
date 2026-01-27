'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { CardWithPrice } from '@/types/scryfall'

// ═══════════════════════════════════════════════════════════════════════════
// 🎴 TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface DeckCard {
  id: string
  cardId: string
  quantity: number
  category: string
  card: CardWithPrice
}

interface DeckVisualViewProps {
  cards: DeckCard[]
  groupBy: 'cmc' | 'type'
  onCardClick?: (card: CardWithPrice) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const TYPE_ORDER = [
  'creature',
  'planeswalker',
  'instant',
  'sorcery',
  'artifact',
  'enchantment',
  'land',
  'other',
]

const TYPE_LABELS: Record<string, string> = {
  creature: 'Creatures',
  planeswalker: 'Planeswalkers',
  instant: 'Instants',
  sorcery: 'Sorceries',
  artifact: 'Artifacts',
  enchantment: 'Enchantments',
  land: 'Lands',
  other: 'Other',
}

const TYPE_COLORS: Record<string, string> = {
  creature: 'from-nature-600/80 to-nature-800/80',
  planeswalker: 'from-gold-500/80 to-gold-700/80',
  instant: 'from-blue-500/80 to-blue-700/80',
  sorcery: 'from-dragon-500/80 to-dragon-700/80',
  artifact: 'from-gray-400/80 to-gray-600/80',
  enchantment: 'from-arcane-500/80 to-arcane-700/80',
  land: 'from-lime-600/80 to-lime-800/80',
  other: 'from-dungeon-500/80 to-dungeon-700/80',
}

// ═══════════════════════════════════════════════════════════════════════════
// 🛠️ UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function getCardTypeCategory(typeLine: string): string {
  const lowerType = typeLine.toLowerCase()
  // Priorité : creature > planeswalker > land > instant > sorcery > artifact > enchantment
  // Les doubles types sont classés dans leur type "principal" :
  // - Artifact Land → Land (pas Artifact)
  // - Enchantment Creature → Creature (pas Enchantment)
  // - Land Creature → Creature
  if (lowerType.includes('creature')) return 'creature'
  if (lowerType.includes('planeswalker')) return 'planeswalker'
  if (lowerType.includes('land')) return 'land'
  if (lowerType.includes('instant')) return 'instant'
  if (lowerType.includes('sorcery')) return 'sorcery'
  if (lowerType.includes('artifact')) return 'artifact'
  if (lowerType.includes('enchantment')) return 'enchantment'
  return 'other'
}

function groupCardsByCMC(cards: DeckCard[]): Map<string, DeckCard[]> {
  const groups = new Map<string, DeckCard[]>()
  
  // Separate lands from other cards
  const lands: DeckCard[] = []
  const nonLands: DeckCard[] = []
  
  for (const dc of cards) {
    if (getCardTypeCategory(dc.card.typeLine) === 'land') {
      lands.push(dc)
    } else {
      nonLands.push(dc)
    }
  }
  
  // Group non-lands by CMC
  for (const dc of nonLands) {
    const cmc = Math.floor(dc.card.cmc)
    const key = cmc >= 7 ? '7+' : cmc.toString()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(dc)
  }
  
  // Add lands as separate group
  if (lands.length > 0) {
    groups.set('Lands', lands)
  }
  
  // Sort by CMC order
  const sortedGroups = new Map<string, DeckCard[]>()
  const cmcOrder = ['0', '1', '2', '3', '4', '5', '6', '7+', 'Lands']
  for (const key of cmcOrder) {
    if (groups.has(key)) {
      sortedGroups.set(key, groups.get(key)!)
    }
  }
  
  return sortedGroups
}

function groupCardsByType(cards: DeckCard[]): Map<string, DeckCard[]> {
  const groups = new Map<string, DeckCard[]>()
  
  for (const dc of cards) {
    const type = getCardTypeCategory(dc.card.typeLine)
    if (!groups.has(type)) groups.set(type, [])
    groups.get(type)!.push(dc)
  }
  
  // Sort by type order
  const sortedGroups = new Map<string, DeckCard[]>()
  for (const type of TYPE_ORDER) {
    if (groups.has(type)) {
      sortedGroups.set(type, groups.get(type)!)
    }
  }
  
  return sortedGroups
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎴 CARD STACK COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface CardStackProps {
  cards: DeckCard[]
  onCardHover: (card: CardWithPrice | null, rect: DOMRect | null) => void
  onCardClick?: (card: CardWithPrice) => void
}

function CardStack({ cards, onCardHover, onCardClick }: CardStackProps) {
  // Sort cards by name within the stack - one entry per unique card
  const sortedCards = [...cards].sort((a, b) => a.card.name.localeCompare(b.card.name))
  
  const handleMouseEnter = useCallback((card: CardWithPrice, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    onCardHover(card, rect)
  }, [onCardHover])
  
  const handleMouseLeave = useCallback(() => {
    onCardHover(null, null)
  }, [onCardHover])
  
  // Fixed offset - works well with the responsive column widths
  const cardOffset = 24
  
  return (
    <div 
      className="relative"
      style={{ 
        height: `${Math.min(sortedCards.length * cardOffset + 90, 320)}px`,
      }}
    >
      {sortedCards.map((dc, index) => (
        <motion.div
          key={dc.id}
          className="absolute left-0 right-0 cursor-pointer group"
          style={{ top: index * cardOffset }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(index * 0.015, 0.3), duration: 0.2 }}
          onMouseEnter={(e) => handleMouseEnter(dc.card, e)}
          onMouseLeave={handleMouseLeave}
          onClick={() => onCardClick?.(dc.card)}
        >
          <div 
            className={cn(
              "relative w-full aspect-[5/7] rounded-lg overflow-hidden",
              "shadow-lg transition-all duration-200",
              "group-hover:z-50 group-hover:scale-105 group-hover:shadow-magic-glow"
            )}
          >
            {dc.card.imageNormal ? (
              <Image
                src={dc.card.imageNormal}
                alt={dc.card.printedName || dc.card.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 80px, 120px"
              />
            ) : (
              <div className="w-full h-full bg-dungeon-700 flex items-center justify-center">
                <span className="text-xs text-parchment-400 text-center px-1">
                  {dc.card.printedName || dc.card.name}
                </span>
              </div>
            )}
            
            {/* Quantity badge - always visible when qty > 1 */}
            {dc.quantity > 1 && (
              <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 bg-dungeon-900/90 text-gold-400 text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded shadow-md">
                x{dc.quantity}
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔮 CARD PREVIEW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface CardPreviewProps {
  card: CardWithPrice | null
  position: { x: number; y: number } | null
}

function CardPreview({ card, position }: CardPreviewProps) {
  if (!card || !position) return null
  
  // Calculate position to keep preview on screen
  const previewWidth = 280
  const previewHeight = 390
  const padding = 20
  
  let x = position.x + padding
  let y = position.y - previewHeight / 2
  
  // Adjust if going off right edge
  if (typeof window !== 'undefined') {
    if (x + previewWidth > window.innerWidth - padding) {
      x = position.x - previewWidth - padding
    }
    // Adjust if going off bottom
    if (y + previewHeight > window.innerHeight - padding) {
      y = window.innerHeight - previewHeight - padding
    }
    // Adjust if going off top
    if (y < padding) {
      y = padding
    }
  }
  
  return (
    <motion.div
      className="fixed z-[100] pointer-events-none"
      style={{ left: x, top: y }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
    >
      <div className="relative rounded-xl overflow-hidden shadow-2xl border-2 border-gold-500/50">
        {card.imageNormal ? (
          <Image
            src={card.imageLarge || card.imageNormal}
            alt={card.printedName || card.name}
            width={previewWidth}
            height={previewHeight}
            className="object-contain bg-dungeon-900"
            priority
          />
        ) : (
          <div 
            className="bg-dungeon-800 flex items-center justify-center"
            style={{ width: previewWidth, height: previewHeight }}
          >
            <span className="text-parchment-400">{card.printedName || card.name}</span>
          </div>
        )}
        
        {/* Card name overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-dungeon-900/95 to-transparent p-3">
          <p className="font-medieval text-gold-400 text-sm truncate">{card.printedName || card.name}</p>
          <p className="text-xs text-parchment-400 truncate">{card.printedTypeLine || card.typeLine}</p>
        </div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 📊 DECK SUMMARY BAR
// ═══════════════════════════════════════════════════════════════════════════

interface DeckSummaryProps {
  cards: DeckCard[]
}

function DeckSummary({ cards }: DeckSummaryProps) {
  const stats = {
    total: 0,
    creatures: 0,
    spells: 0,
    lands: 0,
  }
  
  for (const dc of cards) {
    stats.total += dc.quantity
    const type = getCardTypeCategory(dc.card.typeLine)
    if (type === 'land') {
      stats.lands += dc.quantity
    } else if (type === 'creature') {
      stats.creatures += dc.quantity
    } else {
      stats.spells += dc.quantity
    }
  }
  
  const landPercent = stats.total > 0 ? ((stats.lands / stats.total) * 100).toFixed(0) : '0'
  
  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-6 px-3 sm:px-4 py-2 bg-dungeon-800/50 rounded-lg border border-dungeon-600/50">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="text-parchment-400 text-xs sm:text-sm">Total:</span>
        <span className="text-gold-400 font-medieval text-sm sm:text-base">{stats.total}</span>
      </div>
      <div className="hidden sm:block h-4 w-px bg-dungeon-600" />
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-nature-500" />
        <span className="text-parchment-200 text-xs sm:text-sm">{stats.creatures}</span>
        <span className="hidden sm:inline text-parchment-400 text-sm">Créatures</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-arcane-500" />
        <span className="text-parchment-200 text-xs sm:text-sm">{stats.spells}</span>
        <span className="hidden sm:inline text-parchment-400 text-sm">Sorts</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-lime-500" />
        <span className="text-parchment-200 text-xs sm:text-sm">{stats.lands}</span>
        <span className="text-dungeon-400 text-xs">({landPercent}%)</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎴 MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function DeckVisualView({ cards, groupBy, onCardClick }: DeckVisualViewProps) {
  const [hoveredCard, setHoveredCard] = useState<CardWithPrice | null>(null)
  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number } | null>(null)
  
  const handleCardHover = useCallback((card: CardWithPrice | null, rect: DOMRect | null) => {
    setHoveredCard(card)
    if (rect) {
      setPreviewPosition({ x: rect.right, y: rect.top + rect.height / 2 })
    } else {
      setPreviewPosition(null)
    }
  }, [])
  
  // Filter to mainboard only for visual view
  const mainboardCards = cards.filter(c => c.category === 'mainboard')
  
  // Group cards based on selected mode
  const groups = groupBy === 'cmc' 
    ? groupCardsByCMC(mainboardCards)
    : groupCardsByType(mainboardCards)
  
  if (mainboardCards.length === 0) {
    return (
      <div className="card-frame p-12 text-center">
        <p className="text-parchment-400">No cards in mainboard</p>
      </div>
    )
  }
  
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Summary Bar */}
      <DeckSummary cards={mainboardCards} />
      
      {/* Card Grid */}
      <div className="card-frame p-3 sm:p-6">
        <div className="flex gap-2 sm:gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1">
          {Array.from(groups.entries()).map(([key, groupCards]) => {
            const totalInGroup = groupCards.reduce((sum, dc) => sum + dc.quantity, 0)
            const isTypeGroup = groupBy === 'type'
            const label = isTypeGroup ? TYPE_LABELS[key] || key : key
            const colorClass = isTypeGroup ? TYPE_COLORS[key] : 'from-gold-500/80 to-gold-700/80'
            
            return (
              <div key={key} className="flex-shrink-0 w-[90px] sm:w-[120px] md:w-[140px]">
                {/* Column Header */}
                <div className={cn(
                  "mb-2 sm:mb-3 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-center",
                  "bg-gradient-to-r",
                  colorClass
                )}>
                  <span className="font-medieval text-white text-xs sm:text-sm">
                    {label}
                  </span>
                  <span className="ml-1 sm:ml-2 text-white/80 text-[10px] sm:text-xs">
                    ({totalInGroup})
                  </span>
                </div>
                
                {/* Card Stack */}
                <CardStack 
                  cards={groupCards}
                  onCardHover={handleCardHover}
                  onCardClick={onCardClick}
                />
              </div>
            )
          })}
        </div>
      </div>
      
      {/* Card Preview on Hover - Hidden on mobile (touch devices use click modal) */}
      <AnimatePresence>
        {hoveredCard && (
          <CardPreview card={hoveredCard} position={previewPosition} />
        )}
      </AnimatePresence>
    </div>
  )
}
