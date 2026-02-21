'use client'

import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface NamedCounter {
  label: string
  count: number
}

interface CardCounters {
  plusOne: number
  minusOne: number
  genericCounters: NamedCounter[]
}

interface PreviewCard {
  name: string
  image: string | null
  type?: string
  counters?: CardCounters
  power?: string | null
  toughness?: string | null
  colors?: string[]
  isToken?: boolean
}

interface HoverPreviewContextType {
  showPreview: (card: PreviewCard, event: React.MouseEvent) => void
  hidePreview: () => void
  isVisible: boolean
}

const TOKEN_COLOR_GRADIENT: Record<string, string> = {
  W: 'from-amber-100/30 via-amber-200/20 to-amber-100/10',
  U: 'from-blue-600/30 via-blue-500/20 to-blue-600/10',
  B: 'from-gray-800/50 via-gray-700/30 to-gray-900/20',
  R: 'from-red-600/30 via-red-500/20 to-red-600/10',
  G: 'from-green-600/30 via-green-500/20 to-green-600/10',
}

const TOKEN_COLOR_BORDER: Record<string, string> = {
  W: 'border-amber-300/50',
  U: 'border-blue-400/50',
  B: 'border-gray-500/50',
  R: 'border-red-400/50',
  G: 'border-green-400/50',
}

function TokenCardPreview({ card }: { card: PreviewCard }) {
  const color = card.colors?.[0] || 'C'
  const gradient = TOKEN_COLOR_GRADIENT[color] || 'from-gray-500/20 via-gray-400/15 to-gray-500/10'
  const borderColor = TOKEN_COLOR_BORDER[color] || 'border-gray-400/40'

  return (
    <div className={cn(
      "w-full h-full flex flex-col items-center justify-between p-5 bg-gradient-to-b border-2 border-dashed rounded-lg",
      gradient,
      borderColor,
    )}>
      {/* Card name */}
      <div className="text-center mt-2">
        <p className="text-lg font-bold text-parchment-100 leading-tight">
          {card.isToken ? (card.name?.replace(/\s*\(.*\)/, '') || 'Token') : card.name}
        </p>
      </div>

      {/* Token emblem */}
      <div className="flex flex-col items-center gap-3">
        <div className={cn(
          "w-20 h-20 rounded-full border-2 flex items-center justify-center",
          borderColor,
          "bg-dungeon-800/60"
        )}>
          <span className="text-4xl font-medieval text-gold-400/80">T</span>
        </div>
        {card.type && (
          <p className="text-sm text-parchment-400 text-center italic">{card.type}</p>
        )}
      </div>

      {/* Power / Toughness */}
      {card.power && card.toughness && (
        <div className={cn(
          "px-5 py-2 rounded-lg border bg-dungeon-900/70",
          borderColor,
        )}>
          <span className="text-2xl font-bold text-parchment-100">
            {card.power}/{card.toughness}
          </span>
        </div>
      )}
    </div>
  )
}

const HoverPreviewContext = createContext<HoverPreviewContextType | null>(null)

export function useHoverPreview() {
  const context = useContext(HoverPreviewContext)
  if (!context) {
    throw new Error('useHoverPreview must be used within HoverPreviewProvider')
  }
  return context
}

interface HoverPreviewProviderProps {
  children: ReactNode
}

export function HoverPreviewProvider({ children }: HoverPreviewProviderProps) {
  const [previewCard, setPreviewCard] = useState<PreviewCard | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isVisible, setIsVisible] = useState(false)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const showPreview = (card: PreviewCard, event: React.MouseEvent) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }

    // Calculate position - prefer right side, fall back to left if too close to edge
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    const previewWidth = 280
    const previewHeight = 390
    const padding = 16

    let x = rect.right + padding
    let y = rect.top

    // If preview would go off right edge, show on left
    if (x + previewWidth > window.innerWidth - padding) {
      x = rect.left - previewWidth - padding
    }

    // Keep within vertical bounds
    if (y + previewHeight > window.innerHeight - padding) {
      y = window.innerHeight - previewHeight - padding
    }
    if (y < padding) {
      y = padding
    }

    setPosition({ x, y })
    setPreviewCard(card)
    setIsVisible(true)
  }

  const hidePreview = () => {
    // Small delay to allow moving to preview without it disappearing
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => setPreviewCard(null), 150)
    }, 50)
  }

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [])

  return (
    <HoverPreviewContext.Provider value={{ showPreview, hidePreview, isVisible }}>
      {children}
      
      {/* Global Preview Overlay */}
      <AnimatePresence>
        {isVisible && previewCard && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed z-[100] pointer-events-none"
            style={{ left: position.x, top: position.y }}
          >
            <div className="w-[280px] rounded-xl overflow-hidden shadow-2xl shadow-dungeon-900/80 border-2 border-gold-600/30">
              {/* Card Image */}
              <div className="relative aspect-[488/680] bg-dungeon-800">
                {previewCard.image ? (
                  <Image
                    src={previewCard.image}
                    alt={previewCard.name}
                    fill
                    className="object-cover"
                    sizes="280px"
                    priority
                  />
                ) : (
                  <TokenCardPreview card={previewCard} />
                )}
              </div>

              {/* Card Name Bar + Counters */}
              <div className="bg-dungeon-900/95 backdrop-blur-sm px-3 py-2 border-t border-gold-600/20">
                <p className="text-sm font-medium text-parchment-100 truncate">
                  {previewCard.name}
                </p>
                {previewCard.type && (
                  <p className="text-xs text-parchment-500 truncate">
                    {previewCard.type}
                  </p>
                )}
                {/* Counters display */}
                {previewCard.counters && (
                  <div className="mt-1.5 pt-1.5 border-t border-dungeon-700 space-y-1">
                    {/* Generic named counters */}
                    {previewCard.counters.genericCounters.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {previewCard.counters.genericCounters.map((gc) => (
                          <span key={gc.label} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-arcane-600/20 text-arcane-300 rounded text-[11px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-arcane-400" />
                            {gc.label}: {gc.count}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* +1/+1 and -1/-1 summary */}
                    {(previewCard.counters.plusOne > 0 || previewCard.counters.minusOne > 0) && (
                      <div className="flex flex-wrap gap-1.5">
                        {previewCard.counters.plusOne > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-600/20 text-emerald-300 rounded text-[11px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            +1/+1: {previewCard.counters.plusOne}
                          </span>
                        )}
                        {previewCard.counters.minusOne > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-600/20 text-red-300 rounded text-[11px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            -1/-1: {previewCard.counters.minusOne}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </HoverPreviewContext.Provider>
  )
}

// Helper component to wrap cards with hover preview functionality
interface WithHoverPreviewProps {
  card: PreviewCard
  children: ReactNode
  className?: string
  disabled?: boolean
}

export function WithHoverPreview({ card, children, className, disabled }: WithHoverPreviewProps) {
  const { showPreview, hidePreview } = useHoverPreview()

  if (disabled) {
    return <div className={className}>{children}</div>
  }

  return (
    <div
      className={className}
      onMouseEnter={(e) => showPreview(card, e)}
      onMouseLeave={hidePreview}
    >
      {children}
    </div>
  )
}
