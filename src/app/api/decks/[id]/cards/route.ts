import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { addDeckCardSchema, updateDeckCardSchema, deleteDeckCardParamsSchema } from '@/lib/validations'

// POST /api/decks/[id]/cards - Add card to deck
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deckId } = await params
    const body = await request.json()
    const parsed = addDeckCardSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { cardId, quantity, category } = parsed.data

    // Check if card exists
    const card = await prisma.card.findUnique({ where: { id: cardId } })
    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      )
    }

    // Check if deck exists
    const deck = await prisma.deck.findUnique({ where: { id: deckId } })
    if (!deck) {
      return NextResponse.json(
        { error: 'Deck not found' },
        { status: 404 }
      )
    }

    // Upsert the card in the deck
    const deckCard = await prisma.deckCard.upsert({
      where: {
        deckId_cardId_category: {
          deckId,
          cardId,
          category,
        },
      },
      create: {
        deckId,
        cardId,
        quantity: Math.max(1, quantity),
        category,
      },
      update: {
        quantity: {
          increment: quantity,
        },
      },
      include: {
        card: true,
      },
    })

    return NextResponse.json({ deckCard }, { status: 201 })
  } catch (error) {
    console.error('Error adding card to deck:', error)
    return NextResponse.json(
      { error: 'Failed to add card to deck' },
      { status: 500 }
    )
  }
}

// PATCH /api/decks/[id]/cards - Update card quantity
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deckId } = await params
    const body = await request.json()
    const parsed = updateDeckCardSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { cardId, quantity, category } = parsed.data

    if (quantity <= 0) {
      // Remove card from deck if quantity is 0 or less
      await prisma.deckCard.deleteMany({
        where: {
          deckId,
          cardId,
          ...(category && { category }),
        },
      })
      return NextResponse.json({ success: true, deleted: true })
    }

    const deckCard = await prisma.deckCard.update({
      where: {
        deckId_cardId_category: {
          deckId,
          cardId,
          category: category || 'mainboard',
        },
      },
      data: {
        quantity,
      },
      include: {
        card: true,
      },
    })

    return NextResponse.json({ deckCard })
  } catch (error) {
    console.error('Error updating card in deck:', error)
    return NextResponse.json(
      { error: 'Failed to update card' },
      { status: 500 }
    )
  }
}

// DELETE /api/decks/[id]/cards - Remove card from deck
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deckId } = await params
    const { searchParams } = new URL(request.url)
    const parsed = deleteDeckCardParamsSchema.safeParse({
      cardId: searchParams.get('cardId'),
      category: searchParams.get('category'),
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { cardId, category } = parsed.data

    await prisma.deckCard.deleteMany({
      where: {
        deckId,
        cardId,
        ...(category && { category }),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing card from deck:', error)
    return NextResponse.json(
      { error: 'Failed to remove card' },
      { status: 500 }
    )
  }
}
