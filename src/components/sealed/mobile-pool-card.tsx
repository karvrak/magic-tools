'use client'

import { useState } from 'react'
import Image from 'next/image'
import { RotateCcw, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BoosterCard } from './types'

interface MobilePoolCardProps {
  card: BoosterCard
  inDeckQty: number
  maxQty: number
  onAdd: () => void
  onRemove: () => void
  onHover?: (card: BoosterCard | null, event?: React.MouseEvent) => void
}

export function MobilePoolCard({
  card,
  inDeckQty,
  maxQty,
  onAdd,
  onRemove,
  onHover,
}: MobilePoolCardProps) {
  const [showBack, setShowBack] = useState(false)
  const hasBackFace = card.imageNormalBack || card.imageLargeBack
  const displayImage = showBack && hasBackFace
    ? (card.imageNormalBack || card.imageLargeBack)
    : (card.imageNormal || card.imageLarge)

  const isFullyInDeck = inDeckQty >= maxQty

  return (
    <div
      className="relative"
      onMouseEnter={(e) => onHover?.(card, e)}
      onMouseLeave={() => onHover?.(null)}
    >
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
