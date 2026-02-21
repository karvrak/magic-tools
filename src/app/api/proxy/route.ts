import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { addProxyItemSchema, updateProxyItemSchema, deleteProxyItemParamsSchema } from '@/lib/validations'

// GET /api/proxy - Get all proxy items (optionally filtered by owner)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ownerId = searchParams.get('ownerId')

    const items = await prisma.proxyItem.findMany({
      where: ownerId ? { ownerId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        card: {
          select: {
            id: true,
            name: true,
            printedName: true,
            setCode: true,
            setName: true,
            rarity: true,
            imageNormal: true,
            imageSmall: true,
            collectorNumber: true,
          },
        },
      },
    })

    return NextResponse.json({
      items,
      total: items.reduce((sum, item) => sum + item.quantity, 0),
    })
  } catch (error) {
    console.error('Error fetching proxy list:', error)
    return NextResponse.json(
      { error: 'Failed to fetch proxy list' },
      { status: 500 }
    )
  }
}

// POST /api/proxy - Add item to proxy list
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = addProxyItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { cardId, quantity, ownerId } = parsed.data

    // Check if card exists
    const card = await prisma.card.findUnique({ where: { id: cardId } })
    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      )
    }

    // If ownerId provided, verify owner exists
    if (ownerId) {
      const owner = await prisma.owner.findUnique({ where: { id: ownerId } })
      if (!owner) {
        return NextResponse.json(
          { error: 'Owner not found' },
          { status: 404 }
        )
      }
    }

    // Check if already in proxy list for this owner
    const existing = await prisma.proxyItem.findUnique({
      where: {
        cardId_ownerId: {
          cardId,
          ownerId: (ownerId ?? null) as string,
        },
      },
    })

    if (existing) {
      // Increment quantity
      const updated = await prisma.proxyItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
        include: { card: true },
      })
      return NextResponse.json({ item: updated })
    }

    // Create new proxy item
    const item = await prisma.proxyItem.create({
      data: {
        cardId,
        ownerId: (ownerId ?? null) as string,
        quantity: Math.max(1, quantity),
      },
      include: { card: true },
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('Error adding to proxy list:', error)
    return NextResponse.json(
      { error: 'Failed to add to proxy list' },
      { status: 500 }
    )
  }
}

// PATCH /api/proxy - Update proxy item quantity
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = updateProxyItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { id, quantity } = parsed.data

    if (quantity <= 0) {
      await prisma.proxyItem.delete({ where: { id } })
      return NextResponse.json({ success: true, deleted: true })
    }

    const item = await prisma.proxyItem.update({
      where: { id },
      data: { quantity },
      include: { card: true },
    })

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Error updating proxy item:', error)
    return NextResponse.json(
      { error: 'Failed to update proxy item' },
      { status: 500 }
    )
  }
}

// DELETE /api/proxy - Remove item from proxy list
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    // Support "all" to clear entire proxy list
    if (id === 'all') {
      const ownerId = searchParams.get('ownerId')
      await prisma.proxyItem.deleteMany({
        where: ownerId ? { ownerId } : undefined,
      })
      return NextResponse.json({ success: true })
    }

    const parsed = deleteProxyItemParamsSchema.safeParse({ id })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    await prisma.proxyItem.delete({ where: { id: parsed.data.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing from proxy list:', error)
    return NextResponse.json(
      { error: 'Failed to remove from proxy list' },
      { status: 500 }
    )
  }
}
