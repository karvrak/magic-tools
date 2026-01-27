'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Check, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { formatPrice, getBestPrice } from '@/lib/utils'

interface CardVersion {
  id: string
  name: string
  setCode: string
  setName: string
  collectorNumber: string
  rarity: string
  imageSmall: string | null
  imageNormal: string | null
  isPromo: boolean
  isBooster: boolean
  frameEffects: string[] | null
  isFullArt: boolean
  isTextless: boolean
  isVariation: boolean
  priceEur: number | null
  priceEurFoil: number | null
  priceUsd: number | null
  priceUsdFoil: number | null
}

interface SetSelectorProps {
  cardId: string
  currentSetCode: string
  onEditionChange: (newCardId: string) => void
  disabled?: boolean
}

export function SetSelector({
  cardId,
  currentSetCode,
  onEditionChange,
  disabled = false,
}: SetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredVersion, setHoveredVersion] = useState<CardVersion | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch versions only when dropdown is opened
  const { data, isLoading, error } = useQuery<{
    currentId: string
    versions: CardVersion[]
    totalVersions: number
  }>({
    queryKey: ['card-versions', cardId],
    queryFn: async () => {
      const response = await fetch(`/api/cards/${cardId}/versions`)
      if (!response.ok) throw new Error('Failed to fetch versions')
      return response.json()
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleSelect = (version: CardVersion) => {
    if (version.id !== cardId) {
      onEditionChange(version.id)
    }
    setIsOpen(false)
  }

  const getFrameLabel = (version: CardVersion) => {
    if (version.frameEffects?.includes('showcase')) return 'Showcase'
    if (version.frameEffects?.includes('extendedart')) return 'Extended'
    if (version.frameEffects?.includes('borderless')) return 'Borderless'
    if (version.frameEffects?.includes('etched')) return 'Etched'
    if (version.isFullArt) return 'Full Art'
    if (version.isTextless) return 'Textless'
    if (version.isPromo) return 'Promo'
    return null
  }

  const getVersionPrice = (version: CardVersion) => {
    const price = version.priceEur || version.priceUsd
    if (!price) return null
    const currency = version.priceEur ? 'EUR' : 'USD'
    return formatPrice(price, currency)
  }

  // Only show chevron if there might be multiple versions (most cards do)
  const hasMultipleVersions = !data || data.totalVersions > 1

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (!disabled) setIsOpen(!isOpen)
        }}
        disabled={disabled}
        className={cn(
          'flex items-center gap-0.5 text-xs text-dungeon-400 uppercase hover:text-parchment-300 transition-colors rounded px-1 -mx-1',
          'hover:bg-dungeon-700/50',
          disabled && 'opacity-50 cursor-not-allowed',
          isOpen && 'bg-dungeon-700/50 text-parchment-300'
        )}
        title="Change edition"
      >
        <span>{currentSetCode}</span>
        {hasMultipleVersions && (
          <ChevronDown className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full right-0 mt-1 flex">
          {/* Card Preview on Hover - Left side */}
          {hoveredVersion && hoveredVersion.imageNormal && (
            <div className="mr-2 hidden sm:block">
              <div className="relative w-[200px] h-[280px] rounded-lg overflow-hidden shadow-xl border border-dungeon-600">
                <Image
                  src={hoveredVersion.imageNormal}
                  alt={hoveredVersion.name}
                  fill
                  className="object-cover"
                  sizes="200px"
                  priority
                />
              </div>
            </div>
          )}

          {/* Versions List */}
          <div className="min-w-[280px] max-h-[320px] overflow-y-auto bg-dungeon-800 border border-dungeon-600 rounded-lg shadow-xl">
            {isLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin text-parchment-400" />
              </div>
            ) : error ? (
              <div className="p-3 text-sm text-dragon-400">Failed to load editions</div>
            ) : data && data.versions.length > 0 ? (
              <div className="py-1">
                <div className="px-3 py-2 text-xs text-parchment-500 font-medium border-b border-dungeon-700">
                  {data.totalVersions} edition{data.totalVersions > 1 ? 's' : ''} available
                </div>
                {data.versions.map((version) => {
                  const isSelected = version.id === cardId
                  const frameLabel = getFrameLabel(version)
                  const price = getVersionPrice(version)

                  return (
                    <button
                      key={version.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelect(version)
                      }}
                      onMouseEnter={() => setHoveredVersion(version)}
                      onMouseLeave={() => setHoveredVersion(null)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 hover:bg-dungeon-700/50 transition-colors text-left',
                        isSelected && 'bg-dungeon-700/30'
                      )}
                    >
                      {/* Thumbnail */}
                      <div className="relative w-8 h-11 rounded overflow-hidden bg-dungeon-700 flex-shrink-0">
                        {version.imageSmall ? (
                          <Image
                            src={version.imageSmall}
                            alt={version.setName}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-dungeon-500">
                            ?
                          </div>
                        )}
                      </div>

                      {/* Set Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-parchment-200 uppercase font-medium">
                            {version.setCode}
                          </span>
                          {frameLabel && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-arcane-500/20 text-arcane-400">
                              {frameLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-parchment-500 truncate">{version.setName}</p>
                        <p className="text-xs text-dungeon-500">#{version.collectorNumber}</p>
                      </div>

                      {/* Price & Selection */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {price && (
                          <span className="text-xs text-gold-400">{price}</span>
                        )}
                        {isSelected && (
                          <Check className="w-4 h-4 text-arcane-400" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="p-3 text-sm text-parchment-500">No other editions available</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
