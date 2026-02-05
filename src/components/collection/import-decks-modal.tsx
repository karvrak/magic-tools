'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Package,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface DeckImportStatus {
  id: string
  name: string
  format: string | null
  owner: { id: string; name: string; color: string } | null
  updatedAt: string
  previewImage: string | null
  stats: {
    totalCards: number
    cardsInCollection: number
    missingCards: number
    newCardsToImport: number
    isFullyImported: boolean
    isPartiallyImported: boolean
    uniqueCards: number
  }
}

interface ImportDecksResponse {
  decks: DeckImportStatus[]
  summary: {
    totalDecks: number
    fullyImported: number
    partiallyImported: number
    notImported: number
  }
}

interface ImportDecksModalProps {
  isOpen: boolean
  onClose: () => void
  ownerId?: string
}

export function ImportDecksModal({ isOpen, onClose, ownerId }: ImportDecksModalProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [selectedDecks, setSelectedDecks] = useState<Set<string>>(new Set())
  const [onlyMissing, setOnlyMissing] = useState(true)

  // Fetch decks with import status
  const { data, isLoading } = useQuery<ImportDecksResponse>({
    queryKey: ['decks-import-status', ownerId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (ownerId) params.set('ownerId', ownerId)
      const response = await fetch(`/api/collection/import-decks?${params}`)
      if (!response.ok) throw new Error('Failed to fetch decks')
      return response.json()
    },
    enabled: isOpen,
  })

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (deckIds: string[]) => {
      const response = await fetch('/api/collection/import-decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckIds, onlyMissing }),
      })
      if (!response.ok) throw new Error('Import failed')
      return response.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['collection'] })
      queryClient.invalidateQueries({ queryKey: ['decks-import-status'] })
      toast({
        title: 'Import complete',
        description: `${result.created} cards added, ${result.updated} updated, ${result.skipped} skipped`,
      })
      setSelectedDecks(new Set())
      onClose()
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Import failed',
        variant: 'destructive',
      })
    },
  })

  const toggleDeck = (deckId: string) => {
    const newSelected = new Set(selectedDecks)
    if (newSelected.has(deckId)) {
      newSelected.delete(deckId)
    } else {
      newSelected.add(deckId)
    }
    setSelectedDecks(newSelected)
  }

  const selectAllNotImported = () => {
    if (!data) return
    const notImported = data.decks
      .filter((d) => !d.stats.isFullyImported)
      .map((d) => d.id)
    setSelectedDecks(new Set(notImported))
  }

  const clearSelection = () => {
    setSelectedDecks(new Set())
  }

  const handleImport = () => {
    if (selectedDecks.size === 0) return
    importMutation.mutate(Array.from(selectedDecks))
  }

  // Calculate total cards to import
  const cardsToImport =
    data?.decks
      .filter((d) => selectedDecks.has(d.id))
      .reduce((sum, d) => sum + (onlyMissing ? d.stats.newCardsToImport : d.stats.totalCards), 0) || 0

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative z-10 w-full max-w-2xl max-h-[80vh] bg-dungeon-900 border border-dungeon-600 rounded-lg shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-dungeon-700">
            <div className="flex items-center gap-3">
              <Upload className="w-5 h-5 text-arcane-500" />
              <h2 className="font-display text-lg text-gold-400">Import decks</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-dungeon-700 text-parchment-400 hover:text-parchment-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-arcane-500" />
              </div>
            ) : data?.decks.length === 0 ? (
              <div className="text-center py-12 text-parchment-400">
                No decks found
              </div>
            ) : (
              <>
                {/* Summary */}
                {data?.summary && (
                  <div className="mb-4 p-3 bg-dungeon-800 rounded-lg flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      <span className="text-parchment-400">
                        <span className="text-gold-400 font-semibold">{data.summary.totalDecks}</span> decks
                      </span>
                      <span className="text-emerald-400">
                        {data.summary.fullyImported} imported
                      </span>
                      <span className="text-yellow-400">
                        {data.summary.partiallyImported} partial
                      </span>
                      <span className="text-red-400">
                        {data.summary.notImported} not imported
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectAllNotImported}
                        className="h-7 text-xs"
                      >
                        Select not imported
                      </Button>
                      {selectedDecks.size > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearSelection}
                          className="h-7 text-xs text-dragon-400"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Deck list */}
                <div className="space-y-2">
                  {data?.decks.map((deck) => {
                    const isSelected = selectedDecks.has(deck.id)
                    const { stats } = deck

                    return (
                      <motion.button
                        key={deck.id}
                        onClick={() => toggleDeck(deck.id)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className={cn(
                          'w-full p-3 rounded-lg border transition-all text-left flex items-center gap-3',
                          isSelected
                            ? 'border-arcane-500 bg-arcane-500/10'
                            : stats.isFullyImported
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : stats.isPartiallyImported
                            ? 'border-yellow-500/30 bg-yellow-500/5'
                            : 'border-dungeon-600 bg-dungeon-800/50 hover:border-dungeon-500'
                        )}
                      >
                        {/* Preview image */}
                        <div className="relative w-12 h-16 rounded overflow-hidden bg-dungeon-700 flex-shrink-0">
                          {deck.previewImage ? (
                            <Image
                              src={deck.previewImage}
                              alt={deck.name}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-5 h-5 text-dungeon-500" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-parchment-200 truncate">
                              {deck.name}
                            </span>
                            {deck.format && (
                              <span className="text-xs text-parchment-500 capitalize">
                                {deck.format}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs">
                            {deck.owner && (
                              <span
                                className="flex items-center gap-1"
                                style={{ color: deck.owner.color }}
                              >
                                <User className="w-3 h-3" />
                                {deck.owner.name}
                              </span>
                            )}
                            <span className="text-parchment-500">
                              {stats.uniqueCards} unique cards
                            </span>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="text-right flex-shrink-0">
                          {stats.isFullyImported ? (
                            <div className="flex items-center gap-1.5 text-emerald-400">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="text-sm">Imported</span>
                            </div>
                          ) : stats.isPartiallyImported ? (
                            <div>
                              <div className="flex items-center gap-1.5 text-yellow-400">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-sm">Partial</span>
                              </div>
                              <span className="text-xs text-parchment-500">
                                +{stats.newCardsToImport} to import
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-sm text-red-400">Not imported</span>
                              <span className="text-xs text-parchment-500 block">
                                {stats.totalCards} cards
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Selection indicator */}
                        <div
                          className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                            isSelected
                              ? 'bg-arcane-500 border-arcane-500'
                              : 'border-dungeon-500'
                          )}
                        >
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-dungeon-700 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-parchment-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyMissing}
                  onChange={(e) => setOnlyMissing(e.target.checked)}
                  className="rounded border-dungeon-500"
                />
                Only missing cards
              </label>
              {selectedDecks.size > 0 && (
                <span className="text-sm text-parchment-400">
                  {selectedDecks.size} deck{selectedDecks.size > 1 ? 's' : ''} selected ({cardsToImport} cards)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedDecks.size === 0 || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Import...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
