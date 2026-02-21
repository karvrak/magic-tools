'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Database, DollarSign, Loader2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { SyncProgressBar } from '@/components/layout/sync-progress-bar'

type SyncType = 'cards' | 'prices' | null

export function SyncButtons() {
  const [syncing, setSyncing] = useState<SyncType>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSync = async (type: 'cards' | 'prices') => {
    if (syncing) return

    const endpoint = type === 'cards' ? '/api/sync/cards' : '/api/sync/prices'
    const label = type === 'cards' ? 'Cards' : 'Prices'

    setSyncing(type)
    setMenuOpen(false)

    toast({
      title: `Syncing ${label}...`,
      description: 'This may take a few minutes. Please wait.',
      variant: 'info',
    })

    try {
      const response = await fetch(endpoint, { method: 'POST' })
      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: 'Sync Complete!',
          description: data.message || `${label} synchronized successfully.`,
          variant: 'success',
        })
      } else {
        toast({
          title: 'Sync Failed',
          description: data.error || `Failed to sync ${label.toLowerCase()}.`,
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Sync Error',
        description: 'Network error. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSyncing(null)
    }
  }

  return (
    <div className="relative">
      {/* Trigger Button */}
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMenuOpen(!menuOpen)}
          disabled={syncing !== null}
          className={cn(
            'hidden md:flex items-center gap-1.5 text-parchment-400 hover:text-arcane-400 hover:bg-arcane-600/10',
            syncing && 'text-arcane-400'
          )}
          title="Sync Database"
        >
          {syncing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span className="text-xs font-medium">Sync</span>
          <ChevronDown className={cn(
            'w-3 h-3 transition-transform',
            menuOpen && 'rotate-180'
          )} />
        </Button>
      </motion.div>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {menuOpen && !syncing && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setMenuOpen(false)} 
            />
            
            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 min-w-[200px] rounded-lg border-2 border-gold-700/30 bg-dungeon-800/98 backdrop-blur-md shadow-dungeon overflow-hidden"
            >
              {/* Header */}
              <div className="px-3 py-2 border-b border-dungeon-700 bg-dungeon-900/50">
                <p className="text-xs font-medieval text-gold-500 uppercase tracking-wider">
                  Database Sync
                </p>
              </div>

              {/* Options */}
              <div className="p-1.5 space-y-1">
                <button
                  onClick={() => handleSync('cards')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-all duration-200 hover:bg-arcane-600/15 group"
                >
                  <div className="w-8 h-8 rounded-md bg-arcane-600/20 flex items-center justify-center group-hover:bg-arcane-600/30 transition-colors">
                    <Database className="w-4 h-4 text-arcane-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-parchment-200 group-hover:text-parchment-100">
                      Sync Cards
                    </p>
                    <p className="text-xs text-dungeon-400">
                      Update card database from Scryfall
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => handleSync('prices')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-all duration-200 hover:bg-nature-600/15 group"
                >
                  <div className="w-8 h-8 rounded-md bg-nature-600/20 flex items-center justify-center group-hover:bg-nature-600/30 transition-colors">
                    <DollarSign className="w-4 h-4 text-nature-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-parchment-200 group-hover:text-parchment-100">
                      Sync Prices
                    </p>
                    <p className="text-xs text-dungeon-400">
                      Update card prices from Scryfall
                    </p>
                  </div>
                </button>
              </div>

              {/* Footer warning */}
              <div className="px-3 py-2 border-t border-dungeon-700 bg-dungeon-900/30">
                <p className="text-[10px] text-dungeon-500 italic">
                  ⚠️ Card sync may take several minutes
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Progress bar - shown below the button while syncing */}
      <SyncProgressBar isActive={syncing !== null} />
    </div>
  )
}
