import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getBestPrice } from '@/lib/utils'
import { updateDeckSchema } from '@/lib/validations'

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

    // Fetch minimum prices per oracleId (cheapest version of each card)
    const oracleIds = [...new Set(deck.cards.map((c) => c.card.oracleId))]
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
      const minPrice = minPriceMap.get(card.oracleId)

      const hasCardPrice = card.priceEur !== null || card.priceUsd !== null

      const price = hasCardPrice
        ? {
            eur: card.priceEur,
            eurFoil: card.priceEurFoil,
            usd: card.priceUsd,
            usdFoil: card.priceUsdFoil,
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

      if (minPrice && (minPrice.eur !== null || minPrice.usd !== null)) {
        const priceEur = minPrice.eur !== null
          ? minPrice.eur
          : (minPrice.usd !== null ? minPrice.usd * 0.92 : 0)
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
    const parsed = updateDeckSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { name, description, format, coverImage, ownerId, status, tagIds, addTagId, removeTagId } = parsed.data

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
        ...(ownerId !== undefined && { ownerId: ownerId ?? null }),
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
