import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getRequestUser, verifyOwnerAccess } from '@/lib/api-auth'

interface AddedCard {
  cardId: string
  cardName: string
  quantity: number
  isNew: boolean // true if created, false if updated
}

// POST /api/decks/[id]/add-missing-to-wantlist - Add missing cards to wantlist (INSERT/UPDATE ONLY - NO DELETE)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deckId } = await params
    const { userId, role } = await getRequestUser()

    // Fetch deck with cards
    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        cards: {
          where: {
            // Only mainboard, sideboard, commander - not maybeboard
            category: { in: ['mainboard', 'sideboard', 'commander'] },
          },
          select: {
            cardId: true,
            quantity: true,
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

    if (deck.ownerId) {
      const hasAccess = await verifyOwnerAccess(deck.ownerId, userId, role)
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Aggregate deck needs by cardId (a card can appear in multiple categories)
    const deckNeeds = new Map<string, { quantity: number; name: string }>()
    for (const deckCard of deck.cards) {
      const existing = deckNeeds.get(deckCard.cardId)
      if (existing) {
        existing.quantity += deckCard.quantity
      } else {
        deckNeeds.set(deckCard.cardId, {
          quantity: deckCard.quantity,
          name: deckCard.card.printedName || deckCard.card.name,
        })
      }
    }

    const cardIds = [...deckNeeds.keys()]

    if (cardIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No cards in deck',
        added: [],
        totalAdded: 0,
      })
    }

    // Fetch collection items for these cards (same owner)
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

    // Fetch existing wantlist items for these cards
    const existingWantlistItems = await prisma.wantlistItem.findMany({
      where: {
        cardId: { in: cardIds },
        ownerId: deck.ownerId,
      },
      select: {
        id: true,
        cardId: true,
        quantity: true,
      },
    })

    const wantlistMap = new Map<string, { id: string; quantity: number }>()
    for (const item of existingWantlistItems) {
      wantlistMap.set(item.cardId, { id: item.id, quantity: item.quantity })
    }

    // Calculate missing cards and upsert to wantlist
    const addedCards: AddedCard[] = []

    for (const [cardId, need] of deckNeeds) {
      const owned = ownedMap.get(cardId) || 0
      const missing = Math.max(0, need.quantity - owned)

      if (missing > 0) {
        const existingWantlist = wantlistMap.get(cardId)

        if (existingWantlist) {
          // UPDATE existing wantlist item - add missing quantity (never decrease)
          const newQuantity = Math.max(existingWantlist.quantity, missing)
          if (newQuantity > existingWantlist.quantity) {
            await prisma.wantlistItem.update({
              where: { id: existingWantlist.id },
              data: { quantity: newQuantity },
            })
            addedCards.push({
              cardId,
              cardName: need.name,
              quantity: newQuantity - existingWantlist.quantity,
              isNew: false,
            })
          }
        } else {
          // INSERT new wantlist item
          await prisma.wantlistItem.create({
            data: {
              cardId,
              ownerId: deck.ownerId,
              quantity: missing,
              priority: 'medium',
              notes: `For deck: ${deck.name}`,
            },
          })
          addedCards.push({
            cardId,
            cardName: need.name,
            quantity: missing,
            isNew: true,
          })
        }
      }
    }

    const totalAdded = addedCards.reduce((sum, c) => sum + c.quantity, 0)

    return NextResponse.json({
      success: true,
      message: addedCards.length > 0
        ? `${addedCards.length} card(s) added to wantlist`
        : 'All cards are already in the collection or wantlist',
      added: addedCards,
      totalAdded,
      deckName: deck.name,
    })
  } catch (error) {
    console.error('Error adding missing cards to wantlist:', error)
    return NextResponse.json(
      { error: 'Failed to add missing cards to wantlist' },
      { status: 500 }
    )
  }
}
