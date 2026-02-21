'use client'

import {
  RotateCcw,
  Download,
  Minus,
  Plus,
  Play,
  Mountain,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { BoosterCard, GeneratedPool } from './types'
import { BASIC_LANDS } from './types'

interface DeckStats {
  cmcChartData: Array<{ cmc: string; count: number }>
  avgCMC: number
  lands: number
  nonLands: number
}

interface SealedDeckPanelProps {
  deckSize: number
  deckCards: Array<{ card: BoosterCard; qty: number }>
  deckStats: DeckStats
  generatedPool: GeneratedPool
  basicLands: Record<string, number>
  onRemove: (oracleId: string) => void
  onAddBasicLand: (name: string) => void
  onRemoveBasicLand: (name: string) => void
  onClear: () => void
  onExport: () => void
  onPlaytest?: () => void
  isMobile?: boolean
}

function CMCTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-dungeon-800 border border-dungeon-600 rounded px-2 py-1 shadow-lg">
        <p className="text-parchment-200 text-xs">
          <span className="text-gold-400">CMC {label}:</span> {payload[0].value}
        </p>
      </div>
    )
  }
  return null
}

export function SealedDeckPanel({
  deckSize,
  deckCards,
  deckStats,
  generatedPool,
  basicLands,
  onRemove,
  onAddBasicLand,
  onRemoveBasicLand,
  onClear,
  onExport,
  onPlaytest,
  isMobile = false,
}: SealedDeckPanelProps) {
  return (
    <div className="space-y-4">
      {/* Deck Status */}
      <div className={cn(
        "text-sm font-medium px-3 py-2 rounded",
        deckSize >= 40
          ? "bg-green-900/30 text-green-400"
          : "bg-yellow-900/30 text-yellow-400"
      )}>
        {deckSize >= 40 ? (
          <>Valid deck ({deckSize} cards)</>
        ) : (
          <>{40 - deckSize} cards missing</>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="bg-dungeon-700 rounded p-2 text-center">
          <div className="text-gold-400 font-bold">{deckStats.lands}</div>
          <div className="text-parchment-500 text-xs">Lands</div>
        </div>
        <div className="bg-dungeon-700 rounded p-2 text-center">
          <div className="text-gold-400 font-bold">{deckStats.nonLands}</div>
          <div className="text-parchment-500 text-xs">Spells</div>
        </div>
        <div className="bg-dungeon-700 rounded p-2 text-center">
          <div className="text-gold-400 font-bold">{deckStats.avgCMC.toFixed(1)}</div>
          <div className="text-parchment-500 text-xs">Avg CMC</div>
        </div>
      </div>

      {/* Mana Curve */}
      {deckSize > 0 && (
        <div className="bg-dungeon-800 rounded-lg p-3">
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deckStats.cmcChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <XAxis
                  dataKey="cmc"
                  tick={{ fill: '#a8a29e', fontSize: 9 }}
                  axisLine={{ stroke: '#44403c' }}
                />
                <YAxis
                  tick={{ fill: '#a8a29e', fontSize: 9 }}
                  axisLine={{ stroke: '#44403c' }}
                  allowDecimals={false}
                  width={20}
                />
                <Tooltip content={<CMCTooltip />} />
                <Bar dataKey="count" fill="#d4af37" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Basic Lands Section */}
      <div className="bg-dungeon-800 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-3">
          <Mountain className="w-4 h-4 text-gold-400" />
          <span className="text-sm font-medium text-gold-400">Basic Lands</span>
        </div>
        <div className="space-y-2">
          {BASIC_LANDS.map(({ name, bgClass }) => (
            <div key={name} className="flex items-center gap-2">
              <span className={cn("w-4 h-4 rounded-full flex-shrink-0", bgClass)} />
              <span className="text-parchment-200 text-sm flex-1">{name}</span>
              <button
                onClick={() => onRemoveBasicLand(name)}
                disabled={basicLands[name] === 0}
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-white text-sm",
                  basicLands[name] > 0 ? "bg-red-500/80 hover:bg-red-600" : "bg-dungeon-600/50"
                )}
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className={cn(
                "w-6 text-center text-sm font-bold",
                basicLands[name] > 0 ? "text-gold-400" : "text-parchment-600"
              )}>
                {basicLands[name]}
              </span>
              <button
                onClick={() => onAddBasicLand(name)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm bg-green-500/80 hover:bg-green-600"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Deck Cards List */}
      <div className={cn(
        "bg-dungeon-800 rounded-lg overflow-hidden",
        isMobile ? "max-h-[40vh]" : "max-h-[300px]"
      )}>
        {deckCards.length === 0 ? (
          <p className="text-parchment-500 text-center py-6 text-sm">
            Add cards from the pool
          </p>
        ) : (
          <div className="overflow-y-auto max-h-full divide-y divide-dungeon-700">
            {deckCards.map(({ card, qty }) => (
              <div
                key={card.oracleId}
                className="flex items-center gap-2 px-3 py-2 hover:bg-dungeon-700/50"
              >
                <span className="text-gold-400 font-bold text-sm w-5">{qty}x</span>
                <span className={cn(
                  "w-2.5 h-2.5 rounded-full flex-shrink-0",
                  card.rarity === 'mythic' && "bg-orange-500",
                  card.rarity === 'rare' && "bg-yellow-500",
                  card.rarity === 'uncommon' && "bg-gray-300",
                  card.rarity === 'common' && "bg-gray-600",
                )} />
                <span className="text-parchment-200 text-sm flex-1 truncate">
                  {card.printedName || card.name}
                </span>
                <span className="text-parchment-500 text-xs w-4 text-right">
                  {card.cmc > 0 ? Math.floor(card.cmc) : ''}
                </span>
                <button
                  onClick={() => onRemove(card.oracleId)}
                  className="text-red-400 hover:text-red-300 p-1"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          disabled={deckCards.length === 0}
          className="flex-1"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Clear
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          disabled={deckCards.length === 0}
          className="flex-1"
        >
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>
      </div>

      {/* Playtest Button */}
      {deckSize >= 40 && (
        <Button className="w-full btn-primary" onClick={onPlaytest}>
          <Play className="w-4 h-4 mr-2" />
          Playtest
        </Button>
      )}
    </div>
  )
}
