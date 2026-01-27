import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getBestPrice } from '@/lib/utils'

// GET /api/decks/[id] - Get deck with all cards
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const deck = await prisma.deck.findUnique({
      where: { id },
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
            card: true,
          },
          orderBy: [{ category: 'asc' }, { card: { name: 'asc' } }],
        },
      },
    })

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    // Get oracle prices as fallback for cards without individual prices
    const oracleIds = [...new Set(deck.cards.map((c) => c.card.oracleId))]
    const oraclePrices = await prisma.cardPrice.findMany({
      where: { oracleId: { in: oracleIds } },
    })
    const oraclePriceMap = new Map(oraclePrices.map((p) => [p.oracleId, p]))

    // Fetch minimum prices per oracleId (cheapest version of each card)
    const minPricesRaw = await prisma.card.groupBy({
      by: ['oracleId'],
      where: {
        oracleId: { in: oracleIds },
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

    // Format cards with prices - USE CARD-SPECIFIC PRICES (per illustration)
    const cardsWithPrices = deck.cards.map((dc) => {
      const card = dc.card
      const oraclePrice = oraclePriceMap.get(card.oracleId)
      const minPrice = minPriceMap.get(card.oracleId)

      // Use card-specific prices if available, otherwise fallback to oracle price
      const hasCardPrice = card.priceEur !== null || card.priceUsd !== null

      const price = hasCardPrice
        ? {
            eur: card.priceEur,
            eurFoil: card.priceEurFoil,
            usd: card.priceUsd,
            usdFoil: card.priceUsdFoil,
            tix: oraclePrice?.tix ?? null,
          }
        : oraclePrice
          ? {
              eur: oraclePrice.eur,
              eurFoil: oraclePrice.eurFoil,
              usd: oraclePrice.usd,
              usdFoil: oraclePrice.usdFoil,
              tix: oraclePrice.tix,
            }
          : null

      // Calculate min price in EUR for this card
      const minPriceEur = minPrice
        ? (minPrice.eur !== null ? minPrice.eur : (minPrice.usd !== null ? minPrice.usd * 0.92 : null))
        : null

      return {
        id: dc.id,
        cardId: dc.cardId,
        quantity: dc.quantity,
        category: dc.category,
        card: {
          ...card,
          legalities: card.legalities as Record<string, string>,
          price,
          minPriceEur, // cheapest version available
        },
      }
    })

    // Calculate total price - use getBestPrice for EUR/USD fallback
    const totalPrice = cardsWithPrices.reduce((sum, dc) => {
      const best = getBestPrice(dc.card.price)
      // Convert USD to EUR approximation for total (rough estimate)
      const priceEur = best
        ? (best.currency === 'EUR' ? best.value : best.value * 0.92)
        : 0
      return sum + priceEur * dc.quantity
    }, 0)

    // Calculate minimum total price (cheapest version of each card)
    const minTotalPrice = cardsWithPrices.reduce((sum, dc) => {
      const minPrice = minPriceMap.get(dc.card.oracleId)
      const oraclePrice = oraclePriceMap.get(dc.card.oracleId)

      // Use minimum price from all versions if available
      if (minPrice && (minPrice.eur !== null || minPrice.usd !== null)) {
        const priceEur = minPrice.eur !== null
          ? minPrice.eur
          : (minPrice.usd !== null ? minPrice.usd * 0.92 : 0)
        return sum + priceEur * dc.quantity
      }

      // Fallback to oracle price if no minimum found
      if (oraclePrice) {
        const best = getBestPrice({
          eur: oraclePrice.eur,
          eurFoil: oraclePrice.eurFoil,
          usd: oraclePrice.usd,
          usdFoil: oraclePrice.usdFoil,
        })
        const priceEur = best
          ? (best.currency === 'EUR' ? best.value : best.value * 0.92)
          : 0
        return sum + priceEur * dc.quantity
      }

      return sum
    }, 0)

    return NextResponse.json({
      deck: {
        ...deck,
        status: deck.status, // building, active, locked
        cards: cardsWithPrices,
        totalPrice,
        minTotalPrice,
      },
    })
  } catch (error) {
    console.error('Error fetching deck:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deck' },
      { status: 500 }
    )
  }
}

// PATCH /api/decks/[id] - Update deck info
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, format, coverImage, ownerId, status, tagIds, addTagId, removeTagId } = body

    // Validate status if provided
    if (status !== undefined && !['building', 'active', 'locked'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: building, active, or locked' },
        { status: 400 }
      )
    }

    // Build tags update if provided
    let tagsUpdate = {}
    if (tagIds !== undefined) {
      // Replace all tags with the provided array
      tagsUpdate = {
        tags: {
          set: tagIds.map((tagId: string) => ({ id: tagId }))
        }
      }
    } else if (addTagId) {
      // Add a single tag
      tagsUpdate = {
        tags: {
          connect: { id: addTagId }
        }
      }
    } else if (removeTagId) {
      // Remove a single tag
      tagsUpdate = {
        tags: {
          disconnect: { id: removeTagId }
        }
      }
    }

    const deck = await prisma.deck.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(format !== undefined && { format: format || null }),
        ...(coverImage !== undefined && { coverImage }),
        ...(ownerId !== undefined && { ownerId: ownerId || null }),
        ...(status !== undefined && { status }),
        ...tagsUpdate,
      },
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
      },
    })

    return NextResponse.json({ deck })
  } catch (error) {
    console.error('Error updating deck:', error)
    return NextResponse.json(
      { error: 'Failed to update deck' },
      { status: 500 }
    )
  }
}

// DELETE /api/decks/[id] - Delete deck
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.deck.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting deck:', error)
    return NextResponse.json(
      { error: 'Failed to delete deck' },
      { status: 500 }
    )
  }
}
