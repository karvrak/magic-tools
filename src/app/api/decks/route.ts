import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getBestPrice } from '@/lib/utils'
import { createDeckSchema } from '@/lib/validations'

// Helper to compute deck's color identity from its cards
// Uses intersection of spell colors and land colors to determine actual deck colors
function computeDeckColors(cards: { card: { colorIdentity: string[], typeLine?: string | null } }[]): string[] {
  const spellColors = new Set<string>()
  const landColors = new Set<string>()

  for (const dc of cards) {
    const typeLine = dc.card.typeLine?.toLowerCase() || ''
    const isLand = typeLine.includes('land')

    for (const color of dc.card.colorIdentity || []) {
      if (isLand) {
        landColors.add(color)
      } else {
        spellColors.add(color)
      }
    }
  }

  // Sort in WUBRG order
  const colorOrder = ['W', 'U', 'B', 'R', 'G']

  // If no lands with colors (e.g., colorless deck or only Wastes), use spell colors
  if (landColors.size === 0) {
    return colorOrder.filter(c => spellColors.has(c))
  }

  // If no spells with colors, use land colors
  if (spellColors.size === 0) {
    return colorOrder.filter(c => landColors.has(c))
  }

  // Intersection: only colors that appear in BOTH spells AND lands
  return colorOrder.filter(c => spellColors.has(c) && landColors.has(c))
}

// GET /api/decks - List all decks with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ownerId = searchParams.get('ownerId')
    const cardName = searchParams.get('cardName')?.trim()
    const colorsParam = searchParams.get('colors') // e.g. "WU" or "W,U"
    const colorMode = searchParams.get('colorMode') || 'any' // any, all, exact
    const tagsParam = searchParams.get('tags') // e.g. "aggro,budget" or "aggro"
    const tagMode = searchParams.get('tagMode') || 'any' // any, all

    // Parse colors parameter
    const filterColors = colorsParam 
      ? colorsParam.split(/[,\s]*/).filter(c => ['W', 'U', 'B', 'R', 'G'].includes(c))
      : []

    // Parse tags parameter (lowercase, trimmed)
    const filterTags = tagsParam
      ? tagsParam.split(',').map(t => t.toLowerCase().trim()).filter(t => t.length > 0)
      : []

    // Build where clause for card name filter
    // If cardName is specified, we need to filter decks that contain a card with that name
    let deckIdsWithCard: string[] | null = null
    if (cardName) {
      const decksWithCard = await prisma.deckCard.findMany({
        where: {
          card: {
            OR: [
              { name: { contains: cardName, mode: 'insensitive' } },
              { printedName: { contains: cardName, mode: 'insensitive' } },
            ]
          }
        },
        select: { deckId: true },
        distinct: ['deckId']
      })
      deckIdsWithCard = decksWithCard.map(d => d.deckId)
    }

    // Build tags filter for Prisma
    const tagsFilter = filterTags.length > 0
      ? tagMode === 'all'
        ? { AND: filterTags.map(tag => ({ tags: { some: { name: tag } } })) }
        : { tags: { some: { name: { in: filterTags } } } }
      : {}

    const decks = await prisma.deck.findMany({
      where: {
        ...(ownerId ? { ownerId } : {}),
        ...(deckIdsWithCard !== null ? { id: { in: deckIdsWithCard } } : {}),
        ...tagsFilter,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        tags: {
          select: {
            id: true,
            name: true,
            color: true,
          },
          orderBy: { name: 'asc' },
        },
        cards: {
          include: {
            card: {
              select: {
                oracleId: true,
                imageArtCrop: true,
                imageNormal: true,
                colorIdentity: true,
                cmc: true, // For average CMC calculation
                typeLine: true, // To exclude lands from CMC calculation
                // Include card-specific prices
                priceEur: true,
                priceEurFoil: true,
                priceUsd: true,
                priceUsdFoil: true,
              },
            },
          },
        },
      },
    })

    // Fetch minimum prices per oracleId (cheapest version of each card)
    const allOracleIds = [...new Set(
      decks.flatMap((deck) => deck.cards.map((c) => c.card.oracleId))
    )]
    const minPricesRaw = await prisma.card.groupBy({
      by: ['oracleId'],
      where: {
        oracleId: { in: allOracleIds },
        OR: [
          { priceEur: { not: null } },
          { priceUsd: { not: null } },
        ],
      },
      _min: {
        priceEur: true,
        priceUsd: true,
      },
    })
    const minPriceMap = new Map(minPricesRaw.map((p) => [p.oracleId, {
      eur: p._min.priceEur,
      usd: p._min.priceUsd,
    }]))

    // Format response with card count, cover image, owner, status, colors and total price
    let formattedDecks = decks.map((deck) => {
      // Calculate deck's color identity
      const colors = computeDeckColors(deck.cards)
      
      // Calculate total price for this deck - use card-specific prices
      const totalPrice = deck.cards.reduce((sum, dc) => {
        const card = dc.card

        const priceData = (card.priceEur !== null || card.priceUsd !== null)
          ? {
              eur: card.priceEur,
              eurFoil: card.priceEurFoil,
              usd: card.priceUsd,
              usdFoil: card.priceUsdFoil,
            }
          : null

        const best = getBestPrice(priceData)
        // Convert USD to EUR approximation for total (rough estimate)
        const priceEur = best
          ? (best.currency === 'EUR' ? best.value : best.value * 0.92)
          : 0
        return sum + priceEur * dc.quantity
      }, 0)

      // Calculate minimum total price (cheapest version of each card)
      const minTotalPrice = deck.cards.reduce((sum, dc) => {
        const card = dc.card
        const minPrice = minPriceMap.get(card.oracleId)

        if (minPrice && (minPrice.eur !== null || minPrice.usd !== null)) {
          const priceEur = minPrice.eur !== null
            ? minPrice.eur
            : (minPrice.usd !== null ? minPrice.usd * 0.92 : 0)
          return sum + priceEur * dc.quantity
        }

        return sum
      }, 0)

      // Calculate total card count (sum of quantities)
      const cardCount = deck.cards.reduce((sum, dc) => sum + dc.quantity, 0)

      // Calculate average CMC (excluding lands)
      const nonLandCards = deck.cards.filter(dc => {
        const typeLine = dc.card.typeLine?.toLowerCase() || ''
        return !typeLine.includes('land')
      })
      const totalCmc = nonLandCards.reduce((sum, dc) => sum + (dc.card.cmc || 0) * dc.quantity, 0)
      const nonLandCount = nonLandCards.reduce((sum, dc) => sum + dc.quantity, 0)
      const avgCmc = nonLandCount > 0 ? totalCmc / nonLandCount : 0

      return {
        id: deck.id,
        name: deck.name,
        description: deck.description,
        format: deck.format,
        status: deck.status, // building, active, locked
        colors, // deck's color identity
        cardCount,
        avgCmc: Math.round(avgCmc * 100) / 100, // Round to 2 decimals
        totalPrice,
        minTotalPrice, // cheapest version of each card
        owner: deck.owner,
        tags: deck.tags, // tags du deck
        coverImage: deck.coverImage || deck.cards[0]?.card.imageArtCrop || deck.cards[0]?.card.imageNormal,
        createdAt: deck.createdAt,
        updatedAt: deck.updatedAt,
      }
    })

    // Filter by colors if specified (client-side filtering after computing colors)
    if (filterColors.length > 0) {
      formattedDecks = formattedDecks.filter((deck) => {
        switch (colorMode) {
          case 'exact':
            // Deck has exactly these colors
            return deck.colors.length === filterColors.length &&
                   filterColors.every(c => deck.colors.includes(c))
          case 'all':
            // Deck contains all these colors (and possibly more)
            return filterColors.every(c => deck.colors.includes(c))
          case 'any':
          default:
            // Deck contains at least one of these colors
            return filterColors.some(c => deck.colors.includes(c))
        }
      })
    }

    return NextResponse.json({ decks: formattedDecks })
  } catch (error) {
    console.error('Error fetching decks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch decks' },
      { status: 500 }
    )
  }
}

// POST /api/decks - Create a new deck
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createDeckSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { name, description, format, ownerId, status } = parsed.data

    // If no ownerId provided, use the default owner
    let finalOwnerId = ownerId
    if (!finalOwnerId) {
      const defaultOwner = await prisma.owner.findFirst({
        where: { isDefault: true },
      })
      finalOwnerId = defaultOwner?.id || null
    }

    const deck = await prisma.deck.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        format: format || null,
        ownerId: finalOwnerId,
        status: status || 'active',
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    })

    return NextResponse.json({ deck }, { status: 201 })
  } catch (error) {
    console.error('Error creating deck:', error)
    return NextResponse.json(
      { error: 'Failed to create deck' },
      { status: 500 }
    )
  }
}
