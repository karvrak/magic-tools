import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getRequestUser, verifyOwnerAccess } from '@/lib/api-auth'
import { createCardTagSchema } from '@/lib/validations'

// GET /api/card-tags?deckId=...
// Liste les tags accessibles depuis un deck:
//   * tags globaux de l'utilisateur (deckId = null)
//   * tags spécifiques au deck demandé (si deckId fourni)
// Sans deckId, retourne uniquement les tags globaux de l'utilisateur.
export async function GET(request: NextRequest) {
  try {
    const { userId, role } = await getRequestUser()
    const deckId = request.nextUrl.searchParams.get('deckId')

    if (deckId) {
      const deck = await prisma.deck.findUnique({
        where: { id: deckId },
        select: { ownerId: true },
      })
      if (!deck) {
        return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
      }
      if (deck.ownerId === null) {
        if (role !== 'admin') {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      } else {
        const allowed = await verifyOwnerAccess(deck.ownerId, userId, role)
        if (!allowed) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
    }

    const tags = await prisma.cardTag.findMany({
      where: {
        userId,
        OR: deckId
          ? [{ deckId: null }, { deckId }]
          : [{ deckId: null }],
      },
      include: {
        _count: { select: { deckCards: true } },
      },
      orderBy: [{ deckId: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({
      tags: tags.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        deckId: t.deckId,
        scope: t.deckId ? 'deck' : 'global',
        usageCount: t._count.deckCards,
        createdAt: t.createdAt,
      })),
    })
  } catch (error) {
    console.error('Error listing card tags:', error)
    return NextResponse.json({ error: 'Failed to list card tags' }, { status: 500 })
  }
}

// POST /api/card-tags — crée un tag (global ou spécifique au deck)
export async function POST(request: NextRequest) {
  try {
    const { userId, role } = await getRequestUser()
    const body = await request.json()
    const parsed = createCardTagSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { name, color, deckId } = parsed.data

    if (deckId) {
      const deck = await prisma.deck.findUnique({
        where: { id: deckId },
        select: { ownerId: true },
      })
      if (!deck) {
        return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
      }
      if (deck.ownerId === null) {
        if (role !== 'admin') {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      } else {
        const allowed = await verifyOwnerAccess(deck.ownerId, userId, role)
        if (!allowed) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
    }

    const existing = await prisma.cardTag.findFirst({
      where: { userId, deckId: deckId ?? null, name },
    })
    if (existing) {
      return NextResponse.json({ error: 'Tag already exists', tag: existing }, { status: 409 })
    }

    const tag = await prisma.cardTag.create({
      data: {
        name,
        color: color || '#8B5CF6',
        userId,
        deckId: deckId ?? null,
      },
    })

    return NextResponse.json({
      tag: {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        deckId: tag.deckId,
        scope: tag.deckId ? 'deck' : 'global',
        usageCount: 0,
        createdAt: tag.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating card tag:', error)
    return NextResponse.json({ error: 'Failed to create card tag' }, { status: 500 })
  }
}
