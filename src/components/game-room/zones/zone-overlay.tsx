'use client'

import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Library,
  Trash2,
  EyeOff,
  Hand,
  Play,
  Eye,
  Search,
  Check,
  ChevronUp,
  ChevronDown,
  ArrowUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CardWithPrice } from '@/types/scryfall'
import { GamePlayer, ZoneCardInfo } from '@/lib/game-room/types'
import { WithHoverPreview } from '@/components/card/card-hover-preview'

interface ZoneOverlayProps {
  // Library peek
  showLibrary: boolean
  library: CardWithPrice[]
  onCloseLibrary: () => void

  // Graveyard viewer
  showGraveyard: boolean
  graveyard: CardWithPrice[]
  onCloseGraveyard: () => void
  onGraveyardToHand: (index: number) => void
  onGraveyardToBattlefield: (index: number) => void
  onGraveyardToLibraryTop: (index: number) => void

  // Exile viewer
  showExile: boolean
  exile: CardWithPrice[]
  onCloseExile: () => void
  onExileToHand: (index: number) => void
  onExileToBattlefield: (index: number) => void

  // Scry overlay
  showScry: boolean
  scryCards: { card: CardWithPrice; originalIndex: number }[]
  scryCount: number
  onScryPutTop: (index: number) => void
  onScryPutBottom: (index: number) => void
  onCloseScry: () => void
  onCancelScry: (remainingCards: { card: CardWithPrice; originalIndex: number }[]) => void

  // Deck search
  showDeckSearch: boolean
  deckSearchQuery: string
  deckSearchSelected: Set<number>
  onDeckSearchQueryChange: (query: string) => void
  onToggleDeckSearchSelection: (index: number) => void
  onDeckSearchToTop: () => void
  onDeckSearchToHand: () => void
  onCloseDeckSearch: () => void

  // Opponent graveyard
  viewingOpponentGraveyard: string | null
  opponents: GamePlayer[]
  onCloseOpponentGraveyard: () => void

  // Opponent exile
  viewingOpponentExile: string | null
  onCloseOpponentExile: () => void

  // Generic counter popup
  genericCounterPopup: { uniqueId: string } | null
  genericCounterLabel: string
  genericCounterInputRef: React.RefObject<HTMLInputElement | null>
  onGenericCounterLabelChange: (label: string) => void
  onConfirmGenericCounter: () => void
  onCloseGenericCounterPopup: () => void

  fullDeckLength: number
}

export function ZoneOverlay({
  showLibrary,
  library,
  onCloseLibrary,
  showGraveyard,
  graveyard,
  onCloseGraveyard,
  onGraveyardToHand,
  onGraveyardToBattlefield,
  onGraveyardToLibraryTop,
  showExile,
  exile,
  onCloseExile,
  onExileToHand,
  onExileToBattlefield,
  showScry,
  scryCards,
  scryCount,
  onScryPutTop,
  onScryPutBottom,
  onCloseScry,
  onCancelScry,
  showDeckSearch,
  deckSearchQuery,
  deckSearchSelected,
  onDeckSearchQueryChange,
  onToggleDeckSearchSelection,
  onDeckSearchToTop,
  onDeckSearchToHand,
  onCloseDeckSearch,
  viewingOpponentGraveyard,
  opponents,
  onCloseOpponentGraveyard,
  viewingOpponentExile,
  onCloseOpponentExile,
  genericCounterPopup,
  genericCounterLabel,
  genericCounterInputRef,
  onGenericCounterLabelChange,
  onConfirmGenericCounter,
  onCloseGenericCounterPopup,
  fullDeckLength,
}: ZoneOverlayProps) {
  return (
    <>
      {/* Library peek */}
      {showLibrary && fullDeckLength > 0 && (
        <div className="card-frame p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gold-400 flex items-center gap-2">
              <Library className="w-4 h-4" />
              Library ({library.length}) - Top 20
            </h3>
            <button onClick={onCloseLibrary} className="text-parchment-400 hover:text-parchment-200">
              <EyeOff className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto">
            {library.slice(0, 20).map((card, index) => (
              <WithHoverPreview key={`lib-${index}`} card={{ name: card?.printedName || card?.name || '', image: card?.imageNormal || null, type: card?.typeLine }}>
                <div className="relative w-[60px] h-[84px] rounded-lg overflow-hidden opacity-60 hover:opacity-100 transition-opacity border border-dungeon-600 hover:border-arcane-500/50 cursor-pointer shadow-sm">
                  {card?.imageNormal ? (
                    <Image src={card.imageNormal} alt={card.name || ''} fill className="object-cover" sizes="60px" />
                  ) : (
                    <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-1">
                      <span className="text-[7px] text-parchment-400 text-center">{card?.name || ''}</span>
                    </div>
                  )}
                  <div className="absolute top-0 left-0 px-1.5 py-0.5 bg-dungeon-900/90 text-[9px] text-parchment-400 font-medium rounded-br">{index + 1}</div>
                </div>
              </WithHoverPreview>
            ))}
          </div>
        </div>
      )}

      {/* Graveyard viewer */}
      {showGraveyard && graveyard.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dungeon-950/70 backdrop-blur-sm">
          <div className="max-w-2xl w-full mx-4 space-y-4">
            <div className="text-center">
              <h2 className="font-medieval text-2xl text-gold-400 flex items-center justify-center gap-2 mb-1">
                <Trash2 className="w-5 h-5" />
                Graveyard ({graveyard.length})
              </h2>
            </div>
            <div className="flex flex-wrap gap-3 justify-center max-h-[60vh] overflow-y-auto p-2">
              {graveyard.map((card, index) => (
                <div key={`gy-${index}`} className="relative group">
                  <WithHoverPreview card={{ name: card?.printedName || card?.name || '', image: card?.imageNormal || null, type: card?.typeLine }}>
                    <div className="w-[100px] h-[140px] rounded-lg overflow-hidden opacity-80 group-hover:opacity-100 relative border border-dungeon-600 hover:border-gold-500/50 shadow-md hover:shadow-lg transition-all cursor-pointer">
                      {card?.imageNormal ? (
                        <Image src={card.imageNormal} alt={card.name || ''} fill className="object-cover" sizes="100px" />
                      ) : (
                        <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-2">
                          <span className="text-xs text-parchment-400 text-center">{card?.name || ''}</span>
                        </div>
                      )}
                    </div>
                  </WithHoverPreview>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                    <button onClick={() => onGraveyardToHand(index)} className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-md" title="Return to hand">
                      <Hand className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onGraveyardToBattlefield(index)} className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-md" title="Put onto battlefield">
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onGraveyardToLibraryTop(index)} className="p-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded shadow-md" title="Put on top of library">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center">
              <Button onClick={onCloseGraveyard} variant="outline" size="lg">
                <Eye className="w-5 h-5 mr-2" />
                Voir le champ de bataille
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Scry overlay */}
      {showScry && scryCards.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dungeon-950/70 backdrop-blur-sm">
          <div className="max-w-2xl w-full mx-4 space-y-4">
            <div className="text-center">
              <h2 className="font-medieval text-2xl text-gold-400 flex items-center justify-center gap-2 mb-1">
                <Eye className="w-5 h-5" />
                Scry {scryCount} — Top of library
              </h2>
              <p className="text-parchment-400 text-sm">
                {scryCards.length > 1 ? `Choose where to put each card (${scryCards.length} remaining)` : 'Choose where to put this card'}
              </p>
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              <AnimatePresence mode="popLayout">
                {scryCards.map((entry, index) => (
                  <motion.div
                    key={`scry-${entry.originalIndex}`}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <WithHoverPreview card={{ name: entry.card?.printedName || entry.card?.name || '', image: entry.card?.imageNormal || null, type: entry.card?.typeLine }}>
                      <div className="w-[140px] h-[196px] rounded-lg overflow-hidden relative border-2 border-gold-500/40 shadow-lg">
                        {entry.card?.imageNormal ? (
                          <Image src={entry.card.imageNormal} alt={entry.card.name || ''} fill className="object-cover" sizes="140px" />
                        ) : (
                          <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-2">
                            <span className="text-sm text-parchment-400 text-center">{entry.card?.name || ''}</span>
                          </div>
                        )}
                      </div>
                    </WithHoverPreview>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => onScryPutTop(index)}>
                        <ChevronUp className="w-4 h-4 mr-1" />
                        Top
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onScryPutBottom(index)}>
                        <ChevronDown className="w-4 h-4 mr-1" />
                        Bottom
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="text-center">
              <Button onClick={() => onCancelScry(scryCards)} variant="outline" size="lg">
                <Eye className="w-5 h-5 mr-2" />
                Voir le champ de bataille
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Exile zone viewer */}
      {showExile && exile.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dungeon-950/70 backdrop-blur-sm">
          <div className="max-w-2xl w-full mx-4 space-y-4">
            <div className="text-center">
              <h2 className="font-medieval text-2xl text-gold-400 flex items-center justify-center gap-2 mb-1">
                <EyeOff className="w-5 h-5" />
                Exile ({exile.length})
              </h2>
            </div>
            <div className="flex flex-wrap gap-3 justify-center max-h-[60vh] overflow-y-auto p-2">
              {exile.map((card, index) => (
                <div key={`exile-${index}`} className="relative group">
                  <WithHoverPreview card={{ name: card?.printedName || card?.name || '', image: card?.imageNormal || null, type: card?.typeLine }}>
                    <div className="w-[100px] h-[140px] rounded-lg overflow-hidden opacity-80 group-hover:opacity-100 relative border border-dungeon-600 hover:border-parchment-500/50 shadow-md hover:shadow-lg transition-all cursor-pointer">
                      {card?.imageNormal ? (
                        <Image src={card.imageNormal} alt={card.name || ''} fill className="object-cover" sizes="100px" />
                      ) : (
                        <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-2">
                          <span className="text-xs text-parchment-400 text-center">{card?.name || ''}</span>
                        </div>
                      )}
                    </div>
                  </WithHoverPreview>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                    <button onClick={() => onExileToHand(index)} className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-md" title="Return to hand">
                      <Hand className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onExileToBattlefield(index)} className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-md" title="Put onto battlefield">
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center">
              <Button onClick={onCloseExile} variant="outline" size="lg">
                <Eye className="w-5 h-5 mr-2" />
                Voir le champ de bataille
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Deck search (tutor) modal */}
      {showDeckSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dungeon-950/70 backdrop-blur-sm">
          <div className="max-w-3xl w-full mx-4 space-y-4">
            <div className="text-center">
              <h2 className="font-medieval text-2xl text-gold-400 flex items-center justify-center gap-2 mb-1">
                <Search className="w-5 h-5" />
                Search Library ({library.length})
              </h2>
            </div>
            {/* Search input */}
            <div className="flex justify-center">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-parchment-500" />
                <input
                  type="text"
                  value={deckSearchQuery}
                  onChange={(e) => onDeckSearchQueryChange(e.target.value)}
                  placeholder="Search by name or type..."
                  className="w-full pl-10 pr-4 py-2 bg-dungeon-800 border border-dungeon-600 rounded-lg text-parchment-200 placeholder-parchment-600 focus:outline-none focus:border-gold-500/50 text-sm"
                  autoFocus
                />
              </div>
            </div>
            {/* Selected count */}
            {deckSearchSelected.size > 0 && (
              <p className="text-center text-sm text-gold-400">
                {deckSearchSelected.size} card{deckSearchSelected.size > 1 ? 's' : ''} selected
              </p>
            )}
            {/* Cards grid */}
            <div className="flex flex-wrap gap-2 justify-center max-h-[50vh] overflow-y-auto p-2">
              {library
                .map((card, index) => ({ card, index }))
                .filter(({ card }) => {
                  if (!deckSearchQuery.trim()) return true
                  const q = deckSearchQuery.toLowerCase()
                  return (card.name || '').toLowerCase().includes(q)
                    || (card.printedName || '').toLowerCase().includes(q)
                    || (card.typeLine || '').toLowerCase().includes(q)
                })
                .map(({ card, index }) => {
                  const isSelected = deckSearchSelected.has(index)
                  return (
                    <div key={`search-${index}`} className="relative">
                      <WithHoverPreview card={{ name: card?.printedName || card?.name || '', image: card?.imageNormal || null, type: card?.typeLine }}>
                        <button
                          onClick={() => onToggleDeckSearchSelection(index)}
                          className={cn(
                            "w-[80px] h-[112px] rounded-lg overflow-hidden relative border-2 shadow-sm transition-all cursor-pointer",
                            isSelected
                              ? "border-gold-400 ring-2 ring-gold-400/30 scale-105"
                              : "border-dungeon-600 hover:border-parchment-500/50 opacity-80 hover:opacity-100"
                          )}
                        >
                          {card?.imageNormal ? (
                            <Image src={card.imageNormal} alt={card.name || ''} fill className="object-cover" sizes="80px" />
                          ) : (
                            <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-1">
                              <span className="text-[8px] text-parchment-400 text-center">{card?.name || ''}</span>
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute inset-0 bg-gold-500/20 flex items-center justify-center">
                              <Check className="w-6 h-6 text-gold-400 drop-shadow-lg" />
                            </div>
                          )}
                        </button>
                      </WithHoverPreview>
                    </div>
                  )
                })}
            </div>
            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3">
              <Button
                onClick={onDeckSearchToTop}
                disabled={deckSearchSelected.size === 0}
                size="lg"
              >
                <ChevronUp className="w-5 h-5 mr-2" />
                Top of library
              </Button>
              <Button
                onClick={onDeckSearchToHand}
                disabled={deckSearchSelected.size === 0}
                variant="outline"
                size="lg"
              >
                <Hand className="w-5 h-5 mr-2" />
                To hand
              </Button>
            </div>
            <div className="text-center">
              <Button onClick={onCloseDeckSearch} variant="outline" size="sm" className="text-parchment-500">
                <Eye className="w-4 h-4 mr-1" />
                Voir le champ de bataille
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Opponent graveyard modal */}
      {viewingOpponentGraveyard && (() => {
        const opp = opponents.find(o => o.id === viewingOpponentGraveyard)
        const oppGraveyardCards = (opp?.graveyardCards || []) as ZoneCardInfo[]
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dungeon-950/70 backdrop-blur-sm">
            <div className="max-w-2xl w-full mx-4 space-y-4">
              <div className="text-center">
                <h2 className="font-medieval text-2xl text-gold-400 flex items-center justify-center gap-2 mb-1">
                  <Trash2 className="w-5 h-5" />
                  {opp?.name} — Graveyard ({oppGraveyardCards.length})
                </h2>
              </div>
              <div className="flex flex-wrap gap-3 justify-center max-h-[60vh] overflow-y-auto p-2">
                {oppGraveyardCards.length === 0 ? (
                  <p className="text-parchment-500 italic py-8">Empty graveyard</p>
                ) : (
                  oppGraveyardCards.map((card, index) => (
                    <WithHoverPreview key={`opp-gy-${index}`} card={{ name: card.name, image: card.image, type: card.type }}>
                      <div className="w-[100px] h-[140px] rounded-lg overflow-hidden border border-dungeon-600 shadow-md cursor-pointer hover:border-gold-500/50 transition-all relative">
                        {card.image ? (
                          <Image src={card.image} alt={card.name} fill className="object-cover" sizes="100px" />
                        ) : (
                          <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-2">
                            <span className="text-xs text-parchment-400 text-center">{card.name}</span>
                          </div>
                        )}
                      </div>
                    </WithHoverPreview>
                  ))
                )}
              </div>
              <div className="text-center">
                <Button onClick={onCloseOpponentGraveyard} variant="outline" size="lg">
                  <Eye className="w-5 h-5 mr-2" />
                  Voir le champ de bataille
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Opponent exile modal */}
      {viewingOpponentExile && (() => {
        const opp = opponents.find(o => o.id === viewingOpponentExile)
        const oppExileCards = (opp?.exileCards || []) as ZoneCardInfo[]
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dungeon-950/70 backdrop-blur-sm">
            <div className="max-w-2xl w-full mx-4 space-y-4">
              <div className="text-center">
                <h2 className="font-medieval text-2xl text-gold-400 flex items-center justify-center gap-2 mb-1">
                  <EyeOff className="w-5 h-5" />
                  {opp?.name} — Exile ({oppExileCards.length})
                </h2>
              </div>
              <div className="flex flex-wrap gap-3 justify-center max-h-[60vh] overflow-y-auto p-2">
                {oppExileCards.length === 0 ? (
                  <p className="text-parchment-500 italic py-8">No exiled cards</p>
                ) : (
                  oppExileCards.map((card, index) => (
                    <WithHoverPreview key={`opp-ex-${index}`} card={{ name: card.name, image: card.image, type: card.type }}>
                      <div className="w-[100px] h-[140px] rounded-lg overflow-hidden border border-dungeon-600 shadow-md cursor-pointer hover:border-parchment-500/50 transition-all relative">
                        {card.image ? (
                          <Image src={card.image} alt={card.name} fill className="object-cover" sizes="100px" />
                        ) : (
                          <div className="w-full h-full bg-dungeon-700 flex items-center justify-center p-2">
                            <span className="text-xs text-parchment-400 text-center">{card.name}</span>
                          </div>
                        )}
                      </div>
                    </WithHoverPreview>
                  ))
                )}
              </div>
              <div className="text-center">
                <Button onClick={onCloseOpponentExile} variant="outline" size="lg">
                  <Eye className="w-5 h-5 mr-2" />
                  Voir le champ de bataille
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Generic counter name popup */}
      {genericCounterPopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-dungeon-950/70 backdrop-blur-sm" onClick={onCloseGenericCounterPopup}>
          <div className="bg-dungeon-800 border border-dungeon-600 rounded-xl p-4 w-72 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-gold-400 text-center">Ajouter un marqueur</h3>
            <input
              ref={genericCounterInputRef}
              type="text"
              value={genericCounterLabel}
              onChange={(e) => onGenericCounterLabelChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onConfirmGenericCounter(); if (e.key === 'Escape') onCloseGenericCounterPopup(); }}
              placeholder="Nom du marqueur (ex: Loyalty, Charge...)"
              className="w-full px-3 py-2 bg-dungeon-900 border border-dungeon-500 rounded-lg text-parchment-200 placeholder-parchment-600 focus:outline-none focus:border-gold-500/50 text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={onCloseGenericCounterPopup} variant="outline" size="sm" className="flex-1">
                Annuler
              </Button>
              <Button onClick={onConfirmGenericCounter} size="sm" className="flex-1" disabled={!genericCounterLabel.trim()}>
                Ajouter
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
