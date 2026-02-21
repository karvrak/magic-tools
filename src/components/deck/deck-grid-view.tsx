'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  Layers,
  Trash2,
  Sparkles,
  Coins,
  Users,
  Lock,
  Hammer,
} from 'lucide-react'
import { formatDate, formatPrice, cn } from '@/lib/utils'
import { StaggerContainer, StaggerItem } from '@/components/layout/page-transition'
import type { Deck, DeckStatus } from './types'
import { MANA_CONFIG } from './types'

interface DeckGridViewProps {
  decks: Deck[]
  activeOwnerId?: string
  onDeleteDeck: (id: string, name: string) => void
  onCycleDeckStatus: (deck: Deck, e: React.MouseEvent) => void
}

export function DeckGridView({
  decks,
  activeOwnerId,
  onDeleteDeck,
  onCycleDeckStatus,
}: DeckGridViewProps) {
  return (
    <StaggerContainer
      key={`${activeOwnerId || 'all'}-grid`}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    >
      {decks.map((deck) => (
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
                      onClick={(e) => onCycleDeckStatus(deck, e)}
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
                    onDeleteDeck(deck.id, deck.name)
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
  )
}
