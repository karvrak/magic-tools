'use client'

import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { CardWithPrice } from '@/types/scryfall'
import { WithHoverPreview } from '@/components/card/card-hover-preview'

interface HandZoneProps {
  hand: CardWithPrice[]
  fullDeckLength: number
  onPlayCard: (index: number) => void
  onDiscardCard: (index: number) => void
  onExileFromHand: (index: number) => void
}

export function HandZone({
  hand,
  fullDeckLength,
  onPlayCard,
  onDiscardCard,
  onExileFromHand,
}: HandZoneProps) {
  if (fullDeckLength === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 px-1 min-h-[100px] justify-center">
      <AnimatePresence mode="popLayout">
        {hand.map((card, index) => (
          <motion.div
            key={`hand-${card?.id || index}-${index}`}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative group"
          >
            <WithHoverPreview card={{ name: card?.printedName || card?.name || 'Card', image: card?.imageNormal || null, type: card?.typeLine }}>
              <div className="w-[70px] h-[98px] rounded overflow-hidden relative hover:scale-110 transition-transform cursor-pointer">
                {card?.imageNormal ? (
                  <Image src={card.imageNormal} alt={card.name || 'Card'} fill className="object-cover" sizes="70px" />
                ) : (
                  <div className="w-full h-full bg-dungeon-800 flex items-center justify-center p-1">
                    <span className="text-[8px] text-center text-parchment-500">{card?.name || 'Card'}</span>
                  </div>
                )}
              </div>
            </WithHoverPreview>
            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 z-10">
              <button onClick={() => onPlayCard(index)} className="px-1.5 py-0.5 text-[10px] bg-emerald-600/90 text-white rounded-l" title="Play">
                &#9654;
              </button>
              <button onClick={() => onDiscardCard(index)} className="px-1.5 py-0.5 text-[10px] bg-dragon-600/90 text-white" title="Discard">
                &#10005;
              </button>
              <button onClick={() => onExileFromHand(index)} className="px-1.5 py-0.5 text-[10px] bg-parchment-700/90 text-white rounded-r" title="Exile">
                &#9939;
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {hand.length === 0 && <p className="text-parchment-600 italic text-xs py-6">Empty hand</p>}
    </div>
  )
}
