'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { BattlefieldCardInfo, CardCounters } from '@/lib/game-room/types'
import { WithHoverPreview } from '@/components/card/card-hover-preview'

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
          <div className="w-full h-full bg-dungeon-800 flex items-center justify-center p-1">
            <span className="text-[7px] text-center text-parchment-500 leading-tight">{card.name}</span>
          </div>
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
              <CounterBadge key={gc.label} count={gc.count} color="bg-arcane-600" label={`${gc.label} (${gc.count})`} />
            ))}
          </div>
        )}
      </div>
    </WithHoverPreview>
  )
}
