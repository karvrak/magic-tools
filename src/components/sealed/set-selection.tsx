'use client'

import Link from 'next/link'
import {
  Package,
  Sparkles,
  BookOpen,
  Puzzle,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SetInfo } from './types'

interface SetSelectionProps {
  sets: SetInfo[] | undefined
  isLoading: boolean
  selectedSet: string
  onSelectedSetChange: (setCode: string) => void
  onGenerate: (setCode: string) => void
  isGenerating: boolean
  generateError: string | undefined
}

export function SetSelection({
  sets,
  isLoading,
  selectedSet,
  onSelectedSetChange,
  onGenerate,
  isGenerating,
  generateError,
}: SetSelectionProps) {
  return (
    <div className="card-frame p-4 lg:p-6 max-w-lg mx-auto">
      {/* Link to collection sealed */}
      <Link
        href="/sealed/collection"
        className="flex items-center gap-3 p-3 mb-4 rounded-lg bg-emerald-900/20 border border-emerald-600/30 hover:bg-emerald-900/30 transition-colors"
      >
        <BookOpen className="w-5 h-5 text-emerald-400" />
        <div className="flex-1">
          <p className="text-emerald-400 font-medium text-sm">Sealed with your collection</p>
          <p className="text-parchment-500 text-xs">Open boosters with your own cards</p>
        </div>
        <ArrowRight className="w-4 h-4 text-emerald-400" />
      </Link>

      {/* Link to custom sets */}
      <Link
        href="/sealed/custom"
        className="flex items-center gap-3 p-3 mb-4 rounded-lg bg-purple-900/20 border border-purple-600/30 hover:bg-purple-900/30 transition-colors"
      >
        <Puzzle className="w-5 h-5 text-purple-400" />
        <div className="flex-1">
          <p className="text-purple-400 font-medium text-sm">Custom sets</p>
          <p className="text-parchment-500 text-xs">Upload and play with your own extensions</p>
        </div>
        <ArrowRight className="w-4 h-4 text-purple-400" />
      </Link>

      <h2 className="font-medieval text-lg text-gold-400 mb-4">Sealed Simulator</h2>
      <p className="text-parchment-500 text-sm mb-4">Simulate opening boosters from any set.</p>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Sparkles className="w-6 h-6 text-gold-400 animate-pulse" />
          <span className="ml-2 text-parchment-400">Loading...</span>
        </div>
      ) : (
        <>
          <select
            value={selectedSet}
            onChange={(e) => onSelectedSetChange(e.target.value)}
            className="w-full bg-dungeon-800 border border-dungeon-600 rounded-lg px-3 py-3 text-parchment-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 mb-4"
          >
            <option value="">-- Select --</option>
            {sets?.map((set) => (
              <option key={set.setCode} value={set.setCode}>
                {set.setCode.startsWith('cus_') ? '\u2728 ' : ''}{set.setName} ({set.setCode.toUpperCase()})
              </option>
            ))}
          </select>

          <Button
            onClick={() => selectedSet && onGenerate(selectedSet)}
            disabled={!selectedSet || isGenerating}
            className="w-full btn-primary"
          >
            {isGenerating ? (
              <>
                <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                Opening...
              </>
            ) : (
              <>
                <Package className="w-5 h-5 mr-2" />
                Open 6 Boosters
              </>
            )}
          </Button>

          {generateError && (
            <p className="text-red-400 mt-3 text-center text-sm">
              {generateError}
            </p>
          )}
        </>
      )}
    </div>
  )
}
