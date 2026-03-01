import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import prisma from '@/lib/prisma'
import { getRequestUser, verifyOwnerAccess } from '@/lib/api-auth'

// POST /api/decks/[id]/share - Generate share token
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId, role } = await getRequestUser()

    const deck = await prisma.deck.findUnique({
      where: { id },
      select: { id: true, shareToken: true, ownerId: true },
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

    // Return existing token if already shared
    if (deck.shareToken) {
      return NextResponse.json({ shareToken: deck.shareToken })
    }

    // Generate a unique 12-char token
    const shareToken = randomBytes(9).toString('base64url').slice(0, 12)

    await prisma.deck.update({
      where: { id },
      data: { shareToken },
    })

    return NextResponse.json({ shareToken })
  } catch (error) {
    console.error('Error generating share token:', error)
    return NextResponse.json(
      { error: 'Failed to generate share link' },
      { status: 500 }
    )
  }
}

// DELETE /api/decks/[id]/share - Revoke share token
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId, role } = await getRequestUser()

    const deckForAuth = await prisma.deck.findUnique({ where: { id }, select: { ownerId: true } })
    if (!deckForAuth) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }
    if (deckForAuth.ownerId) {
      const hasAccess = await verifyOwnerAccess(deckForAuth.ownerId, userId, role)
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.deck.update({
      where: { id },
      data: { shareToken: null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error revoking share token:', error)
    return NextResponse.json(
      { error: 'Failed to revoke share link' },
      { status: 500 }
    )
  }
}
