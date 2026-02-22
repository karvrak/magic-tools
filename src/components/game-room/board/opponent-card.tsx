'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { BattlefieldCardInfo, CardCounters } from '@/lib/game-room/types'
import { WithHoverPreview } from '@/components/card/card-hover-preview'

const TOKEN_BG: Record<string, string> = {
  W: 'from-amber-200/30 to-amber-100/10',
  U: 'from-blue-500/30 to-blue-600/10',
  B: 'from-gray-700/40 to-gray-900/20',
  R: 'from-red-500/30 to-red-600/10',
  G: 'from-green-500/30 to-green-600/10',
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

function GenericCounterBadge({ count, color, label }: { count: number; color: string; label: string }) {
  if (count === 0) return null
  const letter = label.charAt(0).toUpperCase()
  return (
    <div
      className={cn(
        "min-w-[16px] h-[16px] rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-md border border-white/20",
        color
      )}
      title={`${label} (${count})`}
    >
      {letter}{count > 1 ? count : ''}
    </div>
  )
}

function OpponentTokenDisplay({ card, small }: { card: BattlefieldCardInfo; small: boolean }) {
  // Extract color from card name (format: "Name (P/T)" or just "Name")
  // We'll use default gray since we don't have color info in BattlefieldCardInfo
  const bg = 'from-gray-400/20 to-gray-500/10'
  const tokenName = card.name?.replace(/\s*\(.*\)/, '') || 'Token'
  const typeLine = card.type || ''
  const isCreatureToken = typeLine.toLowerCase().includes('creature')

  // Try to extract P/T from name if present (format: "Name (P/T)")
  const ptMatch = card.name?.match(/\((\d+)\/(\d+)\)/)
  const power = ptMatch?.[1]
  const toughness = ptMatch?.[2]
  const hasStats = power && toughness && isCreatureToken

  return (
    <div className={cn(
      "w-full h-full bg-gradient-to-b flex flex-col items-center justify-between border-2 border-dashed border-gold-500/40",
      bg,
      "bg-dungeon-800"
    )}>
      {/* Name */}
      <div className="w-full px-1 pt-1 text-center">
        <span className={cn(
          "font-bold text-parchment-200 leading-tight block truncate",
          small ? "text-[9px]" : "text-[10px]"
        )}>
          {tokenName}
        </span>
      </div>
      {/* P/T - only for creatures */}
      {hasStats ? (
        <div className={cn(
          "font-bold text-gold-400 mb-1",
          small ? "text-sm" : "text-base"
        )}>
          {power}/{toughness}
        </div>
      ) : (
        <div className="flex-1" />
      )}
      {/* Type */}
      <div className="w-full px-0.5 pb-0.5 text-center">
        <span className={cn(
          "text-parchment-500 leading-tight block truncate",
          small ? "text-[7px]" : "text-[8px]"
        )}>
          {typeLine.replace('Token ', '') || 'Token'}
        </span>
      </div>
    </div>
  )
}

interface OpponentBattlefieldCardProps {
  card: BattlefieldCardInfo
  small?: boolean
  expanded?: boolean
  onSelect?: () => void
}

export function OpponentBattlefieldCard({
  card,
  small = false,
  expanded = false,
  onSelect,
}: OpponentBattlefieldCardProps) {
  const size = expanded
    ? (small ? "w-[60px] h-[84px]" : "w-[80px] h-[112px]")
    : (small ? "w-[70px] h-[98px]" : "w-[90px] h-[126px]")
  const imgSize = expanded ? (small ? "60px" : "80px") : (small ? "70px" : "90px")

  const hasCounters = card.counters && (card.counters.plusOne > 0 || card.counters.minusOne > 0 || (card.counters.genericCounters && card.counters.genericCounters.length > 0))

  return (
    <WithHoverPreview card={{ name: card.name, image: card.image, type: card.type, counters: hasCounters ? card.counters : undefined }}>
      <div
        onClick={onSelect}
        className={cn(
          size,
          "rounded overflow-hidden relative cursor-pointer",
          card.tapped && "rotate-90"
        )}
      >
        {card.image ? (
          <Image src={card.image} alt={card.name} fill className="object-cover" sizes={imgSize} />
        ) : (
          <OpponentTokenDisplay card={card} small={small} />
        )}
        {card.tapped && <div className="absolute inset-0 bg-black/20" />}

        {/* Counter badges overlay - read-only */}
        {hasCounters && card.counters && (
          <div className={cn(
            "absolute top-0.5 right-0.5 flex flex-col gap-0.5",
            card.tapped && "rotate-[-90deg]"
          )}>
            <CounterBadge count={card.counters.plusOne} color="bg-emerald-600" label={`+1/+1 (${card.counters.plusOne})`} />
            <CounterBadge count={card.counters.minusOne} color="bg-dragon-600" label={`-1/-1 (${card.counters.minusOne})`} />
            {(card.counters.genericCounters || []).map((gc) => (
              <GenericCounterBadge key={gc.label} count={gc.count} color="bg-arcane-600" label={gc.label} />
            ))}
          </div>
        )}
      </div>
    </WithHoverPreview>
  )
}
