'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { SearchFilters, MTG_COLORS, RARITIES, FORMATS } from '@/types/search'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Flame, 
  Droplets, 
  Skull, 
  Sun, 
  TreePine,
  Scroll,
  Sword,
  Crown,
  Gem,
  Sparkles,
  BookOpen,
  Coins,
  Shield,
  Wand2,
  Loader2
} from 'lucide-react'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

interface SearchFiltersPanelProps {
  filters: SearchFilters
  onChange: (filters: SearchFilters) => void
}

// Mana color icons and styles
const MANA_CONFIG = {
  W: { 
    icon: Sun, 
    name: 'Plains', 
    bg: 'from-amber-100 to-yellow-50',
    border: 'border-amber-300',
    activeBorder: 'border-amber-400',
    glow: 'shadow-[0_0_15px_rgba(251,191,36,0.5)]',
    text: 'text-amber-900'
  },
  U: { 
    icon: Droplets, 
    name: 'Island', 
    bg: 'from-blue-500 to-blue-600',
    border: 'border-blue-400',
    activeBorder: 'border-blue-300',
    glow: 'shadow-[0_0_15px_rgba(59,130,246,0.6)]',
    text: 'text-white'
  },
  B: { 
    icon: Skull, 
    name: 'Swamp', 
    bg: 'from-gray-800 to-gray-900',
    border: 'border-gray-600',
    activeBorder: 'border-purple-500',
    glow: 'shadow-[0_0_15px_rgba(168,85,247,0.5)]',
    text: 'text-gray-200'
  },
  R: { 
    icon: Flame, 
    name: 'Mountain', 
    bg: 'from-red-500 to-red-600',
    border: 'border-red-400',
    activeBorder: 'border-orange-400',
    glow: 'shadow-[0_0_15px_rgba(239,68,68,0.6)]',
    text: 'text-white'
  },
  G: { 
    icon: TreePine, 
    name: 'Forest', 
    bg: 'from-green-500 to-green-600',
    border: 'border-green-400',
    activeBorder: 'border-emerald-300',
    glow: 'shadow-[0_0_15px_rgba(34,197,94,0.6)]',
    text: 'text-white'
  },
}

// Rarity config with D&D-style theming
const RARITY_CONFIG = {
  common: {
    icon: Shield,
    name: 'Common',
    description: 'Peasant Wares',
    bg: 'bg-gradient-to-br from-stone-600 to-stone-700',
    border: 'border-stone-500',
    activeBg: 'bg-gradient-to-br from-stone-500 to-stone-600',
    activeBorder: 'border-stone-300',
    glow: 'shadow-[0_0_10px_rgba(168,162,158,0.4)]'
  },
  uncommon: {
    icon: Sword,
    name: 'Uncommon',
    description: 'Adventurer\'s Gear',
    bg: 'bg-gradient-to-br from-slate-500 to-slate-600',
    border: 'border-slate-400',
    activeBg: 'bg-gradient-to-br from-slate-400 to-slate-500',
    activeBorder: 'border-slate-200',
    glow: 'shadow-[0_0_12px_rgba(148,163,184,0.5)]'
  },
  rare: {
    icon: Crown,
    name: 'Rare',
    description: 'Royal Treasures',
    bg: 'bg-gradient-to-br from-amber-500 to-yellow-600',
    border: 'border-amber-400',
    activeBg: 'bg-gradient-to-br from-amber-400 to-yellow-500',
    activeBorder: 'border-yellow-300',
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.6)]'
  },
  mythic: {
    icon: Gem,
    name: 'Mythic',
    description: 'Legendary Artifacts',
    bg: 'bg-gradient-to-br from-orange-500 via-red-500 to-rose-600',
    border: 'border-orange-400',
    activeBg: 'bg-gradient-to-br from-orange-400 via-red-400 to-rose-500',
    activeBorder: 'border-orange-300',
    glow: 'shadow-[0_0_20px_rgba(249,115,22,0.7)]'
  },
}

// Section wrapper component
function FilterSection({ 
  icon: Icon, 
  title, 
  children,
  delay = 0 
}: { 
  icon: React.ElementType
  title: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="relative"
    >
      {/* Section header with decorative line */}
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <div className="p-1 sm:p-1.5 rounded bg-gradient-to-br from-gold-600/20 to-gold-700/10 border border-gold-600/30">
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold-500" />
        </div>
        <span className="font-medieval text-xs sm:text-sm text-gold-400 tracking-wide">{title}</span>
        <div className="flex-1 h-px bg-gradient-to-r from-gold-600/30 to-transparent" />
      </div>
      {children}
    </motion.div>
  )
}

// Type Autocomplete Component
interface TypeSuggestion {
  word: string
  count: number
}

interface TypeAutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

// Set Autocomplete Component
interface SetSuggestion {
  code: string
  name: string
  count: number
}

interface SetAutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

function SetAutocomplete({ value, onChange, placeholder, className }: SetAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<SetSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [inputText, setInputText] = useState('') // What the user types
  const [selectedSet, setSelectedSet] = useState<SetSuggestion | null>(null) // The selected set
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Debounce for requests
  const debouncedInput = useDebouncedValue(inputText, 200)
  
  // Fetch suggestions
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
  
  // Fetch when debounced input changes
  useEffect(() => {
    // Don't fetch if we already have a selected set and haven't modified it
    if (selectedSet && inputText === selectedSet.name) {
      return
    }
    
    if (debouncedInput.length >= 1) {
      fetchSuggestions(debouncedInput)
    } else if (debouncedInput === '') {
      setSuggestions([])
    }
  }, [debouncedInput, fetchSuggestions, selectedSet, inputText])
  
  // Reset if the external value changes to empty
  useEffect(() => {
    if (value === '' && selectedSet) {
      setSelectedSet(null)
      setInputText('')
    }
  }, [value, selectedSet])
  
  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Handle selection
  const handleSelect = (suggestion: SetSuggestion) => {
    setSelectedSet(suggestion)
    setInputText(suggestion.name) // Display full name
    onChange(suggestion.code) // Send code to filter
    setIsOpen(false)
    setSelectedIndex(-1)
  }
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputText(newValue)
    setSelectedSet(null) // Clear selection when user types
    setIsOpen(true)
    
    if (newValue === '') {
      onChange('')
      setSuggestions([])
    }
  }
  
  // Handle focus
  const handleFocus = () => {
    if (!selectedSet) {
      setIsOpen(true)
      if (inputText === '') {
        fetchSuggestions('')
      }
    }
  }
  
  // Keyboard navigation
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
        setSelectedIndex(prev => Math.max(prev - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
      case 'Tab':
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          e.preventDefault()
          handleSelect(suggestions[selectedIndex])
        } else {
          setIsOpen(false)
        }
        break
    }
  }
  
  // Clear button
  const handleClear = () => {
    setInputText('')
    setSelectedSet(null)
    onChange('')
    setSuggestions([])
    inputRef.current?.focus()
  }
  
  const displayValue = inputText
  const hasValue = selectedSet !== null || inputText !== ''
  
  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn("pr-16", className)}
        autoComplete="off"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {isLoading && <Loader2 className="w-3 h-3 animate-spin text-dungeon-400" />}
        {hasValue && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            className="text-dungeon-400 hover:text-parchment-300 transition-colors"
          >
            <span className="text-xs">✕</span>
          </button>
        )}
        <BookOpen className="w-4 h-4 text-dungeon-500" />
      </div>
      
      {/* Selected set badge */}
      {selectedSet && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <span className="text-[9px] text-gold-500 uppercase tracking-wider bg-dungeon-700/80 px-1 py-0.5 rounded">
            {selectedSet.code}
          </span>
        </div>
      )}
      
      {/* Suggestions dropdown */}
      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full left-0 right-0 mt-1 bg-dungeon-800 border border-dungeon-600 rounded-lg shadow-lg overflow-hidden"
          >
            <div className="max-h-[280px] overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.code}
                  type="button"
                  onClick={() => handleSelect(suggestion)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors",
                    index === selectedIndex 
                      ? "bg-gold-600/20 text-gold-400" 
                      : "text-parchment-300 hover:bg-dungeon-700"
                  )}
                >
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="truncate">{suggestion.name}</span>
                    <span className="text-[10px] text-dungeon-400 uppercase tracking-wider">
                      {suggestion.code}
                    </span>
                  </div>
                  <span className="text-[10px] text-dungeon-400 ml-2 flex-shrink-0">
                    {suggestion.count.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TypeAutocomplete({ value, onChange, placeholder, className }: TypeAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<TypeSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Debounce value to avoid too many requests
  const debouncedValue = useDebouncedValue(value, 200)
  
  // Fetch suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/search/types?q=${encodeURIComponent(query)}&limit=12`)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('Failed to fetch type suggestions:', error)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [])
  
  // Fetch when debounced value changes
  useEffect(() => {
    if (debouncedValue.length >= 1) {
      fetchSuggestions(debouncedValue)
      setIsOpen(true)
    } else if (debouncedValue === '' && isOpen) {
      // Fetch top suggestions when empty and focused
      fetchSuggestions('')
    } else {
      setSuggestions([])
    }
  }, [debouncedValue, fetchSuggestions, isOpen])
  
  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Handle selection
  const handleSelect = (suggestion: string) => {
    // If current value already contains words, we add the new one
    const currentWords = value.split(/\s+/).filter(Boolean)
    const lastWord = currentWords[currentWords.length - 1]?.toLowerCase() || ''

    // If the last word is a prefix of the suggestion, replace it
    if (suggestion.toLowerCase().startsWith(lastWord)) {
      currentWords.pop()
    }
    
    currentWords.push(suggestion)
    onChange(currentWords.join(' '))
    setIsOpen(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }
  
  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && value.length > 0) {
        setIsOpen(true)
        fetchSuggestions(value)
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
        setSelectedIndex(prev => Math.max(prev - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex].word)
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
      case 'Tab':
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          e.preventDefault()
          handleSelect(suggestions[selectedIndex].word)
        } else {
          setIsOpen(false)
        }
        break
    }
  }
  
  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (value.length >= 1 || suggestions.length > 0) {
            setIsOpen(true)
          }
          if (value === '') {
            fetchSuggestions('')
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn("pr-10", className)}
        autoComplete="off"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {isLoading && <Loader2 className="w-3 h-3 animate-spin text-dungeon-400" />}
        <Sword className="w-4 h-4 text-dungeon-500" />
      </div>
      
      {/* Suggestions dropdown */}
      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full left-0 right-0 mt-1 bg-dungeon-800 border border-dungeon-600 rounded-lg shadow-lg overflow-hidden"
          >
            <div className="max-h-[200px] overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.word}
                  type="button"
                  onClick={() => handleSelect(suggestion.word)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors",
                    index === selectedIndex 
                      ? "bg-gold-600/20 text-gold-400" 
                      : "text-parchment-300 hover:bg-dungeon-700"
                  )}
                >
                  <span className="capitalize">{suggestion.word}</span>
                  <span className="text-[10px] text-dungeon-400">
                    {suggestion.count.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function SearchFiltersPanel({ filters, onChange }: SearchFiltersPanelProps) {
  const updateFilter = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    onChange({ ...filters, [key]: value })
  }

  const toggleArrayFilter = <K extends keyof SearchFilters>(
    key: K,
    value: string
  ) => {
    const current = filters[key] as string[]
    const newValue = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onChange({ ...filters, [key]: newValue })
  }

  return (
    <div className="relative">
      {/* Decorative background pattern - hidden on mobile */}
      <div className="absolute inset-0 opacity-5 pointer-events-none hidden sm:block">
        <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-gold-500/50 rounded-tl-lg" />
        <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-gold-500/50 rounded-br-lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 relative z-10">
        {/* Left Column - Primary Filters */}
        <div className="space-y-4 sm:space-y-6">
          {/* Mana Colors - The Elemental Forge */}
          <FilterSection icon={Sparkles} title="Colors" delay={0}>
            <div className="flex flex-wrap gap-2 sm:gap-3 mb-2 sm:mb-3">
              {MTG_COLORS.map((color) => {
                const config = MANA_CONFIG[color.code as keyof typeof MANA_CONFIG]
                const Icon = config.icon
                const isActive = filters.colors.includes(color.code)
                
                return (
                  <motion.button
                    key={color.code}
                    onClick={() => toggleArrayFilter('colors', color.code)}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg border-2 transition-all duration-300',
                      'bg-gradient-to-br flex items-center justify-center',
                      config.bg,
                      isActive ? [config.activeBorder, config.glow] : config.border,
                    )}
                    title={config.name}
                  >
                    <Icon className={cn('w-5 h-5 sm:w-6 sm:h-6', config.text)} />
                    
                    {/* Active indicator ring */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          className="absolute inset-0 rounded-lg border-2 border-white/30"
                        />
                      )}
                    </AnimatePresence>
                    
                    {/* Mana symbol letter */}
                    <span className={cn(
                      'absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full text-[9px] sm:text-[10px] font-bold',
                      'flex items-center justify-center',
                      'bg-dungeon-900 border border-dungeon-600',
                      isActive ? 'text-gold-400' : 'text-parchment-500'
                    )}>
                      {color.code}
                    </span>
                  </motion.button>
                )
              })}
            </div>
            
            {/* Color mode selector */}
            <AnimatePresence>
              {filters.colors.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Select
                    value={filters.colorMode}
                    onValueChange={(value: 'exact' | 'include' | 'atMost') =>
                      updateFilter('colorMode', value)
                    }
                  >
                    <SelectTrigger className="bg-dungeon-800/50 border-dungeon-600 text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="include">
                        <span className="flex items-center gap-2">
                          <span className="text-green-400">∪</span> Includes these colors
                        </span>
                      </SelectItem>
                      <SelectItem value="exact">
                        <span className="flex items-center gap-2">
                          <span className="text-gold-400">=</span> Exactly
                        </span>
                      </SelectItem>
                      <SelectItem value="atMost">
                        <span className="flex items-center gap-2">
                          <span className="text-blue-400">≤</span> At most
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </motion.div>
              )}
            </AnimatePresence>
          </FilterSection>

          {/* Rarity - Compact grid on mobile */}
          <FilterSection icon={Crown} title="Rarity" delay={0.1}>
            <div className="grid grid-cols-4 sm:grid-cols-2 gap-1.5 sm:gap-2">
              {RARITIES.map((rarity) => {
                const config = RARITY_CONFIG[rarity.code as keyof typeof RARITY_CONFIG]
                const Icon = config.icon
                const isActive = filters.rarity.includes(rarity.code)
                
                return (
                  <motion.button
                    key={rarity.code}
                    onClick={() => toggleArrayFilter('rarity', rarity.code)}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'relative p-2 sm:p-3 rounded-lg border-2 transition-all duration-300',
                      'flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left',
                      isActive ? [config.activeBg, config.activeBorder, config.glow] : [config.bg, config.border],
                    )}
                  >
                    <div className={cn(
                      'p-1.5 sm:p-2 rounded-md bg-black/20',
                      isActive && 'bg-white/10'
                    )}>
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white/90" />
                    </div>
                    <div className="flex-1 min-w-0 hidden sm:block">
                      <div className="font-medieval text-sm text-white truncate">
                        {config.name}
                      </div>
                      <div className="text-[10px] text-white/60 truncate">
                        {config.description}
                      </div>
                    </div>
                    {/* Mobile: show short name */}
                    <span className="sm:hidden text-[10px] text-white font-medium">
                      {config.name.slice(0, 3)}
                    </span>
                    
                    {/* Selection checkmark */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white/20 flex items-center justify-center"
                        >
                          <span className="text-white text-[10px] sm:text-xs">✓</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                )
              })}
            </div>
          </FilterSection>

          {/* Mana Value */}
          <FilterSection icon={Wand2} title="Mana cost" delay={0.2}>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative flex-1">
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  max={20}
                  value={filters.cmcMin ?? ''}
                  onChange={(e) =>
                    updateFilter('cmcMin', e.target.value ? parseFloat(e.target.value) : null)
                  }
                  className="bg-dungeon-800/50 border-dungeon-600 text-center text-base sm:text-lg font-medieval h-10 sm:h-auto"
                />
                <span className="absolute -top-2 left-2 text-[9px] sm:text-[10px] text-dungeon-400 bg-dungeon-900 px-1">MIN</span>
              </div>
              
              <div className="hidden sm:flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-gold-600/50" />
                <div className="w-8 h-0.5 bg-gradient-to-r from-gold-600/50 via-gold-500 to-gold-600/50" />
                <div className="w-2 h-2 rounded-full bg-gold-600/50" />
              </div>
              <span className="sm:hidden text-dungeon-500">—</span>
              
              <div className="relative flex-1">
                <Input
                  type="number"
                  placeholder="∞"
                  min={0}
                  max={20}
                  value={filters.cmcMax ?? ''}
                  onChange={(e) =>
                    updateFilter('cmcMax', e.target.value ? parseFloat(e.target.value) : null)
                  }
                  className="bg-dungeon-800/50 border-dungeon-600 text-center text-base sm:text-lg font-medieval h-10 sm:h-auto"
                />
                <span className="absolute -top-2 left-2 text-[9px] sm:text-[10px] text-dungeon-400 bg-dungeon-900 px-1">MAX</span>
              </div>
            </div>
          </FilterSection>
        </div>

        {/* Right Column - Secondary Filters */}
        <div className="space-y-4 sm:space-y-6">
          {/* Card Text - The Scriptorium */}
          <FilterSection icon={Scroll} title="Text" delay={0.05}>
            <div className="space-y-2 sm:space-y-3">
              <div className="relative">
                <Input
                  placeholder="Card text..."
                  value={filters.text}
                  onChange={(e) => updateFilter('text', e.target.value)}
                  className="bg-dungeon-800/50 border-dungeon-600 pl-3 pr-10 text-sm sm:text-base h-10 sm:h-auto"
                />
                <BookOpen className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dungeon-500" />
              </div>
              
              {/* Type with Autocomplete */}
              <TypeAutocomplete
                value={filters.type}
                onChange={(value) => updateFilter('type', value)}
                placeholder="Type (Creature, Elf...)"
                className="bg-dungeon-800/50 border-dungeon-600 pl-3 text-sm sm:text-base h-10 sm:h-auto"
              />
            </div>
          </FilterSection>

          {/* Format and Set in a row on mobile */}
          <div className="grid grid-cols-2 sm:grid-cols-1 gap-4 sm:gap-6">
            {/* Format - The Tournament Hall */}
            <FilterSection icon={Shield} title="Format" delay={0.15}>
              <Select
                value={filters.format || 'all'}
                onValueChange={(value) => updateFilter('format', value === 'all' ? '' : value)}
              >
                <SelectTrigger className="bg-dungeon-800/50 border-dungeon-600 text-sm h-10 sm:h-auto">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {FORMATS.map((format) => (
                    <SelectItem key={format.code} value={format.code}>
                      {format.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterSection>

            {/* Set - The Archive */}
            <FilterSection icon={BookOpen} title="Set" delay={0.2}>
              <SetAutocomplete
                value={filters.set}
                onChange={(value) => updateFilter('set', value)}
                placeholder="Lord of the Rings..."
                className="bg-dungeon-800/50 border-dungeon-600 text-sm h-10 sm:h-auto"
              />
            </FilterSection>
          </div>

          {/* Price - The Merchant's Ledger */}
          <FilterSection icon={Coins} title="Price (€)" delay={0.25}>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative flex-1">
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  step={0.5}
                  value={filters.priceMinEur ?? ''}
                  onChange={(e) =>
                    updateFilter('priceMinEur', e.target.value ? parseFloat(e.target.value) : null)
                  }
                  className="bg-dungeon-800/50 border-dungeon-600 text-center pr-6 sm:pr-8 text-sm h-10 sm:h-auto"
                />
                <span className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-gold-500 font-bold text-sm">€</span>
              </div>
              
              <span className="text-dungeon-500">—</span>
              
              <div className="relative flex-1">
                <Input
                  type="number"
                  placeholder="∞"
                  min={0}
                  step={0.5}
                  value={filters.priceMaxEur ?? ''}
                  onChange={(e) =>
                    updateFilter('priceMaxEur', e.target.value ? parseFloat(e.target.value) : null)
                  }
                  className="bg-dungeon-800/50 border-dungeon-600 text-center pr-6 sm:pr-8 text-sm h-10 sm:h-auto"
                />
                <span className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-gold-500 font-bold text-sm">€</span>
              </div>
            </div>
          </FilterSection>
        </div>
      </div>

      {/* Bottom decorative element - smaller on mobile */}
      <motion.div 
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mt-4 sm:mt-6 h-px bg-gradient-to-r from-transparent via-gold-600/30 to-transparent"
      />
    </div>
  )
}
