'use client'

import Image from 'next/image'
import { ScannedCard, CardMatch } from '@/types/scanner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Check,
  AlertTriangle,
  XCircle,
  Minus,
  Plus,
  Trash2,
  ChevronDown,
} from 'lucide-react'
import { useState } from 'react'

interface ScannedCardsListProps {
  cards: ScannedCard[]
  onQuantityChange: (id: string, quantity: number) => void
  onRemove: (id: string) => void
  onSelectMatch: (id: string, match: CardMatch) => void
}

export function ScannedCardsList({
  cards,
  onQuantityChange,
  onRemove,
  onSelectMatch,
}: ScannedCardsListProps) {
  if (cards.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-parchment-400 mb-2">Aucune carte scannée</p>
          <p className="text-parchment-500 text-sm">
            Retournez au mode scan pour ajouter des cartes
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {cards.map((card) => (
        <ScannedCardItem
          key={card.id}
          card={card}
          onQuantityChange={onQuantityChange}
          onRemove={onRemove}
          onSelectMatch={onSelectMatch}
        />
      ))}
    </div>
  )
}

interface ScannedCardItemProps {
  card: ScannedCard
  onQuantityChange: (id: string, quantity: number) => void
  onRemove: (id: string) => void
  onSelectMatch: (id: string, match: CardMatch) => void
}

function ScannedCardItem({
  card,
  onQuantityChange,
  onRemove,
  onSelectMatch,
}: ScannedCardItemProps) {
  const [showCandidates, setShowCandidates] = useState(false)

  const statusConfig = {
    matched: {
      icon: Check,
      color: 'text-emerald-400',
      bg: 'bg-emerald-900/20 border-emerald-600/30',
      label: 'Reconnu',
    },
    ambiguous: {
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'bg-amber-900/20 border-amber-600/30',
      label: 'Probable',
    },
    not_found: {
      icon: XCircle,
      color: 'text-dragon-400',
      bg: 'bg-dragon-900/20 border-dragon-600/30',
      label: 'Non trouvé',
    },
    pending: {
      icon: AlertTriangle,
      color: 'text-parchment-400',
      bg: 'bg-dungeon-800 border-dungeon-600',
      label: 'En attente',
    },
    manual: {
      icon: Check,
      color: 'text-arcane-400',
      bg: 'bg-arcane-900/20 border-arcane-600/30',
      label: 'Manuel',
    },
  }

  const status = statusConfig[card.status]
  const StatusIcon = status.icon

  return (
    <div className={cn('rounded-lg border p-3', status.bg)}>
      <div className="flex gap-3">
        {/* Card image or placeholder */}
        <div className="flex-shrink-0 w-14 h-20 rounded overflow-hidden bg-dungeon-700">
          {card.card?.imageSmall || card.card?.imageNormal ? (
            <Image
              src={card.card.imageSmall || card.card.imageNormal!}
              alt={card.card.printedName || card.card.name}
              width={56}
              height={80}
              className="w-full h-full object-cover"
            />
          ) : card.imageDataUrl ? (
            <img
              src={card.imageDataUrl}
              alt="Captured"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-dungeon-500 text-xs">
              ?
            </div>
          )}
        </div>

        {/* Card info */}
        <div className="flex-1 min-w-0">
          {/* Name and status */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <h4 className="font-medium text-parchment-200 truncate">
                {card.card?.printedName || card.card?.name || card.extractedText}
              </h4>
              {card.card && (
                <p className="text-xs text-parchment-500 truncate">
                  {card.card.setName} ({card.card.setCode.toUpperCase()})
                </p>
              )}
            </div>
            <div className={cn('flex items-center gap-1 text-xs', status.color)}>
              <StatusIcon className="w-3.5 h-3.5" />
              <span>{Math.round(card.confidence * 100)}%</span>
            </div>
          </div>

          {/* OCR text if different from match */}
          {card.card && card.extractedText !== card.card.name && card.extractedText !== card.card.printedName && (
            <p className="text-[10px] text-parchment-500 mb-1">
              OCR: "{card.extractedText}"
            </p>
          )}

          {/* Quantity controls for matched cards */}
          {(card.status === 'matched' || card.status === 'ambiguous') && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 bg-dungeon-800/50 rounded">
                <button
                  onClick={() => onQuantityChange(card.id, card.quantity - 1)}
                  disabled={card.quantity <= 1}
                  className="p-1.5 text-parchment-400 hover:text-parchment-200 disabled:opacity-50"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-medium text-parchment-200">
                  {card.quantity}
                </span>
                <button
                  onClick={() => onQuantityChange(card.id, card.quantity + 1)}
                  className="p-1.5 text-parchment-400 hover:text-parchment-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => onRemove(card.id)}
                className="p-1.5 text-dragon-400 hover:text-dragon-300 ml-auto"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Remove button for not found */}
          {card.status === 'not_found' && (
            <div className="flex items-center justify-end mt-2">
              <button
                onClick={() => onRemove(card.id)}
                className="p-1.5 text-dragon-400 hover:text-dragon-300"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Alternative candidates for ambiguous matches */}
      {card.candidates && card.candidates.length > 1 && card.status === 'ambiguous' && (
        <div className="mt-2 pt-2 border-t border-dungeon-600/50">
          <button
            onClick={() => setShowCandidates(!showCandidates)}
            className="flex items-center gap-1 text-xs text-parchment-400 hover:text-parchment-300"
          >
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 transition-transform',
                showCandidates && 'rotate-180'
              )}
            />
            {showCandidates ? 'Masquer' : 'Autres correspondances'} ({card.candidates.length - 1})
          </button>

          {showCandidates && (
            <div className="mt-2 space-y-1">
              {card.candidates.slice(1).map((match, index) => (
                <button
                  key={match.card.id}
                  onClick={() => onSelectMatch(card.id, match)}
                  className="w-full flex items-center gap-2 p-2 rounded bg-dungeon-800/50 hover:bg-dungeon-700/50 text-left transition-colors"
                >
                  {match.card.imageSmall && (
                    <Image
                      src={match.card.imageSmall}
                      alt={match.card.name}
                      width={28}
                      height={40}
                      className="rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-parchment-200 truncate">
                      {match.card.printedName || match.card.name}
                    </p>
                    <p className="text-[10px] text-parchment-500">
                      {match.card.setCode.toUpperCase()} • {Math.round(match.score * 100)}%
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
