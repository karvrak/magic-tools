import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { simulateDeckSchema } from '@/lib/validations'

// ============================================
// INTERFACES
// ============================================

interface ManaSource {
  amount: number // How much mana this produces
  colors: string[] // Colors it can produce: ['W', 'U', 'B', 'R', 'G', 'C', 'ANY']
}

interface ColorRequirement {
  generic: number // Generic mana that can be paid with any color
  colored: string[] // Specific color requirements: ['W', 'W', 'U'] for {1}{W}{W}{U}
}

type LandType = 'basic' | 'fetch' | 'shock' | 'check' | 'fast' | 'reveal' | 'bounce' | 'tapland' | 'mdfc' | 'other'

interface SimCard {
  name: string // For sample hands
  cmc: number
  isLand: boolean
  isManaAccelerator: boolean
  isMdfc: boolean // Modal double-faced card (can be land OR spell)
  mdfcLandSide: ManaSource | null // Mana source if played as land
  manaSource: ManaSource | null // null if doesn't produce mana
  colorRequirement: ColorRequirement // What colors are needed to cast this
  entersTapped: boolean // Does this land enter tapped?
  entersTappedConditional: 'always' | 'shock' | 'fast' | 'check' | 'reveal' | 'never' // Type of condition
  isFetchland: boolean // Fetchlands sacrifice themselves
  isBounceland: boolean // Returns a land to hand
  landType: LandType
}

interface SampleHand {
  cards: string[]
  lands: number
  t1Plays: number
  reason?: string // For mulligan hands: 'flood' | 'screw' | 'no_colors' | 'no_plays'
}

interface DeckAnalysis {
  colorSources: Record<string, number>
  colorNeeds: Record<string, number>
  colorRatios: Record<string, number>
  landBreakdown: Record<string, number>
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Fisher-Yates shuffle
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Parse mana cost string to get color requirements
function parseManaCost(manaCost: string | null): ColorRequirement {
  if (!manaCost) return { generic: 0, colored: [] }
  
  const symbols = manaCost.match(/\{[^}]+\}/g) || []
  let generic = 0
  const colored: string[] = []
  
  for (const symbol of symbols) {
    const inner = symbol.replace(/[{}]/g, '')
    
    if (/^\d+$/.test(inner)) {
      generic += parseInt(inner)
    } else if (inner === 'X') {
      continue
    } else if (inner.includes('/')) {
      const parts = inner.split('/')
      const color = parts.find(p => ['W', 'U', 'B', 'R', 'G'].includes(p))
      if (color) colored.push(color)
      else generic++
    } else if (inner.includes('P')) {
      continue
    } else if (['W', 'U', 'B', 'R', 'G'].includes(inner)) {
      colored.push(inner)
    } else if (inner === 'C') {
      colored.push('C')
    }
  }
  
  return { generic, colored }
}

// Count color symbols in mana cost (for deck analysis)
function countColorSymbols(manaCost: string | null): Record<string, number> {
  const counts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 }
  if (!manaCost) return counts
  
  const symbols = manaCost.match(/\{[^}]+\}/g) || []
  for (const symbol of symbols) {
    const inner = symbol.replace(/[{}]/g, '')
    if (['W', 'U', 'B', 'R', 'G'].includes(inner)) {
      counts[inner]++
    } else if (inner.includes('/') && !inner.includes('P')) {
      // Hybrid mana - count half for each color
      const parts = inner.split('/')
      for (const p of parts) {
        if (['W', 'U', 'B', 'R', 'G'].includes(p)) {
          counts[p] += 0.5
        }
      }
    }
  }
  return counts
}

// ============================================
// LAND DETECTION FUNCTIONS
// ============================================

// Detect land type and characteristics
function detectLandType(name: string, oracleText: string | null, typeLine: string): {
  landType: LandType
  entersTapped: boolean
  entersTappedConditional: 'always' | 'shock' | 'fast' | 'check' | 'reveal' | 'never'
  isFetchland: boolean
  isBounceland: boolean
} {
  const lowerName = name.toLowerCase()
  const lowerText = (oracleText || '').toLowerCase()
  const lowerType = typeLine.toLowerCase()
  
  // Basic lands
  const basicLandNames = ['plains', 'island', 'swamp', 'mountain', 'forest']
  if (basicLandNames.includes(lowerName) || lowerType.includes('basic')) {
    return { landType: 'basic', entersTapped: false, entersTappedConditional: 'never', isFetchland: false, isBounceland: false }
  }
  
  // Fetchlands - "search your library for a [type] card"
  if (lowerText.includes('search your library for a') && 
      (lowerText.includes('land card') || lowerText.includes('plains') || lowerText.includes('island') || 
       lowerText.includes('swamp') || lowerText.includes('mountain') || lowerText.includes('forest'))) {
    return { landType: 'fetch', entersTapped: false, entersTappedConditional: 'never', isFetchland: true, isBounceland: false }
  }
  
  // Bounce lands - "return a land you control to its owner's hand"
  if (lowerText.includes('return a land') || lowerText.includes('return another land')) {
    return { landType: 'bounce', entersTapped: true, entersTappedConditional: 'always', isFetchland: false, isBounceland: true }
  }
  
  // Check for enters tapped patterns
  const entersTappedPattern = /enters (the battlefield )?tapped/i
  if (!entersTappedPattern.test(oracleText || '')) {
    // Doesn't enter tapped at all
    return { landType: 'other', entersTapped: false, entersTappedConditional: 'never', isFetchland: false, isBounceland: false }
  }
  
  // Shock lands - "unless you pay 2 life"
  if (lowerText.includes('unless you pay 2 life')) {
    return { landType: 'shock', entersTapped: false, entersTappedConditional: 'shock', isFetchland: false, isBounceland: false }
  }
  
  // Fast lands - "unless you control two or more other lands"
  if (lowerText.includes('two or more other lands') || lowerText.includes('two or more lands')) {
    return { landType: 'fast', entersTapped: false, entersTappedConditional: 'fast', isFetchland: false, isBounceland: false }
  }
  
  // Check lands - "unless you control a [type]"
  if (lowerText.includes('unless you control a') && 
      (lowerText.includes('plains') || lowerText.includes('island') || lowerText.includes('swamp') || 
       lowerText.includes('mountain') || lowerText.includes('forest'))) {
    return { landType: 'check', entersTapped: false, entersTappedConditional: 'check', isFetchland: false, isBounceland: false }
  }
  
  // Reveal lands - "unless you reveal a [type] card"
  if (lowerText.includes('unless you reveal')) {
    return { landType: 'reveal', entersTapped: false, entersTappedConditional: 'reveal', isFetchland: false, isBounceland: false }
  }
  
  // Pure taplands (temples, guildgates, etc.)
  return { landType: 'tapland', entersTapped: true, entersTappedConditional: 'always', isFetchland: false, isBounceland: false }
}

// Detect if card is an MDFC (Modal Double-Faced Card)
function detectMdfc(layout: string, typeLine: string, backTypeLine?: string): {
  isMdfc: boolean
  isLandOnBack: boolean
} {
  // MDFC layouts are "modal_dfc"
  if (layout !== 'modal_dfc') {
    return { isMdfc: false, isLandOnBack: false }
  }
  
  // Check if back side is a land
  const backIsLand = backTypeLine?.toLowerCase().includes('land') || false
  const frontIsLand = typeLine.toLowerCase().includes('land')
  
  // It's useful as MDFC if one side is land and other is spell
  return { 
    isMdfc: true, 
    isLandOnBack: backIsLand && !frontIsLand 
  }
}

// Parse what colors a land/mana source produces
function parseManaProduction(oracleText: string | null, name: string): string[] {
  if (!oracleText) return ['C']
  
  const lowerText = oracleText.toLowerCase()
  const lowerName = name.toLowerCase()
  const colors: Set<string> = new Set()
  
  // Check for "any color"
  if (lowerText.includes('any color') || lowerText.includes('any one color') || lowerText.includes('any type')) {
    return ['ANY']
  }
  
  // Fetchlands can get any color (via duals)
  if (lowerText.includes('search your library for a') && 
      (lowerText.includes('land card') || lowerText.includes('basic land'))) {
    return ['ANY']
  }
  
  // Check for each color
  if (lowerText.includes('add {w}') || (lowerText.includes('{w}') && lowerText.includes('add'))) colors.add('W')
  if (lowerText.includes('add {u}') || (lowerText.includes('{u}') && lowerText.includes('add'))) colors.add('U')
  if (lowerText.includes('add {b}') || (lowerText.includes('{b}') && lowerText.includes('add'))) colors.add('B')
  if (lowerText.includes('add {r}') || (lowerText.includes('{r}') && lowerText.includes('add'))) colors.add('R')
  if (lowerText.includes('add {g}') || (lowerText.includes('{g}') && lowerText.includes('add'))) colors.add('G')
  if (lowerText.includes('add {c}') || (lowerText.includes('{c}') && lowerText.includes('add'))) colors.add('C')
  
  // Basic lands by name
  if (lowerName.includes('plains') || lowerName === 'plains') colors.add('W')
  if (lowerName.includes('island') || lowerName === 'island') colors.add('U')
  if (lowerName.includes('swamp') || lowerName === 'swamp') colors.add('B')
  if (lowerName.includes('mountain') || lowerName === 'mountain') colors.add('R')
  if (lowerName.includes('forest') || lowerName === 'forest') colors.add('G')
  
  if (colors.size === 0) colors.add('C')
  
  return Array.from(colors)
}

// Detect special lands that produce more than 1 mana
function detectLandManaAmount(name: string, oracleText: string | null): number {
  const lowerName = name.toLowerCase()
  const lowerText = (oracleText || '').toLowerCase()
  
  // Bounce lands produce 2 mana
  if (lowerText.includes('return a land') || lowerText.includes('return another land')) {
    return 2
  }
  
  // Urza lands
  if (lowerName.includes("urza's tower") || lowerName.includes("urza's mine") || lowerName.includes("urza's power plant")) {
    return 2
  }
  
  // Lands that tap for 2
  if (lowerName.includes('ancient tomb') || lowerName.includes('city of traitors') ||
      lowerName.includes('crystal vein') || lowerName.includes('temple of the false god') ||
      lowerName.includes('eldrazi temple')) {
    return 2
  }
  
  // Check oracle text for {C}{C}
  if (lowerText.includes('{c}{c}') || lowerText.includes('add two mana') || lowerText.includes('adds two mana')) {
    return 2
  }
  
  // Fetchlands produce 0 mana (they sacrifice)
  if (lowerText.includes('search your library for a') && lowerText.includes('sacrifice')) {
    return 0
  }
  
  return 1
}

// ============================================
// MANA CALCULATION
// ============================================

// Determine if a conditional land enters tapped on a specific turn
function landEntersTappedOnTurn(
  card: SimCard, 
  turn: number, 
  landsPlayedBefore: number,
  hasBasicTypes: boolean // Does the deck have basic land types that the check land cares about?
): boolean {
  switch (card.entersTappedConditional) {
    case 'never':
      return false
    case 'always':
      return true
    case 'shock':
      // Assume player pays life - enters untapped
      return false
    case 'fast':
      // Enters untapped if controlling 2 or fewer lands when played
      // On turn 1, you have 0 lands before playing this = untapped
      // On turn 2, you have 1 land before = untapped  
      // On turn 3, you have 2 lands before = untapped
      // On turn 4+, you have 3+ lands = TAPPED
      return landsPlayedBefore >= 3
    case 'check':
      // Enters untapped if you control a basic of the right type
      // Assume: T1 = tapped (no basics yet), T2+ = untapped if deck has basics
      if (turn === 1) return true
      return !hasBasicTypes // If no basics in deck, always tapped
    case 'reveal':
      // Assume optimistic - deck has the card types
      return false
    default:
      return card.entersTapped
  }
}

// Check if a card can be cast with available mana sources
function canCastWithColors(requirements: ColorRequirement, manaSources: ManaSource[]): boolean {
  const { generic, colored } = requirements
  const totalNeeded = generic + colored.length
  
  const totalAvailable = manaSources.reduce((sum, s) => sum + s.amount, 0)
  if (totalAvailable < totalNeeded) return false
  if (colored.length === 0) return true
  
  const manaUnits: string[][] = []
  for (const source of manaSources) {
    for (let i = 0; i < source.amount; i++) {
      manaUnits.push([...source.colors])
    }
  }
  
  const sortedReqs = [...colored].sort((a, b) => {
    const aCount = manaUnits.filter(u => u.includes(a) || u.includes('ANY')).length
    const bCount = manaUnits.filter(u => u.includes(b) || u.includes('ANY')).length
    return aCount - bCount
  })
  
  const usedUnits: Set<number> = new Set()
  
  for (const req of sortedReqs) {
    let found = false
    
    for (let i = 0; i < manaUnits.length; i++) {
      if (usedUnits.has(i)) continue
      const unit = manaUnits[i]
      if (unit.length === 1 && unit[0] === req) {
        usedUnits.add(i)
        found = true
        break
      }
    }
    
    if (!found) {
      for (let i = 0; i < manaUnits.length; i++) {
        if (usedUnits.has(i)) continue
        const unit = manaUnits[i]
        if (unit.includes(req) && !unit.includes('ANY')) {
          usedUnits.add(i)
          found = true
          break
        }
      }
    }
    
    if (!found) {
      for (let i = 0; i < manaUnits.length; i++) {
        if (usedUnits.has(i)) continue
        const unit = manaUnits[i]
        if (unit.includes('ANY')) {
          usedUnits.add(i)
          found = true
          break
        }
      }
    }
    
    if (!found && req === 'C') {
      for (let i = 0; i < manaUnits.length; i++) {
        if (usedUnits.has(i)) continue
        if (manaUnits[i].includes('C')) {
          usedUnits.add(i)
          found = true
          break
        }
      }
    }
    
    if (!found) return false
  }
  
  return (manaUnits.length - usedUnits.size) >= generic
}

// Calculate mana available at a given turn (advanced mode)
function calculateManaAdvanced(
  cardsInHand: SimCard[], 
  turn: number,
  hasBasicTypes: boolean
): { total: number, sources: ManaSource[] } {
  // Get all lands/MDFCs that could be played as lands
  const playableLands = cardsInHand.filter(c => c.isLand || (c.isMdfc && c.mdfcLandSide))
  
  // Sort: untapped first, non-fetch first, higher mana first
  const sortedLands = [...playableLands].sort((a, b) => {
    // Fetchlands last (they don't produce mana immediately)
    if (a.isFetchland !== b.isFetchland) return a.isFetchland ? 1 : -1
    // Untapped lands first
    if (a.entersTapped !== b.entersTapped) return a.entersTapped ? 1 : -1
    // Higher mana production first
    const aAmount = a.manaSource?.amount || a.mdfcLandSide?.amount || 0
    const bAmount = b.manaSource?.amount || b.mdfcLandSide?.amount || 0
    return bAmount - aAmount
  })
  
  const landsToPlay = sortedLands.slice(0, turn)
  const sources: ManaSource[] = []
  let totalMana = 0
  let effectiveLandsOnBoard = 0 // For bounce land calculation
  
  for (let i = 0; i < landsToPlay.length; i++) {
    const land = landsToPlay[i]
    const turnPlayed = i + 1
    const landsPlayedBefore = i
    
    // Handle bounce lands - they return a land
    if (land.isBounceland && effectiveLandsOnBoard > 0) {
      effectiveLandsOnBoard-- // One land goes back to hand
    }
    
    // Calculate if this land enters tapped
    const entersTappedThisTurn = landEntersTappedOnTurn(land, turnPlayed, landsPlayedBefore, hasBasicTypes)
    
    // Land provides mana if: played before this turn OR doesn't enter tapped
    const providesManaNow = turnPlayed < turn || !entersTappedThisTurn
    
    // Fetchlands never provide mana (they sacrifice)
    if (land.isFetchland) {
      // But the land they fetch does! (on next turn or immediately if it's untapped)
      // Simplification: assume fetch provides 1 ANY mana starting next turn
      if (turnPlayed < turn) {
        sources.push({ amount: 1, colors: ['ANY'] })
        totalMana += 1
        effectiveLandsOnBoard++
      }
      continue
    }
    
    if (providesManaNow) {
      const source = land.manaSource || land.mdfcLandSide
      if (source) {
        sources.push(source)
        totalMana += source.amount
      }
      effectiveLandsOnBoard++
    }
  }
  
  // Mana accelerators
  const accelerators = cardsInHand.filter(c => c.isManaAccelerator && c.manaSource)
  
  for (const acc of accelerators) {
    if (acc.cmc <= 1 && turn >= 2) {
      // Check if we had mana T1
      const t1Land = landsToPlay[0]
      if (t1Land && !t1Land.isFetchland && !landEntersTappedOnTurn(t1Land, 1, 0, hasBasicTypes)) {
        sources.push(acc.manaSource!)
        totalMana += acc.manaSource!.amount
      }
    } else if (acc.cmc === 2 && turn >= 3) {
      // Check if we had 2 mana T2
      let t2Mana = 0
      for (let i = 0; i < Math.min(2, landsToPlay.length); i++) {
        const land = landsToPlay[i]
        if (land.isFetchland) {
          if (i === 0) t2Mana += 1 // Fetched land is untapped by T2
        } else if (!landEntersTappedOnTurn(land, i + 1, i, hasBasicTypes)) {
          t2Mana += land.manaSource?.amount || 1
        }
      }
      if (t2Mana >= 2) {
        sources.push(acc.manaSource!)
        totalMana += acc.manaSource!.amount
      }
    }
  }
  
  return { total: totalMana, sources }
}

// Basic mode calculation
function calculateManaBasic(cardsInHand: SimCard[], turn: number): { total: number, sources: ManaSource[] } {
  const lands = cardsInHand.filter(c => c.isLand)
    .sort((a, b) => {
      if (a.isFetchland !== b.isFetchland) return a.isFetchland ? 1 : -1
      return (a.entersTapped ? 1 : 0) - (b.entersTapped ? 1 : 0)
    })
  
  const landsToPlay = lands.slice(0, turn)
  const sources: ManaSource[] = []
  let total = 0
  
  for (let i = 0; i < landsToPlay.length; i++) {
    const land = landsToPlay[i]
    const turnPlayed = i + 1
    
    if (land.isFetchland) {
      if (turnPlayed < turn) {
        total++
        if (land.manaSource) sources.push({ amount: 1, colors: ['ANY'] })
      }
      continue
    }
    
    const providesManaNow = turnPlayed < turn || !land.entersTapped
    if (providesManaNow) {
      total++
      if (land.manaSource) sources.push(land.manaSource)
    }
  }
  
  return { total, sources }
}

// ============================================
// SIMULATION
// ============================================

function runSimulation(
  deck: SimCard[], 
  iterations: number, 
  turns: number, 
  advanced: boolean,
  hasBasicTypes: boolean
) {
  const calculateMana = advanced 
    ? (cards: SimCard[], t: number) => calculateManaAdvanced(cards, t, hasBasicTypes)
    : calculateManaBasic
  
  const countPlayables = advanced 
    ? (cards: SimCard[], manaResult: { total: number, sources: ManaSource[] }) => 
        cards.filter(c => !c.isLand && !c.isManaAccelerator && canCastWithColors(c.colorRequirement, manaResult.sources)).length
    : (cards: SimCard[], manaResult: { total: number, sources: ManaSource[] }) => 
        cards.filter(c => !c.isLand && !c.isManaAccelerator && c.cmc <= manaResult.total).length

  const landsDistribution: Record<number, number> = {}
  for (let i = 0; i <= 7; i++) landsDistribution[i] = 0

  let totalLandsInHand = 0
  let totalNonLandsInHand = 0
  let totalCmcInHand = 0
  let totalLandsTurn3 = 0
  let totalPlayablesTurn1 = 0
  let totalPlayablesTurn2 = 0
  let totalPlayablesTurn3 = 0
  
  let keepableHands = 0
  let turn1PlayHands = 0
  let turn2PlayHands = 0
  let manaScrewHands = 0
  let manaFloodHands = 0
  
  // Color fixing tracking
  let colorFixedT1 = 0
  let colorFixedT2 = 0
  let colorFixedT3 = 0
  
  // Mana availability tracking
  let totalManaT1 = 0
  let totalManaT2 = 0
  let totalManaT3 = 0
  
  // Sample hands
  const sampleKeepHands: SampleHand[] = []
  const sampleMulliganHands: SampleHand[] = []
  const maxSamples = 3

  for (let i = 0; i < iterations; i++) {
    const shuffled = shuffle(deck)
    const hand = shuffled.slice(0, 7)
    const library = shuffled.slice(7)
    
    // Count lands (including MDFCs that can be lands)
    const effectiveLands = hand.filter(c => c.isLand || (c.isMdfc && c.mdfcLandSide))
    const landsInHand = effectiveLands.length
    const nonLandsInHand = hand.filter(c => !c.isLand).length
    const cmcInHand = hand.filter(c => !c.isLand).reduce((sum, c) => sum + c.cmc, 0)
    
    totalLandsInHand += landsInHand
    totalNonLandsInHand += nonLandsInHand
    totalCmcInHand += nonLandsInHand > 0 ? cmcInHand / nonLandsInHand : 0
    
    const distKey = Math.min(landsInHand, 7)
    landsDistribution[distKey]++
    
    const isKeepable = landsInHand >= 2 && landsInHand <= 4
    if (isKeepable) keepableHands++
    if (landsInHand <= 1) manaScrewHands++
    if (landsInHand >= 5) manaFloodHands++
    
    // Simulate turns
    const cardsInPlay: SimCard[] = [...hand]
    let t1Mana = 0, t2Mana = 0, t3Mana = 0
    let t1Playables = 0
    
    for (let turn = 1; turn <= turns; turn++) {
      if (turn > 1 && library.length > 0) {
        cardsInPlay.push(library.shift()!)
      }
      
      const manaResult = calculateMana(cardsInPlay, turn)
      const playables = countPlayables(cardsInPlay, manaResult)
      
      if (turn === 1) {
        totalPlayablesTurn1 += playables
        t1Playables = playables
        if (playables > 0) turn1PlayHands++
        t1Mana = manaResult.total
        totalManaT1 += manaResult.total
        
        // Check if colors are available for T1 plays
        const t1Cards = cardsInPlay.filter(c => !c.isLand && c.cmc <= 1)
        const canPlayT1 = t1Cards.some(c => canCastWithColors(c.colorRequirement, manaResult.sources))
        if (canPlayT1 || t1Cards.length === 0) colorFixedT1++
      } else if (turn === 2) {
        totalPlayablesTurn2 += playables
        if (playables > 0) turn2PlayHands++
        t2Mana = manaResult.total
        totalManaT2 += manaResult.total
        
        const t2Cards = cardsInPlay.filter(c => !c.isLand && c.cmc <= 2)
        const canPlayT2 = t2Cards.some(c => canCastWithColors(c.colorRequirement, manaResult.sources))
        if (canPlayT2 || t2Cards.length === 0) colorFixedT2++
      } else if (turn === 3) {
        totalPlayablesTurn3 += playables
        totalLandsTurn3 += cardsInPlay.filter(c => c.isLand).length
        t3Mana = manaResult.total
        totalManaT3 += manaResult.total
        
        const t3Cards = cardsInPlay.filter(c => !c.isLand && c.cmc <= 3)
        const canPlayT3 = t3Cards.some(c => canCastWithColors(c.colorRequirement, manaResult.sources))
        if (canPlayT3 || t3Cards.length === 0) colorFixedT3++
      }
    }
    
    // Collect sample hands (first few iterations)
    if (i < iterations * 0.01) { // Check first 1% of hands for diversity
      const handNames = hand.map(c => c.name)
      
      if (isKeepable && t1Playables > 0 && sampleKeepHands.length < maxSamples) {
        sampleKeepHands.push({
          cards: handNames,
          lands: landsInHand,
          t1Plays: t1Playables
        })
      } else if (!isKeepable && sampleMulliganHands.length < maxSamples) {
        let reason: string
        if (landsInHand <= 1) reason = 'screw'
        else if (landsInHand >= 5) reason = 'flood'
        else reason = 'no_plays'
        
        sampleMulliganHands.push({
          cards: handNames,
          lands: landsInHand,
          t1Plays: t1Playables,
          reason
        })
      }
    }
  }

  return {
    // Base stats
    avgLandsInHand: totalLandsInHand / iterations,
    avgNonLandsInHand: totalNonLandsInHand / iterations,
    avgCmcInHand: totalCmcInHand / iterations,
    landsDistribution,
    avgLandsTurn3: totalLandsTurn3 / iterations,
    avgPlayablesTurn1: totalPlayablesTurn1 / iterations,
    avgPlayablesTurn2: totalPlayablesTurn2 / iterations,
    avgPlayablesTurn3: totalPlayablesTurn3 / iterations,
    pctKeepableHands: (keepableHands / iterations) * 100,
    pctTurn1Play: (turn1PlayHands / iterations) * 100,
    pctTurn2Play: (turn2PlayHands / iterations) * 100,
    pctManaScrew: (manaScrewHands / iterations) * 100,
    pctManaFlood: (manaFloodHands / iterations) * 100,
    
    // Advanced stats
    pctColorFixedT1: (colorFixedT1 / iterations) * 100,
    pctColorFixedT2: (colorFixedT2 / iterations) * 100,
    pctColorFixedT3: (colorFixedT3 / iterations) * 100,
    avgManaAvailableT1: totalManaT1 / iterations,
    avgManaAvailableT2: totalManaT2 / iterations,
    avgManaAvailableT3: totalManaT3 / iterations,
    
    // Sample hands
    sampleKeepHands,
    sampleMulliganHands,
  }
}

// ============================================
// DECK ANALYSIS (Color Sources vs Needs)
// ============================================

function analyzeDeck(cards: Array<{
  card: { name: string; typeLine: string; oracleText: string | null; manaCost: string | null; layout?: string }
  quantity: number
}>): DeckAnalysis {
  const colorSources: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, ANY: 0 }
  const colorNeeds: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 }
  const landBreakdown: Record<string, number> = { 
    basics: 0, fetches: 0, shocks: 0, checks: 0, fasts: 0, taplands: 0, mdfc: 0, bouncelands: 0, other: 0 
  }
  
  for (const dc of cards) {
    const isLand = dc.card.typeLine.toLowerCase().includes('land')
    
    if (isLand) {
      const landInfo = detectLandType(dc.card.name, dc.card.oracleText, dc.card.typeLine)
      
      // Count land types
      switch (landInfo.landType) {
        case 'basic': landBreakdown.basics += dc.quantity; break
        case 'fetch': landBreakdown.fetches += dc.quantity; break
        case 'shock': landBreakdown.shocks += dc.quantity; break
        case 'check': landBreakdown.checks += dc.quantity; break
        case 'fast': landBreakdown.fasts += dc.quantity; break
        case 'tapland': landBreakdown.taplands += dc.quantity; break
        case 'bounce': landBreakdown.bouncelands += dc.quantity; break
        default: landBreakdown.other += dc.quantity
      }
      
      // Count color sources
      const colors = parseManaProduction(dc.card.oracleText, dc.card.name)
      for (const color of colors) {
        if (color === 'ANY') {
          colorSources.ANY += dc.quantity
        } else {
          colorSources[color] = (colorSources[color] || 0) + dc.quantity
        }
      }
    } else {
      // Count color needs from spells
      const needs = countColorSymbols(dc.card.manaCost)
      for (const [color, count] of Object.entries(needs)) {
        colorNeeds[color] += count * dc.quantity
      }
      
      // Check for MDFC
      if (dc.card.layout === 'modal_dfc') {
        landBreakdown.mdfc += dc.quantity
      }
    }
  }
  
  // Calculate ratios (sources / needs)
  const colorRatios: Record<string, number> = {}
  for (const color of ['W', 'U', 'B', 'R', 'G']) {
    if (colorNeeds[color] > 0) {
      // Include ANY sources proportionally
      const effectiveSources = colorSources[color] + (colorSources.ANY * 0.5)
      colorRatios[color] = effectiveSources / colorNeeds[color]
    }
  }
  
  return { colorSources, colorNeeds, colorRatios, landBreakdown }
}

// ============================================
// API ROUTES
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    let advanced = false
    try {
      const body = await request.json()
      const parsed = simulateDeckSchema.safeParse(body)
      if (parsed.success) {
        advanced = parsed.data.advanced
      }
    } catch {
      // Default to basic mode
    }
    
    const deck = await prisma.deck.findUnique({
      where: { id },
      include: {
        cards: {
          where: { category: { not: 'sideboard' } },
          include: {
            card: {
              select: {
                name: true,
                cmc: true,
                typeLine: true,
                oracleText: true,
                manaCost: true,
                layout: true,
              }
            }
          }
        }
      }
    })

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    // Analyze deck for color sources/needs
    const deckAnalysis = analyzeDeck(deck.cards)
    
    // Check if deck has basic land types (for check lands)
    const hasBasicTypes = deckAnalysis.landBreakdown.basics > 0 || 
                          deckAnalysis.landBreakdown.shocks > 0 // Shocks have basic types

    // Build SimCard array
    const expandedDeck: SimCard[] = []
    
    for (const dc of deck.cards) {
      const typeLine = dc.card.typeLine
      const isLand = typeLine.toLowerCase().includes('land')
      const landInfo = detectLandType(dc.card.name, dc.card.oracleText, typeLine)
      const colorReq = parseManaCost(dc.card.manaCost)
      
      // Check for MDFC
      const mdfcInfo = detectMdfc(dc.card.layout || 'normal', typeLine)
      
      let manaSource: ManaSource | null = null
      let mdfcLandSide: ManaSource | null = null
      
      if (isLand) {
        const colors = parseManaProduction(dc.card.oracleText, dc.card.name)
        const amount = detectLandManaAmount(dc.card.name, dc.card.oracleText)
        manaSource = { amount, colors }
      } else if (mdfcInfo.isMdfc && mdfcInfo.isLandOnBack) {
        // MDFC with land on back - can be played as land
        mdfcLandSide = { amount: 1, colors: ['ANY'] } // Simplified - most MDFC lands tap for any
      }
      
      // Detect mana accelerators
      let isManaAccelerator = false
      if (!isLand && dc.card.cmc <= 2 && dc.card.oracleText) {
        const lowerText = dc.card.oracleText.toLowerCase()
        if (lowerText.includes('add {') || lowerText.includes('add one mana') || lowerText.includes('add ')) {
          isManaAccelerator = true
          const colors = parseManaProduction(dc.card.oracleText, dc.card.name)
          let amount = 1
          if (lowerText.includes('{c}{c}') || lowerText.includes('add {2}') || 
              lowerText.includes('two mana') || lowerText.match(/add \{.\}\{.\}/)) {
            amount = 2
          }
          manaSource = { amount, colors }
        }
      }
      
      for (let i = 0; i < dc.quantity; i++) {
        expandedDeck.push({
          name: dc.card.name,
          cmc: dc.card.cmc,
          isLand,
          isManaAccelerator,
          isMdfc: mdfcInfo.isMdfc,
          mdfcLandSide,
          manaSource,
          colorRequirement: colorReq,
          entersTapped: landInfo.entersTapped,
          entersTappedConditional: landInfo.entersTappedConditional,
          isFetchland: landInfo.isFetchland,
          isBounceland: landInfo.isBounceland,
          landType: landInfo.landType,
        })
      }
    }

    if (expandedDeck.length < 7) {
      return NextResponse.json({ error: 'Deck must have at least 7 cards' }, { status: 400 })
    }

    // Run simulation
    const iterations = 10000
    const turns = 3
    const results = runSimulation(expandedDeck, iterations, turns, advanced, hasBasicTypes)

    // Save to database
    const simulation = await prisma.deckSimulation.create({
      data: {
        deckId: id,
        iterations,
        turnsSimulated: turns,
        isAdvanced: advanced,
        
        // Base stats
        avgLandsInHand: results.avgLandsInHand,
        avgNonLandsInHand: results.avgNonLandsInHand,
        avgCmcInHand: results.avgCmcInHand,
        landsDistribution: results.landsDistribution,
        avgLandsTurn3: results.avgLandsTurn3,
        avgPlayablesTurn1: results.avgPlayablesTurn1,
        avgPlayablesTurn2: results.avgPlayablesTurn2,
        avgPlayablesTurn3: results.avgPlayablesTurn3,
        pctKeepableHands: results.pctKeepableHands,
        pctTurn1Play: results.pctTurn1Play,
        pctTurn2Play: results.pctTurn2Play,
        pctManaScrew: results.pctManaScrew,
        pctManaFlood: results.pctManaFlood,
        
        // Advanced stats
        colorSources: deckAnalysis.colorSources,
        colorNeeds: deckAnalysis.colorNeeds,
        colorRatios: deckAnalysis.colorRatios,
        pctColorFixedT1: results.pctColorFixedT1,
        pctColorFixedT2: results.pctColorFixedT2,
        pctColorFixedT3: results.pctColorFixedT3,
        landBreakdown: deckAnalysis.landBreakdown,
        avgManaAvailableT1: results.avgManaAvailableT1,
        avgManaAvailableT2: results.avgManaAvailableT2,
        avgManaAvailableT3: results.avgManaAvailableT3,
        
        // Sample hands (cast to JSON for Prisma)
        sampleKeepHands: results.sampleKeepHands as unknown as Prisma.InputJsonValue,
        sampleMulliganHands: results.sampleMulliganHands as unknown as Prisma.InputJsonValue,
      }
    })

    return NextResponse.json({ simulation })
  } catch (error) {
    console.error('Simulation error:', error)
    return NextResponse.json({ error: 'Failed to run simulation' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const simulation = await prisma.deckSimulation.findFirst({
      where: { deckId: id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ simulation })
  } catch (error) {
    console.error('Get simulation error:', error)
    return NextResponse.json({ error: 'Failed to get simulation' }, { status: 500 })
  }
}
