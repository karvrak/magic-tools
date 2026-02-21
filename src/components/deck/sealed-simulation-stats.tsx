'use client'

import { useState, useCallback } from 'react'
import {
  FlaskConical,
  RefreshCw,
  Mountain,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Target,
  Palette,
  Layers,
  Hand,
  X,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { runSealedSimulation } from '@/lib/sealed-simulation'

interface BoosterCard {
  id: string
  oracleId: string
  name: string
  printedName: string | null
  manaCost: string | null
  cmc: number
  typeLine: string
  printedTypeLine: string | null
  colors: string[]
  colorIdentity: string[]
  rarity: string
  imageNormal: string | null
  imageLarge: string | null
  imageNormalBack: string | null
  imageLargeBack: string | null
  power: string | null
  toughness: string | null
  loyalty: string | null
  oracleText: string | null
  printedText: string | null
  setCode: string
  setName: string
  layout: string
  slot: string
}

interface SealedSimulationStatsProps {
  deckCards: Array<{ card: BoosterCard; qty: number }>
  basicLands: Record<string, number>
  deckSize: number
}

interface SampleHand {
  cards: string[]
  lands: number
  t1Plays: number
  reason?: string
}

import type { SimulationResult as SimResult, DeckAnalysis } from '@/lib/sealed-simulation'

interface MergedSimulation extends SimResult {
  colorSources: Record<string, number>
  colorNeeds: Record<string, number>
  colorRatios: Record<string, number>
  landBreakdown: Record<string, number>
}

const ITERATIONS = 10000

const COLOR_STYLES: Record<string, { bg: string; text: string; name: string }> = {
  W: { bg: 'bg-amber-100', text: 'text-amber-900', name: 'White' },
  U: { bg: 'bg-blue-500', text: 'text-white', name: 'Blue' },
  B: { bg: 'bg-zinc-800', text: 'text-white', name: 'Black' },
  R: { bg: 'bg-red-500', text: 'text-white', name: 'Red' },
  G: { bg: 'bg-green-600', text: 'text-white', name: 'Green' },
  C: { bg: 'bg-gray-400', text: 'text-gray-900', name: 'Colorless' },
  ANY: { bg: 'bg-gradient-to-r from-amber-400 via-blue-400 to-green-400', text: 'text-white', name: 'Any' },
}

export function SealedSimulationStats({ deckCards, basicLands, deckSize }: SealedSimulationStatsProps) {
  const [simulation, setSimulation] = useState<MergedSimulation | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [showSampleHands, setShowSampleHands] = useState(false)

  const runSim = useCallback(() => {
    setIsRunning(true)
    // Use setTimeout to let React render the loading state first
    setTimeout(() => {
      const { simulation: sim, analysis } = runSealedSimulation(deckCards, basicLands)
      setSimulation({
        ...sim,
        colorSources: analysis.colorSources,
        colorNeeds: analysis.colorNeeds,
        colorRatios: analysis.colorRatios,
        landBreakdown: analysis.landBreakdown,
      })
      setIsRunning(false)
    }, 50)
  }, [deckCards, basicLands])

  if (deckSize < 7) return null

  // No simulation yet and not running
  if (!simulation && !isRunning) {
    return (
      <div className="card-frame p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medieval text-lg text-gold-400 flex items-center gap-2">
            <FlaskConical className="w-5 h-5" />
            Simulateur 10 000 parties
          </h3>
        </div>

        <div className="text-center py-6">
          <p className="text-parchment-400 mb-4">
            Run a 10,000 draw simulation to analyze your deck consistency.
          </p>

          <p className="text-xs text-parchment-500 mb-4">
            Fetchlands, bounce lands, MDFCs, fast/check lands, color fixing
          </p>

          <Button
            onClick={runSim}
            className="gap-2"
          >
            <FlaskConical className="w-4 h-4" />
            Run simulation
          </Button>
        </div>
      </div>
    )
  }

  // Loading state
  if (isRunning) {
    return (
      <div className="card-frame p-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-medieval text-lg text-gold-400 flex items-center gap-2">
            <FlaskConical className="w-5 h-5" />
            Simulateur 10 000 parties
          </h3>
        </div>
        <div className="text-center py-6">
          <FlaskConical className="w-6 h-6 text-arcane-400 mx-auto mb-3 animate-pulse" />
          <p className="text-parchment-400 text-sm mb-3">
            Simulating 10,000 draws...
          </p>
          <div className="max-w-xs mx-auto">
            <div className="h-2 bg-dungeon-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-arcane-500 rounded-full animate-indeterminate-progress"
                style={{
                  width: '40%',
                }}
              />
            </div>
            <p className="text-[10px] text-parchment-600 mt-2">
              Analyzing mana curve, color fixing, and opening hands...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!simulation) return null

  return (
    <div className="card-frame p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="font-medieval text-lg text-gold-400 flex items-center gap-2">
            <FlaskConical className="w-5 h-5" />
            Simulateur 10 000 parties
          </h3>
          <span className="px-2 py-0.5 rounded text-xs bg-arcane-500/20 text-arcane-400">
            Advanced
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={runSim}
          disabled={isRunning}
          className="gap-1.5"
        >
          {isRunning ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          <span className="hidden sm:inline">Rerun</span>
        </Button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Mountain}
          label="Lands in hand"
          value={simulation.avgLandsInHand.toFixed(1)}
          subtext="average over 7 cards"
          color="text-lime-400"
        />
        <StatCard
          icon={Sparkles}
          label="Spells in hand"
          value={simulation.avgNonLandsInHand.toFixed(1)}
          subtext={`Avg CMC: ${simulation.avgCmcInHand.toFixed(1)}`}
          color="text-arcane-400"
        />
        <StatCard
          icon={Target}
          label="Keepable hands"
          value={`${simulation.pctKeepableHands.toFixed(0)}%`}
          subtext="2-4 terrains"
          color="text-gold-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Playable T1"
          value={`${simulation.pctTurn1Play.toFixed(0)}%`}
          subtext={`moy: ${simulation.avgPlayablesTurn1.toFixed(1)} cartes`}
          color="text-green-400"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Playable T2"
          value={`${simulation.pctTurn2Play.toFixed(0)}%`}
          subtext={`moy: ${simulation.avgPlayablesTurn2.toFixed(1)} cartes`}
          color="text-green-400"
          small
        />
        <StatCard
          label="Playable T3"
          value={simulation.avgPlayablesTurn3.toFixed(1)}
          subtext="cards CMC≤3"
          color="text-green-400"
          small
        />
        <StatCard
          icon={TrendingDown}
          label="Mana Screw"
          value={`${simulation.pctManaScrew.toFixed(0)}%`}
          subtext="0-1 terrains"
          color="text-dragon-400"
          small
        />
        <StatCard
          label="Mana Flood"
          value={`${simulation.pctManaFlood.toFixed(0)}%`}
          subtext="5+ terrains"
          color="text-blue-400"
          small
        />
      </div>

      {/* Mana Availability */}
      {simulation.avgManaAvailableT1 !== undefined && (
        <div className="p-3 rounded-lg bg-dungeon-800 border border-dungeon-600">
          <div className="flex items-center gap-2 text-parchment-400 text-sm mb-2">
            <Layers className="w-4 h-4" />
            Actual mana available (after tapped lands)
          </div>
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-lg font-bold text-parchment-200">{simulation.avgManaAvailableT1?.toFixed(1)}</p>
              <p className="text-[10px] text-parchment-500">T1</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-parchment-200">{simulation.avgManaAvailableT2?.toFixed(1)}</p>
              <p className="text-[10px] text-parchment-500">T2</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-parchment-200">{simulation.avgManaAvailableT3?.toFixed(1)}</p>
              <p className="text-[10px] text-parchment-500">T3</p>
            </div>
          </div>
        </div>
      )}

      {/* Color Fixing Analysis */}
      {simulation.colorSources && simulation.colorNeeds && (
        <div className="p-3 rounded-lg bg-dungeon-800 border border-dungeon-600">
          <div className="flex items-center gap-2 text-parchment-400 text-sm mb-3">
            <Palette className="w-4 h-4" />
            Color Fixing Analysis
          </div>

          <div className="space-y-2">
            {(['W', 'U', 'B', 'R', 'G'] as const).map(color => {
              const sources = (simulation.colorSources?.[color] || 0) + (simulation.colorSources?.ANY || 0) * 0.5
              const needs = simulation.colorNeeds?.[color] || 0
              const ratio = simulation.colorRatios?.[color]

              if (needs === 0) return null

              const isGood = ratio !== undefined && ratio >= 0.4
              const isBad = ratio !== undefined && ratio < 0.3

              return (
                <div key={color} className="flex items-center gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    COLOR_STYLES[color].bg,
                    COLOR_STYLES[color].text
                  )}>
                    {color}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-parchment-400">
                        {sources.toFixed(0)} sources / {needs.toFixed(0)} symbols
                      </span>
                      <span className={cn(
                        "font-medium",
                        isGood ? "text-green-400" : isBad ? "text-dragon-400" : "text-gold-400"
                      )}>
                        {ratio !== undefined ? `${(ratio * 100).toFixed(0)}%` : '-'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-dungeon-700 rounded-full mt-1">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          isGood ? "bg-green-500" : isBad ? "bg-dragon-500" : "bg-gold-500"
                        )}
                        style={{ width: `${Math.min((ratio || 0) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Color fix success rates */}
          {simulation.pctColorFixedT1 !== undefined && (
            <div className="mt-3 pt-3 border-t border-dungeon-600">
              <p className="text-xs text-parchment-500 mb-2">% hands with correct colors</p>
              <div className="flex gap-4">
                <div>
                  <span className="text-sm font-medium text-parchment-200">T1: </span>
                  <span className={cn(
                    "text-sm",
                    (simulation.pctColorFixedT1 || 0) >= 90 ? "text-green-400" : "text-gold-400"
                  )}>
                    {simulation.pctColorFixedT1?.toFixed(0)}%
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-parchment-200">T2: </span>
                  <span className={cn(
                    "text-sm",
                    (simulation.pctColorFixedT2 || 0) >= 90 ? "text-green-400" : "text-gold-400"
                  )}>
                    {simulation.pctColorFixedT2?.toFixed(0)}%
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-parchment-200">T3: </span>
                  <span className={cn(
                    "text-sm",
                    (simulation.pctColorFixedT3 || 0) >= 90 ? "text-green-400" : "text-gold-400"
                  )}>
                    {simulation.pctColorFixedT3?.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Land Breakdown */}
      {simulation.landBreakdown && (
        <div className="p-3 rounded-lg bg-dungeon-800 border border-dungeon-600">
          <div className="flex items-center gap-2 text-parchment-400 text-sm mb-2">
            <Mountain className="w-4 h-4" />
            Land breakdown
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(simulation.landBreakdown).map(([type, count]) => {
              if (count === 0) return null
              const labels: Record<string, string> = {
                basics: 'Basic',
                fetches: 'Fetch',
                shocks: 'Shock',
                checks: 'Check',
                fasts: 'Fast',
                taplands: 'Tapland',
                mdfc: 'MDFC',
                bouncelands: 'Bounce',
                other: 'Other'
              }
              return (
                <span
                  key={type}
                  className="px-2 py-1 rounded bg-dungeon-700 text-xs text-parchment-300"
                >
                  {labels[type] || type}: <span className="font-medium text-parchment-100">{count}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Lands Distribution Chart */}
      <div>
        <p className="text-sm text-parchment-400 mb-2">Land distribution (opening hand)</p>
        <div className="flex gap-1 items-end" style={{ height: '64px' }}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((lands) => {
            const count = Number(simulation.landsDistribution[lands] || 0)
            const percentage = (count / ITERATIONS) * 100
            const heightPx = Math.max((percentage / 40) * 64, 2)

            return (
              <div key={lands} className="flex-1 flex flex-col items-center justify-end h-full">
                <div
                  className={cn(
                    "w-full rounded-t transition-all",
                    lands >= 2 && lands <= 4
                      ? "bg-green-500"
                      : lands <= 1
                        ? "bg-dragon-500"
                        : "bg-blue-500"
                  )}
                  style={{ height: `${heightPx}px` }}
                  title={`${lands} terrains: ${percentage.toFixed(1)}% (${count})`}
                />
              </div>
            )
          })}
        </div>
        <div className="flex gap-1 mt-1">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((lands) => (
            <div key={lands} className="flex-1 text-center text-[10px] text-parchment-500">
              {lands}{lands === 7 ? '+' : ''}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-parchment-600">
          <span>Screw</span>
          <span>Optimal</span>
          <span>Flood</span>
        </div>
      </div>

      {/* Sample Hands */}
      {(simulation.sampleKeepHands?.length || simulation.sampleMulliganHands?.length) && (
        <div>
          <button
            onClick={() => setShowSampleHands(!showSampleHands)}
            className="flex items-center gap-2 text-sm text-parchment-400 hover:text-parchment-200 transition-colors"
          >
            <Hand className="w-4 h-4" />
            {showSampleHands ? 'Hide' : 'Show'} sample hands
          </button>

          {showSampleHands && (
            <div className="mt-3 space-y-3">
              {/* Keepable hands */}
              {simulation.sampleKeepHands && simulation.sampleKeepHands.length > 0 && (
                <div>
                  <p className="text-xs text-green-400 flex items-center gap-1 mb-2">
                    <Check className="w-3 h-3" /> Sample keepable hands
                  </p>
                  <div className="space-y-2">
                    {simulation.sampleKeepHands.map((hand, idx) => (
                      <div key={idx} className="p-2 rounded bg-green-500/10 border border-green-500/20">
                        <div className="flex flex-wrap gap-1">
                          {hand.cards.map((card, cidx) => (
                            <span
                              key={cidx}
                              className="px-1.5 py-0.5 rounded bg-dungeon-700 text-[10px] text-parchment-300"
                            >
                              {card}
                            </span>
                          ))}
                        </div>
                        <p className="text-[10px] text-parchment-500 mt-1">
                          {hand.lands} lands {'\u2022'} {hand.t1Plays} T1 playable(s)
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mulligan hands */}
              {simulation.sampleMulliganHands && simulation.sampleMulliganHands.length > 0 && (
                <div>
                  <p className="text-xs text-dragon-400 flex items-center gap-1 mb-2">
                    <X className="w-3 h-3" /> Sample mulligan hands
                  </p>
                  <div className="space-y-2">
                    {simulation.sampleMulliganHands.map((hand, idx) => (
                      <div key={idx} className="p-2 rounded bg-dragon-500/10 border border-dragon-500/20">
                        <div className="flex flex-wrap gap-1">
                          {hand.cards.map((card, cidx) => (
                            <span
                              key={cidx}
                              className="px-1.5 py-0.5 rounded bg-dungeon-700 text-[10px] text-parchment-300"
                            >
                              {card}
                            </span>
                          ))}
                        </div>
                        <p className="text-[10px] text-parchment-500 mt-1">
                          {hand.lands} lands {'\u2022'} Reason: {
                            hand.reason === 'screw' ? 'Mana screw' :
                            hand.reason === 'flood' ? 'Mana flood' :
                            hand.reason === 'no_colors' ? 'Wrong colors' :
                            'No T1-2 plays'
                          }
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface StatCardProps {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  value: string
  subtext: string
  color: string
  small?: boolean
}

function StatCard({ icon: Icon, label, value, subtext, color, small }: StatCardProps) {
  return (
    <div className={cn(
      "p-3 rounded-lg bg-dungeon-800 border border-dungeon-600",
      small && "p-2"
    )}>
      <div className="flex items-center gap-1.5 text-parchment-400 text-xs mb-1">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span className="truncate">{label}</span>
      </div>
      <p className={cn("font-bold", color, small ? "text-lg" : "text-xl")}>{value}</p>
      <p className="text-[10px] text-parchment-600 truncate">{subtext}</p>
    </div>
  )
}
