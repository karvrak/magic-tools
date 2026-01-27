import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * Play Booster Structure (Wizards 2024+)
 * 14 cards per pack:
 * - 6 Commons
 * - 1 Common (12.5% chance to be "The List" - we skip this, just common)
 * - 3 Uncommons
 * - 1 Rare/Mythic (1 in 7 chance for mythic = ~14.3%)
 * - 2 Wildcards (any rarity - distribution: 70% C, 20% U, 8% R, 2% M)
 * - 1 Basic Land (we include this)
 *
 * For sealed: 6 boosters = 84 cards total
 */

const BOOSTER_COUNT = 6
const CARDS_PER_PACK = 14

// Wildcard rarity distribution
const WILDCARD_DISTRIBUTION = {
  common: 0.70,
  uncommon: 0.90, // 0.70 + 0.20
  rare: 0.98,      // 0.90 + 0.08
  mythic: 1.0,     // 0.98 + 0.02
}

// Mythic chance for rare slot
const MYTHIC_CHANCE = 1 / 7 // ~14.3%

interface GeneratedBooster {
  packNumber: number
  cards: BoosterCard[]
}

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
  slot: 'common' | 'uncommon' | 'rare' | 'mythic' | 'wildcard' | 'land'
}

function getWildcardRarity(): 'common' | 'uncommon' | 'rare' | 'mythic' {
  const roll = Math.random()
  if (roll < WILDCARD_DISTRIBUTION.common) return 'common'
  if (roll < WILDCARD_DISTRIBUTION.uncommon) return 'uncommon'
  if (roll < WILDCARD_DISTRIBUTION.rare) return 'rare'
  return 'mythic'
}

function getRareSlotRarity(): 'rare' | 'mythic' {
  return Math.random() < MYTHIC_CHANCE ? 'mythic' : 'rare'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { setCode } = body

    // Validate set code
    if (!setCode || typeof setCode !== 'string') {
      return NextResponse.json(
        { error: 'Set code is required' },
        { status: 400 }
      )
    }

    // Fetch cards by rarity from the specified set
    const [commons, uncommons, rares, mythics, lands] = await Promise.all([
      prisma.card.findMany({
        where: {
          setCode: setCode.toLowerCase(),
          rarity: 'common',
          imageNormal: { not: null },
          isBooster: true,
          games: { has: 'paper' },
          NOT: { typeLine: { contains: 'Basic Land' } },
        },
        select: {
          id: true,
          oracleId: true,
          name: true,
          printedName: true,
          manaCost: true,
          cmc: true,
          typeLine: true,
          printedTypeLine: true,
          colors: true,
          colorIdentity: true,
          rarity: true,
          imageNormal: true,
          imageLarge: true,
          imageNormalBack: true,
          imageLargeBack: true,
          power: true,
          toughness: true,
          loyalty: true,
          oracleText: true,
          printedText: true,
          setCode: true,
          setName: true,
          layout: true,
        },
      }),
      prisma.card.findMany({
        where: {
          setCode: setCode.toLowerCase(),
          rarity: 'uncommon',
          imageNormal: { not: null },
          isBooster: true,
          games: { has: 'paper' },
        },
        select: {
          id: true,
          oracleId: true,
          name: true,
          printedName: true,
          manaCost: true,
          cmc: true,
          typeLine: true,
          printedTypeLine: true,
          colors: true,
          colorIdentity: true,
          rarity: true,
          imageNormal: true,
          imageLarge: true,
          imageNormalBack: true,
          imageLargeBack: true,
          power: true,
          toughness: true,
          loyalty: true,
          oracleText: true,
          printedText: true,
          setCode: true,
          setName: true,
          layout: true,
        },
      }),
      prisma.card.findMany({
        where: {
          setCode: setCode.toLowerCase(),
          rarity: 'rare',
          imageNormal: { not: null },
          isBooster: true,
          games: { has: 'paper' },
        },
        select: {
          id: true,
          oracleId: true,
          name: true,
          printedName: true,
          manaCost: true,
          cmc: true,
          typeLine: true,
          printedTypeLine: true,
          colors: true,
          colorIdentity: true,
          rarity: true,
          imageNormal: true,
          imageLarge: true,
          imageNormalBack: true,
          imageLargeBack: true,
          power: true,
          toughness: true,
          loyalty: true,
          oracleText: true,
          printedText: true,
          setCode: true,
          setName: true,
          layout: true,
        },
      }),
      prisma.card.findMany({
        where: {
          setCode: setCode.toLowerCase(),
          rarity: 'mythic',
          imageNormal: { not: null },
          isBooster: true,
          games: { has: 'paper' },
        },
        select: {
          id: true,
          oracleId: true,
          name: true,
          printedName: true,
          manaCost: true,
          cmc: true,
          typeLine: true,
          printedTypeLine: true,
          colors: true,
          colorIdentity: true,
          rarity: true,
          imageNormal: true,
          imageLarge: true,
          imageNormalBack: true,
          imageLargeBack: true,
          power: true,
          toughness: true,
          loyalty: true,
          oracleText: true,
          printedText: true,
          setCode: true,
          setName: true,
          layout: true,
        },
      }),
      prisma.card.findMany({
        where: {
          setCode: setCode.toLowerCase(),
          typeLine: { contains: 'Basic Land' },
          imageNormal: { not: null },
          games: { has: 'paper' },
        },
        select: {
          id: true,
          oracleId: true,
          name: true,
          printedName: true,
          manaCost: true,
          cmc: true,
          typeLine: true,
          printedTypeLine: true,
          colors: true,
          colorIdentity: true,
          rarity: true,
          imageNormal: true,
          imageLarge: true,
          imageNormalBack: true,
          imageLargeBack: true,
          power: true,
          toughness: true,
          loyalty: true,
          oracleText: true,
          printedText: true,
          setCode: true,
          setName: true,
          layout: true,
        },
      }),
    ])

    // Check if set has enough cards
    if (commons.length < 7 || uncommons.length < 3 || rares.length < 1) {
      return NextResponse.json(
        {
          error: 'Not enough cards in this set for sealed',
          details: {
            commons: commons.length,
            uncommons: uncommons.length,
            rares: rares.length,
            mythics: mythics.length,
            lands: lands.length,
          }
        },
        { status: 400 }
      )
    }

    // Helper to pick random cards
    const pickRandom = <T>(arr: T[], count: number): T[] => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5)
      return shuffled.slice(0, count)
    }

    const pickRandomOne = <T>(arr: T[]): T => {
      return arr[Math.floor(Math.random() * arr.length)]
    }

    // Generate 6 boosters
    const boosters: GeneratedBooster[] = []

    for (let i = 0; i < BOOSTER_COUNT; i++) {
      const packCards: BoosterCard[] = []

      // 6 Commons + 1 Common (slot 7 - no List cards in our simulation)
      const packCommons = pickRandom(commons, 7)
      packCommons.forEach(c => packCards.push({ ...c, slot: 'common' }))

      // 3 Uncommons
      const packUncommons = pickRandom(uncommons, 3)
      packUncommons.forEach(c => packCards.push({ ...c, slot: 'uncommon' }))

      // 1 Rare/Mythic slot
      const rareSlotRarity = getRareSlotRarity()
      const rareSlotPool = rareSlotRarity === 'mythic' && mythics.length > 0 ? mythics : rares
      const rareCard = pickRandomOne(rareSlotPool)
      packCards.push({ ...rareCard, slot: rareSlotRarity })

      // 2 Wildcards
      for (let j = 0; j < 2; j++) {
        const wildcardRarity = getWildcardRarity()
        let wildcardPool: typeof commons
        switch (wildcardRarity) {
          case 'mythic':
            wildcardPool = mythics.length > 0 ? mythics : rares
            break
          case 'rare':
            wildcardPool = rares
            break
          case 'uncommon':
            wildcardPool = uncommons
            break
          default:
            wildcardPool = commons
        }
        const wildcardCard = pickRandomOne(wildcardPool)
        packCards.push({ ...wildcardCard, slot: 'wildcard' })
      }

      // 1 Basic Land (if available, otherwise skip)
      if (lands.length > 0) {
        const landCard = pickRandomOne(lands)
        packCards.push({ ...landCard, slot: 'land' })
      }

      boosters.push({
        packNumber: i + 1,
        cards: packCards,
      })
    }

    // Flatten all cards for the pool
    const pool = boosters.flatMap(b => b.cards)

    // Get set name from first card
    const setName = commons[0]?.setName || setCode.toUpperCase()

    return NextResponse.json({
      setCode,
      setName,
      boosters,
      pool,
      totalCards: pool.length,
      stats: {
        commons: pool.filter(c => c.rarity === 'common').length,
        uncommons: pool.filter(c => c.rarity === 'uncommon').length,
        rares: pool.filter(c => c.rarity === 'rare').length,
        mythics: pool.filter(c => c.rarity === 'mythic').length,
        lands: pool.filter(c => c.slot === 'land').length,
      },
    })
  } catch (error) {
    console.error('Sealed generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate sealed pool', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
