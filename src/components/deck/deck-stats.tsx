'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

interface DeckCard {
  quantity: number
  card: {
    cmc: number
    typeLine: string
    manaCost?: string | null
  }
}

// Mana colors with their MTG-style colors
const MANA_COLORS = [
  { key: 'W', label: 'White', color: '#f9fafb', bgColor: '#fef3c7', barColor: '#fbbf24' },
  { key: 'U', label: 'Blue', color: '#3b82f6', bgColor: '#dbeafe', barColor: '#3b82f6' },
  { key: 'B', label: 'Black', color: '#1f2937', bgColor: '#374151', barColor: '#a855f7' },
  { key: 'R', label: 'Red', color: '#ef4444', bgColor: '#fecaca', barColor: '#ef4444' },
  { key: 'G', label: 'Green', color: '#22c55e', bgColor: '#bbf7d0', barColor: '#22c55e' },
  { key: 'C', label: 'Colorless', color: '#6b7280', bgColor: '#4b5563', barColor: '#9ca3af' },
] as const

// Parse mana symbols from a mana cost string and count by color
function parseDevotionFromManaCost(manaCost: string | null | undefined): Record<string, number> {
  const devotion: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
  if (!manaCost) return devotion
  
  // Match all mana symbols like {W}, {U}, {B}, {R}, {G}, {C}, {W/U}, {2/W}, etc.
  const symbols = manaCost.match(/\{[^}]+\}/g) || []
  
  for (const symbol of symbols) {
    const inner = symbol.replace(/[{}]/g, '')
    
    // Check for colorless mana symbol {C}
    if (inner === 'C') {
      devotion['C']++
      continue
    }
    
    // Check for each color in the symbol (handles hybrid mana like {W/U})
    for (const color of ['W', 'U', 'B', 'R', 'G']) {
      if (inner.includes(color)) {
        devotion[color]++
      }
    }
  }
  
  return devotion
}

interface DeckStatsProps {
  cards: DeckCard[]
}

// Card type categories with colors
const TYPE_CATEGORIES = [
  { key: 'creature', label: 'Creatures', color: '#22c55e' }, // green
  { key: 'instant', label: 'Instants', color: '#3b82f6' }, // blue
  { key: 'sorcery', label: 'Sorceries', color: '#ef4444' }, // red
  { key: 'artifact', label: 'Artifacts', color: '#9ca3af' }, // gray
  { key: 'enchantment', label: 'Enchantments', color: '#a855f7' }, // purple
  { key: 'planeswalker', label: 'Planeswalkers', color: '#f59e0b' }, // amber
  { key: 'land', label: 'Lands', color: '#84cc16' }, // lime
  { key: 'other', label: 'Other', color: '#6b7280' }, // gray
]

function getCardTypeCategory(typeLine: string): string {
  const lowerType = typeLine.toLowerCase()
  
  // Priority: creature > planeswalker > land > instant > sorcery > artifact > enchantment
  // Dual types are classified by their "main" type:
  // - Artifact Land -> Land (not Artifact)
  // - Enchantment Creature -> Creature (not Enchantment)
  // - Land Creature -> Creature
  if (lowerType.includes('creature')) return 'creature'
  if (lowerType.includes('planeswalker')) return 'planeswalker'
  if (lowerType.includes('land')) return 'land'
  if (lowerType.includes('instant')) return 'instant'
  if (lowerType.includes('sorcery')) return 'sorcery'
  if (lowerType.includes('artifact')) return 'artifact'
  if (lowerType.includes('enchantment')) return 'enchantment'
  
  return 'other'
}

// Custom tooltip for bar chart
function CMCTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-dungeon-800 border border-dungeon-600 rounded px-3 py-2 shadow-lg">
        <p className="text-parchment-200">
          <span className="text-gold-400">CMC {label}:</span> {payload[0].value} cards
        </p>
      </div>
    )
  }
  return null
}

// Custom tooltip for pie chart
function TypeTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { percent: number } }> }) {
  if (active && payload && payload.length) {
    const data = payload[0]
    return (
      <div className="bg-dungeon-800 border border-dungeon-600 rounded px-3 py-2 shadow-lg">
        <p className="text-parchment-200">
          <span className="text-gold-400">{data.name}:</span> {data.value} cards ({(data.payload.percent * 100).toFixed(0)}%)
        </p>
      </div>
    )
  }
  return null
}

export function DeckStats({ cards }: DeckStatsProps) {
  // Calculate CMC distribution (excluding lands)
  const cmcData: Record<number, number> = {}
  const typeData: Record<string, number> = {}
  const devotionData: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
  
  for (const dc of cards) {
    const typeCategory = getCardTypeCategory(dc.card.typeLine)
    
    // Count types
    typeData[typeCategory] = (typeData[typeCategory] || 0) + dc.quantity
    
    // Count CMC (exclude lands)
    if (typeCategory !== 'land') {
      const cmc = Math.floor(dc.card.cmc)
      const cmcKey = cmc >= 7 ? 7 : cmc // Group 7+ together
      cmcData[cmcKey] = (cmcData[cmcKey] || 0) + dc.quantity
    }
    
    // Count devotion (from all cards with mana cost)
    const cardDevotion = parseDevotionFromManaCost(dc.card.manaCost)
    for (const color of ['W', 'U', 'B', 'R', 'G', 'C']) {
      devotionData[color] += cardDevotion[color] * dc.quantity
    }
  }
  
  // Format CMC data for chart
  const cmcChartData = []
  for (let i = 0; i <= 7; i++) {
    cmcChartData.push({
      cmc: i === 7 ? '7+' : i.toString(),
      count: cmcData[i] || 0,
    })
  }
  
  // Format type data for pie chart
  const typeChartData = TYPE_CATEGORIES
    .map((cat) => ({
      name: cat.label,
      value: typeData[cat.key] || 0,
      color: cat.color,
    }))
    .filter((d) => d.value > 0)
  
  // Calculate totals
  const totalNonLand = Object.entries(typeData)
    .filter(([key]) => key !== 'land')
    .reduce((sum, [, count]) => sum + count, 0)
  
  const totalCards = Object.values(typeData).reduce((sum, count) => sum + count, 0)
  
  // Calculate average CMC (excluding lands)
  const avgCMC = totalNonLand > 0
    ? cards
        .filter((dc) => getCardTypeCategory(dc.card.typeLine) !== 'land')
        .reduce((sum, dc) => sum + dc.card.cmc * dc.quantity, 0) / totalNonLand
    : 0

  // Calculate total devotion and max for scaling
  const totalDevotion = Object.values(devotionData).reduce((sum, val) => sum + val, 0)
  const maxDevotion = Math.max(...Object.values(devotionData), 1)

  if (totalCards === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Devotion by Color */}
      {totalDevotion > 0 && (
        <div className="card-frame p-4">
          <h3 className="font-medieval text-lg text-gold-400 mb-2">Devotion</h3>
          <p className="text-sm text-parchment-400 mb-4">
            Total mana symbols: <span className="text-gold-400 font-semibold">{totalDevotion}</span>
          </p>
          
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {MANA_COLORS.map(({ key, label, color, bgColor, barColor }) => {
              const value = devotionData[key]
              const percentage = maxDevotion > 0 ? (value / maxDevotion) * 100 : 0
              
              return (
                <div key={key} className="text-center">
                  {/* Mana symbol circle */}
                  <div 
                    className="w-10 h-10 mx-auto rounded-full flex items-center justify-center font-bold text-lg shadow-md border-2"
                    style={{ 
                      backgroundColor: bgColor,
                      color: key === 'W' ? '#92400e' : key === 'B' || key === 'C' ? '#f9fafb' : color,
                      borderColor: key === 'B' || key === 'C' ? '#6b7280' : 'transparent',
                    }}
                  >
                    {key}
                  </div>
                  
                  {/* Value */}
                  <p className="mt-2 text-xl font-bold text-parchment-200">{value}</p>
                  <p className="text-xs text-parchment-500">{label}</p>
                  
                  {/* Bar indicator */}
                  <div className="mt-2 h-1.5 bg-dungeon-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
      {/* CMC Histogram */}
      <div className="card-frame p-4">
        <h3 className="font-medieval text-lg text-gold-400 mb-2">Mana Curve</h3>
        <p className="text-sm text-parchment-400 mb-4">
          Average CMC: <span className="text-gold-400 font-semibold">{avgCMC.toFixed(2)}</span>
          <span className="text-dungeon-400 ml-2">({totalNonLand} non-land cards)</span>
        </p>
        
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={cmcChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis 
                dataKey="cmc" 
                tick={{ fill: '#a8a29e', fontSize: 12 }}
                axisLine={{ stroke: '#44403c' }}
                tickLine={{ stroke: '#44403c' }}
              />
              <YAxis 
                tick={{ fill: '#a8a29e', fontSize: 12 }}
                axisLine={{ stroke: '#44403c' }}
                tickLine={{ stroke: '#44403c' }}
                allowDecimals={false}
              />
              <Tooltip content={<CMCTooltip />} />
              <Bar 
                dataKey="count" 
                fill="#d4af37"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Type Distribution Pie Chart */}
      <div className="card-frame p-4">
        <h3 className="font-medieval text-lg text-gold-400 mb-2">Card Types</h3>
        <p className="text-sm text-parchment-400 mb-4">
          Total: <span className="text-gold-400 font-semibold">{totalCards}</span> cards
        </p>
        
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie
                data={typeChartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                label={({ percent }) => 
                  percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                }
                labelLine={false}
              >
                {typeChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<TypeTooltip />} />
              <Legend 
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconType="circle"
                iconSize={10}
                formatter={(value) => (
                  <span className="text-parchment-300 text-sm">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      </div>
    </div>
  )
}
