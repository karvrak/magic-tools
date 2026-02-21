'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Filter,
  X,
  Search,
  Hash,
  Plus,
  Users,
  Layers,
  Coins,
  LayoutGrid,
  List,
  Hammer,
  Sparkles,
  Lock,
  Sun,
  Droplets,
  Skull,
  Flame,
  TreePine,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatPrice, cn } from '@/lib/utils'
import { FadeIn } from '@/components/layout/page-transition'
import { CardNameAutocomplete } from './card-name-autocomplete'
import type { Owner, Tag, DeckStatus, ViewMode, Deck } from './types'
import { MANA_CONFIG, MTG_COLORS } from './types'

/** Map icon names to actual icon components */
const MANA_ICON_COMPONENTS = {
  W: Sun,
  U: Droplets,
  B: Skull,
  R: Flame,
  G: TreePine,
} as const

interface DeckFiltersProps {
  activeOwner: Owner | null
  decks: Deck[] | undefined
  sortedDecksCount: number
  totalCollectionValue: number
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  filterColors: string[]
  onFilterColorsChange: (colors: string[]) => void
  filterColorMode: 'any' | 'all' | 'exact'
  onFilterColorModeChange: (mode: 'any' | 'all' | 'exact') => void
  filterCardName: string
  onFilterCardNameChange: (name: string) => void
  filterStatus: DeckStatus | 'all'
  onFilterStatusChange: (status: DeckStatus | 'all') => void
  filterTags: string[]
  onFilterTagsChange: (tags: string[]) => void
  tags: Tag[] | undefined
  onCreateTag: (name: string) => void
  isCreatingTag: boolean
}

export function DeckFilters({
  activeOwner,
  decks,
  sortedDecksCount,
  totalCollectionValue,
  viewMode,
  onViewModeChange,
  filterColors,
  onFilterColorsChange,
  filterColorMode,
  onFilterColorModeChange,
  filterCardName,
  onFilterCardNameChange,
  filterStatus,
  onFilterStatusChange,
  filterTags,
  onFilterTagsChange,
  tags,
  onCreateTag,
  isCreatingTag,
}: DeckFiltersProps) {
  const [showTagInput, setShowTagInput] = useState(false)
  const [newTagName, setNewTagName] = useState('')

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      onCreateTag(newTagName.trim())
      setNewTagName('')
      setShowTagInput(false)
    }
  }

  return (
    <FadeIn delay={0.1}>
      <div className="card-frame p-4 space-y-4 !overflow-visible">
        {/* Row 1: Active Owner Info & Stats */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Active Owner Info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-parchment-400">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">
                {activeOwner ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: activeOwner.color }}
                    />
                    <span style={{ color: activeOwner.color }}>{activeOwner.name}</span>
                  </span>
                ) : (
                  <span className="text-gold-400">All users</span>
                )}
              </span>
            </div>
          </div>

          {/* Collection Stats & View Toggle */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-parchment-400">
              <Layers className="w-4 h-4" />
              <span className="text-sm">
                {decks?.length || 0} spellbook{(decks?.length || 0) !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-gold-500" />
              <span className="text-sm font-semibold text-gold-400">
                {formatPrice(totalCollectionValue, 'EUR')}
              </span>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 border-l border-dungeon-600 pl-4">
              <button
                onClick={() => onViewModeChange('grid')}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === 'grid'
                    ? "bg-gold-500/20 text-gold-400"
                    : "text-parchment-500 hover:text-parchment-300 hover:bg-dungeon-700"
                )}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => onViewModeChange('list')}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === 'list'
                    ? "bg-gold-500/20 text-gold-400"
                    : "text-parchment-500 hover:text-parchment-300 hover:bg-dungeon-700"
                )}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Row 3: Status Filter (visible in list view) */}
        {viewMode === 'list' && (
          <div className="flex items-center gap-3 pt-3 border-t border-dungeon-700">
            <div className="flex items-center gap-2 text-parchment-400">
              <span className="text-xs font-medium">Status:</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => onFilterStatusChange('all')}
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium transition-all",
                  filterStatus === 'all'
                    ? "bg-gold-500/20 text-gold-400 border border-gold-500/50"
                    : "text-parchment-400 hover:text-parchment-200 hover:bg-dungeon-700 border border-transparent"
                )}
              >
                All
              </button>
              <button
                onClick={() => onFilterStatusChange('building')}
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1",
                  filterStatus === 'building'
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                    : "text-parchment-400 hover:text-parchment-200 hover:bg-dungeon-700 border border-transparent"
                )}
              >
                <Hammer className="w-3 h-3" />
                Building
              </button>
              <button
                onClick={() => onFilterStatusChange('active')}
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1",
                  filterStatus === 'active'
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                    : "text-parchment-400 hover:text-parchment-200 hover:bg-dungeon-700 border border-transparent"
                )}
              >
                <Sparkles className="w-3 h-3" />
                Active
              </button>
              <button
                onClick={() => onFilterStatusChange('locked')}
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1",
                  filterStatus === 'locked'
                    ? "bg-slate-500/20 text-slate-400 border border-slate-500/50"
                    : "text-parchment-400 hover:text-parchment-200 hover:bg-dungeon-700 border border-transparent"
                )}
              >
                <Lock className="w-3 h-3" />
                Locked
              </button>
            </div>

            {/* Results count when filtered */}
            {filterStatus !== 'all' && (
              <span className="text-xs text-parchment-500 ml-2">
                ({sortedDecksCount} deck{sortedDecksCount !== 1 ? 's' : ''})
              </span>
            )}
          </div>
        )}

        {/* Row 2: Color Filter & Card Search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t border-dungeon-700">
          {/* Color Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-parchment-400">
              <Filter className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Colors:</span>
            </div>
            <div className="flex items-center gap-1">
              {MTG_COLORS.map((colorCode) => {
                const config = MANA_CONFIG[colorCode]
                const Icon = MANA_ICON_COMPONENTS[colorCode]
                const isActive = filterColors.includes(colorCode)

                return (
                  <motion.button
                    key={colorCode}
                    onClick={() => {
                      if (isActive) {
                        onFilterColorsChange(filterColors.filter(c => c !== colorCode))
                      } else {
                        onFilterColorsChange([...filterColors, colorCode])
                      }
                    }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'relative w-7 h-7 sm:w-8 sm:h-8 rounded-md border-2 transition-all duration-200',
                      'bg-gradient-to-br flex items-center justify-center',
                      config.bg,
                      isActive ? [config.activeBorder, config.glow] : [config.border, 'opacity-60 hover:opacity-100'],
                    )}
                    title={config.name}
                  >
                    <Icon className={cn('w-3.5 h-3.5 sm:w-4 sm:h-4', config.text)} />
                  </motion.button>
                )
              })}
            </div>

            {/* Color mode selector */}
            {filterColors.length > 0 && (
              <Select
                value={filterColorMode}
                onValueChange={(value: 'any' | 'all' | 'exact') => onFilterColorModeChange(value)}
              >
                <SelectTrigger className="w-[80px] sm:w-[100px] h-7 sm:h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="exact">Exact</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Clear colors button */}
            {filterColors.length > 0 && (
              <button
                onClick={() => onFilterColorsChange([])}
                className="text-dungeon-400 hover:text-parchment-300 transition-colors p-1"
                title="Clear color filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Separator - desktop only */}
          <div className="hidden sm:block w-px h-6 bg-dungeon-600 flex-shrink-0" />

          {/* Card Name Search */}
          <div className="flex items-center gap-2 flex-1 min-w-0 relative">
            <div className="flex items-center gap-1.5 text-parchment-400 flex-shrink-0">
              <Search className="w-3.5 h-3.5" />
              <span className="text-xs font-medium hidden sm:inline">Card:</span>
            </div>
            <CardNameAutocomplete
              value={filterCardName}
              onChange={onFilterCardNameChange}
              placeholder="Search by card..."
            />

            {/* Clear all filters */}
            {(filterColors.length > 0 || filterCardName || filterTags.length > 0) && (
              <button
                onClick={() => {
                  onFilterColorsChange([])
                  onFilterCardNameChange('')
                  onFilterTagsChange([])
                }}
                className="text-xs text-dragon-400 hover:text-dragon-300 transition-colors flex items-center gap-1 flex-shrink-0 whitespace-nowrap"
              >
                <X className="w-3 h-3" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 4: Tags Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t border-dungeon-700">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-parchment-400">
              <Hash className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Tags:</span>
            </div>

            {/* List of existing tags */}
            {tags && tags.length > 0 ? (
              <div className="flex items-center gap-1 flex-wrap">
                {tags.map((tag) => {
                  const isActive = filterTags.includes(tag.name)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => {
                        if (isActive) {
                          onFilterTagsChange(filterTags.filter(t => t !== tag.name))
                        } else {
                          onFilterTagsChange([...filterTags, tag.name])
                        }
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 border",
                        isActive
                          ? "border-opacity-100"
                          : "border-opacity-40 opacity-60 hover:opacity-100"
                      )}
                      style={{
                        backgroundColor: isActive ? `${tag.color}20` : 'transparent',
                        borderColor: tag.color,
                        color: tag.color,
                      }}
                    >
                      {tag.name}
                      {isActive && <X className="w-2.5 h-2.5" />}
                    </button>
                  )
                })}
              </div>
            ) : (
              <span className="text-xs text-dungeon-500 italic">No tags</span>
            )}
          </div>

          {/* Add new tag */}
          <div className="flex items-center gap-2">
            {showTagInput ? (
              <div className="flex items-center gap-1">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="New tag..."
                  className="h-6 w-24 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTagName.trim()) {
                      handleCreateTag()
                    } else if (e.key === 'Escape') {
                      setShowTagInput(false)
                      setNewTagName('')
                    }
                  }}
                  autoFocus
                />
                <button
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || isCreatingTag}
                  className="p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setShowTagInput(false)
                    setNewTagName('')
                  }}
                  className="p-1 text-dungeon-400 hover:text-parchment-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowTagInput(true)}
                className="text-xs text-arcane-400 hover:text-arcane-300 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add tag</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </FadeIn>
  )
}
