'use client'

import { motion } from 'framer-motion'
import {
  Search,
  Layers,
  Heart,
  Scroll,
  Compass,
  Map,
  Skull,
  Sparkles,
  Archive,
  type LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

type EmptyStateVariant =
  | 'search'
  | 'decks'
  | 'wantlist'
  | 'collection'
  | 'no-results'
  | 'error'
  | 'quest'
  | 'treasure'

interface EmptyStateProps {
  variant: EmptyStateVariant
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

const variantConfig: Record<EmptyStateVariant, {
  icon: LucideIcon
  defaultTitle: string
  defaultDescription: string
  iconColor: string
  bgColor: string
  narrative: string
}> = {
  search: {
    icon: Compass,
    defaultTitle: 'Begin Your Quest',
    defaultDescription: 'Enter a card name or use the arcane filters to explore the vast library.',
    iconColor: 'text-gold-500',
    bgColor: 'bg-gold-600/10',
    narrative: 'The ancient tomes await your inquiry...',
  },
  decks: {
    icon: Layers,
    defaultTitle: 'No Spellbooks Yet',
    defaultDescription: 'Create your first deck to begin assembling your arsenal of magical cards.',
    iconColor: 'text-arcane-500',
    bgColor: 'bg-arcane-600/10',
    narrative: 'Your grimoire shelves stand empty, adventurer.',
  },
  wantlist: {
    icon: Heart,
    defaultTitle: 'Quest Log Empty',
    defaultDescription: 'Start adding cards you seek to your collection wishlist.',
    iconColor: 'text-dragon-500',
    bgColor: 'bg-dragon-600/10',
    narrative: 'No treasures marked for acquisition... yet.',
  },
  collection: {
    icon: Archive,
    defaultTitle: 'Collection Empty',
    defaultDescription: 'Your collection is empty. Start adding cards you own.',
    iconColor: 'text-arcane-500',
    bgColor: 'bg-arcane-600/10',
    narrative: 'Your collection awaits its first treasures...',
  },
  'no-results': {
    icon: Map,
    defaultTitle: 'No Treasures Found',
    defaultDescription: 'Your search yielded no results. Try adjusting your filters or search terms.',
    iconColor: 'text-parchment-500',
    bgColor: 'bg-dungeon-700',
    narrative: 'The path leads to an empty chamber...',
  },
  error: {
    icon: Skull,
    defaultTitle: 'A Trap Was Triggered!',
    defaultDescription: 'Something went wrong. The magical connection has been disrupted.',
    iconColor: 'text-dragon-500',
    bgColor: 'bg-dragon-600/10',
    narrative: 'Roll for initiative... or try again.',
  },
  quest: {
    icon: Scroll,
    defaultTitle: 'New Quest Available',
    defaultDescription: 'A new adventure awaits. Are you ready to embark?',
    iconColor: 'text-gold-500',
    bgColor: 'bg-gold-600/10',
    narrative: 'The guild has posted a new mission.',
  },
  treasure: {
    icon: Sparkles,
    defaultTitle: 'Treasure Awaits',
    defaultDescription: 'Valuable items have been discovered in the depths.',
    iconColor: 'text-gold-400',
    bgColor: 'bg-gold-600/10',
    narrative: 'Fortune favors the bold!',
  },
}

export function EmptyState({
  variant,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={cn(
        'card-frame p-12 text-center',
        className
      )}
    >
      {/* Decorative top runes */}
      <div className="flex justify-center gap-4 mb-6 text-gold-600/30">
        {['ᚠ', '◆', 'ᚢ', '◆', 'ᚦ'].map((rune, i) => (
          <motion.span
            key={i}
            className="text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            {rune}
          </motion.span>
        ))}
      </div>

      {/* Icon with animated glow */}
      <motion.div
        className={cn(
          'w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center',
          config.bgColor
        )}
        animate={{
          boxShadow: [
            '0 0 20px rgba(212, 164, 24, 0.1)',
            '0 0 40px rgba(212, 164, 24, 0.2)',
            '0 0 20px rgba(212, 164, 24, 0.1)',
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          animate={{ 
            rotate: variant === 'search' ? [0, 360] : 0,
            scale: [1, 1.1, 1],
          }}
          transition={{ 
            rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
            scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <Icon className={cn('w-12 h-12', config.iconColor)} />
        </motion.div>
      </motion.div>

      {/* Title */}
      <motion.h2
        className="font-display text-2xl text-gold-400 mb-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {title || config.defaultTitle}
      </motion.h2>

      {/* Description */}
      <motion.p
        className="text-parchment-400 mb-2 max-w-md mx-auto"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {description || config.defaultDescription}
      </motion.p>

      {/* Narrative flavor text */}
      <motion.p
        className="text-dungeon-400 italic text-sm mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        "{config.narrative}"
      </motion.p>

      {/* Action button */}
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button onClick={action.onClick} size="lg">
            {action.label}
          </Button>
        </motion.div>
      )}

      {/* Decorative bottom runes */}
      <div className="flex justify-center gap-4 mt-8 text-gold-600/20">
        {['ᚨ', '◆', 'ᚱ', '◆', 'ᚲ'].map((rune, i) => (
          <motion.span
            key={i}
            className="text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 + i * 0.1 }}
          >
            {rune}
          </motion.span>
        ))}
      </div>
    </motion.div>
  )
}

// Compact empty state for inline use
interface CompactEmptyStateProps {
  icon?: LucideIcon
  message: string
  className?: string
}

export function CompactEmptyState({ 
  icon: Icon = Scroll, 
  message,
  className 
}: CompactEmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-8 text-center',
      className
    )}>
      <Icon className="w-8 h-8 text-dungeon-500 mb-2" />
      <p className="text-sm text-dungeon-400 italic">{message}</p>
    </div>
  )
}
