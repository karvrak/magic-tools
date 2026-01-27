'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useCamera } from '@/hooks/scanner'
import { useActiveOwner } from '@/contexts/active-owner'
import { ScannedCard, CardMatch, ScannerCard } from '@/types/scanner'
import { CameraView } from './CameraView'
import { cn } from '@/lib/utils'
import {
  Camera,
  ScanLine,
  Loader2,
  Check,
  Plus,
  Search,
  X,
  Square,
  Trash2,
  Minus,
} from 'lucide-react'
import Image from 'next/image'

interface CardScannerModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

// Beep sound for successful scan
const playBeep = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    gainNode.gain.value = 0.3
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.1)
  } catch (e) {
    // Audio not available
  }
}

export function CardScannerModal({ open, onClose, onSuccess }: CardScannerModalProps) {
  const { toast } = useToast()
  const { activeOwner } = useActiveOwner()

  // Main state: scanning or reviewing
  const [mode, setMode] = useState<'scanning' | 'reviewing' | 'submitting'>('scanning')
  const [scannedCards, setScannedCards] = useState<ScannedCard[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  // Scan state
  const [scanStatus, setScanStatus] = useState<string>('')
  const [lastScannedText, setLastScannedText] = useState<string>('')
  const autoScanIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastAddedCardRef = useRef<string>('')

  // Review mode: search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ScannerCard[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const {
    videoRef,
    canvasRef,
    isReady: cameraReady,
    error: cameraError,
    startCamera,
    stopCamera,
    captureFrame,
  } = useCamera()

  // Start camera when modal opens
  useEffect(() => {
    if (open && mode === 'scanning') {
      startCamera()
    }
    return () => {
      if (!open) {
        stopCamera()
      }
    }
  }, [open, mode, startCamera, stopCamera])

  // Auto-scan every 3 seconds
  useEffect(() => {
    if (!open || mode !== 'scanning' || !cameraReady || isProcessing) {
      if (autoScanIntervalRef.current) {
        clearInterval(autoScanIntervalRef.current)
        autoScanIntervalRef.current = null
      }
      return
    }

    const performAutoScan = async () => {
      if (isProcessing) return

      setIsProcessing(true)
      setScanStatus('Analyse Grok...')

      try {
        const imageData = captureFrame()
        if (!imageData) {
          setScanStatus('Erreur capture')
          setIsProcessing(false)
          return
        }

        // Use Grok Vision API
        const ocrResponse = await fetch('/api/scanner/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageData }),
        })

        if (!ocrResponse.ok) {
          setScanStatus('Erreur API')
          setIsProcessing(false)
          return
        }

        const ocrData = await ocrResponse.json()
        const extractedText = ocrData.cardName

        if (!extractedText || extractedText.length < 3) {
          setScanStatus('Aucune carte détectée')
          setIsProcessing(false)
          return
        }

        // Skip if same text as last scan
        if (extractedText === lastScannedText) {
          setScanStatus('En attente nouvelle carte...')
          setIsProcessing(false)
          return
        }

        setLastScannedText(extractedText)
        setScanStatus(`Recherche: ${extractedText}...`)

        // Match to database
        const response = await fetch('/api/scanner/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: [extractedText] }),
        })

        if (!response.ok) {
          setScanStatus('Erreur recherche')
          setIsProcessing(false)
          return
        }

        const data = await response.json()
        const matches: CardMatch[] = data.matches[0]?.results || []

        if (matches.length === 0 || matches[0].score < 0.6) {
          setScanStatus(`"${extractedText}" - Non trouvé`)
          setIsProcessing(false)
          return
        }

        const bestMatch = matches[0]

        // Skip if same card as last added
        if (bestMatch.card.id === lastAddedCardRef.current) {
          setScanStatus('En attente nouvelle carte...')
          setIsProcessing(false)
          return
        }

        // Check if card already in list - increment quantity
        const existingIndex = scannedCards.findIndex(c => c.cardId === bestMatch.card.id)
        if (existingIndex >= 0) {
          setScannedCards(prev =>
            prev.map((c, i) =>
              i === existingIndex ? { ...c, quantity: c.quantity + 1 } : c
            )
          )
          setScanStatus(`✓ ${bestMatch.card.printedName || bestMatch.card.name} (+1)`)
          playBeep()
          lastAddedCardRef.current = bestMatch.card.id
          setIsProcessing(false)
          return
        }

        // Add new card
        const scannedCard: ScannedCard = {
          id: uuidv4(),
          cardId: bestMatch.card.id,
          card: bestMatch.card,
          extractedText,
          confidence: bestMatch.score,
          quantity: 1,
          status: 'matched',
          candidates: matches.length > 1 ? matches : undefined,
        }

        setScannedCards(prev => [...prev, scannedCard])
        lastAddedCardRef.current = bestMatch.card.id
        setScanStatus(`✓ ${bestMatch.card.printedName || bestMatch.card.name}`)
        playBeep()

      } catch (err) {
        console.error('Auto-scan error:', err)
        setScanStatus('Erreur')
      } finally {
        setIsProcessing(false)
      }
    }

    // Initial scan
    const initialTimeout = setTimeout(performAutoScan, 500)

    // Then scan every 3 seconds
    autoScanIntervalRef.current = setInterval(performAutoScan, 3000)

    return () => {
      clearTimeout(initialTimeout)
      if (autoScanIntervalRef.current) {
        clearInterval(autoScanIntervalRef.current)
        autoScanIntervalRef.current = null
      }
    }
  }, [open, mode, cameraReady, isProcessing, captureFrame, lastScannedText, scannedCards])

  // Search for cards (in review mode)
  useEffect(() => {
    if (mode !== 'reviewing') return

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await fetch(`/api/search?name=${encodeURIComponent(searchQuery)}&limit=8`)
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.cards || [])
        }
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, mode])

  // Stop scanning and go to review
  const handleStop = useCallback(() => {
    stopCamera()
    setMode('reviewing')
  }, [stopCamera])

  // Add card from search
  const handleAddFromSearch = useCallback((card: ScannerCard) => {
    // Check if already in list
    const existingIndex = scannedCards.findIndex(c => c.cardId === card.id)
    if (existingIndex >= 0) {
      setScannedCards(prev =>
        prev.map((c, i) =>
          i === existingIndex ? { ...c, quantity: c.quantity + 1 } : c
        )
      )
    } else {
      const scannedCard: ScannedCard = {
        id: uuidv4(),
        cardId: card.id,
        card: card,
        extractedText: card.printedName || card.name,
        confidence: 1,
        quantity: 1,
        status: 'matched',
      }
      setScannedCards(prev => [...prev, scannedCard])
    }
    setSearchQuery('')
    setSearchResults([])
    toast({
      title: 'Carte ajoutée',
      description: card.printedName || card.name,
    })
  }, [scannedCards, toast])

  // Update quantity
  const handleQuantityChange = useCallback((id: string, delta: number) => {
    setScannedCards(prev =>
      prev.map(card =>
        card.id === id ? { ...card, quantity: Math.max(1, card.quantity + delta) } : card
      )
    )
  }, [])

  // Remove card
  const handleRemoveCard = useCallback((id: string) => {
    setScannedCards(prev => prev.filter(card => card.id !== id))
  }, [])

  // Go back to scanning
  const handleBackToScanning = useCallback(() => {
    setMode('scanning')
    setSearchQuery('')
    setSearchResults([])
    setLastScannedText('')
    lastAddedCardRef.current = ''
    startCamera()
  }, [startCamera])

  // Add all to collection
  const handleAddToCollection = useCallback(async () => {
    if (scannedCards.length === 0) {
      toast({
        title: 'Aucune carte',
        description: 'Ajoutez des cartes avant de valider.',
        variant: 'destructive',
      })
      return
    }

    setMode('submitting')

    try {
      const response = await fetch('/api/collection/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: scannedCards.map(card => ({
            cardId: card.cardId,
            quantity: card.quantity,
            condition: 'nm',
            isFoil: false,
            ownerId: activeOwner?.id || null,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add cards')
      }

      const result = await response.json()

      toast({
        title: 'Cartes ajoutées',
        description: `${result.added} nouvelles, ${result.updated} mises à jour`,
      })

      onSuccess?.()
      onClose()
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'ajouter les cartes',
        variant: 'destructive',
      })
      setMode('reviewing')
    }
  }, [scannedCards, activeOwner, onSuccess, onClose, toast])

  // Reset on close
  const handleClose = useCallback(() => {
    stopCamera()
    setMode('scanning')
    setScannedCards([])
    setSearchQuery('')
    setSearchResults([])
    setScanStatus('')
    setLastScannedText('')
    lastAddedCardRef.current = ''
    onClose()
  }, [stopCamera, onClose])

  const totalQuantity = scannedCards.reduce((sum, c) => sum + c.quantity, 0)

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b border-dungeon-700">
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-arcane-400" />
            {mode === 'scanning' ? 'Scanner des cartes' :
             mode === 'reviewing' ? 'Vérifier les cartes' : 'Ajout en cours...'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* SCANNING MODE */}
          {mode === 'scanning' && (
            <div className="flex-1 flex flex-col">
              {/* Camera View */}
              <CameraView
                videoRef={videoRef}
                canvasRef={canvasRef}
                isReady={cameraReady}
                isProcessing={isProcessing}
                ocrProgress={0}
                error={cameraError}
              />

              {/* Status bar */}
              <div className="p-3 border-t border-dungeon-700 bg-dungeon-800/50">
                <div className="flex items-center gap-2 mb-2">
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin text-arcane-400" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                  <span className="text-sm text-parchment-300 flex-1 truncate">
                    {!cameraReady ? 'Démarrage caméra...' : scanStatus || 'Scan actif...'}
                  </span>
                  <span className="text-gold-400 font-medium text-sm">
                    {scannedCards.length} carte{scannedCards.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Stop button */}
              <div className="p-4 border-t border-dungeon-700">
                <Button
                  onClick={handleStop}
                  className="w-full h-14 text-lg bg-dragon-600 hover:bg-dragon-500 text-white"
                >
                  <Square className="w-5 h-5 mr-2 fill-current" />
                  Arrêter le scan
                  {scannedCards.length > 0 && ` (${scannedCards.length})`}
                </Button>
              </div>
            </div>
          )}

          {/* REVIEW MODE */}
          {mode === 'reviewing' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search to add more */}
              <div className="p-3 border-b border-dungeon-700">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-parchment-500" />
                  <Input
                    type="text"
                    placeholder="Ajouter une carte..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 bg-dungeon-800 border-dungeon-600"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('')
                        setSearchResults([])
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-parchment-500 hover:text-parchment-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Search results dropdown */}
                {(isSearching || searchResults.length > 0) && (
                  <div className="mt-2 max-h-40 overflow-y-auto bg-dungeon-900 rounded-lg border border-dungeon-700">
                    {isSearching ? (
                      <div className="p-3 text-center">
                        <Loader2 className="w-5 h-5 animate-spin text-arcane-400 mx-auto" />
                      </div>
                    ) : (
                      searchResults.map(card => (
                        <button
                          key={card.id}
                          onClick={() => handleAddFromSearch(card)}
                          className="w-full flex items-center gap-2 p-2 hover:bg-dungeon-700 text-left"
                        >
                          {card.imageSmall && (
                            <Image
                              src={card.imageSmall}
                              alt={card.name}
                              width={30}
                              height={42}
                              className="rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-parchment-200 truncate">
                              {card.printedName || card.name}
                            </p>
                            <p className="text-xs text-parchment-500 truncate">
                              {card.setName}
                            </p>
                          </div>
                          <Plus className="w-4 h-4 text-arcane-400" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Cards list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {scannedCards.length === 0 ? (
                  <div className="text-center py-8 text-parchment-500">
                    <p>Aucune carte scannée</p>
                    <p className="text-sm mt-1">Utilisez la recherche pour ajouter des cartes</p>
                  </div>
                ) : (
                  scannedCards.map(card => (
                    <div
                      key={card.id}
                      className="flex items-center gap-3 p-2 bg-dungeon-800/50 rounded-lg"
                    >
                      {card.card?.imageSmall && (
                        <Image
                          src={card.card.imageSmall}
                          alt={card.card.name}
                          width={40}
                          height={56}
                          className="rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-parchment-200 truncate">
                          {card.card?.printedName || card.card?.name}
                        </p>
                        <p className="text-xs text-parchment-500">
                          {card.card?.setName}
                        </p>
                      </div>

                      {/* Quantity controls */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleQuantityChange(card.id, -1)}
                          className="w-7 h-7 flex items-center justify-center rounded bg-dungeon-700 hover:bg-dungeon-600 text-parchment-400"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium text-parchment-200">
                          {card.quantity}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(card.id, 1)}
                          className="w-7 h-7 flex items-center justify-center rounded bg-dungeon-700 hover:bg-dungeon-600 text-parchment-400"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => handleRemoveCard(card.id)}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-dragon-900/50 text-dragon-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Summary & Actions */}
              <div className="border-t border-dungeon-700">
                {scannedCards.length > 0 && (
                  <div className="p-3 bg-dungeon-800/50 flex justify-between text-sm">
                    <span className="text-parchment-400">Total:</span>
                    <span className="text-gold-400 font-medium">
                      {scannedCards.length} carte{scannedCards.length !== 1 ? 's' : ''} ({totalQuantity} exemplaire{totalQuantity !== 1 ? 's' : ''})
                    </span>
                  </div>
                )}

                <div className="p-3 space-y-2">
                  <Button
                    onClick={handleAddToCollection}
                    disabled={scannedCards.length === 0}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <Check className="w-5 h-5 mr-2" />
                    Valider et ajouter à la collection
                  </Button>

                  <Button
                    onClick={handleBackToScanning}
                    variant="outline"
                    className="w-full"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Scanner plus de cartes
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* SUBMITTING MODE */}
          {mode === 'submitting' && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-arcane-400 mx-auto mb-4" />
                <p className="text-parchment-300">Ajout des cartes en cours...</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
