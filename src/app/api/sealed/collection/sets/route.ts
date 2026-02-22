import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * Get available sets from the user's collection for sealed play
 * Only returns sets with cards in the collection (excluding cards used in decks)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ownerId = searchParams.get('ownerId')

    // Build owner filter for SQL
    // When ownerId is provided: filter collection by owner OR null, filter decks by owner OR null
    // When ownerId is not provided: show all collection, subtract all decks
    const ownerFilter = ownerId
      ? `AND (ci."ownerId" = '${ownerId}' OR ci."ownerId" IS NULL)`
      : ''
    const deckOwnerFilter = ownerId
      ? `AND (d."ownerId" = '${ownerId}' OR d."ownerId" IS NULL)`
      : ''

    // Get sets with available cards from collection (minus cards in decks)
    const setsWithCounts = await prisma.$queryRawUnsafe<Array<{
      setCode: string
      setName: string
      totalCards: bigint
      availableCards: bigint
      commons: bigint
      uncommons: bigint
      rares: bigint
      mythics: bigint
      lands: bigint
    }>>(`
      WITH collection_cards AS (
        -- All cards in collection with their quantities
        SELECT
          ci."cardId",
          c."setCode",
          c."setName",
          c."rarity",
          c."typeLine",
          SUM(ci.quantity) as owned_qty
        FROM "CollectionItem" ci
        JOIN "Card" c ON ci."cardId" = c.id
        WHERE c."imageNormal" IS NOT NULL
          ${ownerFilter}
        GROUP BY ci."cardId", c."setCode", c."setName", c."rarity", c."typeLine"
      ),
      deck_cards AS (
        -- Cards used in decks (to exclude) - match by oracleId to handle different editions
        SELECT
          c."oracleId",
          SUM(dc.quantity) as deck_qty
        FROM "DeckCard" dc
        JOIN "Deck" d ON dc."deckId" = d.id
        JOIN "Card" c ON dc."cardId" = c.id
        WHERE 1=1 ${deckOwnerFilter}
        GROUP BY c."oracleId"
      ),
      available_cards AS (
        -- Available = collection - decks (join by oracleId for cross-edition matching)
        SELECT
          cc."cardId",
          cc."setCode",
          cc."setName",
          cc."rarity",
          cc."typeLine",
          GREATEST(0, cc.owned_qty - COALESCE(dck.deck_qty, 0)) as available_qty
        FROM collection_cards cc
        JOIN "Card" card ON cc."cardId" = card.id
        LEFT JOIN deck_cards dck ON card."oracleId" = dck."oracleId"
      )
      SELECT
        "setCode",
        MAX("setName") as "setName",
        SUM(available_qty) as "totalCards",
        COUNT(*) as "availableCards",
        SUM(CASE WHEN "rarity" = 'common' AND "typeLine" NOT LIKE '%Basic Land%' THEN available_qty ELSE 0 END) as commons,
        SUM(CASE WHEN "rarity" = 'uncommon' THEN available_qty ELSE 0 END) as uncommons,
        SUM(CASE WHEN "rarity" = 'rare' THEN available_qty ELSE 0 END) as rares,
        SUM(CASE WHEN "rarity" = 'mythic' THEN available_qty ELSE 0 END) as mythics,
        SUM(CASE WHEN "typeLine" LIKE '%Basic Land%' THEN available_qty ELSE 0 END) as lands
      FROM available_cards
      WHERE available_qty > 0
      GROUP BY "setCode"
      ORDER BY SUM(available_qty) DESC
    `)

    // Minimum requirements for a viable sealed (relaxed for collection-based)
    // At least some cards of each rarity
    const MIN_COMMONS = 7
    const MIN_UNCOMMONS = 3
    const MIN_RARES = 1

    const sets = setsWithCounts.map(s => {
      const commons = Number(s.commons)
      const uncommons = Number(s.uncommons)
      const rares = Number(s.rares)
      const mythics = Number(s.mythics)
      const lands = Number(s.lands)
      const totalCards = Number(s.totalCards)

      // Check if viable for sealed
      const isViable = commons >= MIN_COMMONS && uncommons >= MIN_UNCOMMONS && (rares >= MIN_RARES || mythics >= 1)

      return {
        setCode: s.setCode,
        setName: s.setName,
        totalCards,
        availableCards: Number(s.availableCards),
        commons,
        uncommons,
        rares,
        mythics,
        lands,
        isViable,
      }
    })

    const globalStats = {
      totalCards: sets.reduce((sum, s) => sum + s.totalCards, 0),
      commons: sets.reduce((sum, s) => sum + s.commons, 0),
      uncommons: sets.reduce((sum, s) => sum + s.uncommons, 0),
      rares: sets.reduce((sum, s) => sum + s.rares, 0),
      mythics: sets.reduce((sum, s) => sum + s.mythics, 0),
      lands: sets.reduce((sum, s) => sum + s.lands, 0),
    }

    return NextResponse.json({ sets, globalStats })
  } catch (error) {
    console.error('Error fetching collection sets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collection sets', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
