'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PRESET_TOKENS, MANA_COLORS, MANA_COLOR_STYLES, MANA_COLOR_LABELS } from '@/lib/game-room/constants'
import type { ManaColor } from '@/lib/game-room/constants'

interface TokenData {
  name: string
  power: string
  toughness: string
  type: string
  color: string
}

interface TokenCreatorProps {
  isOpen: boolean
  onClose: () => void
  onCreateToken: (token: TokenData) => void
}

const TOKEN_COLOR_BG: Record<string, string> = {
  W: 'bg-amber-200/20 border-amber-300/40 text-amber-200',
  U: 'bg-blue-500/20 border-blue-400/40 text-blue-300',
  B: 'bg-gray-800/40 border-gray-600/40 text-gray-300',
  R: 'bg-red-500/20 border-red-400/40 text-red-300',
  G: 'bg-green-500/20 border-green-400/40 text-green-300',
  C: 'bg-gray-400/20 border-gray-400/40 text-gray-300',
}

export function TokenCreator({ isOpen, onClose, onCreateToken }: TokenCreatorProps) {
  const [customName, setCustomName] = useState('')
  const [customPower, setCustomPower] = useState('')
  const [customToughness, setCustomToughness] = useState('')
  const [customType, setCustomType] = useState('Creature')
  const [customColor, setCustomColor] = useState<string>('C')

  const handleCreatePreset = (preset: typeof PRESET_TOKENS[number]) => {
    onCreateToken({
      name: preset.name,
      power: preset.power,
      toughness: preset.toughness,
      type: preset.type,
      color: preset.color,
    })
  }

  // Check if the selected type is a creature type (needs power/toughness)
  const isCreatureType = customType.toLowerCase().includes('creature')

  const handleCreateCustom = () => {
    if (!customName.trim()) return
    // Only require P/T for creature types
    if (isCreatureType && (!customPower.trim() || !customToughness.trim())) return

    onCreateToken({
      name: customName.trim(),
      power: isCreatureType ? customPower.trim() : '',
      toughness: isCreatureType ? customToughness.trim() : '',
      type: customType,
      color: customColor,
    })
    // Reset form
    setCustomName('')
    setCustomPower('')
    setCustomToughness('')
    setCustomType('Creature')
    setCustomColor('C')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-dungeon-800 border border-gold-500/30 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-dungeon-600 bg-dungeon-900/50">
              <h3 className="text-lg font-bold text-gold-400">Create Token</h3>
              <button
                onClick={onClose}
                className="p-1 text-parchment-500 hover:text-parchment-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Preset tokens grid */}
              <div>
                <p className="text-xs text-parchment-500 uppercase tracking-wide mb-2">Preset Tokens</p>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_TOKENS.map((preset) => (
                    <button
                      key={`${preset.name}-${preset.power}-${preset.color}`}
                      onClick={() => handleCreatePreset(preset)}
                      className={cn(
                        "px-2 py-2 rounded-lg border text-center transition-all hover:scale-105 active:scale-95",
                        TOKEN_COLOR_BG[preset.color] || TOKEN_COLOR_BG.C
                      )}
                    >
                      <div className="text-sm font-bold">{preset.power}/{preset.toughness}</div>
                      <div className="text-xs truncate">{preset.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-dungeon-600" />
                <span className="text-xs text-parchment-500 uppercase">or custom</span>
                <div className="flex-1 h-px bg-dungeon-600" />
              </div>

              {/* Custom token form */}
              <div className="space-y-3">
                {/* Name */}
                <input
                  type="text"
                  placeholder="Token name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-2 bg-dungeon-900 border border-dungeon-600 rounded-lg text-parchment-200 placeholder-parchment-600 text-sm focus:outline-none focus:border-gold-500/50"
                />

                {/* Power / Toughness - only for creature types */}
                {isCreatureType && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Power"
                      value={customPower}
                      onChange={(e) => setCustomPower(e.target.value)}
                      className="flex-1 px-3 py-2 bg-dungeon-900 border border-dungeon-600 rounded-lg text-parchment-200 placeholder-parchment-600 text-sm focus:outline-none focus:border-gold-500/50"
                    />
                    <span className="text-parchment-500 self-center text-lg">/</span>
                    <input
                      type="text"
                      placeholder="Toughness"
                      value={customToughness}
                      onChange={(e) => setCustomToughness(e.target.value)}
                      className="flex-1 px-3 py-2 bg-dungeon-900 border border-dungeon-600 rounded-lg text-parchment-200 placeholder-parchment-600 text-sm focus:outline-none focus:border-gold-500/50"
                    />
                  </div>
                )}

                {/* Type dropdown */}
                <select
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  className="w-full px-3 py-2 bg-dungeon-900 border border-dungeon-600 rounded-lg text-parchment-200 text-sm focus:outline-none focus:border-gold-500/50"
                >
                  <option value="Creature">Creature</option>
                  <option value="Artifact Creature">Artifact Creature</option>
                  <option value="Enchantment Creature">Enchantment Creature</option>
                  <option value="Artifact">Artifact</option>
                  <option value="Enchantment">Enchantment</option>
                  <option value="Land">Land</option>
                  <option value="Basic Land">Basic Land</option>
                </select>

                {/* Color selector */}
                <div>
                  <p className="text-xs text-parchment-500 mb-1.5">Color</p>
                  <div className="flex gap-2">
                    {MANA_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setCustomColor(color)}
                        title={MANA_COLOR_LABELS[color]}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all",
                          MANA_COLOR_STYLES[color],
                          customColor === color
                            ? 'ring-2 ring-gold-400 ring-offset-2 ring-offset-dungeon-800 scale-110'
                            : 'opacity-60 hover:opacity-100'
                        )}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Create button */}
                <Button
                  onClick={handleCreateCustom}
                  disabled={!customName.trim() || (isCreatureType && (!customPower.trim() || !customToughness.trim()))}
                  className="w-full bg-gold-600 hover:bg-gold-500 text-dungeon-900 font-semibold disabled:opacity-40"
                >
                  Create Token
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
