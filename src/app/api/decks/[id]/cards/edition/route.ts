import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { changeCardEditionSchema } from '@/lib/validations'

// PATCH /api/decks/[id]/cards/edition - Change card edition in deck
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deckId } = await params
    const body = await request.json()
    const parsed = changeCardEditionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { currentCardId, newCardId, category } = parsed.data

    if (currentCardId === newCardId) {
      return NextResponse.json(
        { error: 'New card ID must be different from current' },
        { status: 400 }
      )
    }

    // Get both cards to verify they have the same oracleId
    const [currentCard, newCard] = await Promise.all([
      prisma.card.findUnique({ where: { id: currentCardId }, select: { oracleId: true } }),
      prisma.card.findUnique({ where: { id: newCardId } }),
    ])

    if (!currentCard) {
      return NextResponse.json(
        { error: 'Current card not found' },
        { status: 404 }
      )
    }

    if (!newCard) {
      return NextResponse.json(
        { error: 'New card not found' },
        { status: 404 }
      )
    }

    if (currentCard.oracleId !== newCard.oracleId) {
      return NextResponse.json(
        { error: 'Cannot change to a different card, only different editions of the same card' },
        { status: 400 }
      )
    }

    // Find the current deck card entry
    const currentDeckCard = await prisma.deckCard.findUnique({
      where: {
        deckId_cardId_category: {
          deckId,
          cardId: currentCardId,
          category,
        },
      },
    })

    if (!currentDeckCard) {
      return NextResponse.json(
        { error: 'Card not found in deck' },
        { status: 404 }
      )
    }

    // Check if the new edition already exists in the deck
    const existingNewEdition = await prisma.deckCard.findUnique({
      where: {
        deckId_cardId_category: {
          deckId,
          cardId: newCardId,
          category,
        },
      },
    })

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      if (existingNewEdition) {
        // If new edition already exists, merge quantities
        const updatedCard = await tx.deckCard.update({
          where: {
            deckId_cardId_category: {
              deckId,
              cardId: newCardId,
              category,
            },
          },
          data: {
            quantity: existingNewEdition.quantity + currentDeckCard.quantity,
          },
          include: { card: true },
        })

        // Delete the old edition entry
        await tx.deckCard.delete({
          where: {
            deckId_cardId_category: {
              deckId,
              cardId: currentCardId,
              category,
            },
          },
        })

        return updatedCard
      } else {
        // Delete old entry first to avoid unique constraint issues
        await tx.deckCard.delete({
          where: {
            deckId_cardId_category: {
              deckId,
              cardId: currentCardId,
              category,
            },
          },
        })

        // Create new entry with the new edition
        const newDeckCard = await tx.deckCard.create({
          data: {
            deckId,
            cardId: newCardId,
            quantity: currentDeckCard.quantity,
            category,
          },
          include: { card: true },
        })

        return newDeckCard
      }
    })

    return NextResponse.json({ deckCard: result })
  } catch (error) {
    console.error('Error changing card edition:', error)
    return NextResponse.json(
      { error: 'Failed to change card edition' },
      { status: 500 }
    )
  }
}
