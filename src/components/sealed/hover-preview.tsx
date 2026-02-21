'use client'

import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import type { BoosterCard } from './types'

interface HoverPreviewProps {
  hoveredCard: BoosterCard | null
  previewPosition: { x: number; y: number } | null
}

export function HoverPreview({ hoveredCard, previewPosition }: HoverPreviewProps) {
  return (
    <AnimatePresence>
      {hoveredCard && previewPosition && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed z-[100] pointer-events-none hidden lg:block"
          style={{ left: previewPosition.x, top: previewPosition.y }}
        >
          <div className="w-[280px] rounded-xl overflow-hidden shadow-2xl shadow-dungeon-900/80 border-2 border-gold-600/30">
            <div className="relative aspect-[488/680] bg-dungeon-800">
              {(hoveredCard.imageLarge || hoveredCard.imageNormal) ? (
                <Image
                  src={hoveredCard.imageLarge || hoveredCard.imageNormal!}
                  alt={hoveredCard.printedName || hoveredCard.name}
                  fill
                  className="object-cover"
                  sizes="280px"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <span className="text-parchment-400 text-center font-medium">
                    {hoveredCard.printedName || hoveredCard.name}
                  </span>
                </div>
              )}
            </div>
            <div className="bg-dungeon-900/95 backdrop-blur-sm px-3 py-2 border-t border-gold-600/20">
              <p className="text-sm font-medium text-parchment-100 truncate">
                {hoveredCard.printedName || hoveredCard.name}
              </p>
              <p className="text-xs text-parchment-500 truncate">
                {hoveredCard.printedTypeLine || hoveredCard.typeLine}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
