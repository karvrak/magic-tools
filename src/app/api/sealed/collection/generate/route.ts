import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * Play Booster Structure (Wizards 2024+)
 * 14 cards per pack:
 * - 7 Commons (including common slot that could be "The List")
 * - 3 Uncommons
 * - 1 Rare/Mythic (1 in 7 chance for mythic = ~14.3%)
 * - 2 Wildcards (any rarity - distribution: 70% C, 20% U, 8% R, 2% M)
 * - 1 Basic Land (if available)
 *
 * For sealed: 6 boosters = 84 cards total
 *
 * COLLECTION MODE: Cards are drawn from user's collection, excluding cards in decks
 */

const BOOSTER_COUNT = 6

// Wildcard rarity distribution
const WILDCARD_DISTRIBUTION = {
  common: 0.70,
  uncommon: 0.90, // 0.70 + 0.20
  rare: 0.98,      // 0.90 + 0.08
  mythic: 1.0,     // 0.98 + 0.02
}

// Mythic chance for rare slot
const MYTHIC_CHANCE = 1 / 7 // ~14.3%

interface CardPool {
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
  availableQty: number
}

interface BoosterCard extends Omit<CardPool, 'availableQty'> {
  slot: 'common' | 'uncommon' | 'rare' | 'mythic' | 'wildcard' | 'land'
}

interface GeneratedBooster {
  packNumber: number
  cards: BoosterCard[]
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
    const { setCode, ownerId } = body

    // Validate set code
    if (!setCode || typeof setCode !== 'string') {
      return NextResponse.json(
        { error: 'Set code is required' },
        { status: 400 }
      )
    }

    const isAllCollection = setCode === '_all'

    // Build owner filter for SQL
    // When ownerId is provided: filter collection by owner OR null, filter decks by owner OR null
    const ownerFilter = ownerId
      ? `AND (ci."ownerId" = '${ownerId}' OR ci."ownerId" IS NULL)`
      : ''
    const deckOwnerFilter = ownerId
      ? `AND (d."ownerId" = '${ownerId}' OR d."ownerId" IS NULL)`
      : ''

    // Fetch available cards from collection (minus cards in decks)
    const availableCards = await prisma.$queryRawUnsafe<Array<{
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
      availableQty: bigint
    }>>(`
      WITH collection_cards AS (
        SELECT
          ci."cardId",
          c."oracleId",
          SUM(ci.quantity) as owned_qty
        FROM "CollectionItem" ci
        JOIN "Card" c ON ci."cardId" = c.id
        WHERE c."imageNormal" IS NOT NULL
          ${isAllCollection ? '' : `AND c."setCode" = '${setCode.toLowerCase()}'`}
          ${ownerFilter}
        GROUP BY ci."cardId", c."oracleId"
      ),
      deck_cards AS (
        -- Match by oracleId to handle different editions of same card
        SELECT
          c."oracleId",
          SUM(dc.quantity) as deck_qty
        FROM "DeckCard" dc
        JOIN "Deck" d ON dc."deckId" = d.id
        JOIN "Card" c ON dc."cardId" = c.id
        WHERE 1=1 ${deckOwnerFilter}
        GROUP BY c."oracleId"
      )
      SELECT
        c.id,
        c."oracleId",
        c.name,
        c."printedName",
        c."manaCost",
        c.cmc,
        c."typeLine",
        c."printedTypeLine",
        c.colors,
        c."colorIdentity",
        c.rarity,
        c."imageNormal",
        c."imageLarge",
        c."imageNormalBack",
        c."imageLargeBack",
        c.power,
        c.toughness,
        c.loyalty,
        c."oracleText",
        c."printedText",
        c."setCode",
        c."setName",
        c.layout,
        GREATEST(0, cc.owned_qty - COALESCE(dck.deck_qty, 0)) as "availableQty"
      FROM collection_cards cc
      JOIN "Card" c ON cc."cardId" = c.id
      LEFT JOIN deck_cards dck ON cc."oracleId" = dck."oracleId"
      WHERE cc.owned_qty > COALESCE(dck.deck_qty, 0)
    `)

    // Convert bigint to number and create card pool
    const cardPool: CardPool[] = availableCards.map(c => ({
      ...c,
      availableQty: Number(c.availableQty),
    }))

    // Group by rarity
    const commons = cardPool.filter(c => c.rarity === 'common' && !c.typeLine.includes('Basic Land'))
    const uncommons = cardPool.filter(c => c.rarity === 'uncommon')
    const rares = cardPool.filter(c => c.rarity === 'rare')
    const mythics = cardPool.filter(c => c.rarity === 'mythic')
    const lands = cardPool.filter(c => c.typeLine.includes('Basic Land'))

    // Calculate total available by rarity (respecting quantities)
    const totalCommons = commons.reduce((sum, c) => sum + c.availableQty, 0)
    const totalUncommons = uncommons.reduce((sum, c) => sum + c.availableQty, 0)
    const totalRares = rares.reduce((sum, c) => sum + c.availableQty, 0)
    const totalMythics = mythics.reduce((sum, c) => sum + c.availableQty, 0)
    const totalLands = lands.reduce((sum, c) => sum + c.availableQty, 0)

    // Check if we have enough cards (relaxed requirements for collection mode)
    const warnings: string[] = []

    if (totalCommons < 7) {
      warnings.push(`Only ${totalCommons} commons available (7 recommended per booster)`)
    }
    if (totalUncommons < 3) {
      warnings.push(`Only ${totalUncommons} uncommons available (3 recommended per booster)`)
    }
    if (totalRares + totalMythics < 1) {
      warnings.push(`No rare or mythic available`)
    }

    // Create a mutable pool that tracks remaining quantities
    const remainingPool = new Map<string, number>()
    for (const card of cardPool) {
      remainingPool.set(card.id, card.availableQty)
    }

    // Helper to pick a random card from a list respecting quantities
    const pickCard = (pool: CardPool[]): CardPool | null => {
      // Filter to cards with remaining quantity
      const available = pool.filter(c => (remainingPool.get(c.id) || 0) > 0)
      if (available.length === 0) return null

      // Weighted random selection based on available quantity
      const totalWeight = available.reduce((sum, c) => sum + (remainingPool.get(c.id) || 0), 0)
      let random = Math.random() * totalWeight

      for (const card of available) {
        const qty = remainingPool.get(card.id) || 0
        random -= qty
        if (random <= 0) {
          // Decrement the remaining quantity
          remainingPool.set(card.id, qty - 1)
          return card
        }
      }

      // Fallback: pick first available
      const card = available[0]
      const qty = remainingPool.get(card.id) || 0
      remainingPool.set(card.id, qty - 1)
      return card
    }

    // Generate 6 boosters
    const boosters: GeneratedBooster[] = []

    for (let i = 0; i < BOOSTER_COUNT; i++) {
      const packCards: BoosterCard[] = []

      // 7 Commons
      for (let j = 0; j < 7; j++) {
        const card = pickCard(commons)
        if (card) {
          const { availableQty, ...cardData } = card
          packCards.push({ ...cardData, slot: 'common' })
        }
      }

      // 3 Uncommons
      for (let j = 0; j < 3; j++) {
        const card = pickCard(uncommons)
        if (card) {
          const { availableQty, ...cardData } = card
          packCards.push({ ...cardData, slot: 'uncommon' })
        }
      }

      // 1 Rare/Mythic slot
      const rareSlotRarity = getRareSlotRarity()
      let rareCard: CardPool | null = null

      if (rareSlotRarity === 'mythic' && mythics.some(c => (remainingPool.get(c.id) || 0) > 0)) {
        rareCard = pickCard(mythics)
      }
      if (!rareCard) {
        rareCard = pickCard(rares)
      }
      if (!rareCard && mythics.some(c => (remainingPool.get(c.id) || 0) > 0)) {
        rareCard = pickCard(mythics)
      }

      if (rareCard) {
        const { availableQty, ...cardData } = rareCard
        packCards.push({ ...cardData, slot: rareCard.rarity === 'mythic' ? 'mythic' : 'rare' })
      }

      // 2 Wildcards
      for (let j = 0; j < 2; j++) {
        const wildcardRarity = getWildcardRarity()
        let wildcardCard: CardPool | null = null

        switch (wildcardRarity) {
          case 'mythic':
            wildcardCard = pickCard(mythics) || pickCard(rares) || pickCard(uncommons) || pickCard(commons)
            break
          case 'rare':
            wildcardCard = pickCard(rares) || pickCard(mythics) || pickCard(uncommons) || pickCard(commons)
            break
          case 'uncommon':
            wildcardCard = pickCard(uncommons) || pickCard(commons)
            break
          default:
            wildcardCard = pickCard(commons) || pickCard(uncommons)
        }

        if (wildcardCard) {
          const { availableQty, ...cardData } = wildcardCard
          packCards.push({ ...cardData, slot: 'wildcard' })
        }
      }

      // 1 Basic Land (if available)
      const landCard = pickCard(lands)
      if (landCard) {
        const { availableQty, ...cardData } = landCard
        packCards.push({ ...cardData, slot: 'land' })
      }

      boosters.push({
        packNumber: i + 1,
        cards: packCards,
      })
    }

    // Flatten all cards for the pool
    const pool = boosters.flatMap(b => b.cards)

    // Get set name from first card or use set code
    const resolvedSetCode = isAllCollection ? '_all' : setCode
    const resolvedSetName = isAllCollection ? 'Toute la collection' : (cardPool[0]?.setName || setCode.toUpperCase())

    return NextResponse.json({
      setCode: resolvedSetCode,
      setName: resolvedSetName,
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
      collectionStats: {
        totalCommons,
        totalUncommons,
        totalRares,
        totalMythics,
        totalLands,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    })
  } catch (error) {
    console.error('Collection sealed generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate sealed pool', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
