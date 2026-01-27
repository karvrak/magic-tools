'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { CARD_CATEGORIES, FORMATS } from '@/types/search'
import { Plus, Layers, Hammer, Sparkles } from 'lucide-react'

type DeckStatus = 'building' | 'active' | 'locked'

interface Deck {
  id: string
  name: string
  format: string | null
  status: DeckStatus
  cardCount: number
}

interface AddToDeckModalProps {
  open: boolean
  onClose: () => void
  cardId: string
  cardName: string
  onSuccess?: () => void
}

export function AddToDeckModal({ open, onClose, cardId, cardName, onSuccess }: AddToDeckModalProps) {
  const [selectedDeckId, setSelectedDeckId] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [category, setCategory] = useState('mainboard')
  const [showCreateDeck, setShowCreateDeck] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [newDeckFormat, setNewDeckFormat] = useState('')
  
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Fetch existing decks
  const { data: decksData, isLoading: decksLoading } = useQuery<{ decks: Deck[] }>({
    queryKey: ['decks'],
    queryFn: async () => {
      const response = await fetch('/api/decks')
      if (!response.ok) throw new Error('Failed to fetch decks')
      return response.json()
    },
    enabled: open,
  })

  // Create deck mutation
  const createDeckMutation = useMutation({
    mutationFn: async (data: { name: string; format: string }) => {
      const response = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to create deck')
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['decks'] })
      setSelectedDeckId(data.deck.id)
      setShowCreateDeck(false)
      setNewDeckName('')
      setNewDeckFormat('')
      toast({
        title: 'Deck Created',
        description: `"${data.deck.name}" has been created.`,
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create deck.',
        variant: 'destructive',
      })
    },
  })

  // Add card to deck mutation
  const addCardMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/decks/${selectedDeckId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, quantity, category }),
      })
      if (!response.ok) throw new Error('Failed to add card to deck')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deck', selectedDeckId] })
      toast({
        title: 'Card Added',
        description: `${quantity}x ${cardName} added to deck.`,
      })
      handleClose()
      // Call the onSuccess callback to close parent modal
      onSuccess?.()
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to add card to deck.',
        variant: 'destructive',
      })
    },
  })

  const handleClose = () => {
    setSelectedDeckId('')
    setQuantity(1)
    setCategory('mainboard')
    setShowCreateDeck(false)
    setNewDeckName('')
    setNewDeckFormat('')
    onClose()
  }

  const handleCreateDeck = () => {
    if (!newDeckName.trim()) return
    createDeckMutation.mutate({
      name: newDeckName.trim(),
      format: newDeckFormat,
    })
  }

  const handleAddToDeck = () => {
    if (!selectedDeckId) return
    addCardMutation.mutate()
  }

  // Filter out locked decks and sort: building first, then active
  const decks = (decksData?.decks || [])
    .filter((deck) => deck.status !== 'locked')
    .sort((a, b) => {
      // Building decks first
      if (a.status === 'building' && b.status !== 'building') return -1
      if (a.status !== 'building' && b.status === 'building') return 1
      return 0
    })

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-gold-400" />
            Add to Deck
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Card name display */}
          <div className="p-3 rounded bg-dungeon-800/50 border border-dungeon-700">
            <p className="text-sm text-parchment-400">Adding card:</p>
            <p className="text-parchment-200 font-medium">{cardName}</p>
          </div>

          {/* Deck selection or creation */}
          {!showCreateDeck ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="deck">Select Deck</Label>
                {decksLoading ? (
                  <div className="h-10 skeleton rounded" />
                ) : decks.length === 0 ? (
                  <div className="text-center py-4">
                    <Layers className="w-8 h-8 mx-auto text-dungeon-500 mb-2" />
                    <p className="text-sm text-parchment-400">No decks yet</p>
                  </div>
                ) : (
                  <Select value={selectedDeckId} onValueChange={setSelectedDeckId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a deck..." />
                    </SelectTrigger>
                    <SelectContent>
                      {decks.map((deck) => (
                        <SelectItem key={deck.id} value={deck.id}>
                          <span className="flex items-center gap-2">
                            {/* Status icon */}
                            {deck.status === 'building' ? (
                              <Hammer className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                            <span>{deck.name}</span>
                            {deck.format && (
                              <span className="text-xs text-parchment-400 capitalize">
                                ({deck.format})
                              </span>
                            )}
                            <span className="text-xs text-dungeon-400">
                              {deck.cardCount} cards
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => setShowCreateDeck(true)}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Deck
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="newDeckName">New Deck Name</Label>
                <Input
                  id="newDeckName"
                  placeholder="Enter deck name..."
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newDeckFormat">Format (optional)</Label>
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

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowCreateDeck(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateDeck}
                  disabled={!newDeckName.trim() || createDeckMutation.isPending}
                  className="flex-1"
                >
                  {createDeckMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </>
          )}

          {/* Quantity and category (only show when not creating deck) */}
          {!showCreateDeck && selectedDeckId && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    max={99}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CARD_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.code} value={cat.code}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>

        {!showCreateDeck && (
          <DialogFooter>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleAddToDeck}
              disabled={!selectedDeckId || addCardMutation.isPending}
            >
              {addCardMutation.isPending ? 'Adding...' : 'Add to Deck'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
