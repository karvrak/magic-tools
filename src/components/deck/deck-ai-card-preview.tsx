'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AIPreviewCard } from './deck-ai-complete'

interface Props {
  card: AIPreviewCard | null
  index: number
  total: number
  onPrev?: () => void
  onNext?: () => void
}

/**
 * Affiche en grand l'image d'une carte cliquee dans la section AI completion.
 * Pas de texte, juste l'image + fleches prev/next + compteur. Place dans le
 * side-rail sous la simulation pour servir de loupe sur la carte courante.
 *
 * Les raccourcis clavier ← / → fonctionnent uniquement quand le composant a
 * une carte selectionnee, et tant que le focus n'est pas dans un input.
 */
export function DeckAICardPreview({ card, index, total, onPrev, onNext }: Props) {
  useEffect(() => {
    if (!card) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowLeft' && onPrev) {
        e.preventDefault()
        onPrev()
      } else if (e.key === 'ArrowRight' && onNext) {
        e.preventDefault()
        onNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [card, onPrev, onNext])

  if (!card) {
    return (
      <p className="px-1 py-2 text-[11px] text-parchment-500 italic">
        Clique sur une carte de l’AI pour la voir ici en grand.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-[5/7] w-full rounded-lg overflow-hidden border-2 border-dungeon-600 bg-dungeon-900">
        {card.imageNormal ? (
          <Image
            key={card.cardId}
            src={card.imageNormal}
            alt={card.name}
            fill
            className="object-contain"
            sizes="360px"
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-parchment-500 text-sm text-center px-2">
            {card.name}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!onPrev}
          className={cn(
            'p-1.5 rounded border transition-colors',
            onPrev
              ? 'border-dungeon-600 text-parchment-200 hover:bg-dungeon-700/60'
              : 'border-dungeon-700 text-dungeon-500 cursor-not-allowed'
          )}
          aria-label="Carte precedente"
          title="Carte précédente (←)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[11px] text-parchment-400 tabular-nums">
          {index + 1} / {total}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={!onNext}
          className={cn(
            'p-1.5 rounded border transition-colors',
            onNext
              ? 'border-dungeon-600 text-parchment-200 hover:bg-dungeon-700/60'
              : 'border-dungeon-700 text-dungeon-500 cursor-not-allowed'
          )}
          aria-label="Carte suivante"
          title="Carte suivante (→)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
