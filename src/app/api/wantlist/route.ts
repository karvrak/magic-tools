import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getBestPrice } from '@/lib/utils'
import { addWantlistItemSchema, updateWantlistItemSchema, deleteWantlistItemParamsSchema } from '@/lib/validations'
import { getRequestUser, getUserOwnerIds, buildOwnerFilter } from '@/lib/api-auth'

// GET /api/wantlist - Get all wantlist items (optionally filtered by owner)
export async function GET(request: NextRequest) {
  try {
    const { userId, role } = await getRequestUser()
    const ownerIds = await getUserOwnerIds(userId, role)

    const { searchParams } = new URL(request.url)
    const ownerIdParam = searchParams.get('ownerId')

    // Resolve effective where clause for owner scoping
    let ownerWhere: Record<string, unknown>

    if (ownerIds === null) {
      // Admin: respect the query param as-is
      ownerWhere = ownerIdParam ? { ownerId: ownerIdParam } : {}
    } else {
      // Regular user: scope to their ownerIds
      if (ownerIdParam) {
        if (!ownerIds.includes(ownerIdParam)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        ownerWhere = { ownerId: ownerIdParam }
      } else {
        ownerWhere = buildOwnerFilter(ownerIds)
      }
    }

    const items = await prisma.wantlistItem.findMany({
      where: ownerWhere,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        card: true,
        owner: true,
      },
    })

    // Format items with prices - USE CARD-SPECIFIC PRICES (per illustration)
    const formattedItems = items.map((item) => {
      const card = item.card
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
        id: item.id,
        cardId: item.cardId,
        ownerId: item.ownerId,
        owner: item.owner,
        quantity: item.quantity,
        priority: item.priority,
        notes: item.notes,
        isOrdered: item.isOrdered,
        orderedAt: item.orderedAt,
        isReceived: item.isReceived,
        receivedAt: item.receivedAt,
        createdAt: item.createdAt,
        card: {
          ...card,
          legalities: card.legalities as Record<string, string>,
          price,
        },
      }
    })

    // Calculate total price - use getBestPrice for EUR/USD fallback
    const totalPrice = formattedItems.reduce((sum, item) => {
      const best = getBestPrice(item.card.price)
      // Convert USD to EUR approximation for total (rough estimate)
      const priceEur = best
        ? (best.currency === 'EUR' ? best.value : best.value * 0.92)
        : 0
      return sum + priceEur * item.quantity
    }, 0)

    return NextResponse.json({
      items: formattedItems,
      total: items.length,
      totalPrice,
    })
  } catch (error) {
    console.error('Error fetching wantlist:', error)
    return NextResponse.json(
      { error: 'Failed to fetch wantlist' },
      { status: 500 }
    )
  }
}

// POST /api/wantlist - Add item to wantlist
export async function POST(request: NextRequest) {
  try {
    const { userId, role } = await getRequestUser()
    const ownerIds = await getUserOwnerIds(userId, role)

    const body = await request.json()
    const parsed = addWantlistItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { cardId, quantity, priority, notes, ownerId } = parsed.data

    // For regular users, verify the requested ownerId is within their allowed owners
    if (ownerIds !== null && ownerId) {
      if (!ownerIds.includes(ownerId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

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

    // Check if already in wantlist for this owner
    const existing = await prisma.wantlistItem.findUnique({
      where: {
        cardId_ownerId: {
          cardId,
          ownerId: (ownerId ?? null) as string
        }
      },
    })

    if (existing) {
      // Update quantity
      const updated = await prisma.wantlistItem.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + quantity,
        },
        include: { card: true, owner: true },
      })
      return NextResponse.json({ item: updated })
    }

    // Create new wantlist item
    const item = await prisma.wantlistItem.create({
      data: {
        cardId,
        ownerId: (ownerId ?? null) as string,
        quantity: Math.max(1, quantity),
        priority,
        notes: notes?.trim() || null,
      },
      include: { card: true, owner: true },
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('Error adding to wantlist:', error)
    return NextResponse.json(
      { error: 'Failed to add to wantlist' },
      { status: 500 }
    )
  }
}

// PATCH /api/wantlist - Update wantlist item
export async function PATCH(request: NextRequest) {
  try {
    const { userId, role } = await getRequestUser()
    const ownerIds = await getUserOwnerIds(userId, role)

    const body = await request.json()
    const parsed = updateWantlistItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { id, quantity, priority, notes, ownerId, isOrdered, isReceived } = parsed.data

    // For regular users, verify the item belongs to one of their owners before mutating
    if (ownerIds !== null) {
      const existingItem = await prisma.wantlistItem.findUnique({
        where: { id },
        select: { ownerId: true },
      })
      if (!existingItem) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 })
      }
      if (!existingItem.ownerId || !ownerIds.includes(existingItem.ownerId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      // If they're also trying to move to a different ownerId, validate that target too
      if (ownerId !== undefined && ownerId !== null && !ownerIds.includes(ownerId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (quantity !== undefined && quantity <= 0) {
      // Delete if quantity is 0
      await prisma.wantlistItem.delete({ where: { id } })
      return NextResponse.json({ success: true, deleted: true })
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (quantity !== undefined) updateData.quantity = quantity
    if (priority !== undefined) updateData.priority = priority
    if (notes !== undefined) updateData.notes = notes?.trim() || null
    if (ownerId !== undefined) updateData.ownerId = ownerId || null

    // Order tracking
    if (isOrdered !== undefined) {
      updateData.isOrdered = isOrdered
      updateData.orderedAt = isOrdered ? new Date() : null
    }
    if (isReceived !== undefined) {
      updateData.isReceived = isReceived
      updateData.receivedAt = isReceived ? new Date() : null
    }

    const item = await prisma.wantlistItem.update({
      where: { id },
      data: updateData,
      include: { card: true, owner: true },
    })

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Error updating wantlist item:', error)
    return NextResponse.json(
      { error: 'Failed to update wantlist item' },
      { status: 500 }
    )
  }
}

// DELETE /api/wantlist - Remove item from wantlist
export async function DELETE(request: NextRequest) {
  try {
    const { userId, role } = await getRequestUser()
    const ownerIds = await getUserOwnerIds(userId, role)

    const { searchParams } = new URL(request.url)
    const parsed = deleteWantlistItemParamsSchema.safeParse({
      id: searchParams.get('id'),
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { id } = parsed.data

    // For regular users, verify the item belongs to one of their owners before deleting
    if (ownerIds !== null) {
      const existingItem = await prisma.wantlistItem.findUnique({
        where: { id },
        select: { ownerId: true },
      })
      if (!existingItem) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 })
      }
      if (!existingItem.ownerId || !ownerIds.includes(existingItem.ownerId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    await prisma.wantlistItem.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing from wantlist:', error)
    return NextResponse.json(
      { error: 'Failed to remove from wantlist' },
      { status: 500 }
    )
  }
}
