'use client'

import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PreviewCard {
  name: string
  image: string | null
  type?: string
}

interface HoverPreviewContextType {
  showPreview: (card: PreviewCard, event: React.MouseEvent) => void
  hidePreview: () => void
  isVisible: boolean
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
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <span className="text-parchment-400 text-center font-medium">
                      {previewCard.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Card Name Bar */}
              <div className="bg-dungeon-900/95 backdrop-blur-sm px-3 py-2 border-t border-gold-600/20">
                <p className="text-sm font-medium text-parchment-100 truncate">
                  {previewCard.name}
                </p>
                {previewCard.type && (
                  <p className="text-xs text-parchment-500 truncate">
                    {previewCard.type}
                  </p>
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

  if (disabled || !card.image) {
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
