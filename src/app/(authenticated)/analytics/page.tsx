'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  TrendingUp,
  TrendingDown,
  Coins,
  Layers,
  Hash,
  RefreshCw,
  BarChart3,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { useActiveOwner } from '@/contexts/active-owner'
import { useToast } from '@/hooks/use-toast'
import { formatPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface AnalyticsData {
  valueEvolution: { date: string; value: number; cards: number }[]
  rarityDistribution: Record<string, number>
  topSets: { code: string; name: string; count: number; value: number }[]
  kpi: {
    totalValue: number
    totalCards: number
    avgValue: number
    uniqueCards: number
  }
}

const RARITY_COLORS: Record<string, string> = {
  common: '#94a3b8',
  uncommon: '#d4d4d8',
  rare: '#fbbf24',
  mythic: '#ef4444',
}

const RARITY_LABELS: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  mythic: 'Mythic',
}

export default function AnalyticsPage() {
  const { activeOwner } = useActiveOwner()
  const { toast } = useToast()
  const [days, setDays] = useState(90)

  const { data, isLoading, refetch } = useQuery<AnalyticsData>({
    queryKey: ['analytics', activeOwner?.id, days],
    queryFn: async () => {
      const params = new URLSearchParams({ days: days.toString() })
      if (activeOwner?.id) params.set('ownerId', activeOwner.id)
      const response = await fetch(`/api/analytics?${params}`)
      if (!response.ok) throw new Error('Failed to fetch analytics')
      return response.json()
    },
  })

  const snapshotMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/analytics/snapshot', { method: 'POST' })
      if (!response.ok) throw new Error('Failed to generate snapshot')
      return response.json()
    },
    onSuccess: (result) => {
      toast({
        title: 'Snapshot generated',
        description: `${result.snapshots} snapshots created.`,
      })
      refetch()
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Could not generate snapshot.',
        variant: 'destructive',
      })
    },
  })

  const pieData = data
    ? Object.entries(data.rarityDistribution)
        .filter(([, count]) => count > 0)
        .map(([rarity, count]) => ({
          name: RARITY_LABELS[rarity] || rarity,
          value: count,
          fill: RARITY_COLORS[rarity] || '#666',
        }))
    : []

  const valueChartData = data?.valueEvolution.map((s) => ({
    date: new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    value: Math.round(s.value * 100) / 100,
    cards: s.cards,
  })) || []

  const valueTrend = valueChartData.length >= 2
    ? valueChartData[valueChartData.length - 1].value - valueChartData[0].value
    : 0

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display text-gold-400 flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Analytics
          </h1>
          <p className="text-sm text-parchment-500 mt-1">
            Collection insights
            {activeOwner && (
              <span style={{ color: activeOwner.color }}> - {activeOwner.name}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex rounded-lg border border-dungeon-600 overflow-hidden">
            {[30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  'px-3 py-1.5 text-xs transition-colors',
                  days === d
                    ? 'bg-gold-600/20 text-gold-400'
                    : 'text-parchment-500 hover:bg-dungeon-700'
                )}
              >
                {d}d
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => snapshotMutation.mutate()}
            disabled={snapshotMutation.isPending}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', snapshotMutation.isPending && 'animate-spin')} />
            Snapshot
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-gold-500 animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <KpiCard
              label="Total Value"
              value={formatPrice(data.kpi.totalValue)}
              icon={<Coins className="w-5 h-5 text-gold-400" />}
              trend={valueTrend}
            />
            <KpiCard
              label="Total Cards"
              value={data.kpi.totalCards.toLocaleString('fr-FR')}
              icon={<Layers className="w-5 h-5 text-arcane-400" />}
            />
            <KpiCard
              label="Avg. Value"
              value={formatPrice(data.kpi.avgValue)}
              icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
            />
            <KpiCard
              label="Unique Cards"
              value={data.kpi.uniqueCards.toLocaleString('fr-FR')}
              icon={<Hash className="w-5 h-5 text-blue-400" />}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Value Evolution - takes 2 cols */}
            <div className="lg:col-span-2 bg-dungeon-800 border border-dungeon-600 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-parchment-300 mb-4">
                Value Evolution ({days} days)
              </h2>
              {valueChartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={valueChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      tickFormatter={(v: number) => `${Math.round(v)}€`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: '#e2e8f0' }}
                      formatter={(value) => [`${Number(value).toFixed(2)} €`, 'Value']}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#D4AF37"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#D4AF37' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-parchment-500 text-sm">
                  Not enough data yet. Generate snapshots daily to see the evolution.
                </div>
              )}
            </div>

            {/* Rarity Distribution - Donut */}
            <div className="bg-dungeon-800 border border-dungeon-600 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-parchment-300 mb-4">
                Rarity Distribution
              </h2>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: 8,
                        }}
                        formatter={(value) => [Number(value).toLocaleString('fr-FR'), 'Cards']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {pieData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: entry.fill }}
                        />
                        <span className="text-xs text-parchment-400">
                          {entry.name} ({entry.value.toLocaleString('fr-FR')})
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-parchment-500 text-sm">
                  No collection data.
                </div>
              )}
            </div>
          </div>

          {/* Top Sets - Horizontal Bar Chart */}
          <div className="bg-dungeon-800 border border-dungeon-600 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-parchment-300 mb-4">
              Top 15 Sets (by card count)
            </h2>
            {data.topSets.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(300, data.topSets.length * 32)}>
                <BarChart
                  data={data.topSets}
                  layout="vertical"
                  margin={{ left: 80, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="code"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    width={70}
                    tickFormatter={(v: string) => v.toUpperCase()}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 8,
                    }}
                    formatter={(value, name) => [
                      name === 'count'
                        ? `${value} cards`
                        : `${Number(value).toFixed(2)} €`,
                      name === 'count' ? 'Cards' : 'Value',
                    ]}
                    labelFormatter={(label: string) => {
                      const set = data.topSets.find((s) => s.code === label)
                      return set?.name || label
                    }}
                  />
                  <Bar dataKey="count" fill="#D4AF37" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-parchment-500 text-sm">
                No collection data.
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-parchment-500">
          Failed to load analytics data.
        </div>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon,
  trend,
}: {
  label: string
  value: string
  icon: React.ReactNode
  trend?: number
}) {
  return (
    <div className="bg-dungeon-800 border border-dungeon-600 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        {icon}
        {trend !== undefined && trend !== 0 && (
          <span className={cn(
            'flex items-center gap-0.5 text-xs',
            trend > 0 ? 'text-emerald-400' : 'text-red-400'
          )}>
            {trend > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {trend > 0 ? '+' : ''}{formatPrice(trend)}
          </span>
        )}
      </div>
      <p className="text-xl font-bold text-parchment-200">{value}</p>
      <p className="text-xs text-parchment-500 mt-1">{label}</p>
    </div>
  )
}
