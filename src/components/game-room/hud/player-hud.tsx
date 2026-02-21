'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  Shuffle,
  ChevronDown,
  Library,
  Trash2,
  EyeOff,
  Minus,
  Plus,
  Eye,
  Search,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CardWithPrice } from '@/types/scryfall'
import { ManaPoolColors } from '@/lib/game-room/types'
import { MANA_COLORS, MANA_COLOR_STYLES, MANA_COLOR_LABELS } from '@/lib/game-room/constants'
import type { ManaColor } from '@/lib/game-room/constants'

interface PlayerHudProps {
  life: number
  poisonCounters: number
  graveyard: CardWithPrice[]
  exile: CardWithPrice[]
  library: CardWithPrice[]
  fullDeckLength: number
  isMyTurn: boolean
  showDeckMenu: boolean
  showLibrary: boolean
  showGraveyard: boolean
  showExile: boolean
  manaPoolColors: ManaPoolColors
  onAdjustLife: (amount: number) => void
  onAdjustPoison: (amount: number) => void
  onAdjustManaColor: (color: keyof ManaPoolColors, delta: number) => void
  onToggleGraveyard: () => void
  onToggleExile: () => void
  onToggleDeckMenu: () => void
  onDraw: (count: number) => void
  onStartScry: (count: number) => void
  onMill: (count: number) => void
  onExileTop: (count: number) => void
  onOpenDeckSearch: () => void
  onToggleLibrary: () => void
  onShuffleLibrary: () => void
  onStartTurn: () => void
  onEndTurn: () => void
  onAdvancePhase: () => void
  onToggleKeyboardHelp: () => void
}

export function PlayerHud({
  life,
  poisonCounters,
  graveyard,
  exile,
  library,
  fullDeckLength,
  isMyTurn,
  showDeckMenu,
  showLibrary,
  showGraveyard,
  showExile,
  manaPoolColors,
  onAdjustLife,
  onAdjustPoison,
  onAdjustManaColor,
  onToggleGraveyard,
  onToggleExile,
  onToggleDeckMenu,
  onDraw,
  onStartScry,
  onMill,
  onExileTop,
  onOpenDeckSearch,
  onToggleLibrary,
  onShuffleLibrary,
  onStartTurn,
  onEndTurn,
  onAdvancePhase,
  onToggleKeyboardHelp,
}: PlayerHudProps) {
  const totalMana = Object.values(manaPoolColors).reduce((sum, v) => sum + v, 0)

  return (
    <div className={cn(
      "flex-shrink-0 mt-auto pt-2 sticky bottom-0 bg-dungeon-900/95 backdrop-blur-sm pb-1",
      isMyTurn && "border-t-2 border-gold-500/60 shadow-[0_-4px_12px_rgba(234,179,8,0.15)]"
    )}>
      {/* Compact stats bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 mb-1">
        {/* Life */}
        <div className="flex items-center gap-1">
          <button onClick={() => onAdjustLife(-1)} className="p-1 text-dragon-400 active:scale-90">
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-2xl font-bold text-parchment-200 min-w-[3ch] text-center">{life}</span>
          <button onClick={() => onAdjustLife(1)} className="p-1 text-emerald-400 active:scale-90">
            <Plus className="w-4 h-4" />
          </button>
          <div className="flex gap-0.5 ml-1">
            <button onClick={() => onAdjustLife(-5)} className="px-1 py-0.5 text-[10px] text-dragon-400 active:bg-dragon-500/20 rounded">-5</button>
            <button onClick={() => onAdjustLife(5)} className="px-1 py-0.5 text-[10px] text-emerald-400 active:bg-emerald-500/20 rounded">+5</button>
          </div>
        </div>

        {/* Poison */}
        {poisonCounters > 0 && (
          <span className="text-emerald-400 font-bold text-sm">{poisonCounters}&#9760;</span>
        )}

        {/* Colored Mana Pool */}
        <div className="flex items-center gap-1">
          {MANA_COLORS.map((color) => (
            <div key={color} className="flex items-center">
              <button
                onClick={() => onAdjustManaColor(color, -1)}
                disabled={manaPoolColors[color] === 0}
                className="p-0.5 text-parchment-500 hover:text-parchment-200 disabled:opacity-30 active:scale-90"
                title={`Remove ${MANA_COLOR_LABELS[color]}`}
              >
                <Minus className="w-2.5 h-2.5" />
              </button>
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border",
                  MANA_COLOR_STYLES[color],
                  manaPoolColors[color] > 0 ? 'opacity-100' : 'opacity-40'
                )}
                title={`${MANA_COLOR_LABELS[color]}: ${manaPoolColors[color]}`}
              >
                {manaPoolColors[color]}
              </div>
              <button
                onClick={() => onAdjustManaColor(color, 1)}
                className="p-0.5 text-parchment-500 hover:text-parchment-200 active:scale-90"
                title={`Add ${MANA_COLOR_LABELS[color]}`}
              >
                <Plus className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          {totalMana > 0 && (
            <span className="text-[10px] text-parchment-500 ml-1">= {totalMana}</span>
          )}
        </div>

        {/* Zone counters + Deck menu */}
        <div className="flex items-center gap-2">
          {fullDeckLength > 0 && (
            <>
              <button onClick={onToggleGraveyard} className="text-xs text-parchment-400 hover:text-parchment-200 transition-colors">
                &#129702;{graveyard.length}
              </button>
              <button onClick={onToggleExile} className="text-xs text-parchment-400 hover:text-parchment-200 transition-colors">
                &#9939;{exile.length}
              </button>
            </>
          )}
          {isMyTurn && <span className="text-[10px] text-gold-400 font-bold animate-pulse">YOUR TURN</span>}

          {/* Keyboard help button */}
          <button
            onClick={onToggleKeyboardHelp}
            className="p-1 text-parchment-500 hover:text-gold-400 transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Library card-back button with deck menu */}
          {fullDeckLength > 0 && (
            <div className="relative">
              <button
                onClick={onToggleDeckMenu}
                className="relative w-[40px] h-[56px] rounded border-2 border-dungeon-500 hover:border-gold-500/60 transition-all group overflow-hidden"
                title="Deck actions"
              >
                {/* Card back design */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900">
                  <div className="absolute inset-[3px] border border-gold-500/30 rounded-sm flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full border border-gold-500/40 bg-gold-500/10 flex items-center justify-center">
                      <span className="text-[8px] text-gold-400/80 font-bold">M</span>
                    </div>
                  </div>
                </div>
                {/* Count overlay */}
                <div className="absolute bottom-0 inset-x-0 bg-dungeon-900/80 text-[9px] text-parchment-300 text-center py-0.5 font-medium">
                  {library.length}
                </div>
              </button>

              {/* Deck actions popup menu */}
              <AnimatePresence>
                {showDeckMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    className="absolute bottom-full mb-2 right-0 w-44 bg-dungeon-800 border border-dungeon-600 rounded-lg shadow-xl z-30 py-1 overflow-hidden"
                  >
                    <button
                      onClick={() => onDraw(1)}
                      disabled={library.length === 0}
                      className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 disabled:opacity-40 flex items-center gap-2"
                    >
                      <ChevronDown className="w-3.5 h-3.5 text-arcane-400" />
                      Draw
                    </button>
                    <button
                      onClick={() => onDraw(2)}
                      disabled={library.length === 0}
                      className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 disabled:opacity-40 flex items-center gap-2"
                    >
                      <ChevronDown className="w-3.5 h-3.5 text-arcane-400" />
                      Draw 2
                    </button>
                    <div className="h-px bg-dungeon-600 my-0.5" />
                    <button
                      onClick={() => onStartScry(1)}
                      disabled={library.length === 0}
                      className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 disabled:opacity-40 flex items-center gap-2"
                    >
                      <Eye className="w-3.5 h-3.5 text-gold-400" />
                      Scry 1
                    </button>
                    <button
                      onClick={() => onStartScry(2)}
                      disabled={library.length < 2}
                      className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 disabled:opacity-40 flex items-center gap-2"
                    >
                      <Eye className="w-3.5 h-3.5 text-gold-400" />
                      Scry 2
                    </button>
                    <div className="h-px bg-dungeon-600 my-0.5" />
                    <button
                      onClick={() => onMill(1)}
                      disabled={library.length === 0}
                      className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 disabled:opacity-40 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-dragon-400" />
                      Mill 1
                    </button>
                    <button
                      onClick={() => onExileTop(1)}
                      disabled={library.length === 0}
                      className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 disabled:opacity-40 flex items-center gap-2"
                    >
                      <EyeOff className="w-3.5 h-3.5 text-parchment-500" />
                      Exile top
                    </button>
                    <div className="h-px bg-dungeon-600 my-0.5" />
                    <button
                      onClick={onOpenDeckSearch}
                      disabled={library.length === 0}
                      className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 disabled:opacity-40 flex items-center gap-2"
                    >
                      <Search className="w-3.5 h-3.5 text-arcane-400" />
                      Search deck
                    </button>
                    <button
                      onClick={onToggleLibrary}
                      className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 flex items-center gap-2"
                    >
                      <Library className="w-3.5 h-3.5 text-parchment-400" />
                      Peek top 20
                    </button>
                    <button
                      onClick={onShuffleLibrary}
                      className="w-full px-3 py-2 text-left text-sm text-parchment-200 hover:bg-dungeon-700 flex items-center gap-2"
                    >
                      <Shuffle className="w-3.5 h-3.5 text-parchment-400" />
                      Shuffle
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {isMyTurn && (
            <>
              <Button size="sm" onClick={onStartTurn} className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500">
                &#9654; Begin Turn
              </Button>
              <Button size="sm" onClick={onAdvancePhase} className="h-7 px-3 text-xs bg-arcane-600 hover:bg-arcane-500 text-white border-arcane-500">
                Next Phase &#9654;&#9654;
              </Button>
              <Button size="sm" onClick={onEndTurn} className="h-7 px-3 text-xs bg-gold-600 hover:bg-gold-500 text-dungeon-900 font-semibold border-gold-500">
                End Turn &#9197;
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
