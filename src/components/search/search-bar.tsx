'use client'

import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onToggleFilters: () => void
  showFiltersActive: boolean
  hasActiveFilters: boolean
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar({
  value,
  onChange,
  onToggleFilters,
  showFiltersActive,
  hasActiveFilters,
}, ref) {
  return (
    <div className="flex gap-2 sm:gap-3">
      <div className="relative flex-1 group">
        {/* Search icon with glow on focus */}
        <div className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-dungeon-400 group-focus-within:text-gold-500 transition-colors z-10">
          <Search className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        
        <Input
          ref={ref}
          type="text"
          placeholder="Rechercher une carte..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-8 sm:pl-10 h-10 sm:h-12 text-sm sm:text-base"
        />
        
        {/* Decorative sparkle when typing */}
        {value && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2"
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold-500/50" />
          </motion.div>
        )}
      </div>
      
      <motion.div whileTap={{ scale: 0.98 }}>
        <Button
          variant={showFiltersActive ? 'default' : 'outline'}
          onClick={onToggleFilters}
          className={cn(
            'relative px-3 sm:px-4 h-10 sm:h-12',
            hasActiveFilters && !showFiltersActive && 'border-gold-500'
          )}
        >
          <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline ml-2 font-medieval">Filtres</span>
          
          {/* Active filters indicator */}
          {hasActiveFilters && !showFiltersActive && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-gold-500 rounded-full"
              style={{
                boxShadow: '0 0 8px rgba(212, 164, 24, 0.6)',
              }}
            />
          )}
        </Button>
      </motion.div>
    </div>
  )
})
