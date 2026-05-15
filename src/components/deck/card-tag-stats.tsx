'use client'

import { Tag as TagIcon, Settings2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CardTagStat } from './card-tags-types'

interface Props {
  stats: CardTagStat[]
  activeTagIds: string[]
  onToggle: (tagId: string) => void
  onClear: () => void
  onManage: () => void
}

// Panneau "Stats par tag" affiché sur la page deck.
// - Chaque tag = pastille cliquable qui filtre les cartes du deck (toggle multi).
// - Affiche `count` = somme des quantités (4 copies d'une carte taguée comptent 4),
//   et `uniqueCards` = nombre de cartes distinctes.
export function CardTagStats({ stats, activeTagIds, onToggle, onClear, onManage }: Props) {
  const hasFilter = activeTagIds.length > 0

  return (
    <div className="card-frame p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medieval text-lg text-gold-400 flex items-center gap-2">
          <TagIcon className="w-4 h-4" />
          Tags
          {stats.length > 0 && (
            <span className="text-xs text-parchment-400 font-sans">
              ({stats.length})
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {hasFilter && (
            <button
              onClick={onClear}
              className="text-xs text-parchment-400 hover:text-parchment-200 flex items-center gap-1"
              title="Effacer le filtre"
            >
              <X className="w-3 h-3" />
              Effacer filtre ({activeTagIds.length})
            </button>
          )}
          <button
            onClick={onManage}
            className="text-xs text-parchment-400 hover:text-gold-400 flex items-center gap-1"
            title="Gérer les tags"
          >
            <Settings2 className="w-3 h-3" />
            Gérer
          </button>
        </div>
      </div>

      {stats.length === 0 ? (
        <p className="text-sm text-parchment-500 italic">
          Aucune carte taguée dans ce deck. Cliquez sur l&apos;icône tag d&apos;une carte pour commencer.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {stats.map((tag) => {
            const isActive = activeTagIds.includes(tag.id)
            return (
              <button
                key={tag.id}
                onClick={() => onToggle(tag.id)}
                className={cn(
                  'group flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
                  isActive ? 'shadow-md' : 'opacity-80 hover:opacity-100'
                )}
                style={{
                  borderColor: tag.color,
                  color: isActive ? '#fff' : tag.color,
                  backgroundColor: isActive ? tag.color : 'transparent',
                }}
                title={
                  isActive
                    ? `Cliquer pour retirer le filtre "${tag.name}"`
                    : `Filtrer le deck par "${tag.name}"`
                }
              >
                <span>{tag.name}</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px]',
                    isActive ? 'bg-white/20 text-white' : 'bg-dungeon-700/60'
                  )}
                >
                  <span className="font-bold">{tag.count}</span>
                  {tag.uniqueCards !== tag.count && (
                    <span className="opacity-70">({tag.uniqueCards})</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}
      {hasFilter && (
        <p className="text-xs text-parchment-500 mt-3">
          Filtre actif: seules les cartes ayant au moins un des tags sélectionnés sont affichées.
        </p>
      )}
    </div>
  )
}
