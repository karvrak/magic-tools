import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// POST /api/decks/[id]/duplicate - Duplicate a deck
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'New deck name is required' },
        { status: 400 }
      )
    }

    // Get the original deck with all cards
    const originalDeck = await prisma.deck.findUnique({
      where: { id },
      include: {
        cards: true,
      },
    })

    if (!originalDeck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    // Create the new deck with status "building"
    const newDeck = await prisma.deck.create({
      data: {
        name: name.trim(),
        description: originalDeck.description,
        format: originalDeck.format,
        coverImage: originalDeck.coverImage,
        ownerId: originalDeck.ownerId,
        status: 'building', // Duplicates start in building mode
        cards: {
          create: originalDeck.cards.map((card) => ({
            cardId: card.cardId,
            quantity: card.quantity,
            category: card.category,
          })),
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        cards: {
          include: {
            card: true,
          },
        },
      },
    })

    return NextResponse.json({ deck: newDeck }, { status: 201 })
  } catch (error) {
    console.error('Error duplicating deck:', error)
    return NextResponse.json(
      { error: 'Failed to duplicate deck' },
      { status: 500 }
    )
  }
}
