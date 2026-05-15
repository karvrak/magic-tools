import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getBestPrice } from '@/lib/utils'
import { updateDeckSchema } from '@/lib/validations'
import { getRequestUser, getUserOwnerIds, verifyOwnerAccess } from '@/lib/api-auth'

// GET /api/decks/[id] - Get deck with all cards
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getRequestUser()
    const { id } = await params

    const deck = await prisma.deck.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        tags: {
          select: {
            id: true,
            name: true,
            color: true,
          },
          orderBy: { name: 'asc' },
        },
        cards: {
          include: {
            card: true,
            tags: {
              include: {
                cardTag: {
                  select: {
                    id: true,
                    name: true,
                    color: true,
                    deckId: true,
                  },
                },
              },
            },
          },
          orderBy: [{ category: 'asc' }, { card: { name: 'asc' } }],
        },
        cardTags: {
          select: {
            id: true,
            name: true,
            color: true,
            deckId: true,
            userId: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    })

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    // Verify the requesting user has access to this deck's owner
    // A deck with no ownerId is restricted to admins
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

    // Tags accessibles depuis ce deck: tags spécifiques au deck + tags globaux
    // de l'utilisateur (le owner du deck si non-admin, sinon l'admin lui-même
    // — un admin voit ses propres tags globaux).
    const deckOwner = deck.ownerId
      ? await prisma.owner.findUnique({
          where: { id: deck.ownerId },
          select: { userId: true },
        })
      : null
    const tagOwnerUserId = deckOwner?.userId ?? userId
    const globalCardTags = await prisma.cardTag.findMany({
      where: { userId: tagOwnerUserId, deckId: null },
      select: { id: true, name: true, color: true, deckId: true },
      orderBy: { name: 'asc' },
    })
    const allCardTags = [...deck.cardTags, ...globalCardTags].map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      scope: t.deckId ? 'deck' : 'global',
    }))

    // Tags globaux assignés (UserCardTag) pour les oracleIds présents dans le deck.
    // C'est ce qui rend un tag "Removal" visible dans tous les decks où la carte
    // apparaît, sans dupliquer l'assignation par DeckCard.
    const deckOracleIds = [...new Set(deck.cards.map((dc) => dc.card.oracleId))]
    const globalAssignments = deckOracleIds.length
      ? await prisma.userCardTag.findMany({
          where: { userId: tagOwnerUserId, oracleId: { in: deckOracleIds } },
          include: { cardTag: { select: { id: true, name: true, color: true } } },
        })
      : []
    const globalTagsByOracleId = new Map<string, { id: string; name: string; color: string; scope: 'global' }[]>()
    for (const row of globalAssignments) {
      const list = globalTagsByOracleId.get(row.oracleId) ?? []
      list.push({ id: row.cardTag.id, name: row.cardTag.name, color: row.cardTag.color, scope: 'global' })
      globalTagsByOracleId.set(row.oracleId, list)
    }

    // Fetch minimum prices per oracleId (cheapest version of each card)
    const oracleIds = [...new Set(deck.cards.map((c) => c.card.oracleId))]
    const minPricesRaw = await prisma.card.groupBy({
      by: ['oracleId'],
      where: {
        oracleId: { in: oracleIds },
        OR: [
          { priceEur: { not: null } },
          { priceUsd: { not: null } },
        ],
      },
      _min: {
        priceEur: true,
        priceUsd: true,
      },
    })
    const minPriceMap = new Map(minPricesRaw.map((p) => [p.oracleId, {
      eur: p._min.priceEur,
      usd: p._min.priceUsd,
    }]))

    // Format cards with prices - USE CARD-SPECIFIC PRICES (per illustration)
    const cardsWithPrices = deck.cards.map((dc) => {
      const card = dc.card
      const minPrice = minPriceMap.get(card.oracleId)

      const hasCardPrice = card.priceEur !== null || card.priceUsd !== null

      const price = hasCardPrice
        ? {
            eur: card.priceEur,
            eurFoil: card.priceEurFoil,
            usd: card.priceUsd,
            usdFoil: card.priceUsdFoil,
          }
        : null

      // Calculate min price in EUR for this card
      const minPriceEur = minPrice
        ? (minPrice.eur !== null ? minPrice.eur : (minPrice.usd !== null ? minPrice.usd * 0.92 : null))
        : null

      const deckScopedTags: { id: string; name: string; color: string; scope: 'deck' | 'global' }[] = dc.tags
        .filter((t) => t.cardTag.deckId !== null)
        .map((t) => ({
          id: t.cardTag.id,
          name: t.cardTag.name,
          color: t.cardTag.color,
          scope: 'deck' as const,
        }))
      const globalTags = globalTagsByOracleId.get(card.oracleId) ?? []
      // Union (deck-scope + global), unique par id.
      const seen = new Set<string>()
      const mergedTags: { id: string; name: string; color: string; scope: 'deck' | 'global' }[] = []
      for (const t of [...deckScopedTags, ...globalTags]) {
        if (seen.has(t.id)) continue
        seen.add(t.id)
        mergedTags.push(t)
      }

      return {
        id: dc.id,
        cardId: dc.cardId,
        quantity: dc.quantity,
        category: dc.category,
        tags: mergedTags,
        card: {
          ...card,
          legalities: card.legalities as Record<string, string>,
          price,
          minPriceEur, // cheapest version available
        },
      }
    })

    // Agrégat: nombre de cartes (en respectant les quantités) par tag.
    const tagStats = new Map<string, { id: string; name: string; color: string; scope: string; count: number; uniqueCards: number }>()
    for (const dc of cardsWithPrices) {
      for (const tag of dc.tags) {
        const existing = tagStats.get(tag.id)
        if (existing) {
          existing.count += dc.quantity
          existing.uniqueCards += 1
        } else {
          tagStats.set(tag.id, {
            id: tag.id,
            name: tag.name,
            color: tag.color,
            scope: tag.scope,
            count: dc.quantity,
            uniqueCards: 1,
          })
        }
      }
    }
    const tagStatsArray = Array.from(tagStats.values()).sort((a, b) => b.count - a.count)

    // Calculate total price - use getBestPrice for EUR/USD fallback
    const totalPrice = cardsWithPrices.reduce((sum, dc) => {
      const best = getBestPrice(dc.card.price)
      // Convert USD to EUR approximation for total (rough estimate)
      const priceEur = best
        ? (best.currency === 'EUR' ? best.value : best.value * 0.92)
        : 0
      return sum + priceEur * dc.quantity
    }, 0)

    // Calculate minimum total price (cheapest version of each card)
    const minTotalPrice = cardsWithPrices.reduce((sum, dc) => {
      const minPrice = minPriceMap.get(dc.card.oracleId)

      if (minPrice && (minPrice.eur !== null || minPrice.usd !== null)) {
        const priceEur = minPrice.eur !== null
          ? minPrice.eur
          : (minPrice.usd !== null ? minPrice.usd * 0.92 : 0)
        return sum + priceEur * dc.quantity
      }

      return sum
    }, 0)

    return NextResponse.json({
      deck: {
        ...deck,
        status: deck.status, // building, active, locked
        cards: cardsWithPrices,
        totalPrice,
        minTotalPrice,
        availableCardTags: allCardTags,
        tagStats: tagStatsArray,
      },
    })
  } catch (error) {
    console.error('Error fetching deck:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deck' },
      { status: 500 }
    )
  }
}

// PATCH /api/decks/[id] - Update deck info
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getRequestUser()
    const { id } = await params

    // Verify ownership before processing the update
    const existingDeck = await prisma.deck.findUnique({
      where: { id },
      select: { ownerId: true },
    })
    if (!existingDeck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }
    if (existingDeck.ownerId === null) {
      if (role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      const allowed = await verifyOwnerAccess(existingDeck.ownerId, userId, role)
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const body = await request.json()
    const parsed = updateDeckSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { name, description, format, coverImage, ownerId, status, tagIds, addTagId, removeTagId } = parsed.data

    // Build tags update if provided
    let tagsUpdate = {}
    if (tagIds !== undefined) {
      // Replace all tags with the provided array
      tagsUpdate = {
        tags: {
          set: tagIds.map((tagId: string) => ({ id: tagId }))
        }
      }
    } else if (addTagId) {
      // Add a single tag
      tagsUpdate = {
        tags: {
          connect: { id: addTagId }
        }
      }
    } else if (removeTagId) {
      // Remove a single tag
      tagsUpdate = {
        tags: {
          disconnect: { id: removeTagId }
        }
      }
    }

    const deck = await prisma.deck.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(format !== undefined && { format: format || null }),
        ...(coverImage !== undefined && { coverImage }),
        ...(ownerId !== undefined && { ownerId: ownerId ?? null }),
        ...(status !== undefined && { status }),
        ...tagsUpdate,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        tags: {
          select: {
            id: true,
            name: true,
            color: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    })

    return NextResponse.json({ deck })
  } catch (error) {
    console.error('Error updating deck:', error)
    return NextResponse.json(
      { error: 'Failed to update deck' },
      { status: 500 }
    )
  }
}

// DELETE /api/decks/[id] - Delete deck
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getRequestUser()
    const { id } = await params

    // Verify ownership before deleting
    const existingDeck = await prisma.deck.findUnique({
      where: { id },
      select: { ownerId: true },
    })
    if (!existingDeck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }
    if (existingDeck.ownerId === null) {
      if (role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      const allowed = await verifyOwnerAccess(existingDeck.ownerId, userId, role)
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    await prisma.deck.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting deck:', error)
    return NextResponse.json(
      { error: 'Failed to delete deck' },
      { status: 500 }
    )
  }
}
