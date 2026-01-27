'use client'

import { use, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { 
  ArrowLeft, 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  Download, 
  ExternalLink, 
  Settings2, 
  BookOpen,
  LayoutGrid,
  List,
  Layers,
  Hash,
  Users,
  Crown,
  ImageIcon,
  Check,
  X,
  Copy,
  MoreVertical,
  FlaskConical,
  Tag,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
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
import { formatPrice, formatBestPrice, getBestPrice, getRarityColor } from '@/lib/utils'
import { CARD_CATEGORIES, FORMATS } from '@/types/search'
import { cn } from '@/lib/utils'
import { DeckStats } from '@/components/deck/deck-stats'
import { DeckVisualView } from '@/components/deck/deck-visual-view'
import { SimulationStats } from '@/components/deck/simulation-stats'
import { DeckAvailability } from '@/components/deck/deck-availability'
import { DeckSuggestions } from '@/components/deck/deck-suggestions'
import { CardDetailModal } from '@/components/card/card-detail-modal'
import { SetSelector } from '@/components/card/set-selector'
import { CardWithPrice } from '@/types/scryfall'

type ViewMode = 'list' | 'visual'
type GroupBy = 'cmc' | 'type'

interface DeckCard {
  id: string
  cardId: string
  quantity: number
  category: string
  card: CardWithPrice
}

const EXPORT_FORMATS = [
  { code: 'arena', name: 'MTG Arena' },
  { code: 'mtgo', name: 'MTGO' },
  { code: 'simple', name: 'Simple (Qty x Name)' },
] as const

interface Owner {
  id: string
  name: string
  color: string
}

interface Tag {
  id: string
  name: string
  color: string
}

interface DeckDetail {
  id: string
  name: string
  description: string | null
  format: string | null
  coverImage: string | null
  owner: Owner | null
  tags: Tag[]
  cards: DeckCard[]
  totalPrice: number
  minTotalPrice: number
}

export default function DeckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [selectedCard, setSelectedCard] = useState<CardWithPrice | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCoverModal, setShowCoverModal] = useState(false)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateName, setDuplicateName] = useState('')
  const [editName, setEditName] = useState('')
  const [editFormat, setEditFormat] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editOwnerId, setEditOwnerId] = useState('')
  const [editCoverImage, setEditCoverImage] = useState<string | null>(null)
  
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [groupBy, setGroupBy] = useState<GroupBy>('cmc')

  // Fetch owners for the edit modal
  const { data: ownersData } = useQuery<{ owners: Owner[] }>({
    queryKey: ['owners'],
    queryFn: async () => {
      const response = await fetch('/api/owners')
      if (!response.ok) throw new Error('Failed to fetch owners')
      return response.json()
    },
  })

  // Fetch available tags
  const { data: tagsData } = useQuery<{ tags: Tag[] }>({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await fetch('/api/tags')
      if (!response.ok) throw new Error('Failed to fetch tags')
      return response.json()
    },
  })

  // Export deck handler
  const handleExport = async (format: string) => {
    try {
      const response = await fetch(`/api/decks/${id}/export?format=${format}`)
      if (!response.ok) throw new Error('Export failed')
      
      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition
        ?.split('filename=')[1]
        ?.replace(/"/g, '') || 'decklist.txt'
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({
        title: 'Deck Exported',
        description: `Decklist downloaded as ${filename}`,
      })
    } catch {
      toast({
        title: 'Export Failed',
        description: 'Could not export the deck. Please try again.',
        variant: 'destructive',
      })
    }
  }

  // Fetch deck
  const { data, isLoading, error } = useQuery<{ deck: DeckDetail }>({
    queryKey: ['deck', id],
    queryFn: async () => {
      const response = await fetch(`/api/decks/${id}`)
      if (!response.ok) throw new Error('Failed to fetch deck')
      return response.json()
    },
  })

  // Update card quantity mutation
  const updateCardMutation = useMutation({
    mutationFn: async ({
      cardId,
      quantity,
      category,
    }: {
      cardId: string
      quantity: number
      category: string
    }) => {
      const response = await fetch(`/api/decks/${id}/cards`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, quantity, category }),
      })
      if (!response.ok) throw new Error('Failed to update card')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deck', id] })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update card quantity.',
        variant: 'destructive',
      })
    },
  })

  // Remove card mutation
  const removeCardMutation = useMutation({
    mutationFn: async ({ cardId, category }: { cardId: string; category: string }) => {
      const response = await fetch(`/api/decks/${id}/cards?cardId=${cardId}&category=${category}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to remove card')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deck', id] })
      toast({
        title: 'Card Removed',
        description: 'The card has been removed from the deck.',
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to remove card.',
        variant: 'destructive',
      })
    },
  })

  // Update deck mutation
  const updateDeckMutation = useMutation({
    mutationFn: async (data: { name: string; format: string; description: string; ownerId: string; coverImage: string | null }) => {
      const response = await fetch(`/api/decks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          format: data.format === 'none' ? null : data.format,
          description: data.description,
          ownerId: data.ownerId || null,
          coverImage: data.coverImage,
        }),
      })
      if (!response.ok) throw new Error('Failed to update deck')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deck', id] })
      queryClient.invalidateQueries({ queryKey: ['decks'] })
      queryClient.invalidateQueries({ queryKey: ['owners'] })
      setShowEditModal(false)
      toast({
        title: '✨ Spellbook Updated',
        description: 'Your grimoire has been successfully modified.',
      })
    },
    onError: () => {
      toast({
        title: 'Update Failed',
        description: 'Could not update the spellbook. Please try again.',
        variant: 'destructive',
      })
    },
  })

  // Open edit modal with current deck data
  const handleOpenEditModal = () => {
    if (data?.deck) {
      setEditName(data.deck.name)
      setEditFormat(data.deck.format || 'none')
      setEditDescription(data.deck.description || '')
      setEditOwnerId(data.deck.owner?.id || '')
      setEditCoverImage(data.deck.coverImage)
      setShowEditModal(true)
    }
  }

  const handleUpdateDeck = () => {
    if (!editName.trim()) return
    updateDeckMutation.mutate({
      name: editName,
      format: editFormat,
      description: editDescription,
      ownerId: editOwnerId,
      coverImage: editCoverImage,
    })
  }

  // Update cover image mutation (dedicated for quick change)
  const updateCoverMutation = useMutation({
    mutationFn: async (coverImage: string | null) => {
      const response = await fetch(`/api/decks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverImage }),
      })
      if (!response.ok) throw new Error('Failed to update cover')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deck', id] })
      queryClient.invalidateQueries({ queryKey: ['decks'] })
      setShowCoverModal(false)
      toast({
        title: '🖼️ Couverture mise à jour',
        description: 'La couverture du grimoire a été changée.',
      })
    },
    onError: () => {
      toast({
        title: 'Échec',
        description: 'Impossible de mettre à jour la couverture.',
        variant: 'destructive',
      })
    },
  })

  // Duplicate deck mutation
  const duplicateDeckMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch(`/api/decks/${id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!response.ok) throw new Error('Failed to duplicate deck')
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['decks'] })
      setShowDuplicateModal(false)
      setDuplicateName('')
      toast({
        title: '📋 Deck dupliqué !',
        description: `"${data.deck.name}" créé en mode construction.`,
      })
      // Navigate to the new deck
      router.push(`/decks/${data.deck.id}`)
    },
    onError: () => {
      toast({
        title: 'Échec',
        description: 'Impossible de dupliquer le deck.',
        variant: 'destructive',
      })
    },
  })

  // Toggle tag on deck
  const toggleTagMutation = useMutation({
    mutationFn: async ({ tagId, action }: { tagId: string; action: 'add' | 'remove' }) => {
      const body = action === 'add' ? { addTagId: tagId } : { removeTagId: tagId }
      const response = await fetch(`/api/decks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error('Failed to update tags')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deck', id] })
      queryClient.invalidateQueries({ queryKey: ['decks'] })
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
    onError: () => {
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier les tags.',
        variant: 'destructive',
      })
    },
  })

  // Change card edition mutation
  const changeEditionMutation = useMutation({
    mutationFn: async ({
      currentCardId,
      newCardId,
      category,
    }: {
      currentCardId: string
      newCardId: string
      category: string
    }) => {
      const response = await fetch(`/api/decks/${id}/cards/edition`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentCardId, newCardId, category }),
      })
      if (!response.ok) throw new Error('Failed to change edition')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deck', id] })
      toast({
        title: 'Edition changed',
        description: 'Card edition has been updated.',
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to change card edition.',
        variant: 'destructive',
      })
    },
  })

  // Open duplicate modal with suggested name
  const handleOpenDuplicateModal = () => {
    if (data?.deck) {
      setDuplicateName(`${data.deck.name} (copie)`)
      setShowDuplicateModal(true)
    }
  }

  const handleDuplicate = () => {
    if (!duplicateName.trim()) return
    duplicateDeckMutation.mutate(duplicateName.trim())
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-12 w-64 rounded" />
        <div className="skeleton h-96 rounded-lg" />
      </div>
    )
  }

  if (error || !data?.deck) {
    return (
      <div className="card-frame p-12 text-center">
        <p className="text-dragon-400">Failed to load deck</p>
        <Link href="/decks">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Decks
          </Button>
        </Link>
      </div>
    )
  }

  const deck = data.deck

  // Group cards by category
  const cardsByCategory = CARD_CATEGORIES.reduce((acc, cat) => {
    acc[cat.code] = deck.cards.filter((c) => c.category === cat.code)
    return acc
  }, {} as Record<string, DeckCard[]>)

  // Calculate total cards
  const totalCards = deck.cards.reduce((sum, c) => sum + c.quantity, 0)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-4">
        {/* Top row: Back link + Actions */}
        <div className="flex items-center justify-between">
          <Link
            href="/decks"
            className="inline-flex items-center text-sm text-parchment-400 hover:text-parchment-200"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Retour aux decks</span>
            <span className="sm:hidden">Retour</span>
          </Link>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-dungeon-800 rounded-lg p-1 border border-dungeon-600">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-2 rounded-md transition-all",
                  viewMode === 'list' 
                    ? "bg-gold-500/20 text-gold-400" 
                    : "text-parchment-400 hover:text-parchment-200"
                )}
                title="Vue liste"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('visual')}
                className={cn(
                  "p-2 rounded-md transition-all",
                  viewMode === 'visual' 
                    ? "bg-gold-500/20 text-gold-400" 
                    : "text-parchment-400 hover:text-parchment-200"
                )}
                title="Vue visuelle"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {/* Group By Toggle (only in visual mode) */}
            {viewMode === 'visual' && (
              <div className="flex items-center bg-dungeon-800 rounded-lg p-1 border border-dungeon-600">
                <button
                  onClick={() => setGroupBy('cmc')}
                  className={cn(
                    "p-2 rounded-md transition-all flex items-center gap-1.5",
                    groupBy === 'cmc' 
                      ? "bg-arcane-500/20 text-arcane-400" 
                      : "text-parchment-400 hover:text-parchment-200"
                  )}
                  title="Grouper par coût de mana"
                >
                  <Hash className="w-4 h-4" />
                  <span className="text-xs font-medium">CMC</span>
                </button>
                <button
                  onClick={() => setGroupBy('type')}
                  className={cn(
                    "p-2 rounded-md transition-all flex items-center gap-1.5",
                    groupBy === 'type' 
                      ? "bg-arcane-500/20 text-arcane-400" 
                      : "text-parchment-400 hover:text-parchment-200"
                  )}
                  title="Grouper par type"
                >
                  <Layers className="w-4 h-4" />
                  <span className="text-xs font-medium">Type</span>
                </button>
              </div>
            )}

            {/* Playtest button */}
            <Link href={`/decks/${id}/playtest`}>
              <Button variant="outline" disabled={deck.cards.length === 0}>
                <FlaskConical className="w-4 h-4 mr-2" />
                Tester
              </Button>
            </Link>

            {/* Duplicate button */}
            <Button variant="outline" onClick={handleOpenDuplicateModal}>
              <Copy className="w-4 h-4 mr-2" />
              Dupliquer
            </Button>

            {/* Edit button */}
            <Button variant="outline" onClick={handleOpenEditModal}>
              <Settings2 className="w-4 h-4 mr-2" />
              Modifier
            </Button>

            {/* Export dropdown */}
            <Select onValueChange={handleExport}>
              <SelectTrigger className="w-auto gap-2">
                <Download className="w-4 h-4" />
                <SelectValue placeholder="Export" />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_FORMATS.map((format) => (
                  <SelectItem key={format.code} value={format.code}>
                    {format.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Link href="/">
              <Button>
                <Search className="w-4 h-4 mr-2" />
                Ajouter
              </Button>
            </Link>
          </div>

          {/* Mobile Actions - Dropdown Menu */}
          <div className="md:hidden flex items-center gap-2">
            <Link href="/">
              <Button size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </Link>
            <Select onValueChange={(value) => {
              if (value === 'edit') handleOpenEditModal()
              else if (value === 'duplicate') handleOpenDuplicateModal()
              else if (value === 'playtest') router.push(`/decks/${id}/playtest`)
              else if (value.startsWith('export-')) handleExport(value.replace('export-', ''))
              else if (value === 'view-list') setViewMode('list')
              else if (value === 'view-visual') setViewMode('visual')
              else if (value === 'group-cmc') setGroupBy('cmc')
              else if (value === 'group-type') setGroupBy('type')
            }}>
              <SelectTrigger className="w-auto px-2">
                <MoreVertical className="w-4 h-4" />
              </SelectTrigger>
              <SelectContent align="end">
                {deck.cards.length > 0 && (
                  <SelectItem value="playtest">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="w-4 h-4" /> Tester
                    </div>
                  </SelectItem>
                )}
                <SelectItem value="edit">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4" /> Modifier
                  </div>
                </SelectItem>
                <SelectItem value="duplicate">
                  <div className="flex items-center gap-2">
                    <Copy className="w-4 h-4" /> Dupliquer
                  </div>
                </SelectItem>
                <SelectItem value="view-list">
                  <div className="flex items-center gap-2">
                    <List className="w-4 h-4" /> Vue liste {viewMode === 'list' && '✓'}
                  </div>
                </SelectItem>
                <SelectItem value="view-visual">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4" /> Vue visuelle {viewMode === 'visual' && '✓'}
                  </div>
                </SelectItem>
                {viewMode === 'visual' && (
                  <>
                    <SelectItem value="group-cmc">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4" /> Par CMC {groupBy === 'cmc' && '✓'}
                      </div>
                    </SelectItem>
                    <SelectItem value="group-type">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4" /> Par type {groupBy === 'type' && '✓'}
                      </div>
                    </SelectItem>
                  </>
                )}
                {EXPORT_FORMATS.map((format) => (
                  <SelectItem key={format.code} value={`export-${format.code}`}>
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4" /> Export {format.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Deck Info Row */}
        <div className="flex gap-3 sm:gap-4">
          {/* Cover Image Thumbnail */}
          <button
            onClick={() => deck.cards.length > 0 && setShowCoverModal(true)}
            className={cn(
              "relative w-16 h-22 sm:w-20 sm:h-28 rounded-lg overflow-hidden border-2 transition-all group flex-shrink-0",
              deck.cards.length > 0 
                ? "border-dungeon-600 hover:border-gold-500 cursor-pointer" 
                : "border-dungeon-700 cursor-default"
            )}
            title={deck.cards.length > 0 ? "Changer la couverture" : "Ajouter des cartes pour définir une couverture"}
          >
            {deck.coverImage ? (
              <Image
                src={deck.coverImage}
                alt={deck.name}
                fill
                className="object-cover"
                sizes="80px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-dungeon-800">
                <Layers className="w-6 h-6 sm:w-8 sm:h-8 text-dungeon-600" />
              </div>
            )}
            {/* Hover overlay */}
            {deck.cards.length > 0 && (
              <div className="absolute inset-0 bg-dungeon-900/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gold-400" />
              </div>
            )}
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-medieval text-xl sm:text-2xl md:text-3xl text-gold-400 truncate">{deck.name}</h1>
            {deck.description && (
              <p className="text-parchment-400 text-sm mt-1 line-clamp-2">{deck.description}</p>
            )}
            <div className="flex items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm flex-wrap">
              {deck.owner && (
                <span 
                  className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-dungeon-700 flex items-center gap-1 sm:gap-1.5 border border-opacity-50"
                  style={{ color: deck.owner.color, borderColor: deck.owner.color }}
                >
                  <Users className="w-3 h-3" />
                  <span className="truncate max-w-[60px] sm:max-w-none">{deck.owner.name}</span>
                </span>
              )}
              {deck.format && (
                <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-dungeon-700 text-gold-400 capitalize">
                  {deck.format}
                </span>
              )}
              <span className="text-parchment-400">{totalCards} cartes</span>
              <span className="font-semibold flex items-center gap-1">
                <span className="text-emerald-400" title="Prix minimum (versions les moins chères)">
                  {formatPrice(deck.minTotalPrice, 'EUR')}
                </span>
                <span className="text-dungeon-500">/</span>
                <span className="text-gold-400" title="Prix réel (versions dans le deck)">
                  {formatPrice(deck.totalPrice, 'EUR')}
                </span>
              </span>
            </div>

            {/* Tags section */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Tag className="w-3.5 h-3.5 text-parchment-500" />
              
              {/* Current deck tags */}
              {deck.tags && deck.tags.length > 0 && deck.tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTagMutation.mutate({ tagId: tag.id, action: 'remove' })}
                  className="px-2 py-0.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 border hover:opacity-70"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    borderColor: tag.color,
                    color: tag.color,
                  }}
                  title={`Retirer le tag "${tag.name}"`}
                >
                  {tag.name}
                  <X className="w-2.5 h-2.5" />
                </button>
              ))}
              
              {/* Available tags to add (not already on deck) */}
              {tagsData?.tags && tagsData.tags
                .filter(t => !deck.tags?.some(dt => dt.id === t.id))
                .map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTagMutation.mutate({ tagId: tag.id, action: 'add' })}
                    className="px-2 py-0.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 border opacity-40 hover:opacity-100"
                    style={{
                      borderColor: tag.color,
                      color: tag.color,
                    }}
                    title={`Ajouter le tag "${tag.name}"`}
                  >
                    <Plus className="w-2.5 h-2.5" />
                    {tag.name}
                  </button>
                ))
              }
              
              {/* Empty state */}
              {(!tagsData?.tags || tagsData.tags.length === 0) && (!deck.tags || deck.tags.length === 0) && (
                <span className="text-xs text-dungeon-500 italic">
                  Aucun tag disponible
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {deck.cards.length === 0 && (
        <div className="card-frame p-12 text-center">
          <p className="text-parchment-400 mb-4">
            This deck is empty. Start by adding some cards!
          </p>
          <Link href="/">
            <Button>
              <Search className="w-4 h-4 mr-2" />
              Search Cards
            </Button>
          </Link>
        </div>
      )}

      {/* Deck Statistics - Only in List View */}
      {deck.cards.length > 0 && viewMode === 'list' && (
        <>
          <DeckStats cards={deck.cards} />
          <DeckAvailability deckId={id} />
          <DeckSuggestions deckId={id} />
          <SimulationStats deckId={id} cardCount={totalCards} />
        </>
      )}

      {/* Visual View */}
      {deck.cards.length > 0 && viewMode === 'visual' && (
        <DeckVisualView 
          cards={deck.cards}
          groupBy={groupBy}
          onCardClick={setSelectedCard}
        />
      )}

      {/* List View - Cards by Category */}
      {deck.cards.length > 0 && viewMode === 'list' && (
        <div className="grid gap-6">
          {CARD_CATEGORIES.map((category) => {
            const cards = cardsByCategory[category.code]
            if (!cards || cards.length === 0) return null

            const categoryTotal = cards.reduce((sum, c) => sum + c.quantity, 0)

            return (
              <div key={category.code} className="card-frame p-4">
                <h2 className="font-medieval text-lg text-gold-400 mb-4 flex items-center justify-between">
                  <span>{category.name}</span>
                  <span className="text-sm text-parchment-400">{categoryTotal} cards</span>
                </h2>

                <div className="grid gap-2">
                  {cards.map((dc) => (
                    <div
                      key={dc.id}
                      className="flex items-center gap-3 p-2 rounded bg-dungeon-800/50 hover:bg-dungeon-700/50 transition-colors group"
                    >
                      {/* Clickable Card Area (Image + Info) */}
                      <button
                        onClick={() => setSelectedCard(dc.card)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                      >
                        {/* Card Image Thumbnail */}
                        <div className="relative w-12 h-16 rounded overflow-hidden bg-dungeon-700 flex-shrink-0">
                          {dc.card.imageNormal ? (
                            <Image
                              src={dc.card.imageNormal}
                              alt={dc.card.name}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-dungeon-500">
                              ?
                            </div>
                          )}
                        </div>

                        {/* Card Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-parchment-200 truncate">{dc.card.name}</p>
                          <p className="text-xs text-parchment-400 truncate">
                            {dc.card.typeLine}
                          </p>
                        </div>
                      </button>

                      {/* Rarity & Set */}
                      <div className="hidden sm:block text-right">
                        <p className={cn('text-xs capitalize', getRarityColor(dc.card.rarity))}>
                          {dc.card.rarity}
                        </p>
                        <SetSelector
                          cardId={dc.cardId}
                          currentSetCode={dc.card.setCode}
                          onEditionChange={(newCardId) =>
                            changeEditionMutation.mutate({
                              currentCardId: dc.cardId,
                              newCardId,
                              category: dc.category,
                            })
                          }
                          disabled={changeEditionMutation.isPending}
                        />
                      </div>

                      {/* Price */}
                      <div className="text-right w-28">
                        {(() => {
                          const best = getBestPrice(dc.card.price)
                          const minPrice = dc.card.minPriceEur
                          if (!best) return <p className="text-sm text-parchment-500">-</p>

                          const currentPriceEur = best.currency === 'EUR' ? best.value : best.value * 0.92
                          const hasCheaperVersion = minPrice != null && minPrice < currentPriceEur * 0.95

                          return (
                            <div className="flex flex-col items-end">
                              {hasCheaperVersion && minPrice != null ? (
                                <>
                                  <p className="text-xs text-emerald-400" title="Prix minimum disponible">
                                    {formatPrice(minPrice * dc.quantity, 'EUR')}
                                  </p>
                                  <p className="text-xs text-gold-400/60 line-through" title="Prix actuel">
                                    {formatPrice(best.value * dc.quantity, best.currency)}
                                  </p>
                                </>
                              ) : (
                                <p className="text-sm text-gold-400">
                                  {formatPrice(best.value * dc.quantity, best.currency)}
                                </p>
                              )}
                            </div>
                          )
                        })()}
                      </div>

                      {/* External Links */}
                      <div className="flex items-center gap-1">
                        <a
                          href={`https://www.cardmarket.com/en/Magic/Products/Search?searchString=${encodeURIComponent(dc.card.name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-dungeon-600 text-parchment-400 hover:text-gold-400 transition-colors"
                          title="View on Cardmarket"
                        >
                          <span className="text-xs font-bold">CM</span>
                        </a>
                        <a
                          href={`https://scryfall.com/card/${dc.card.setCode}/${dc.card.collectorNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-dungeon-600 text-parchment-400 hover:text-gold-400 transition-colors"
                          title="View on Scryfall"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            updateCardMutation.mutate({
                              cardId: dc.cardId,
                              quantity: dc.quantity - 1,
                              category: dc.category,
                            })
                          }
                          className="p-1.5 rounded hover:bg-dungeon-600 text-parchment-400 hover:text-parchment-200 transition-colors"
                          disabled={updateCardMutation.isPending}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center text-parchment-200 font-medium">
                          {dc.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateCardMutation.mutate({
                              cardId: dc.cardId,
                              quantity: dc.quantity + 1,
                              category: dc.category,
                            })
                          }
                          className="p-1.5 rounded hover:bg-dungeon-600 text-parchment-400 hover:text-parchment-200 transition-colors"
                          disabled={updateCardMutation.isPending}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() =>
                          removeCardMutation.mutate({
                            cardId: dc.cardId,
                            category: dc.category,
                          })
                        }
                        className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-dragon-600/50 text-dragon-400 hover:text-dragon-300 transition-all"
                        disabled={removeCardMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Card Detail Modal */}
      <CardDetailModal
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
      />

      {/* Edit Deck Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-arcane-500" />
              Modifier le Grimoire
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 sm:py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="font-medieval text-sm sm:text-base">Nom</Label>
              <Input
                id="edit-name"
                placeholder="Nommer votre grimoire..."
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                className="text-base"
              />
            </div>

            {/* Owner and Format in a row on desktop, stacked on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-owner" className="font-medieval text-sm sm:text-base">Propriétaire</Label>
                <Select value={editOwnerId} onValueChange={setEditOwnerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {ownersData?.owners?.map((owner: Owner) => (
                      <SelectItem key={owner.id} value={owner.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: owner.color }}
                          />
                          {owner.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-format" className="font-medieval text-sm sm:text-base">Format</Label>
                <Select value={editFormat} onValueChange={setEditFormat}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {FORMATS.map((format) => (
                      <SelectItem key={format.code} value={format.code}>
                        {format.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description" className="font-medieval text-sm sm:text-base">Description</Label>
              <Input
                id="edit-description"
                placeholder="Décrire ce grimoire..."
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="text-base"
              />
            </div>

            {/* Cover Image Selector */}
            <div className="space-y-2">
              <Label className="font-medieval flex items-center gap-2 text-sm sm:text-base">
                <ImageIcon className="w-4 h-4" />
                Image de couverture
              </Label>
              {deck.cards.length === 0 ? (
                <p className="text-sm text-parchment-500 italic">
                  Ajouter des cartes pour choisir une couverture.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Current cover preview */}
                  {editCoverImage && (
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-dungeon-800 border border-gold-500/30">
                      <div className="relative w-12 h-16 sm:w-16 sm:h-22 rounded overflow-hidden flex-shrink-0">
                        <Image
                          src={editCoverImage}
                          alt="Couverture actuelle"
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gold-400 font-medium">Couverture actuelle</p>
                        <p className="text-xs text-parchment-500 hidden sm:block">Cliquer sur une carte pour changer</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditCoverImage(null)}
                        className="p-2 rounded hover:bg-dragon-600/50 text-parchment-400 hover:text-dragon-400 transition-colors flex-shrink-0"
                        title="Retirer la couverture"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                  
                  {/* Card grid for selection - responsive columns */}
                  <div className="max-h-40 sm:max-h-48 overflow-y-auto rounded-lg border border-dungeon-600 bg-dungeon-800/50 p-2">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {/* Get unique cards by imageArtCrop to avoid duplicates */}
                      {Array.from(
                        new Map(
                          deck.cards
                            .filter(dc => dc.card.imageArtCrop)
                            .map(dc => [dc.card.imageArtCrop, dc])
                        ).values()
                      ).map((dc) => {
                        const imageUrl = dc.card.imageArtCrop!
                        const isSelected = editCoverImage === imageUrl
                        return (
                          <button
                            key={dc.id}
                            type="button"
                            onClick={() => setEditCoverImage(imageUrl)}
                            className={cn(
                              "relative aspect-[4/3] rounded overflow-hidden transition-all",
                              isSelected 
                                ? "ring-2 ring-gold-500 ring-offset-2 ring-offset-dungeon-800" 
                                : "hover:ring-2 hover:ring-arcane-500/50 active:ring-2 active:ring-gold-500"
                            )}
                            title={dc.card.name}
                          >
                            <Image
                              src={imageUrl}
                              alt={dc.card.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 100px, 80px"
                            />
                            {isSelected && (
                              <div className="absolute inset-0 bg-gold-500/20 flex items-center justify-center">
                                <Check className="w-5 h-5 sm:w-6 sm:h-6 text-gold-400 drop-shadow-lg" />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="secondary" onClick={() => setShowEditModal(false)} className="flex-1 sm:flex-none">
              Annuler
            </Button>
            <Button
              variant="arcane"
              onClick={handleUpdateDeck}
              disabled={!editName.trim() || updateDeckMutation.isPending}
              className="flex-1 sm:flex-none"
            >
              {updateDeckMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cover Image Selection Modal */}
      <Dialog open={showCoverModal} onOpenChange={setShowCoverModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-gold-500" />
              Choisir la couverture
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 sm:py-4 flex-1 overflow-hidden flex flex-col">
            {/* Current cover preview */}
            {deck.coverImage && (
              <div className="flex items-center gap-3 sm:gap-4 p-2 sm:p-3 mb-3 sm:mb-4 rounded-lg bg-dungeon-800 border border-gold-500/30 flex-shrink-0">
                <div className="relative w-14 h-20 sm:w-20 sm:h-28 rounded overflow-hidden flex-shrink-0">
                  <Image
                    src={deck.coverImage}
                    alt="Couverture actuelle"
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gold-400 font-medium text-sm sm:text-base">Couverture actuelle</p>
                  <p className="text-xs sm:text-sm text-parchment-500 hidden sm:block">Sélectionner une carte ci-dessous</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateCoverMutation.mutate(null)}
                  disabled={updateCoverMutation.isPending}
                  className="text-dragon-400 border-dragon-500/50 hover:bg-dragon-500/20 flex-shrink-0"
                >
                  <X className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Retirer</span>
                </Button>
              </div>
            )}

            {/* Card grid - scrollable */}
            <div className="flex-1 overflow-y-auto rounded-lg border border-dungeon-600 bg-dungeon-800/50 p-2 sm:p-3">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                {Array.from(
                  new Map(
                    deck.cards
                      .filter(dc => dc.card.imageArtCrop)
                      .map(dc => [dc.card.imageArtCrop, dc])
                  ).values()
                ).map((dc) => {
                  const imageUrl = dc.card.imageArtCrop!
                  const isSelected = deck.coverImage === imageUrl
                  return (
                    <button
                      key={dc.id}
                      type="button"
                      onClick={() => updateCoverMutation.mutate(imageUrl)}
                      disabled={updateCoverMutation.isPending}
                      className={cn(
                        "relative aspect-[3/4] rounded-lg overflow-hidden transition-all",
                        isSelected 
                          ? "ring-2 ring-gold-500 ring-offset-2 ring-offset-dungeon-800" 
                          : "hover:ring-2 hover:ring-arcane-500/50 active:ring-2 active:ring-gold-500",
                        updateCoverMutation.isPending && "opacity-50"
                      )}
                      title={dc.card.name}
                    >
                      <Image
                        src={imageUrl}
                        alt={dc.card.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100px, 120px"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-gold-500/30 flex items-center justify-center">
                          <Check className="w-6 h-6 sm:w-8 sm:h-8 text-gold-400 drop-shadow-lg" />
                        </div>
                      )}
                      {/* Card name - always visible on mobile for touch feedback */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-dungeon-900 to-transparent p-1.5 sm:p-2 sm:opacity-0 sm:hover:opacity-100 transition-opacity">
                        <p className="text-[10px] sm:text-xs text-parchment-200 truncate">{dc.card.name}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button variant="secondary" onClick={() => setShowCoverModal(false)} className="w-full sm:w-auto">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Deck Modal */}
      <Dialog open={showDuplicateModal} onOpenChange={setShowDuplicateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5 text-arcane-500" />
              Dupliquer le deck
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-parchment-400">
              Une copie du deck sera créée en <span className="text-arcane-400 font-medium">mode construction</span>.
            </p>
            <div className="space-y-2">
              <Label htmlFor="duplicate-name" className="font-medieval">Nom du nouveau deck</Label>
              <Input
                id="duplicate-name"
                placeholder="Nom du deck..."
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                autoFocus
                className="text-base"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && duplicateName.trim()) {
                    handleDuplicate()
                  }
                }}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="secondary" onClick={() => setShowDuplicateModal(false)} className="flex-1 sm:flex-none">
              Annuler
            </Button>
            <Button
              variant="arcane"
              onClick={handleDuplicate}
              disabled={!duplicateName.trim() || duplicateDeckMutation.isPending}
              className="flex-1 sm:flex-none"
            >
              {duplicateDeckMutation.isPending ? 'Duplication...' : 'Dupliquer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
