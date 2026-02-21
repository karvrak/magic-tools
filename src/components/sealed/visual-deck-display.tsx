'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { BoosterCard } from './types'
import { BASIC_LANDS } from './types'

interface VisualDeckDisplayProps {
  deckCards: Array<{ card: BoosterCard; qty: number }>
  basicLands: Record<string, number>
  onHover?: (card: BoosterCard | null, event?: React.MouseEvent) => void
}

export function VisualDeckDisplay({
  deckCards,
  basicLands,
  onHover,
}: VisualDeckDisplayProps) {
  const groups = useMemo(() => {
    const result = new Map<string, Array<{ card: BoosterCard; qty: number }>>()
    const lands: Array<{ card: BoosterCard; qty: number }> = []
    const nonLands: Array<{ card: BoosterCard; qty: number }> = []

    for (const dc of deckCards) {
      if (dc.card.typeLine.toLowerCase().includes('land')) {
        lands.push(dc)
      } else {
        nonLands.push(dc)
      }
    }

    // Add basic lands as fake BoosterCard entries
    for (const [name, qty] of Object.entries(basicLands)) {
      if (qty > 0) {
        const land = BASIC_LANDS.find(l => l.name === name)!
        lands.push({
          card: {
            id: `basic-${name.toLowerCase()}`,
            oracleId: `basic-${name.toLowerCase()}`,
            name,
            printedName: null,
            manaCost: null,
            cmc: 0,
            typeLine: `Basic Land \u2014 ${name}`,
            printedTypeLine: null,
            colors: [],
            colorIdentity: [land.color],
            rarity: 'common',
            imageNormal: null,
            imageLarge: null,
            imageNormalBack: null,
            imageLargeBack: null,
            power: null,
            toughness: null,
            loyalty: null,
            oracleText: null,
            printedText: null,
            setCode: '',
            setName: '',
            layout: 'normal',
            slot: '',
          },
          qty,
        })
      }
    }

    for (const dc of nonLands) {
      const cmc = Math.floor(dc.card.cmc)
      const key = cmc >= 7 ? '7+' : cmc.toString()
      if (!result.has(key)) result.set(key, [])
      result.get(key)!.push(dc)
    }

    for (const [, cards] of result) {
      cards.sort((a, b) => a.card.name.localeCompare(b.card.name))
    }

    if (lands.length > 0) {
      lands.sort((a, b) => a.card.name.localeCompare(b.card.name))
      result.set('Lands', lands)
    }

    const sorted = new Map<string, Array<{ card: BoosterCard; qty: number }>>()
    const order = ['0', '1', '2', '3', '4', '5', '6', '7+', 'Lands']
    for (const key of order) {
      if (result.has(key)) sorted.set(key, result.get(key)!)
    }
    return sorted
  }, [deckCards, basicLands])

  const cardOffset = 24

  return (
    <div className="bg-dungeon-800/50 rounded-lg border border-dungeon-700 p-3">
      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {Array.from(groups.entries()).map(([key, cards]) => {
          const totalInGroup = cards.reduce((sum, dc) => sum + dc.qty, 0)
          const expandedCards = cards.flatMap(dc =>
            Array.from({ length: dc.qty }, (_, i) => ({ ...dc, stackIndex: i }))
          )

          return (
            <div key={key} className="flex-shrink-0 w-[80px] sm:w-[100px] md:w-[120px]">
              <div className="mb-2 px-2 py-1 rounded-lg text-center bg-gradient-to-r from-gold-500/60 to-gold-700/60">
                <span className="font-medieval text-white text-xs">
                  {key === 'Lands' ? 'Lands' : `CMC ${key}`}
                </span>
                <span className="ml-1 text-white/70 text-[10px]">({totalInGroup})</span>
              </div>

              <div
                className="relative"
                style={{ height: `${Math.min(expandedCards.length * cardOffset + 70, 280)}px` }}
              >
                {expandedCards.map((dc, index) => (
                  <div
                    key={`${dc.card.oracleId}-${dc.stackIndex}`}
                    className="absolute left-0 right-0 group cursor-pointer"
                    style={{ top: index * cardOffset }}
                    onMouseEnter={(e) => onHover?.(dc.card, e)}
                    onMouseLeave={() => onHover?.(null)}
                  >
                    <div className={cn(
                      "relative w-full aspect-[5/7] rounded-lg overflow-hidden",
                      "shadow-lg transition-all duration-200",
                      "group-hover:z-50 group-hover:scale-105"
                    )}>
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
                          <span className="text-[9px] text-parchment-400 text-center px-1">
                            {dc.card.printedName || dc.card.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
