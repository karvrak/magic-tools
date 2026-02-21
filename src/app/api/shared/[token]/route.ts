import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getBestPrice } from '@/lib/utils'

// GET /api/shared/[token] - Public read-only deck data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const deck = await prisma.deck.findUnique({
      where: { shareToken: token },
      include: {
        owner: {
          select: {
            name: true,
            color: true,
          },
        },
        tags: {
          select: {
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

    const cardsWithPrices = deck.cards.map((dc) => {
      const card = dc.card
      const hasCardPrice = card.priceEur !== null || card.priceUsd !== null

      const price = hasCardPrice
        ? {
            eur: card.priceEur,
            eurFoil: card.priceEurFoil,
            usd: card.priceUsd,
            usdFoil: card.priceUsdFoil,
          }
        : null

      return {
        quantity: dc.quantity,
        category: dc.category,
        card: {
          name: card.name,
          printedName: card.printedName,
          manaCost: card.manaCost,
          cmc: card.cmc,
          typeLine: card.typeLine,
          printedTypeLine: card.printedTypeLine,
          rarity: card.rarity,
          setCode: card.setCode,
          setName: card.setName,
          imageSmall: card.imageSmall,
          imageNormal: card.imageNormal,
          colors: card.colors,
          colorIdentity: card.colorIdentity,
          power: card.power,
          toughness: card.toughness,
          loyalty: card.loyalty,
          price,
        },
      }
    })

    const totalPrice = cardsWithPrices.reduce((sum, dc) => {
      const best = getBestPrice(dc.card.price)
      const priceEur = best
        ? (best.currency === 'EUR' ? best.value : best.value * 0.92)
        : 0
      return sum + priceEur * dc.quantity
    }, 0)

    return NextResponse.json({
      deck: {
        name: deck.name,
        description: deck.description,
        format: deck.format,
        coverImage: deck.coverImage,
        owner: deck.owner,
        tags: deck.tags,
        cards: cardsWithPrices,
        totalPrice,
      },
    })
  } catch (error) {
    console.error('Error fetching shared deck:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shared deck' },
      { status: 500 }
    )
  }
}
