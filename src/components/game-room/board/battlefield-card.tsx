'use client'

import Image from 'next/image'
import {
  RotateCw,
  Trash2,
  Undo2,
  EyeOff,
  Minus,
  Zap,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BattlefieldCard, CardCounters } from '@/lib/game-room/types'
import { WithHoverPreview } from '@/components/card/card-hover-preview'

const TOKEN_BG: Record<string, string> = {
  W: 'from-amber-200/30 to-amber-100/10',
  U: 'from-blue-500/30 to-blue-600/10',
  B: 'from-gray-700/40 to-gray-900/20',
  R: 'from-red-500/30 to-red-600/10',
  G: 'from-green-500/30 to-green-600/10',
}

function TokenBattlefieldDisplay({ card, larger }: { card: BattlefieldCard; larger: boolean }) {
  const color = card.colors?.[0] || 'C'
  const bg = TOKEN_BG[color] || 'from-gray-400/20 to-gray-500/10'
  const tokenName = card.printedName || card.name?.replace(/\s*\(.*\)/, '') || 'Token'

  return (
    <div className={cn(
      "w-full h-full bg-gradient-to-b flex flex-col items-center justify-between",
      bg,
      "bg-dungeon-800"
    )}>
      {/* Name */}
      <div className="w-full px-1 pt-1 text-center">
        <span className={cn(
          "font-bold text-parchment-200 leading-tight block truncate",
          larger ? "text-[10px]" : "text-[9px]"
        )}>
          {tokenName}
        </span>
      </div>
      {/* P/T */}
      {card.power && card.toughness && (
        <div className={cn(
          "font-bold text-gold-400 mb-1",
          larger ? "text-base" : "text-sm"
        )}>
          {card.power}/{card.toughness}
        </div>
      )}
      {/* Type */}
      <div className="w-full px-0.5 pb-0.5 text-center">
        <span className={cn(
          "text-parchment-500 leading-tight block truncate",
          larger ? "text-[8px]" : "text-[7px]"
        )}>
          {(card.typeLine || 'Token').replace('Token ', '')}
        </span>
      </div>
    </div>
  )
}

function CounterBadge({ count, color, label }: { count: number; color: string; label: string }) {
  if (count === 0) return null
  return (
    <div
      className={cn(
        "min-w-[16px] h-[16px] rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-md border border-white/20",
        color
      )}
      title={label}
    >
      {count}
    </div>
  )
}

interface BattlefieldCardMiniProps {
  card: BattlefieldCard
  onTap: () => void
  onGraveyard: () => void
  onBounce: () => void
  onExile?: () => void
  onAdjustCounter?: (type: 'plusOne' | 'minusOne', delta: number) => void
  onAddGenericCounter?: () => void
  onAdjustGenericCounter?: (label: string, delta: number) => void
  onRemoveGenericCounter?: (label: string) => void
  onSelect?: () => void
  larger?: boolean
}

export function BattlefieldCardMini({
  card,
  onTap,
  onGraveyard,
  onBounce,
  onExile,
  onAdjustCounter,
  onAddGenericCounter,
  onAdjustGenericCounter,
  onRemoveGenericCounter,
  onSelect,
  larger = false,
}: BattlefieldCardMiniProps) {
  const size = larger ? "w-[80px] h-[112px]" : "w-[60px] h-[84px]"
  const hasCounters = card.counters.plusOne > 0 || card.counters.minusOne > 0 || card.counters.genericCounters.length > 0

  const countersInfo: CardCounters | undefined = hasCounters ? card.counters : undefined

  return (
    <div className="relative group">
      <WithHoverPreview card={{
        name: card?.printedName || card?.name || '',
        image: card?.imageNormal || null,
        type: card?.typeLine,
        counters: countersInfo,
        power: card?.power,
        toughness: card?.toughness,
        colors: card?.colors,
        isToken: card?.isToken,
      }}>
        <button
          onClick={() => { if (onSelect) onSelect(); else onTap(); }}
          className={cn(
            size,
            "rounded overflow-hidden transition-transform relative",
            card.tapped && "rotate-90",
            card.isToken && "border-2 border-dashed border-gold-500/40"
          )}
        >
          {card?.imageNormal ? (
            <Image src={card.imageNormal} alt={card.name || ''} fill className="object-cover" sizes={larger ? "80px" : "60px"} />
          ) : card.isToken ? (
            <TokenBattlefieldDisplay card={card} larger={larger} />
          ) : (
            <div className="w-full h-full bg-dungeon-800 flex items-center justify-center p-1">
              <span className="text-[7px] text-center text-parchment-500 leading-tight">{card?.name || ''}</span>
            </div>
          )}
          {card.tapped && <div className="absolute inset-0 bg-black/20" />}

          {/* Counter badges overlay */}
          {hasCounters && (
            <div className={cn(
              "absolute top-0.5 right-0.5 flex flex-col gap-0.5",
              card.tapped && "rotate-[-90deg]"
            )}>
              <CounterBadge count={card.counters.plusOne} color="bg-emerald-600" label={`+1/+1 (${card.counters.plusOne})`} />
              <CounterBadge count={card.counters.minusOne} color="bg-dragon-600" label={`-1/-1 (${card.counters.minusOne})`} />
              {card.counters.genericCounters.map((gc) => (
                <CounterBadge key={gc.label} count={gc.count} color="bg-arcane-600" label={`${gc.label} (${gc.count})`} />
              ))}
            </div>
          )}
        </button>
      </WithHoverPreview>

      {/* Action buttons on hover */}
      <div className={cn(
        "absolute opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 z-10",
        card.tapped ? "top-1/2 -right-1 -translate-y-1/2 flex-col" : "-bottom-1 left-1/2 -translate-x-1/2"
      )}>
        <button onClick={(e) => { e.stopPropagation(); onTap(); }} className="p-0.5 bg-arcane-600/90 text-white rounded" title="Tap">
          <RotateCw className="w-2.5 h-2.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onBounce(); }} className="p-0.5 bg-blue-600/90 text-white rounded" title="Hand">
          <Undo2 className="w-2.5 h-2.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onGraveyard(); }} className="p-0.5 bg-dragon-600/90 text-white rounded" title="Graveyard">
          <Trash2 className="w-2.5 h-2.5" />
        </button>
        {onExile && (
          <button onClick={(e) => { e.stopPropagation(); onExile(); }} className="p-0.5 bg-parchment-700/90 text-white rounded" title="Exile">
            <EyeOff className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      {/* Counter controls on hover */}
      {onAdjustCounter && (
        <div className={cn(
          "absolute opacity-0 group-hover:opacity-100 transition-opacity z-10",
          card.tapped ? "-left-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5" : "-top-1 left-1/2 -translate-x-1/2 flex gap-0.5"
        )}>
          <button
            onClick={(e) => { e.stopPropagation(); onAdjustCounter('plusOne', -1); }}
            className="p-0.5 bg-emerald-800/90 text-emerald-200 rounded text-[8px] font-bold leading-none min-w-[14px]"
            title="Remove +1/+1"
          >
            -
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAdjustCounter('plusOne', 1); }}
            className="p-0.5 bg-emerald-600/90 text-white rounded text-[8px] font-bold leading-none min-w-[14px]"
            title="Add +1/+1"
          >
            +
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAdjustCounter('minusOne', 1); }}
            className="p-0.5 bg-dragon-600/90 text-white rounded text-[8px] font-bold leading-none min-w-[14px]"
            title="Add -1/-1"
          >
            <Minus className="w-2 h-2" />
          </button>
          {onAddGenericCounter && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddGenericCounter(); }}
              className="p-0.5 bg-arcane-600/90 text-white rounded text-[8px] font-bold leading-none min-w-[14px]"
              title="Add named counter"
            >
              <Zap className="w-2 h-2" />
            </button>
          )}
        </div>
      )}

      {/* Generic counter adjustment buttons */}
      {card.counters.genericCounters.length > 0 && onAdjustGenericCounter && onRemoveGenericCounter && (
        <div className={cn(
          "absolute opacity-0 group-hover:opacity-100 transition-opacity z-10",
          card.tapped ? "-left-6 top-0 flex flex-col gap-0.5" : "top-0 -left-1 flex flex-col gap-0.5"
        )}>
          {card.counters.genericCounters.map((gc) => (
            <div key={gc.label} className="flex items-center gap-px">
              <button
                onClick={(e) => { e.stopPropagation(); onAdjustGenericCounter(gc.label, -1); }}
                className="px-0.5 bg-arcane-800/90 text-arcane-200 rounded-l text-[7px] font-bold"
                title={`Remove ${gc.label}`}
              >-</button>
              <span className="px-1 bg-arcane-700/80 text-[7px] text-white">{gc.count}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onAdjustGenericCounter(gc.label, 1); }}
                className="px-0.5 bg-arcane-600/90 text-white rounded-r text-[7px] font-bold"
                title={`Add ${gc.label}`}
              >+</button>
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveGenericCounter(gc.label); }}
                className="ml-px p-0.5 bg-dragon-700/80 text-white rounded text-[7px]"
                title={`Remove all ${gc.label}`}
              >
                <X className="w-2 h-2" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
