'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts'
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Target,
  Flame,
  Snowflake,
  Swords,
  Crown,
  Medal,
  Calendar,
  Users,
  Loader2,
  ChevronLeft,
  Search,
  ArrowUp,
  ArrowDown,
  Minus,
  Zap,
  Shield,
  Skull,
} from 'lucide-react'
import Link from 'next/link'

interface DeckStats {
  name: string
  deckId: string | null
  totalMatches: number
  wins: number
  losses: number
  draws: number
  winRate: number
  gamesWon: number
  gamesLost: number
  gameWinRate: number
  currentStreak: number
  bestWinStreak: number
  worstLoseStreak: number
  recentForm: ('W' | 'L' | 'D')[]
  recentWinRate: number
  bestMatchup: { opponent: string; winRate: number; matches: number } | null
  worstMatchup: { opponent: string; winRate: number; matches: number } | null
}

interface MatchupStats {
  deck1: string
  deck2: string
  deck1Wins: number
  deck2Wins: number
  draws: number
  totalMatches: number
  deck1WinRate: number
}

interface TimelineEntry {
  month: string
  matches: number
  wins: number
  winRate: number
  avgGames: number
}

interface StatsData {
  totalMatches: number
  totalGames: number
  uniqueDecks: number
  deckStats: DeckStats[]
  matchups: MatchupStats[]
  timeline: TimelineEntry[]
  globalStats: {
    avgGamesPerMatch: number
    sweepRate: number
    comebackRate: number
    deck1WinRate: number
    mostPlayedDay: string
    longestSession: number
    longestSessionDate: string | null
    mostCommonOpponent: { name: string; matches: number } | null
    topRivalry: { deck1: string; deck2: string; matches: number } | null
  }
}

const COLORS = [
  '#D4AF37', // gold
  '#8B5CF6', // arcane
  '#22C55E', // nature
  '#EF4444', // dragon
  '#3B82F6', // blue
  '#EC4899', // pink
  '#F97316', // orange
  '#14B8A6', // teal
]

export default function MatchStatsPage() {
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null)
  const [deckSearch, setDeckSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'decks' | 'matchups' | 'timeline'>('overview')

  const { data, isLoading } = useQuery({
    queryKey: ['match-stats'],
    queryFn: async () => {
      const res = await fetch('/api/matches/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json() as Promise<StatsData>
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-dungeon-900 via-dungeon-800 to-dungeon-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-gold-400 animate-spin" />
      </div>
    )
  }

  if (!data || data.totalMatches === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-dungeon-900 via-dungeon-800 to-dungeon-900">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Link
            href="/matches"
            className="inline-flex items-center gap-2 text-parchment-400 hover:text-gold-400 mb-8"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to matches
          </Link>
          <div className="text-center py-16">
            <Swords className="w-16 h-16 mx-auto mb-4 text-parchment-600" />
            <h1 className="text-2xl font-cinzel text-parchment-300">No data</h1>
            <p className="text-parchment-500 mt-2">Import matches to see statistics</p>
          </div>
        </div>
      </div>
    )
  }

  const topDecks = data.deckStats
    .filter(d => d.totalMatches >= 10)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 10)

  const mostPlayedDecks = data.deckStats
    .sort((a, b) => b.totalMatches - a.totalMatches)
    .slice(0, 10)

  const filteredDecks = data.deckStats.filter(d =>
    d.name.toLowerCase().includes(deckSearch.toLowerCase())
  )

  const selectedDeckData = selectedDeck
    ? data.deckStats.find(d => d.name === selectedDeck)
    : null

  // Data for winrate distribution pie chart
  const winRateDistribution = [
    { name: '> 60%', value: data.deckStats.filter(d => d.totalMatches >= 5 && d.winRate > 60).length, color: '#22C55E' },
    { name: '50-60%', value: data.deckStats.filter(d => d.totalMatches >= 5 && d.winRate >= 50 && d.winRate <= 60).length, color: '#D4AF37' },
    { name: '< 50%', value: data.deckStats.filter(d => d.totalMatches >= 5 && d.winRate < 50).length, color: '#EF4444' },
  ].filter(d => d.value > 0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-dungeon-900 via-dungeon-800 to-dungeon-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/matches"
              className="inline-flex items-center gap-2 text-parchment-400 hover:text-gold-400 mb-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to matches
            </Link>
            <h1 className="text-3xl font-cinzel font-bold text-gold-400">
              Statistics
            </h1>
          </div>
        </div>

        {/* Global Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <StatCard
            icon={<Swords className="w-6 h-6" />}
            label="Matches"
            value={data.totalMatches.toLocaleString()}
            color="gold"
          />
          <StatCard
            icon={<Target className="w-6 h-6" />}
            label="Games"
            value={data.totalGames.toLocaleString()}
            color="arcane"
          />
          <StatCard
            icon={<Users className="w-6 h-6" />}
            label="Unique Decks"
            value={data.uniqueDecks}
            color="nature"
          />
          <StatCard
            icon={<Trophy className="w-6 h-6" />}
            label="Win Rate"
            value={`${data.globalStats.deck1WinRate.toFixed(1)}%`}
            color={data.globalStats.deck1WinRate >= 50 ? 'nature' : 'dragon'}
          />
          <StatCard
            icon={<Zap className="w-6 h-6" />}
            label="Sweeps"
            value={`${data.globalStats.sweepRate.toFixed(1)}%`}
            color="gold"
          />
          <StatCard
            icon={<Shield className="w-6 h-6" />}
            label="Comebacks"
            value={`${data.globalStats.comebackRate.toFixed(1)}%`}
            color="arcane"
          />
        </div>

        {/* Fun Facts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {data.globalStats.mostCommonOpponent && (
            <div className="bg-dungeon-800/80 border border-dungeon-700 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-dragon-600/20 rounded-lg">
                  <Skull className="w-5 h-5 text-dragon-400" />
                </div>
                <div>
                  <p className="text-parchment-500 text-sm">Nemesis</p>
                  <p className="text-parchment-200 font-medium">{data.globalStats.mostCommonOpponent.name}</p>
                  <p className="text-parchment-500 text-xs">{data.globalStats.mostCommonOpponent.matches} encounters</p>
                </div>
              </div>
            </div>
          )}
          {data.globalStats.topRivalry && (
            <div className="bg-dungeon-800/80 border border-dungeon-700 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gold-600/20 rounded-lg">
                  <Flame className="w-5 h-5 text-gold-400" />
                </div>
                <div>
                  <p className="text-parchment-500 text-sm">Legendary Rivalry</p>
                  <p className="text-parchment-200 font-medium text-sm">
                    {data.globalStats.topRivalry.deck1} vs {data.globalStats.topRivalry.deck2}
                  </p>
                  <p className="text-parchment-500 text-xs">{data.globalStats.topRivalry.matches} battles</p>
                </div>
              </div>
            </div>
          )}
          <div className="bg-dungeon-800/80 border border-dungeon-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-nature-600/20 rounded-lg">
                <Calendar className="w-5 h-5 text-nature-400" />
              </div>
              <div>
                <p className="text-parchment-500 text-sm">Favorite Day</p>
                <p className="text-parchment-200 font-medium">{data.globalStats.mostPlayedDay}</p>
                <p className="text-parchment-500 text-xs">
                  Record: {data.globalStats.longestSession} matches in 1 day
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-dungeon-700 pb-2">
          {(['overview', 'decks', 'matchups', 'timeline'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-dungeon-700 text-gold-400'
                  : 'text-parchment-500 hover:text-parchment-300'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'decks' && 'Decks'}
              {tab === 'matchups' && 'Matchups'}
              {tab === 'timeline' && 'Timeline'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {/* Top Win Rates */}
              <div className="bg-dungeon-800/80 border border-dungeon-700 rounded-xl p-6">
                <h3 className="text-lg font-cinzel text-gold-400 mb-4 flex items-center gap-2">
                  <Crown className="w-5 h-5" />
                  Best Win Rates (min 10 matches)
                </h3>
                <div className="space-y-3">
                  {topDecks.map((deck, i) => (
                    <div key={deck.name} className="flex items-center gap-3">
                      <span className={`text-lg font-bold w-8 ${
                        i === 0 ? 'text-gold-400' : i === 1 ? 'text-parchment-400' : i === 2 ? 'text-orange-400' : 'text-parchment-600'
                      }`}>
                        #{i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-parchment-200 truncate">{deck.name}</p>
                        <div className="flex items-center gap-2 text-xs text-parchment-500">
                          <span>{deck.wins}W - {deck.losses}L</span>
                          <span>({deck.totalMatches} matches)</span>
                        </div>
                      </div>
                      <span className={`font-bold ${
                        deck.winRate >= 60 ? 'text-nature-400' : deck.winRate >= 50 ? 'text-gold-400' : 'text-dragon-400'
                      }`}>
                        {deck.winRate.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Most Played */}
              <div className="bg-dungeon-800/80 border border-dungeon-700 rounded-xl p-6">
                <h3 className="text-lg font-cinzel text-gold-400 mb-4 flex items-center gap-2">
                  <Medal className="w-5 h-5" />
                  Most Played
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mostPlayedDecks} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" stroke="#9CA3AF" />
                    <YAxis type="category" dataKey="name" width={120} stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                      labelStyle={{ color: '#D4AF37' }}
                    />
                    <Bar dataKey="totalMatches" fill="#D4AF37" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Win Rate Distribution */}
              <div className="bg-dungeon-800/80 border border-dungeon-700 rounded-xl p-6">
                <h3 className="text-lg font-cinzel text-gold-400 mb-4">
                  Win Rate Distribution
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={winRateDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {winRateDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Hot & Cold Streaks */}
              <div className="bg-dungeon-800/80 border border-dungeon-700 rounded-xl p-6">
                <h3 className="text-lg font-cinzel text-gold-400 mb-4">
                  Memorable Streaks
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-nature-400 mb-2">
                      <Flame className="w-4 h-4" />
                      <span className="text-sm font-medium">Best win streaks</span>
                    </div>
                    <div className="space-y-2">
                      {data.deckStats
                        .filter(d => d.bestWinStreak >= 3)
                        .sort((a, b) => b.bestWinStreak - a.bestWinStreak)
                        .slice(0, 5)
                        .map(deck => (
                          <div key={deck.name} className="flex items-center justify-between text-sm">
                            <span className="text-parchment-300">{deck.name}</span>
                            <span className="text-nature-400 font-bold">{deck.bestWinStreak} wins</span>
                          </div>
                        ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-dragon-400 mb-2">
                      <Snowflake className="w-4 h-4" />
                      <span className="text-sm font-medium">Worst lose streaks</span>
                    </div>
                    <div className="space-y-2">
                      {data.deckStats
                        .filter(d => d.worstLoseStreak >= 3)
                        .sort((a, b) => b.worstLoseStreak - a.worstLoseStreak)
                        .slice(0, 5)
                        .map(deck => (
                          <div key={deck.name} className="flex items-center justify-between text-sm">
                            <span className="text-parchment-300">{deck.name}</span>
                            <span className="text-dragon-400 font-bold">{deck.worstLoseStreak} losses</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'decks' && (
            <motion.div
              key="decks"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Deck Search */}
              <div className="relative max-w-md mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-parchment-500" />
                <input
                  type="text"
                  value={deckSearch}
                  onChange={(e) => setDeckSearch(e.target.value)}
                  placeholder="Search a deck..."
                  className="w-full pl-10 pr-4 py-2 bg-dungeon-800 border border-dungeon-600 rounded-lg text-parchment-200 placeholder-parchment-600 focus:outline-none focus:border-gold-500"
                />
              </div>

              {/* Deck Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDecks.slice(0, 30).map(deck => (
                  <motion.div
                    key={deck.name}
                    onClick={() => setSelectedDeck(deck.name === selectedDeck ? null : deck.name)}
                    className={`bg-dungeon-800/80 border rounded-xl p-4 cursor-pointer transition-all ${
                      selectedDeck === deck.name
                        ? 'border-gold-500 ring-1 ring-gold-500/50'
                        : 'border-dungeon-700 hover:border-dungeon-600'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-medium text-parchment-200 truncate flex-1">{deck.name}</h4>
                      <span className={`text-lg font-bold ${
                        deck.winRate >= 60 ? 'text-nature-400' : deck.winRate >= 50 ? 'text-gold-400' : 'text-dragon-400'
                      }`}>
                        {deck.winRate.toFixed(0)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-parchment-500 mb-3">
                      <span>{deck.totalMatches} matches</span>
                      <span className="text-nature-400">{deck.wins}W</span>
                      <span className="text-dragon-400">{deck.losses}L</span>
                    </div>

                    {/* Recent Form */}
                    <div className="flex items-center gap-1">
                      {deck.recentForm.map((result, i) => (
                        <div
                          key={i}
                          className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                            result === 'W'
                              ? 'bg-nature-600/30 text-nature-400'
                              : result === 'L'
                              ? 'bg-dragon-600/30 text-dragon-400'
                              : 'bg-dungeon-600 text-parchment-500'
                          }`}
                        >
                          {result}
                        </div>
                      ))}
                    </div>

                    {/* Current Streak */}
                    {deck.currentStreak !== 0 && (
                      <div className={`mt-2 flex items-center gap-1 text-xs ${
                        deck.currentStreak > 0 ? 'text-nature-400' : 'text-dragon-400'
                      }`}>
                        {deck.currentStreak > 0 ? (
                          <><TrendingUp className="w-3 h-3" /> {deck.currentStreak} wins in a row</>
                        ) : (
                          <><TrendingDown className="w-3 h-3" /> {Math.abs(deck.currentStreak)} losses in a row</>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Selected Deck Details */}
              <AnimatePresence>
                {selectedDeckData && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-6 bg-dungeon-800/80 border border-gold-500/50 rounded-xl p-6"
                  >
                    <h3 className="text-xl font-cinzel text-gold-400 mb-4">{selectedDeckData.name}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="text-center p-3 bg-dungeon-900/50 rounded-lg">
                        <p className="text-2xl font-bold text-parchment-200">{selectedDeckData.totalMatches}</p>
                        <p className="text-xs text-parchment-500">Matches</p>
                      </div>
                      <div className="text-center p-3 bg-dungeon-900/50 rounded-lg">
                        <p className="text-2xl font-bold text-nature-400">{selectedDeckData.wins}</p>
                        <p className="text-xs text-parchment-500">Wins</p>
                      </div>
                      <div className="text-center p-3 bg-dungeon-900/50 rounded-lg">
                        <p className="text-2xl font-bold text-dragon-400">{selectedDeckData.losses}</p>
                        <p className="text-xs text-parchment-500">Losses</p>
                      </div>
                      <div className="text-center p-3 bg-dungeon-900/50 rounded-lg">
                        <p className={`text-2xl font-bold ${
                          selectedDeckData.gameWinRate >= 50 ? 'text-nature-400' : 'text-dragon-400'
                        }`}>
                          {selectedDeckData.gameWinRate.toFixed(1)}%
                        </p>
                        <p className="text-xs text-parchment-500">Game WR</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Best Matchup */}
                      {selectedDeckData.bestMatchup && (
                        <div className="p-4 bg-nature-900/20 border border-nature-700/50 rounded-lg">
                          <div className="flex items-center gap-2 text-nature-400 mb-2">
                            <ArrowUp className="w-4 h-4" />
                            <span className="font-medium">Best matchup</span>
                          </div>
                          <p className="text-parchment-200">{selectedDeckData.bestMatchup.opponent}</p>
                          <p className="text-sm text-parchment-500">
                            {selectedDeckData.bestMatchup.winRate.toFixed(0)}% ({selectedDeckData.bestMatchup.matches} matches)
                          </p>
                        </div>
                      )}

                      {/* Worst Matchup */}
                      {selectedDeckData.worstMatchup && (
                        <div className="p-4 bg-dragon-900/20 border border-dragon-700/50 rounded-lg">
                          <div className="flex items-center gap-2 text-dragon-400 mb-2">
                            <ArrowDown className="w-4 h-4" />
                            <span className="font-medium">Worst matchup</span>
                          </div>
                          <p className="text-parchment-200">{selectedDeckData.worstMatchup.opponent}</p>
                          <p className="text-sm text-parchment-500">
                            {selectedDeckData.worstMatchup.winRate.toFixed(0)}% ({selectedDeckData.worstMatchup.matches} matches)
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === 'matchups' && (
            <motion.div
              key="matchups"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <p className="text-parchment-500 mb-4">Matchups with at least 3 matches</p>
              <div className="space-y-2">
                {data.matchups.map((matchup, i) => (
                  <div
                    key={`${matchup.deck1}-${matchup.deck2}`}
                    className="bg-dungeon-800/80 border border-dungeon-700 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-parchment-600 w-8">#{i + 1}</span>

                      <div className="flex-1 text-right">
                        <span className={`font-medium ${
                          matchup.deck1Wins > matchup.deck2Wins ? 'text-nature-400' : 'text-parchment-300'
                        }`}>
                          {matchup.deck1}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 px-4 min-w-[140px] justify-center">
                        <span className={`text-xl font-bold ${
                          matchup.deck1Wins > matchup.deck2Wins ? 'text-nature-400' : 'text-parchment-500'
                        }`}>
                          {matchup.deck1Wins}
                        </span>
                        <Minus className="w-4 h-4 text-dungeon-500" />
                        <span className={`text-xl font-bold ${
                          matchup.deck2Wins > matchup.deck1Wins ? 'text-nature-400' : 'text-parchment-500'
                        }`}>
                          {matchup.deck2Wins}
                        </span>
                      </div>

                      <div className="flex-1">
                        <span className={`font-medium ${
                          matchup.deck2Wins > matchup.deck1Wins ? 'text-nature-400' : 'text-parchment-300'
                        }`}>
                          {matchup.deck2}
                        </span>
                      </div>

                      <span className="text-parchment-500 text-sm w-20 text-right">
                        {matchup.totalMatches} matches
                      </span>
                    </div>

                    {/* Win Rate Bar */}
                    <div className="mt-2 h-2 bg-dungeon-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-nature-500 to-nature-400 transition-all"
                        style={{ width: `${matchup.deck1WinRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'timeline' && (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Matches over time */}
              <div className="bg-dungeon-800/80 border border-dungeon-700 rounded-xl p-6">
                <h3 className="text-lg font-cinzel text-gold-400 mb-4">Monthly Activity</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                      labelStyle={{ color: '#D4AF37' }}
                    />
                    <Bar dataKey="matches" fill="#D4AF37" name="Matches" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Win Rate over time */}
              <div className="bg-dungeon-800/80 border border-dungeon-700 rounded-xl p-6">
                <h3 className="text-lg font-cinzel text-gold-400 mb-4">Win Rate Evolution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#9CA3AF" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                      labelStyle={{ color: '#D4AF37' }}
                      formatter={(value) => [`${(value as number).toFixed(1)}%`, 'Win Rate']}
                    />
                    <Line
                      type="monotone"
                      dataKey="winRate"
                      stroke="#22C55E"
                      strokeWidth={2}
                      dot={{ fill: '#22C55E', strokeWidth: 0 }}
                    />
                    {/* 50% reference line */}
                    <Line
                      type="monotone"
                      dataKey={() => 50}
                      stroke="#6B7280"
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: 'gold' | 'arcane' | 'nature' | 'dragon'
}) {
  const colorClasses = {
    gold: 'bg-gold-600/20 text-gold-400',
    arcane: 'bg-arcane-600/20 text-arcane-400',
    nature: 'bg-nature-600/20 text-nature-400',
    dragon: 'bg-dragon-600/20 text-dragon-400',
  }

  return (
    <div className="bg-dungeon-800/80 border border-dungeon-700 rounded-xl p-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${colorClasses[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-parchment-200">{value}</p>
      <p className="text-xs text-parchment-500">{label}</p>
    </div>
  )
}
