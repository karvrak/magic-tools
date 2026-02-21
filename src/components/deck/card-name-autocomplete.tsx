'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, X, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { cn } from '@/lib/utils'
import { MANA_CONFIG } from './types'

interface CardSuggestion {
  name: string
  oracleId: string
  displayName: string
  colorIdentity: string[]
  deckCount: number
}

interface CardNameAutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function CardNameAutocomplete({
  value,
  onChange,
  placeholder = "Search card name...",
}: CardNameAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<CardSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [inputText, setInputText] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastExternalValue = useRef(value)

  const debouncedInput = useDebouncedValue(inputText, 200)

  const fetchSuggestions = useCallback(async (query: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/decks/cards/suggestions?q=${encodeURIComponent(query)}&limit=12`)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('Failed to fetch card suggestions:', error)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debouncedInput.length >= 1) {
      fetchSuggestions(debouncedInput)
    } else if (debouncedInput === '') {
      fetchSuggestions('')
    }
  }, [debouncedInput, fetchSuggestions])

  // Sync external value changes
  useEffect(() => {
    if (value !== lastExternalValue.current) {
      lastExternalValue.current = value
      if (value === '') {
        setInputText('')
      }
    }
  }, [value])

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

  const handleSelect = (suggestion: CardSuggestion) => {
    setInputText(suggestion.displayName)
    onChange(suggestion.name)
    setIsOpen(false)
    setSelectedIndex(-1)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputText(newValue)
    setIsOpen(true)

    if (newValue === '') {
      onChange('')
    }
  }

  const handleClear = () => {
    setInputText('')
    onChange('')
    setSuggestions([])
    inputRef.current?.focus()
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
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0 sm:min-w-[200px]">
      <Input
        ref={inputRef}
        value={inputText}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="pr-14 h-8 sm:h-9 text-sm"
        autoComplete="off"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {isLoading && <Loader2 className="w-3 h-3 animate-spin text-dungeon-400" />}
        {inputText && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            className="text-dungeon-400 hover:text-parchment-300 transition-colors p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <Search className="w-3.5 h-3.5 text-dungeon-500" />
      </div>

      {/* Suggestions dropdown */}
      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-40 top-full left-0 right-0 mt-1 bg-dungeon-800 border border-dungeon-600 rounded-lg shadow-xl overflow-hidden"
            style={{ maxWidth: 'calc(100vw - 2rem)' }}
          >
            <div className="max-h-[200px] sm:max-h-[250px] overflow-y-auto overscroll-contain">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.oracleId}
                  type="button"
                  onClick={() => handleSelect(suggestion)}
                  className={cn(
                    "w-full px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm flex items-center justify-between transition-colors",
                    index === selectedIndex
                      ? "bg-gold-600/20 text-gold-400"
                      : "text-parchment-300 hover:bg-dungeon-700"
                  )}
                >
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="truncate">{suggestion.displayName}</span>
                    {suggestion.displayName !== suggestion.name && (
                      <span className="text-[9px] sm:text-[10px] text-dungeon-400 truncate">
                        {suggestion.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 ml-2 flex-shrink-0">
                    {suggestion.colorIdentity.length > 0 && (
                      <div className="flex gap-0.5">
                        {suggestion.colorIdentity.map(color => {
                          const config = MANA_CONFIG[color as keyof typeof MANA_CONFIG]
                          return config ? (
                            <div
                              key={color}
                              className={cn("w-2 h-2 rounded-full bg-gradient-to-br", config.bg)}
                            />
                          ) : null
                        })}
                      </div>
                    )}
                    <span className="text-[9px] sm:text-[10px] text-dungeon-400">
                      {suggestion.deckCount}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
