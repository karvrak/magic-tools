import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface CardAvailability {
  cardId: string
  cardName: string
  needed: number
  owned: number
  missing: number
  category: string
}

interface AvailabilityResponse {
  deckId: string
  deckName: string
  ownerId: string | null
  summary: {
    totalCards: number      // Total cards needed (with quantities)
    uniqueCards: number     // Unique card types
    ownedCards: number      // Cards owned (capped at needed)
    missingCards: number    // Cards missing
    coveragePercent: number // Percentage of deck covered
    isComplete: boolean     // 100% coverage
  }
  cards: CardAvailability[]
}

// GET /api/decks/[id]/availability - Get deck availability from collection (READ-ONLY)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deckId } = await params

    // Fetch deck with cards
    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        cards: {
          select: {
            cardId: true,
            quantity: true,
            category: true,
            card: {
              select: {
                id: true,
                name: true,
                printedName: true,
              },
            },
          },
        },
      },
    })

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    // Get all card IDs from the deck
    const cardIds = [...new Set(deck.cards.map((c) => c.cardId))]

    if (cardIds.length === 0) {
      return NextResponse.json({
        deckId: deck.id,
        deckName: deck.name,
        ownerId: deck.ownerId,
        summary: {
          totalCards: 0,
          uniqueCards: 0,
          ownedCards: 0,
          missingCards: 0,
          coveragePercent: 100,
          isComplete: true,
        },
        cards: [],
      } satisfies AvailabilityResponse)
    }

    // Fetch collection items for these cards (same owner)
    // We need to aggregate by cardId because collection can have multiple entries
    // (different conditions, foil status)
    const collectionItems = await prisma.collectionItem.findMany({
      where: {
        cardId: { in: cardIds },
        ownerId: deck.ownerId,
      },
      select: {
        cardId: true,
        quantity: true,
      },
    })

    // Build a map of cardId -> total owned quantity
    const ownedMap = new Map<string, number>()
    for (const item of collectionItems) {
      const current = ownedMap.get(item.cardId) || 0
      ownedMap.set(item.cardId, current + item.quantity)
    }

    // Calculate availability for each card in the deck
    const cardAvailability: CardAvailability[] = []
    let totalCards = 0
    let ownedCards = 0
    let missingCards = 0

    for (const deckCard of deck.cards) {
      const needed = deckCard.quantity
      const owned = ownedMap.get(deckCard.cardId) || 0
      const effectiveOwned = Math.min(owned, needed) // Cap at needed
      const missing = Math.max(0, needed - owned)

      totalCards += needed
      ownedCards += effectiveOwned
      missingCards += missing

      cardAvailability.push({
        cardId: deckCard.cardId,
        cardName: deckCard.card.printedName || deckCard.card.name,
        needed,
        owned,
        missing,
        category: deckCard.category,
      })
    }

    // Sort: missing first, then by category
    cardAvailability.sort((a, b) => {
      // Missing cards first
      if (a.missing > 0 && b.missing === 0) return -1
      if (a.missing === 0 && b.missing > 0) return 1
      // Then by missing count (descending)
      if (a.missing !== b.missing) return b.missing - a.missing
      // Then by category
      const categoryOrder = ['commander', 'mainboard', 'sideboard', 'maybeboard']
      return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
    })

    const coveragePercent = totalCards > 0
      ? Math.round((ownedCards / totalCards) * 100)
      : 100

    const response: AvailabilityResponse = {
      deckId: deck.id,
      deckName: deck.name,
      ownerId: deck.ownerId,
      summary: {
        totalCards,
        uniqueCards: cardIds.length,
        ownedCards,
        missingCards,
        coveragePercent,
        isComplete: missingCards === 0,
      },
      cards: cardAvailability,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching deck availability:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deck availability' },
      { status: 500 }
    )
  }
}
