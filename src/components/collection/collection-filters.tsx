'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import {
  Flame,
  Droplets,
  Skull,
  Sun,
  TreePine,
  Sword,
  Crown,
  Gem,
  Shield,
  Search,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  Sparkles,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

export interface CollectionFilters {
  name: string
  colors: string[]
  colorMode: 'include' | 'exact' | 'atMost'
  rarity: string[]
  type: string
  set: string
  cmcMin: number | null
  cmcMax: number | null
  condition: string
  isFoil: 'all' | 'true' | 'false'
  sortBy: 'date' | 'name' | 'price' | 'cmc' | 'rarity' | 'set'
  sortDir: 'asc' | 'desc'
}

export const DEFAULT_COLLECTION_FILTERS: CollectionFilters = {
  name: '',
  colors: [],
  colorMode: 'include',
  rarity: [],
  type: '',
  set: '',
  cmcMin: null,
  cmcMax: null,
  condition: 'all',
  isFoil: 'all',
  sortBy: 'date',
  sortDir: 'desc',
}

interface CollectionFiltersPanelProps {
  filters: CollectionFilters
  onChange: (filters: CollectionFilters) => void
  onReset: () => void
  hasActiveFilters: boolean
}

// Mana color icons and styles
const MANA_CONFIG = {
  W: {
    icon: Sun,
    name: 'White',
    bg: 'from-amber-100 to-yellow-50',
    border: 'border-amber-300',
    activeBorder: 'border-amber-400',
    glow: 'shadow-[0_0_12px_rgba(251,191,36,0.5)]',
    text: 'text-amber-900'
  },
  U: {
    icon: Droplets,
    name: 'Blue',
    bg: 'from-blue-500 to-blue-600',
    border: 'border-blue-400',
    activeBorder: 'border-blue-300',
    glow: 'shadow-[0_0_12px_rgba(59,130,246,0.6)]',
    text: 'text-white'
  },
  B: {
    icon: Skull,
    name: 'Black',
    bg: 'from-gray-800 to-gray-900',
    border: 'border-gray-600',
    activeBorder: 'border-purple-500',
    glow: 'shadow-[0_0_12px_rgba(168,85,247,0.5)]',
    text: 'text-gray-200'
  },
  R: {
    icon: Flame,
    name: 'Red',
    bg: 'from-red-500 to-red-600',
    border: 'border-red-400',
    activeBorder: 'border-orange-400',
    glow: 'shadow-[0_0_12px_rgba(239,68,68,0.6)]',
    text: 'text-white'
  },
  G: {
    icon: TreePine,
    name: 'Green',
    bg: 'from-green-500 to-green-600',
    border: 'border-green-400',
    activeBorder: 'border-emerald-300',
    glow: 'shadow-[0_0_12px_rgba(34,197,94,0.6)]',
    text: 'text-white'
  },
}

// Rarity config
const RARITY_CONFIG = {
  common: {
    icon: Shield,
    name: 'Common',
    bg: 'bg-gradient-to-br from-stone-600 to-stone-700',
    border: 'border-stone-500',
    activeBg: 'bg-gradient-to-br from-stone-500 to-stone-600',
    activeBorder: 'border-stone-300',
    glow: 'shadow-[0_0_8px_rgba(168,162,158,0.4)]'
  },
  uncommon: {
    icon: Sword,
    name: 'Uncommon',
    bg: 'bg-gradient-to-br from-slate-500 to-slate-600',
    border: 'border-slate-400',
    activeBg: 'bg-gradient-to-br from-slate-400 to-slate-500',
    activeBorder: 'border-slate-200',
    glow: 'shadow-[0_0_10px_rgba(148,163,184,0.5)]'
  },
  rare: {
    icon: Crown,
    name: 'Rare',
    bg: 'bg-gradient-to-br from-amber-500 to-yellow-600',
    border: 'border-amber-400',
    activeBg: 'bg-gradient-to-br from-amber-400 to-yellow-500',
    activeBorder: 'border-yellow-300',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.6)]'
  },
  mythic: {
    icon: Gem,
    name: 'Mythic',
    bg: 'bg-gradient-to-br from-orange-500 via-red-500 to-rose-600',
    border: 'border-orange-400',
    activeBg: 'bg-gradient-to-br from-orange-400 via-red-400 to-rose-500',
    activeBorder: 'border-orange-300',
    glow: 'shadow-[0_0_15px_rgba(249,115,22,0.7)]'
  },
}

const CONDITIONS = [
  { code: 'all', name: 'Toutes' },
  { code: 'nm', name: 'Near Mint' },
  { code: 'lp', name: 'Light Play' },
  { code: 'mp', name: 'Moderate Play' },
  { code: 'hp', name: 'Heavy Play' },
  { code: 'dmg', name: 'Damaged' },
]

const SORT_OPTIONS = [
  { value: 'date', label: 'Date ajout' },
  { value: 'name', label: 'Nom' },
  { value: 'price', label: 'Prix' },
  { value: 'cmc', label: 'CMC' },
  { value: 'rarity', label: 'Rareté' },
  { value: 'set', label: 'Édition' },
]

// Set Autocomplete
interface SetSuggestion {
  code: string
  name: string
  count: number
}

function SetAutocomplete({
  value,
  onChange
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [suggestions, setSuggestions] = useState<SetSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [inputText, setInputText] = useState('')
  const [selectedSet, setSelectedSet] = useState<SetSuggestion | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const debouncedInput = useDebouncedValue(inputText, 200)

  const fetchSuggestions = useCallback(async (query: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/search/sets?q=${encodeURIComponent(query)}&limit=15`)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('Failed to fetch set suggestions:', error)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedSet && inputText === selectedSet.name) return

    if (debouncedInput.length >= 1) {
      fetchSuggestions(debouncedInput)
    } else if (debouncedInput === '') {
      setSuggestions([])
    }
  }, [debouncedInput, fetchSuggestions, selectedSet, inputText])

  useEffect(() => {
    if (value === '' && selectedSet) {
      setSelectedSet(null)
      setInputText('')
    }
  }, [value, selectedSet])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (suggestion: SetSuggestion) => {
    setSelectedSet(suggestion)
    setInputText(suggestion.name)
    onChange(suggestion.code)
    setIsOpen(false)
    setSelectedIndex(-1)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputText(newValue)
    setSelectedSet(null)
    setIsOpen(true)

    if (newValue === '') {
      onChange('')
      setSuggestions([])
    }
  }

  const handleFocus = () => {
    if (!selectedSet) {
      setIsOpen(true)
      if (inputText === '') {
        fetchSuggestions('')
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true)
        fetchSuggestions(inputText)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  const handleClear = () => {
    setSelectedSet(null)
    setInputText('')
    onChange('')
    setSuggestions([])
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="Édition..."
          className="h-8 text-xs pr-8"
        />
        {isLoading ? (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-parchment-500" />
        ) : selectedSet ? (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-parchment-400 hover:text-parchment-200"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-dungeon-800 border border-dungeon-600 rounded-lg shadow-xl max-h-48 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.code}
              onClick={() => handleSelect(suggestion)}
              className={cn(
                'w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-dungeon-700 transition-colors',
                index === selectedIndex && 'bg-dungeon-700'
              )}
            >
              <span className="text-parchment-200">{suggestion.name}</span>
              <span className="text-parchment-500 uppercase">{suggestion.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function CollectionFiltersPanel({
  filters,
  onChange,
  onReset,
  hasActiveFilters
}: CollectionFiltersPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [localName, setLocalName] = useState(filters.name)
  const debouncedName = useDebouncedValue(localName, 300)

  // Sync debounced name to filters
  useEffect(() => {
    if (debouncedName !== filters.name) {
      onChange({ ...filters, name: debouncedName })
    }
  }, [debouncedName, filters, onChange])

  const toggleColor = (color: string) => {
    const newColors = filters.colors.includes(color)
      ? filters.colors.filter(c => c !== color)
      : [...filters.colors, color]
    onChange({ ...filters, colors: newColors })
  }

  const toggleRarity = (rarity: string) => {
    const newRarity = filters.rarity.includes(rarity)
      ? filters.rarity.filter(r => r !== rarity)
      : [...filters.rarity, rarity]
    onChange({ ...filters, rarity: newRarity })
  }

  const activeFilterCount = [
    filters.name,
    filters.colors.length > 0,
    filters.rarity.length > 0,
    filters.type,
    filters.set,
    filters.cmcMin !== null,
    filters.cmcMax !== null,
    filters.condition,
    filters.isFoil !== 'all',
  ].filter(Boolean).length

  return (
    <div className="card-frame p-4">
      {/* Header with search and expand toggle */}
      <div className="flex items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-parchment-500" />
          <Input
            type="text"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            placeholder="Rechercher une carte..."
            className="pl-9 h-9 text-sm"
          />
          {localName && (
            <button
              onClick={() => {
                setLocalName('')
                onChange({ ...filters, name: '' })
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-parchment-400 hover:text-parchment-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2">
          <Select
            value={filters.sortBy}
            onValueChange={(v) => onChange({ ...filters, sortBy: v as CollectionFilters['sortBy'] })}
          >
            <SelectTrigger className="w-32 h-9 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...filters, sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' })}
            className="h-9 w-9 p-0"
          >
            <ArrowUpDown className={cn(
              'w-4 h-4 transition-transform',
              filters.sortDir === 'asc' && 'rotate-180'
            )} />
          </Button>
        </div>

        {/* Expand toggle */}
        <Button
          variant={isExpanded || hasActiveFilters ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-9 gap-2"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Filtres</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-arcane-500 text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>

        {/* Reset button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-9 text-dragon-400 hover:text-dragon-300"
          >
            <X className="w-4 h-4 mr-1" />
            Effacer
          </Button>
        )}
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-4 pt-4 border-t border-dungeon-700 space-y-4"
        >
          {/* Colors */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-parchment-400 font-medieval">Couleurs</span>
              <Select
                value={filters.colorMode}
                onValueChange={(v) => onChange({ ...filters, colorMode: v as CollectionFilters['colorMode'] })}
              >
                <SelectTrigger className="w-28 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="include">Inclut</SelectItem>
                  <SelectItem value="exact">Exactement</SelectItem>
                  <SelectItem value="atMost">Au plus</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {Object.entries(MANA_CONFIG).map(([code, config]) => {
                const Icon = config.icon
                const isActive = filters.colors.includes(code)
                return (
                  <motion.button
                    key={code}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleColor(code)}
                    className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-200',
                      `bg-gradient-to-br ${config.bg}`,
                      isActive ? `${config.activeBorder} ${config.glow}` : config.border,
                      !isActive && 'opacity-50 grayscale'
                    )}
                    title={config.name}
                  >
                    <Icon className={cn('w-4 h-4', config.text)} />
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* Rarity */}
          <div>
            <span className="text-xs text-parchment-400 font-medieval mb-2 block">Rareté</span>
            <div className="flex gap-2">
              {Object.entries(RARITY_CONFIG).map(([code, config]) => {
                const Icon = config.icon
                const isActive = filters.rarity.includes(code)
                return (
                  <motion.button
                    key={code}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleRarity(code)}
                    className={cn(
                      'w-9 h-9 rounded flex items-center justify-center border transition-all duration-200',
                      isActive ? `${config.activeBg} ${config.activeBorder} ${config.glow}` : `${config.bg} ${config.border}`,
                      !isActive && 'opacity-50'
                    )}
                    title={config.name}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* Row with Type, Set, CMC */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Type */}
            <div>
              <span className="text-xs text-parchment-400 font-medieval mb-1.5 block">Type</span>
              <Input
                type="text"
                value={filters.type}
                onChange={(e) => onChange({ ...filters, type: e.target.value })}
                placeholder="Creature, Instant..."
                className="h-8 text-xs"
              />
            </div>

            {/* Set */}
            <div>
              <span className="text-xs text-parchment-400 font-medieval mb-1.5 block">Édition</span>
              <SetAutocomplete
                value={filters.set}
                onChange={(v) => onChange({ ...filters, set: v })}
              />
            </div>

            {/* CMC */}
            <div>
              <span className="text-xs text-parchment-400 font-medieval mb-1.5 block">CMC</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={filters.cmcMin ?? ''}
                  onChange={(e) => onChange({ ...filters, cmcMin: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Min"
                  className="h-8 text-xs w-16"
                  min={0}
                />
                <span className="text-parchment-500">-</span>
                <Input
                  type="number"
                  value={filters.cmcMax ?? ''}
                  onChange={(e) => onChange({ ...filters, cmcMax: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Max"
                  className="h-8 text-xs w-16"
                  min={0}
                />
              </div>
            </div>

            {/* Condition (for owned items) */}
            <div>
              <span className="text-xs text-parchment-400 font-medieval mb-1.5 block">Condition</span>
              <Select
                value={filters.condition}
                onValueChange={(v) => onChange({ ...filters, condition: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Foil filter */}
          <div>
            <span className="text-xs text-parchment-400 font-medieval mb-1.5 block">Foil</span>
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'Tous' },
                { value: 'true', label: 'Foil seulement', icon: Sparkles },
                { value: 'false', label: 'Non-foil seulement' },
              ].map(opt => (
                <Button
                  key={opt.value}
                  variant={filters.isFoil === opt.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onChange({ ...filters, isFoil: opt.value as CollectionFilters['isFoil'] })}
                  className="h-8 text-xs gap-1.5"
                >
                  {opt.icon && <opt.icon className="w-3.5 h-3.5" />}
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
