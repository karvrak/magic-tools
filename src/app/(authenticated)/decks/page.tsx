'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Layers, 
  Trash2, 
  BookOpen, 
  Sparkles, 
  Coins, 
  Users, 
  UserPlus,
  Crown,
  Filter,
  Lock,
  Hammer,
  X,
  Upload,
  ChevronDown,
  ChevronUp,
  Search,
  Loader2,
  Flame,
  Droplets,
  Skull,
  Sun,
  TreePine,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Tag,
  Hash
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { FORMATS } from '@/types/search'
import { formatDate, formatPrice, cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { DiceLoader } from '@/components/ui/dice-loader'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/layout/page-transition'
import { useActiveOwner } from '@/contexts/active-owner'

interface Owner {
  id: string
  name: string
  color: string
  isDefault: boolean
  deckCount?: number
}

interface Tag {
  id: string
  name: string
  color: string
  deckCount?: number
}

type DeckStatus = 'building' | 'active' | 'locked'

interface Deck {
  id: string
  name: string
  description: string | null
  format: string | null
  status: DeckStatus
  colors: string[] // deck's color identity (W, U, B, R, G)
  cardCount: number
  avgCmc: number // average CMC (excluding lands)
  totalPrice: number
  minTotalPrice: number // cheapest version of each card
  owner: Owner | null
  tags: Tag[] // deck's tags
  coverImage: string | null
  createdAt: string
  updatedAt: string
}

// Cookie helpers
const VIEW_MODE_COOKIE = 'deck_view_mode'
const SORT_FIELD_COOKIE = 'deck_sort_field'
const SORT_DIR_COOKIE = 'deck_sort_dir'

type ViewMode = 'grid' | 'list'
type SortField = 'name' | 'price' | 'status' | 'updatedAt' | 'cardCount' | 'avgCmc' | 'tags'
type SortDirection = 'asc' | 'desc'

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

function setCookie(name: string, value: string, days: number = 30) {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`
}

// Mana color config for filtering
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

const MTG_COLORS = ['W', 'U', 'B', 'R', 'G'] as const

// Card name autocomplete component for deck filtering
interface CardSuggestion {
  name: string
  oracleId: string
  displayName: string
  colorIdentity: string[]
  deckCount: number
}

function CardNameAutocomplete({ 
  value, 
  onChange,
  placeholder = "Search card name..."
}: { 
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [suggestions, setSuggestions] = useState<CardSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [inputText, setInputText] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastExternalValue = useRef(value)
  
  const debouncedInput = useDebouncedValue(inputText, 200)
  
  // Fetch suggestions
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
  
  // Fetch when debounced input changes
  useEffect(() => {
    if (debouncedInput.length >= 1) {
      fetchSuggestions(debouncedInput)
    } else if (debouncedInput === '') {
      fetchSuggestions('')
    }
  }, [debouncedInput, fetchSuggestions])
  
  // Sync external value changes (only when value actually changes externally)
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
                    {/* Color identity dots */}
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

// Predefined colors for new owners
const OWNER_COLORS = [
  { name: 'Gold', value: '#D4AF37' },
  { name: 'Arcane Purple', value: '#8B5CF6' },
  { name: 'Nature Green', value: '#22C55E' },
  { name: 'Dragon Red', value: '#EF4444' },
  { name: 'Ocean Blue', value: '#3B82F6' },
  { name: 'Sunset Orange', value: '#F97316' },
  { name: 'Rose Pink', value: '#EC4899' },
  { name: 'Teal', value: '#14B8A6' },
]

export default function DecksPage() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showOwnerModal, setShowOwnerModal] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [newDeckFormat, setNewDeckFormat] = useState('')
  const [newDeckDescription, setNewDeckDescription] = useState('')
  const [newDeckOwnerId, setNewDeckOwnerId] = useState('')
  const [newDeckStatus, setNewDeckStatus] = useState<DeckStatus>('building')
  const [newOwnerName, setNewOwnerName] = useState('')
  const [newOwnerColor, setNewOwnerColor] = useState('#D4AF37')
  const [filterColors, setFilterColors] = useState<string[]>([])
  const { activeOwner, owners: globalOwners } = useActiveOwner()
  const [filterColorMode, setFilterColorMode] = useState<'any' | 'all' | 'exact'>('any')
  const [filterCardName, setFilterCardName] = useState('')
  const [filterStatus, setFilterStatus] = useState<DeckStatus | 'all'>('all')
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [showImportSection, setShowImportSection] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [importDecklist, setImportDecklist] = useState('')
  const [importResult, setImportResult] = useState<{
    imported: number
    notFound: string[]
  } | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortField, setSortField] = useState<SortField>('updatedAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Load preferences from cookies on mount
  useEffect(() => {
    const savedViewMode = getCookie(VIEW_MODE_COOKIE) as ViewMode | null
    if (savedViewMode && (savedViewMode === 'grid' || savedViewMode === 'list')) {
      setViewMode(savedViewMode)
    }
    const savedSortField = getCookie(SORT_FIELD_COOKIE) as SortField | null
    if (savedSortField && ['name', 'price', 'status', 'updatedAt', 'cardCount', 'avgCmc', 'tags'].includes(savedSortField)) {
      setSortField(savedSortField)
    }
    const savedSortDir = getCookie(SORT_DIR_COOKIE) as SortDirection | null
    if (savedSortDir && (savedSortDir === 'asc' || savedSortDir === 'desc')) {
      setSortDirection(savedSortDir)
    }
  }, [])

  // Persist view mode to cookie
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    setCookie(VIEW_MODE_COOKIE, mode)
  }

  // Persist sort preferences to cookies
  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      // Toggle direction if same field
      const newDir = sortDirection === 'asc' ? 'desc' : 'asc'
      setSortDirection(newDir)
      setCookie(SORT_DIR_COOKIE, newDir)
    } else {
      // New field, reset to asc
      setSortField(field)
      setSortDirection('asc')
      setCookie(SORT_FIELD_COOKIE, field)
      setCookie(SORT_DIR_COOKIE, 'asc')
    }
  }

  // Fetch owners
  const { data: ownersData } = useQuery<{ owners: Owner[] }>({
    queryKey: ['owners'],
    queryFn: async () => {
      const response = await fetch('/api/owners')
      if (!response.ok) throw new Error('Failed to fetch owners')
      return response.json()
    },
  })

  // Fetch tags
  const { data: tagsData } = useQuery<{ tags: Tag[] }>({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await fetch('/api/tags')
      if (!response.ok) throw new Error('Failed to fetch tags')
      return response.json()
    },
  })

  // Build query params for deck filtering
  const buildDeckQueryParams = () => {
    const params = new URLSearchParams()
    // Use global owner filter from navbar
    if (activeOwner?.id) {
      params.set('ownerId', activeOwner.id)
    }
    if (filterColors.length > 0) {
      params.set('colors', filterColors.join(','))
      params.set('colorMode', filterColorMode)
    }
    if (filterCardName) {
      params.set('cardName', filterCardName)
    }
    if (filterTags.length > 0) {
      params.set('tags', filterTags.join(','))
    }
    return params.toString()
  }

  // Fetch decks (with filters)
  const { data, isLoading, isFetching } = useQuery<{ decks: Deck[] }>({
    queryKey: ['decks', activeOwner?.id, filterColors, filterColorMode, filterCardName, filterTags],
    queryFn: async () => {
      const queryString = buildDeckQueryParams()
      const url = queryString ? `/api/decks?${queryString}` : '/api/decks'
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch decks')
      return response.json()
    },
    staleTime: 0, // Always refetch when filter changes
  })

  // Create deck mutation
  const createMutation = useMutation({
    mutationFn: async (data: { 
      name: string
      format: string
      description: string
      ownerId: string
      status: DeckStatus
    }) => {
      const response = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          ownerId: data.ownerId || undefined,
        }),
      })
      if (!response.ok) throw new Error('Failed to create deck')
      return response.json()
    },
    onError: () => {
      toast({
        title: 'Enchantment Failed',
        description: 'The binding ritual was interrupted. Please try again.',
        variant: 'destructive',
      })
    },
  })

  // Delete deck mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/decks/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete deck')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decks'] })
      queryClient.invalidateQueries({ queryKey: ['owners'] })
      toast({
        title: 'Spellbook Destroyed',
        description: 'The grimoire has been consumed by flames.',
      })
    },
    onError: () => {
      toast({
        title: 'Destruction Failed',
        description: 'The spellbook resists your attempts.',
        variant: 'destructive',
      })
    },
  })

  // Create owner mutation
  const createOwnerMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const response = await fetch('/api/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create owner')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owners'] })
      setShowOwnerModal(false)
      setNewOwnerName('')
      setNewOwnerColor('#D4AF37')
      toast({
        title: '👤 Owner Added',
        description: 'A new keeper has joined the guild.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Add Owner',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Delete owner mutation
  const deleteOwnerMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/owners/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete owner')
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['owners'] })
      queryClient.invalidateQueries({ queryKey: ['decks'] })
      toast({
        title: '👤 Owner Removed',
        description: data.message,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Remove Owner',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Update deck status mutation
  const updateDeckStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DeckStatus }) => {
      const response = await fetch(`/api/decks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error('Failed to update deck status')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decks'] })
    },
    onError: () => {
      toast({
        title: 'Update Failed',
        description: 'Could not update deck status.',
        variant: 'destructive',
      })
    },
  })

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create tag')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      setNewTagName('')
      setShowTagInput(false)
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create tag',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Delete tag mutation  
  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const response = await fetch(`/api/tags?id=${tagId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete tag')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['decks'] })
    },
  })

  // Import decklist mutation
  const importDecklistMutation = useMutation({
    mutationFn: async ({ deckId, decklist }: { deckId: string; decklist: string }) => {
      const response = await fetch(`/api/decks/${deckId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decklist }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to import decklist')
      }
      return response.json()
    },
  })

  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) return
    
    createMutation.mutate({
      name: newDeckName,
      format: newDeckFormat,
      description: newDeckDescription,
      ownerId: newDeckOwnerId,
      status: newDeckStatus,
    }, {
      onSuccess: async (data) => {
        const hasDecklist = importDecklist.trim().length > 0
        
        // If there's a decklist to import, do it after deck creation
        if (hasDecklist && data.deck?.id) {
          try {
            const result = await importDecklistMutation.mutateAsync({
              deckId: data.deck.id,
              decklist: importDecklist,
            })
            
            queryClient.invalidateQueries({ queryKey: ['decks'] })
            queryClient.invalidateQueries({ queryKey: ['owners'] })
            
            if (result.notFound > 0) {
              toast({
                title: `📜 Deck created with ${result.imported} cards`,
                description: `${result.notFound} card(s) not found: ${result.details.notFound.slice(0, 3).join(', ')}${result.details.notFound.length > 3 ? '...' : ''}`,
              })
            } else {
              toast({
                title: `📜 Deck created with ${result.imported} cards`,
                description: 'All cards were found and added to your deck.',
              })
            }
          } catch {
            queryClient.invalidateQueries({ queryKey: ['decks'] })
            queryClient.invalidateQueries({ queryKey: ['owners'] })
            toast({
              title: '⚠️ Deck Created',
              description: 'Deck created but decklist import failed.',
              variant: 'destructive',
            })
          }
        } else {
          queryClient.invalidateQueries({ queryKey: ['decks'] })
          queryClient.invalidateQueries({ queryKey: ['owners'] })
          toast({
            title: '✨ Spellbook Created',
            description: 'Your new grimoire has been bound and is ready for spells.',
          })
        }
        
        // Reset all form state
        setShowCreateModal(false)
        setNewDeckName('')
        setNewDeckFormat('')
        setNewDeckDescription('')
        setNewDeckOwnerId('')
        setNewDeckStatus('building')
        setShowImportSection(false)
        setImportDecklist('')
        setImportResult(null)
      },
    })
  }

  const handleCreateOwner = () => {
    if (!newOwnerName.trim()) return
    createOwnerMutation.mutate({
      name: newOwnerName.trim(),
      color: newOwnerColor,
    })
  }

  const handleDeleteDeck = (id: string, name: string) => {
    if (confirm(`Are you sure you want to destroy "${name}"? This cannot be undone.`)) {
      deleteMutation.mutate(id)
    }
  }

  // Calculate total value of all displayed decks (excluding "building" status)
  const totalCollectionValue = data?.decks?.reduce((sum, deck) => {
    // Don't count decks in "building" status in the total value
    if (deck.status === 'building') return sum
    return sum + deck.totalPrice
  }, 0) || 0

  // Filter and sort decks based on current settings
  const sortedDecks = useMemo(() => {
    if (!data?.decks) return []
    
    // First filter by status if needed
    let filtered = data.decks
    if (filterStatus !== 'all') {
      filtered = data.decks.filter(deck => deck.status === filterStatus)
    }
    
    // Then sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
          break
        case 'price':
          comparison = a.totalPrice - b.totalPrice
          break
        case 'status':
          const statusOrder = { building: 0, active: 1, locked: 2 }
          comparison = statusOrder[a.status] - statusOrder[b.status]
          break
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          break
        case 'cardCount':
          comparison = a.cardCount - b.cardCount
          break
        case 'avgCmc':
          comparison = a.avgCmc - b.avgCmc
          break
        case 'tags':
          // Sort by first tag name alphabetically, decks without tags go last
          const aFirstTag = a.tags[0]?.name || '\uffff'
          const bFirstTag = b.tags[0]?.name || '\uffff'
          comparison = aFirstTag.localeCompare(bFirstTag, 'fr', { sensitivity: 'base' })
          break
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })
    
    return sorted
  }, [data?.decks, sortField, sortDirection, filterStatus])

  // Handle delete owner
  const handleDeleteOwner = (owner: Owner) => {
    if (confirm(`Are you sure you want to remove "${owner.name}"? Their decks will remain but become unassigned.`)) {
      deleteOwnerMutation.mutate(owner.id)
    }
  }

  // Cycle deck status
  const cycleDeckStatus = (deck: Deck, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const statusOrder: DeckStatus[] = ['building', 'active', 'locked']
    const currentIndex = statusOrder.indexOf(deck.status)
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length]
    updateDeckStatusMutation.mutate({ id: deck.id, status: nextStatus })
  }

  // Get default owner for new decks
  const defaultOwner = ownersData?.owners?.find(o => o.isDefault)

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-6 h-6 text-arcane-500" />
              <h1 className="font-display text-2xl text-gold-400">Your Spellbooks</h1>
            </div>
            <p className="text-parchment-500 text-sm">
              Manage your collection of magical grimoires
            </p>
          </div>
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="outline" onClick={() => setShowOwnerModal(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Owner
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Spellbook
              </Button>
            </motion.div>
          </div>
        </div>
      </FadeIn>

      {/* Filters & Stats Bar */}
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
                  {data?.decks?.length || 0} spellbook{(data?.decks?.length || 0) !== 1 ? 's' : ''}
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
                  onClick={() => handleViewModeChange('grid')}
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
                  onClick={() => handleViewModeChange('list')}
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
                  onClick={() => setFilterStatus('all')}
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
                  onClick={() => setFilterStatus('building')}
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
                  onClick={() => setFilterStatus('active')}
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
                  onClick={() => setFilterStatus('locked')}
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
                  ({sortedDecks.length} deck{sortedDecks.length !== 1 ? 's' : ''})
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
                  const Icon = config.icon
                  const isActive = filterColors.includes(colorCode)
                  
                  return (
                    <motion.button
                      key={colorCode}
                      onClick={() => {
                        if (isActive) {
                          setFilterColors(filterColors.filter(c => c !== colorCode))
                        } else {
                          setFilterColors([...filterColors, colorCode])
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
                  onValueChange={(value: 'any' | 'all' | 'exact') => setFilterColorMode(value)}
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
                  onClick={() => setFilterColors([])}
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
                onChange={setFilterCardName}
                placeholder="Search by card..."
              />
              
              {/* Clear all filters - inline on mobile */}
              {(filterColors.length > 0 || filterCardName || filterTags.length > 0) && (
                <button
                  onClick={() => {
                    setFilterColors([])
                    setFilterCardName('')
                    setFilterTags([])
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
              {tagsData?.tags && tagsData.tags.length > 0 ? (
                <div className="flex items-center gap-1 flex-wrap">
                  {tagsData.tags.map((tag) => {
                    const isActive = filterTags.includes(tag.name)
                    return (
                      <button
                        key={tag.id}
                        onClick={() => {
                          if (isActive) {
                            setFilterTags(filterTags.filter(t => t !== tag.name))
                          } else {
                            setFilterTags([...filterTags, tag.name])
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
                        createTagMutation.mutate(newTagName.trim())
                      } else if (e.key === 'Escape') {
                        setShowTagInput(false)
                        setNewTagName('')
                      }
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (newTagName.trim()) {
                        createTagMutation.mutate(newTagName.trim())
                      }
                    }}
                    disabled={!newTagName.trim() || createTagMutation.isPending}
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

      {/* Loading State */}
      {isLoading && (
        <DiceLoader message="Summoning your grimoires from the vault..." />
      )}

      {/* Empty State */}
      {!isLoading && (!data?.decks || data.decks.length === 0) && (
        <EmptyState
          variant="decks"
          action={{
            label: 'Create Your First Spellbook',
            onClick: () => setShowCreateModal(true),
          }}
        />
      )}

      {/* Empty State for filtered results */}
      {!isLoading && data?.decks && data.decks.length > 0 && sortedDecks.length === 0 && (
        <div className="card-frame p-8 text-center">
          <Filter className="w-12 h-12 text-dungeon-500 mx-auto mb-4" />
          <h3 className="font-medieval text-lg text-parchment-300 mb-2">No matching decks</h3>
          <p className="text-sm text-parchment-500 mb-4">
            No decks match your current filters. Try adjusting your criteria.
          </p>
          <Button 
            variant="outline" 
            onClick={() => {
              setFilterStatus('all')
              setFilterColors([])
              setFilterCardName('')
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}

      {/* Decks Grid View */}
      {sortedDecks.length > 0 && viewMode === 'grid' && (
        <StaggerContainer key={`${activeOwner?.id || 'all'}-grid`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedDecks.map((deck) => (
            <StaggerItem key={deck.id}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Link
                  href={`/decks/${deck.id}`}
                  className="card-frame overflow-hidden group hover:border-gold-500/50 transition-all duration-300 block"
                >
                  {/* Cover Image */}
                  <div className="relative h-32 bg-dungeon-700 overflow-hidden">
                    {deck.coverImage ? (
                      <Image
                        src={deck.coverImage}
                        alt={deck.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-arcane-900/50 to-dungeon-800">
                        <Layers className="w-12 h-12 text-arcane-600/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-dungeon-900 via-dungeon-900/50 to-transparent" />

                    {/* Top badges row */}
                    <div className="absolute top-2 left-2 right-2 flex justify-between items-start gap-2">
                      {/* Left side: Owner Badge */}
                      <div className="flex items-center gap-1.5">
                        {deck.owner && (
                          <div 
                            className="px-2 py-1 rounded text-xs bg-dungeon-900/80 font-medium border border-opacity-50 flex items-center gap-1.5"
                            style={{ 
                              color: deck.owner.color,
                              borderColor: deck.owner.color,
                            }}
                          >
                            <Users className="w-3 h-3" />
                            {deck.owner.name}
                          </div>
                        )}
                        {/* Status Badge (clickable) */}
                        <button
                          onClick={(e) => cycleDeckStatus(deck, e)}
                          className={cn(
                            "px-2 py-1 rounded text-xs bg-dungeon-900/80 font-medium border flex items-center gap-1 transition-colors",
                            deck.status === 'building' && "text-amber-400 border-amber-500/50 hover:bg-amber-500/20",
                            deck.status === 'active' && "text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/20",
                            deck.status === 'locked' && "text-slate-400 border-slate-500/50 hover:bg-slate-500/20"
                          )}
                          title={`Status: ${deck.status} (click to change)`}
                        >
                          {deck.status === 'building' && <Hammer className="w-3 h-3" />}
                          {deck.status === 'active' && <Sparkles className="w-3 h-3" />}
                          {deck.status === 'locked' && <Lock className="w-3 h-3" />}
                          <span className="capitalize">{deck.status}</span>
                        </button>
                      </div>
                      
                      {/* Right side: Format Badge */}
                      {deck.format && (
                        <div className="px-2 py-1 rounded text-xs bg-dungeon-900/80 text-gold-400 capitalize font-medieval border border-gold-600/30">
                          {deck.format}
                        </div>
                      )}
                    </div>
                    
                    {/* Magical glow on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                      <div className="absolute inset-0 bg-gradient-to-t from-arcane-600/20 to-transparent" />
                    </div>
                  </div>

                    {/* Info */}
                    <div className="p-4">
                      <h3 className="font-medieval text-lg text-gold-400 truncate group-hover:text-gold-300 transition-colors">
                        {deck.name}
                      </h3>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-parchment-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          {deck.cardCount} cards
                        </p>
                        <p className="text-sm font-semibold flex items-center gap-1">
                          <Coins className="w-3 h-3 text-gold-500" />
                          <span className="text-emerald-400" title="Minimum price">
                            {formatPrice(deck.minTotalPrice, 'EUR')}
                          </span>
                          <span className="text-dungeon-500">/</span>
                          <span className="text-gold-500" title="Actual price">
                            {formatPrice(deck.totalPrice, 'EUR')}
                          </span>
                        </p>
                      </div>
                      {/* Deck colors */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex gap-1">
                          {deck.colors.length > 0 ? (
                            deck.colors.map(colorCode => {
                              const config = MANA_CONFIG[colorCode as keyof typeof MANA_CONFIG]
                              return config ? (
                                <div 
                                  key={colorCode}
                                  className={cn("w-4 h-4 rounded-full bg-gradient-to-br border", config.bg, config.border)}
                                  title={config.name}
                                />
                              ) : null
                            })
                          ) : (
                            <span className="text-xs text-dungeon-500">Colorless</span>
                          )}
                        </div>
                        <p className="text-xs text-dungeon-400 font-body">
                          {formatDate(deck.updatedAt)}
                        </p>
                      </div>
                      
                      {/* Tags */}
                      {deck.tags && deck.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {deck.tags.map(tag => (
                            <span
                              key={tag.id}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-opacity-40"
                              style={{
                                backgroundColor: `${tag.color}15`,
                                borderColor: tag.color,
                                color: tag.color,
                              }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                  {/* Actions */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1" style={{ top: deck.format ? '2.5rem' : '0.5rem' }}>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.preventDefault()
                        handleDeleteDeck(deck.id, deck.name)
                      }}
                      className="p-2 rounded bg-dragon-600/80 hover:bg-dragon-500 text-white transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                </Link>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Decks List View */}
      {sortedDecks.length > 0 && viewMode === 'list' && (
        <FadeIn delay={0.1}>
          <div className="card-frame overflow-hidden">
            {/* Sort Header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto_auto] sm:grid-cols-[2fr_80px_90px_70px_50px_50px_100px_90px_80px_36px] gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-dungeon-800 border-b border-dungeon-600 text-xs font-medium text-parchment-400">
              <button
                onClick={() => handleSortChange('name')}
                className="flex items-center gap-1 hover:text-gold-400 transition-colors text-left"
              >
                Name
                {sortField === 'name' && (
                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                )}
                {sortField !== 'name' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
              </button>
              <span className="hidden sm:block text-center">Colors</span>
              <button
                onClick={() => handleSortChange('status')}
                className="hidden sm:flex items-center gap-1 hover:text-gold-400 transition-colors justify-center"
              >
                Status
                {sortField === 'status' && (
                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                )}
              </button>
              <span className="hidden sm:block text-center">Format</span>
              <button
                onClick={() => handleSortChange('cardCount')}
                className="flex items-center gap-1 hover:text-gold-400 transition-colors justify-end"
              >
                <span className="hidden sm:inline">Cards</span>
                <Sparkles className="w-3 h-3 sm:hidden" />
                {sortField === 'cardCount' && (
                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={() => handleSortChange('avgCmc')}
                className="hidden sm:flex items-center gap-1 hover:text-gold-400 transition-colors justify-end"
                title="Average Mana Cost"
              >
                CMC
                {sortField === 'avgCmc' && (
                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={() => handleSortChange('tags')}
                className="hidden sm:flex items-center gap-1 hover:text-gold-400 transition-colors"
              >
                Tags
                {sortField === 'tags' && (
                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={() => handleSortChange('price')}
                className="flex items-center gap-1 hover:text-gold-400 transition-colors justify-end"
              >
                Price
                {sortField === 'price' && (
                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={() => handleSortChange('updatedAt')}
                className="hidden sm:flex items-center gap-1 hover:text-gold-400 transition-colors justify-end"
              >
                Date
                {sortField === 'updatedAt' && (
                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                )}
                {sortField !== 'updatedAt' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
              </button>
              <span className="w-8" />
            </div>
            
            {/* Deck Rows */}
            <div className="divide-y divide-dungeon-700">
              {sortedDecks.map((deck) => (
                <Link
                  key={deck.id}
                  href={`/decks/${deck.id}`}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto_auto] sm:grid-cols-[2fr_80px_90px_70px_50px_50px_100px_90px_80px_36px] gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 hover:bg-dungeon-700/50 transition-colors group items-center"
                >
                  {/* Name + Owner (mobile shows colors and status here too) */}
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Owner dot */}
                    {deck.owner && (
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: deck.owner.color }}
                        title={deck.owner.name}
                      />
                    )}
                    {/* Mobile: status icon */}
                    <button
                      onClick={(e) => cycleDeckStatus(deck, e)}
                      className={cn(
                        "flex-shrink-0 sm:hidden",
                        deck.status === 'building' && "text-amber-400",
                        deck.status === 'active' && "text-emerald-400",
                        deck.status === 'locked' && "text-slate-400"
                      )}
                      title={`Status: ${deck.status}`}
                    >
                      {deck.status === 'building' && <Hammer className="w-3.5 h-3.5" />}
                      {deck.status === 'active' && <Sparkles className="w-3.5 h-3.5" />}
                      {deck.status === 'locked' && <Lock className="w-3.5 h-3.5" />}
                    </button>
                    <span className="font-medieval text-gold-400 group-hover:text-gold-300 truncate">
                      {deck.name}
                    </span>
                    {/* Mobile: colors inline */}
                    <div className="flex gap-0.5 sm:hidden flex-shrink-0">
                      {deck.colors.length > 0 ? (
                        deck.colors.map(colorCode => {
                          const config = MANA_CONFIG[colorCode as keyof typeof MANA_CONFIG]
                          return config ? (
                            <div
                              key={colorCode}
                              className={cn("w-3 h-3 rounded-full bg-gradient-to-br", config.bg)}
                            />
                          ) : null
                        })
                      ) : (
                        <span className="text-[10px] text-dungeon-500">C</span>
                      )}
                    </div>
                  </div>

                  {/* Colors (desktop) */}
                  <div className="hidden sm:flex gap-1 justify-center">
                    {deck.colors.length > 0 ? (
                      deck.colors.map(colorCode => {
                        const config = MANA_CONFIG[colorCode as keyof typeof MANA_CONFIG]
                        return config ? (
                          <div
                            key={colorCode}
                            className={cn("w-4 h-4 rounded-full bg-gradient-to-br border", config.bg, config.border)}
                            title={config.name}
                          />
                        ) : null
                      })
                    ) : (
                      <span className="text-xs text-dungeon-500">Colorless</span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="hidden sm:flex justify-center">
                    <button
                      onClick={(e) => cycleDeckStatus(deck, e)}
                      className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium border flex items-center gap-1 transition-colors",
                        deck.status === 'building' && "text-amber-400 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20",
                        deck.status === 'active' && "text-emerald-400 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20",
                        deck.status === 'locked' && "text-slate-400 border-slate-500/40 bg-slate-500/10 hover:bg-slate-500/20"
                      )}
                      title={`Status: ${deck.status} (click to change)`}
                    >
                      {deck.status === 'building' && <Hammer className="w-3 h-3" />}
                      {deck.status === 'active' && <Sparkles className="w-3 h-3" />}
                      {deck.status === 'locked' && <Lock className="w-3 h-3" />}
                      <span className="capitalize hidden lg:inline">{deck.status}</span>
                    </button>
                  </div>

                  {/* Format */}
                  <div className="hidden sm:block text-center">
                    {deck.format ? (
                      <span className="text-xs text-gold-400/80 capitalize">{deck.format}</span>
                    ) : (
                      <span className="text-xs text-dungeon-500">—</span>
                    )}
                  </div>

                  {/* Card Count */}
                  <div className="text-right text-sm text-parchment-400">
                    {deck.cardCount}
                  </div>

                  {/* Average CMC */}
                  <div className="hidden sm:block text-right text-sm text-arcane-400">
                    {deck.avgCmc > 0 ? deck.avgCmc.toFixed(2) : '—'}
                  </div>

                  {/* Tags */}
                  <div className="hidden sm:flex flex-wrap gap-1 justify-start overflow-hidden">
                    {deck.tags.length > 0 ? (
                      deck.tags.slice(0, 2).map(tag => (
                        <span
                          key={tag.id}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-opacity-40 truncate max-w-[45px]"
                          style={{
                            backgroundColor: `${tag.color}15`,
                            borderColor: tag.color,
                            color: tag.color,
                          }}
                          title={tag.name}
                        >
                          {tag.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-dungeon-500">—</span>
                    )}
                    {deck.tags.length > 2 && (
                      <span className="text-[10px] text-dungeon-400">+{deck.tags.length - 2}</span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="text-right text-sm font-semibold flex items-center justify-end gap-1">
                    <span className="text-emerald-400" title="Minimum price">
                      {formatPrice(deck.minTotalPrice, 'EUR')}
                    </span>
                    <span className="text-dungeon-500">/</span>
                    <span className="text-gold-500" title="Actual price">
                      {formatPrice(deck.totalPrice, 'EUR')}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="hidden sm:block text-right text-xs text-dungeon-400">
                    {formatDate(deck.updatedAt)}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex justify-end">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.preventDefault()
                        handleDeleteDeck(deck.id, deck.name)
                      }}
                      className="p-1.5 rounded text-dungeon-400 hover:text-dragon-400 hover:bg-dragon-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Create Deck Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-arcane-500" />
              Bind New Spellbook
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-medieval">Grimoire Name</Label>
              <Input
                id="name"
                placeholder="Name your spellbook..."
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner" className="font-medieval">Owner</Label>
              <Select 
                value={newDeckOwnerId || defaultOwner?.id || ''} 
                onValueChange={setNewDeckOwnerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  {ownersData?.owners?.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: owner.color }}
                        />
                        {owner.name}
                        {owner.isDefault && (
                          <Crown className="w-3 h-3 text-gold-500 ml-1" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="format" className="font-medieval">Magical Format (optional)</Label>
              <Select value={newDeckFormat} onValueChange={setNewDeckFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Format</SelectItem>
                  {FORMATS.map((format) => (
                    <SelectItem key={format.code} value={format.code}>
                      {format.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="font-medieval">Description (optional)</Label>
              <Input
                id="description"
                placeholder="Describe the purpose of this grimoire..."
                value={newDeckDescription}
                onChange={(e) => setNewDeckDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-medieval">Initial Status</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setNewDeckStatus('building')}
                  className={cn(
                    "p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                    newDeckStatus === 'building'
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-dungeon-600 hover:border-dungeon-500"
                  )}
                >
                  <Hammer className={cn("w-5 h-5", newDeckStatus === 'building' ? "text-amber-400" : "text-parchment-400")} />
                  <span className={cn("text-xs", newDeckStatus === 'building' ? "text-amber-400" : "text-parchment-400")}>Building</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewDeckStatus('active')}
                  className={cn(
                    "p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                    newDeckStatus === 'active'
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-dungeon-600 hover:border-dungeon-500"
                  )}
                >
                  <Sparkles className={cn("w-5 h-5", newDeckStatus === 'active' ? "text-emerald-400" : "text-parchment-400")} />
                  <span className={cn("text-xs", newDeckStatus === 'active' ? "text-emerald-400" : "text-parchment-400")}>Active</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewDeckStatus('locked')}
                  className={cn(
                    "p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                    newDeckStatus === 'locked'
                      ? "border-slate-500 bg-slate-500/10"
                      : "border-dungeon-600 hover:border-dungeon-500"
                  )}
                >
                  <Lock className={cn("w-5 h-5", newDeckStatus === 'locked' ? "text-slate-400" : "text-parchment-400")} />
                  <span className={cn("text-xs", newDeckStatus === 'locked' ? "text-slate-400" : "text-parchment-400")}>Locked</span>
                </button>
              </div>
              <p className="text-xs text-parchment-500">
                {newDeckStatus === 'building' && "Building: Prioritized in add-to-deck, excluded from total value"}
                {newDeckStatus === 'active' && "Active: Normal deck, included in total value"}
                {newDeckStatus === 'locked' && "Locked: Hidden from add-to-deck dropdown"}
              </p>
            </div>

            {/* Import Decklist Section */}
            <div className="border-t border-dungeon-600 pt-4">
              <button
                type="button"
                onClick={() => setShowImportSection(!showImportSection)}
                className="flex items-center gap-2 text-sm text-parchment-400 hover:text-parchment-200 transition-colors w-full"
              >
                <Upload className="w-4 h-4" />
                <span className="font-medieval">Import Decklist (optional)</span>
                {showImportSection ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                )}
              </button>
              
              {showImportSection && (
                <div className="mt-3 space-y-2">
                  <textarea
                    placeholder={"Paste your decklist here...\n\nFormat examples:\n4 Lightning Bolt\n2x Counterspell\n\n// Sideboard\n2 Negate"}
                    value={importDecklist}
                    onChange={(e) => setImportDecklist(e.target.value)}
                    className="w-full h-32 px-3 py-2 text-sm bg-dungeon-800 border border-dungeon-600 rounded-lg text-parchment-200 placeholder:text-dungeon-500 focus:outline-none focus:border-arcane-500 resize-none font-mono"
                  />
                  <p className="text-xs text-parchment-500">
                    Format: &quot;4 Card Name&quot; or &quot;4x Card Name&quot;. Use &quot;// Sideboard&quot; for sideboard cards.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              variant="arcane"
              onClick={handleCreateDeck}
              disabled={!newDeckName.trim() || createMutation.isPending || importDecklistMutation.isPending}
            >
              {createMutation.isPending 
                ? 'Binding...' 
                : importDecklistMutation.isPending 
                  ? 'Importing cards...'
                  : importDecklist.trim() 
                    ? 'Create & Import'
                    : 'Bind Spellbook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Owner Modal */}
      <Dialog open={showOwnerModal} onOpenChange={setShowOwnerModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-arcane-500" />
              Add New Owner
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ownerName" className="font-medieval">Owner Name</Label>
              <Input
                id="ownerName"
                placeholder="Enter owner name..."
                value={newOwnerName}
                onChange={(e) => setNewOwnerName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label className="font-medieval">Color</Label>
              <div className="grid grid-cols-4 gap-2">
                {OWNER_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setNewOwnerColor(color.value)}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                      newOwnerColor === color.value
                        ? "border-gold-500 bg-dungeon-700"
                        : "border-dungeon-600 hover:border-dungeon-500"
                    )}
                  >
                    <span
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: color.value }}
                    />
                    <span className="text-xs text-parchment-400">{color.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 rounded-lg bg-dungeon-800 border border-dungeon-600">
              <p className="text-sm text-parchment-400 mb-2">Preview:</p>
              <div 
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dungeon-900/80 border border-opacity-50"
                style={{ 
                  color: newOwnerColor,
                  borderColor: newOwnerColor,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: newOwnerColor }}
                />
                {newOwnerName || 'Owner Name'}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowOwnerModal(false)}>
              Cancel
            </Button>
            <Button
              variant="arcane"
              onClick={handleCreateOwner}
              disabled={!newOwnerName.trim() || createOwnerMutation.isPending}
            >
              {createOwnerMutation.isPending ? 'Adding...' : 'Add Owner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
