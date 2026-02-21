'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Trash2,
  Sparkles,
  Coins,
  Lock,
  Hammer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { formatDate, formatPrice, cn } from '@/lib/utils'
import { FadeIn } from '@/components/layout/page-transition'
import type { Deck, SortField, SortDirection } from './types'
import { MANA_CONFIG } from './types'

interface DeckListViewProps {
  decks: Deck[]
  sortField: SortField
  sortDirection: SortDirection
  onSortChange: (field: SortField) => void
  onDeleteDeck: (id: string, name: string) => void
  onCycleDeckStatus: (deck: Deck, e: React.MouseEvent) => void
}

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (field !== sortField) return <ArrowUpDown className="w-3 h-3 opacity-30" />
  return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
}

export function DeckListView({
  decks,
  sortField,
  sortDirection,
  onSortChange,
  onDeleteDeck,
  onCycleDeckStatus,
}: DeckListViewProps) {
  return (
    <FadeIn delay={0.1}>
      <div className="card-frame overflow-hidden">
        {/* Sort Header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto_auto] sm:grid-cols-[2fr_80px_90px_70px_50px_50px_100px_90px_80px_36px] gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-dungeon-800 border-b border-dungeon-600 text-xs font-medium text-parchment-400">
          <button
            onClick={() => onSortChange('name')}
            className="flex items-center gap-1 hover:text-gold-400 transition-colors text-left"
          >
            Name
            <SortIcon field="name" sortField={sortField} sortDirection={sortDirection} />
          </button>
          <span className="hidden sm:block text-center">Colors</span>
          <button
            onClick={() => onSortChange('status')}
            className="hidden sm:flex items-center gap-1 hover:text-gold-400 transition-colors justify-center"
          >
            Status
            {sortField === 'status' && (
              sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
            )}
          </button>
          <span className="hidden sm:block text-center">Format</span>
          <button
            onClick={() => onSortChange('cardCount')}
            className="flex items-center gap-1 hover:text-gold-400 transition-colors justify-end"
          >
            <span className="hidden sm:inline">Cards</span>
            <Sparkles className="w-3 h-3 sm:hidden" />
            {sortField === 'cardCount' && (
              sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={() => onSortChange('avgCmc')}
            className="hidden sm:flex items-center gap-1 hover:text-gold-400 transition-colors justify-end"
            title="Average Mana Cost"
          >
            CMC
            {sortField === 'avgCmc' && (
              sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={() => onSortChange('tags')}
            className="hidden sm:flex items-center gap-1 hover:text-gold-400 transition-colors"
          >
            Tags
            {sortField === 'tags' && (
              sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={() => onSortChange('price')}
            className="flex items-center gap-1 hover:text-gold-400 transition-colors justify-end"
          >
            Price
            {sortField === 'price' && (
              sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={() => onSortChange('updatedAt')}
            className="hidden sm:flex items-center gap-1 hover:text-gold-400 transition-colors justify-end"
          >
            Date
            <SortIcon field="updatedAt" sortField={sortField} sortDirection={sortDirection} />
          </button>
          <span className="w-8" />
        </div>

        {/* Deck Rows */}
        <div className="divide-y divide-dungeon-700">
          {decks.map((deck) => (
            <Link
              key={deck.id}
              href={`/decks/${deck.id}`}
              className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto_auto] sm:grid-cols-[2fr_80px_90px_70px_50px_50px_100px_90px_80px_36px] gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 hover:bg-dungeon-700/50 transition-colors group items-center"
            >
              {/* Name + Owner */}
              <div className="flex items-center gap-2 min-w-0">
                {deck.owner && (
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: deck.owner.color }}
                    title={deck.owner.name}
                  />
                )}
                {/* Mobile: status icon */}
                <button
                  onClick={(e) => onCycleDeckStatus(deck, e)}
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
                  onClick={(e) => onCycleDeckStatus(deck, e)}
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
                  <span className="text-xs text-dungeon-500">&mdash;</span>
                )}
              </div>

              {/* Card Count */}
              <div className="text-right text-sm text-parchment-400">
                {deck.cardCount}
              </div>

              {/* Average CMC */}
              <div className="hidden sm:block text-right text-sm text-arcane-400">
                {deck.avgCmc > 0 ? deck.avgCmc.toFixed(2) : '&mdash;'}
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
                  <span className="text-xs text-dungeon-500">&mdash;</span>
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
                    onDeleteDeck(deck.id, deck.name)
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
  )
}
