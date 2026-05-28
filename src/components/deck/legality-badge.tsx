'use client'

import { AlertTriangle, Ban, ShieldAlert } from 'lucide-react'
import { cn, getCardLegalityStatus, type LegalityStatus } from '@/lib/utils'

interface Props {
  legalities: Record<string, string> | null | undefined
  format: string | null | undefined
  size?: 'sm' | 'md'
  className?: string
}

const COPY: Record<Exclude<LegalityStatus, 'legal'>, { label: string; tone: string; Icon: typeof AlertTriangle }> = {
  banned: {
    label: 'Banned in this format',
    tone: 'bg-dragon-900/80 text-dragon-200 border-dragon-500/60',
    Icon: Ban,
  },
  restricted: {
    label: 'Restricted in this format',
    tone: 'bg-gold-900/80 text-gold-200 border-gold-500/60',
    Icon: ShieldAlert,
  },
  not_legal: {
    label: 'Not legal in this format',
    tone: 'bg-dungeon-800/90 text-parchment-300 border-parchment-500/40',
    Icon: AlertTriangle,
  },
}

export function LegalityBadge({ legalities, format, size = 'md', className }: Props) {
  const status = getCardLegalityStatus(legalities, format)
  if (!status || status === 'legal') return null

  const { label, tone, Icon } = COPY[status]
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'
  const padding = size === 'sm' ? 'p-0.5' : 'p-1'

  return (
    <span
      title={`${label} (${format})`}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center rounded border',
        tone,
        padding,
        className
      )}
    >
      <Icon className={iconSize} />
    </span>
  )
}
