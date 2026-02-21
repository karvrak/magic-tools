'use client'

import Image from 'next/image'
import { ArrowLeft, ArrowRight, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { GeneratedPool } from './types'

interface BoosterOpeningProps {
  generatedPool: GeneratedPool
  currentBoosterIndex: number
  onBoosterIndexChange: (index: number) => void
  onFinish: () => void
}

export function BoosterOpening({
  generatedPool,
  currentBoosterIndex,
  onBoosterIndexChange,
  onFinish,
}: BoosterOpeningProps) {
  return (
    <div className="fixed inset-0 bg-dungeon-900/98 z-50 flex flex-col">
      {/* Header */}
      <div className="text-center py-4 border-b border-dungeon-700">
        <h2 className="font-medieval text-xl text-gold-400">
          Booster {currentBoosterIndex + 1} / 6
        </h2>
        <p className="text-parchment-400 text-sm">{generatedPool.setName}</p>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-auto p-3">
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2 max-w-4xl mx-auto">
          {[...(generatedPool.boosters[currentBoosterIndex]?.cards || [])].sort((a, b) => {
            const order = ['mythic', 'rare', 'uncommon', 'common']
            return order.indexOf(a.rarity) - order.indexOf(b.rarity)
          }).map((card, idx) => (
            <div
              key={`${card.id}-${idx}`}
              className="transition-all duration-300"
              style={{
                animationDelay: `${idx * 50}ms`,
                animation: 'fadeInUp 0.3s ease-out forwards',
              }}
            >
              {card.imageNormal ? (
                <Image
                  src={card.imageNormal}
                  alt={card.printedName || card.name}
                  width={120}
                  height={167}
                  className={cn(
                    "rounded-md shadow-lg w-full h-auto",
                    card.rarity === 'mythic' && "ring-2 ring-orange-500",
                    card.rarity === 'rare' && "ring-2 ring-yellow-500",
                  )}
                />
              ) : (
                <div className="aspect-[5/7] bg-dungeon-700 rounded-md flex items-center justify-center text-[10px] text-parchment-400 p-1 text-center">
                  {card.printedName || card.name}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 border-t border-dungeon-700 bg-dungeon-900">
        <div className="flex justify-center gap-3 max-w-md mx-auto">
          <Button
            onClick={() => onBoosterIndexChange(currentBoosterIndex - 1)}
            disabled={currentBoosterIndex === 0}
            variant="outline"
            className="flex-1"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Prev.
          </Button>

          {currentBoosterIndex < 5 ? (
            <Button
              onClick={() => onBoosterIndexChange(currentBoosterIndex + 1)}
              className="flex-1 btn-primary"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={onFinish}
              className="flex-1 btn-primary"
            >
              <Layers className="w-4 h-4 mr-1" />
              Build
            </Button>
          )}
        </div>

        <button
          onClick={onFinish}
          className="block mx-auto mt-3 text-parchment-500 text-sm underline"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
