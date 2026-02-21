'use client'

import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Shuffle, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CardWithPrice } from '@/types/scryfall'

interface MulliganScreenProps {
  hand: CardWithPrice[]
  mulliganCount: number
  mulliganPhase: 'choosing' | 'selecting-bottom' | 'done'
  selectedHandIndices: Set<number>
  onDoMulligan: () => void
  onKeepHand: () => void
  onToggleMulliganSelection: (index: number) => void
  onPutOnBottom: () => void
}

export function MulliganScreen({
  hand,
  mulliganCount,
  mulliganPhase,
  selectedHandIndices,
  onDoMulligan,
  onKeepHand,
  onToggleMulliganSelection,
  onPutOnBottom,
}: MulliganScreenProps) {
  return (
    <div className="fixed inset-0 z-50 bg-dungeon-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-3xl w-full space-y-6">
        <div className="text-center">
          <h2 className="font-medieval text-3xl text-gold-400 mb-2">
            {mulliganPhase === 'choosing' ? 'Opening Hand' : 'Select Cards for Bottom'}
          </h2>
          <p className="text-parchment-400">
            {mulliganPhase === 'choosing' ? (
              mulliganCount === 0
                ? 'Your opening hand of 7 cards. Keep or mulligan?'
                : `Mulligan #${mulliganCount} — Draw 7, will keep ${7 - mulliganCount}`
            ) : (
              <>
                Select <strong className="text-gold-400">{mulliganCount}</strong> card{mulliganCount > 1 ? 's' : ''} to put on the bottom of your library
                <span className="text-parchment-500 ml-2">
                  ({selectedHandIndices.size}/{mulliganCount})
                </span>
              </>
            )}
          </p>
        </div>

        {/* Hand display */}
        <div className="flex flex-wrap gap-3 justify-center min-h-[220px]">
          <AnimatePresence mode="popLayout">
            {hand.map((card, index) => {
              const isSelected = selectedHandIndices.has(index)
              return (
                <motion.div
                  key={`mulligan-${card?.id || index}-${index}`}
                  layout
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{
                    opacity: 1,
                    scale: isSelected ? 0.95 : 1,
                    y: isSelected ? 8 : 0
                  }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={cn(
                    "relative cursor-pointer transition-all",
                    mulliganPhase === 'selecting-bottom' && "hover:ring-2 hover:ring-gold-400/50 rounded-lg",
                    isSelected && "ring-2 ring-dragon-500 rounded-lg opacity-60"
                  )}
                  onClick={() => {
                    if (mulliganPhase === 'selecting-bottom') {
                      onToggleMulliganSelection(index)
                    }
                  }}
                >
                  <div className="w-[120px] h-[168px] rounded-lg overflow-hidden relative">
                    {card?.imageNormal ? (
                      <Image src={card.imageNormal} alt={card.name || 'Card'} fill className="object-cover" sizes="120px" />
                    ) : (
                      <div className="w-full h-full bg-dungeon-800 flex items-center justify-center p-2 border border-dungeon-600 rounded-lg">
                        <span className="text-xs text-center text-parchment-500">{card?.name || 'Card'}</span>
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-dragon-900/40 rounded-lg">
                      <ArrowDown className="w-8 h-8 text-dragon-400" />
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-4">
          {mulliganPhase === 'choosing' && (
            <>
              <Button size="lg" onClick={onKeepHand} className="min-w-[140px]">
                <Check className="w-5 h-5 mr-2" />
                Keep
              </Button>
              {mulliganCount < 2 && (
                <Button variant="outline" size="lg" onClick={onDoMulligan} className="min-w-[140px]">
                  <Shuffle className="w-5 h-5 mr-2" />
                  Mulligan
                </Button>
              )}
            </>
          )}
          {mulliganPhase === 'selecting-bottom' && selectedHandIndices.size === mulliganCount && (
            <Button size="lg" onClick={onPutOnBottom} className="min-w-[200px]">
              <ArrowDown className="w-5 h-5 mr-2" />
              Put on bottom and start
            </Button>
          )}
        </div>

        {/* Mulligan counter */}
        {mulliganCount > 0 && mulliganPhase === 'choosing' && (
          <p className="text-center text-sm text-parchment-500">
            Mulligan {mulliganCount}/2 — Will keep {7 - mulliganCount} cards
          </p>
        )}
      </div>
    </div>
  )
}
