import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getBestPrice } from '@/lib/utils'
import { addCollectionItemSchema, updateCollectionItemSchema, deleteCollectionItemParamsSchema } from '@/lib/validations'

// Minimal card fields needed for collection display
const cardSelect = {
  id: true,
  oracleId: true,
  name: true,
  typeLine: true,
  setCode: true,
  setName: true,
  collectorNumber: true,
  rarity: true,
  colors: true,
  cmc: true,
  imageNormal: true,
  priceEur: true,
  priceEurFoil: true,
  priceUsd: true,
  priceUsdFoil: true,
}

const ownerSelect = {
  id: true,
  name: true,
  color: true,
}

// GET /api/collection - Get collection items + wantlist items with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ownerId = searchParams.get('ownerId')
    const filter = searchParams.get('filter') // 'owned' | 'wanted' | 'all' (default: 'all')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '24')))
    const skip = (page - 1) * pageSize

    // Advanced card filters
    const name = searchParams.get('name')
    const colors = searchParams.get('colors')?.split(',').filter(Boolean) || []
    const colorMode = searchParams.get('colorMode') || 'include' // 'include' | 'exact' | 'atMost'
    const rarity = searchParams.get('rarity')?.split(',').filter(Boolean) || []
    const type = searchParams.get('type')
    const set = searchParams.get('set')
    const cmcMin = searchParams.get('cmcMin') ? parseFloat(searchParams.get('cmcMin')!) : null
    const cmcMax = searchParams.get('cmcMax') ? parseFloat(searchParams.get('cmcMax')!) : null
    const condition = searchParams.get('condition')
    const isFoil = searchParams.get('isFoil')
    const sortBy = searchParams.get('sortBy') || 'date' // 'date' | 'name' | 'price' | 'cmc' | 'rarity'
    const sortDir = searchParams.get('sortDir') || 'desc' // 'asc' | 'desc'

    // Build card filter conditions
    const buildCardWhere = () => {
      const conditions: Record<string, unknown> = {}

      if (name) {
        conditions.nameNormalized = { contains: name.toLowerCase() }
      }

      if (colors.length > 0) {
        // Sort colors in WUBRG order to match database storage
        const WUBRG_ORDER = ['W', 'U', 'B', 'R', 'G']
        const sortedColors = [...colors].sort((a, b) => WUBRG_ORDER.indexOf(a) - WUBRG_ORDER.indexOf(b))

        if (colorMode === 'exact') {
          // Exact match: card has exactly these colors (sorted in WUBRG order)
          conditions.colors = { equals: sortedColors }
        } else if (colorMode === 'atMost') {
          // At most: card colors are a subset of selected colors
          conditions.colors = { hasSome: sortedColors }
          conditions.NOT = {
            colors: {
              hasSome: WUBRG_ORDER.filter(c => !sortedColors.includes(c))
            }
          }
        } else {
          // include mode (default): card has at least all selected colors
          conditions.colors = { hasEvery: sortedColors }
        }
      }

      if (rarity.length > 0) {
        conditions.rarity = { in: rarity }
      }

      if (type) {
        conditions.typeLine = { contains: type, mode: 'insensitive' }
      }

      if (set) {
        conditions.setCode = set.toLowerCase()
      }

      if (cmcMin !== null || cmcMax !== null) {
        conditions.cmc = {}
        if (cmcMin !== null) (conditions.cmc as Record<string, number>).gte = cmcMin
        if (cmcMax !== null) (conditions.cmc as Record<string, number>).lte = cmcMax
      }

      return Object.keys(conditions).length > 0 ? conditions : undefined
    }

    const cardWhere = buildCardWhere()
    const hasCardFilters = cardWhere !== undefined

    // Build collection-specific filters
    const buildCollectionWhere = () => {
      const conditions: Record<string, unknown> = {}
      if (ownerId) conditions.ownerId = ownerId
      if (cardWhere) conditions.card = cardWhere
      if (condition) conditions.condition = condition
      if (isFoil === 'true') conditions.isFoil = true
      else if (isFoil === 'false') conditions.isFoil = false
      return conditions
    }

    const buildWantlistWhere = () => {
      const conditions: Record<string, unknown> = {}
      if (ownerId) conditions.ownerId = ownerId
      if (cardWhere) conditions.card = cardWhere
      return conditions
    }

    const collectionWhere = buildCollectionWhere()
    const wantlistWhere = buildWantlistWhere()

    // Get counts and totals via optimized aggregate queries (runs in parallel)
    const ownerWhere = ownerId ? { ownerId } : {}

    const [ownedStats, wantedStats] = await Promise.all([
      filter !== 'wanted'
        ? prisma.collectionItem.aggregate({
            where: collectionWhere,
            _count: { id: true },
            _sum: { quantity: true },
          })
        : Promise.resolve({ _count: { id: 0 }, _sum: { quantity: 0 } }),
      filter !== 'owned'
        ? prisma.wantlistItem.aggregate({
            where: wantlistWhere,
            _count: { id: true },
            _sum: { quantity: true },
          })
        : Promise.resolve({ _count: { id: 0 }, _sum: { quantity: 0 } }),
    ])

    const ownedCount = ownedStats._count.id || 0
    const wantedCount = wantedStats._count.id || 0
    const totalCount = ownedCount + wantedCount

    // Calculate skip/take for each table based on filter and page
    let collectionSkip = 0
    let collectionTake = 0
    let wantlistSkip = 0
    let wantlistTake = 0

    if (filter === 'owned') {
      collectionSkip = skip
      collectionTake = pageSize
    } else if (filter === 'wanted') {
      wantlistSkip = skip
      wantlistTake = pageSize
    } else {
      // Combined: owned items first, then wanted
      if (skip < ownedCount) {
        collectionSkip = skip
        collectionTake = Math.min(pageSize, ownedCount - skip)
        if (collectionTake < pageSize) {
          wantlistSkip = 0
          wantlistTake = pageSize - collectionTake
        }
      } else {
        wantlistSkip = skip - ownedCount
        wantlistTake = pageSize
      }
    }

    // Build sort order
    type SortOrder = 'asc' | 'desc'
    const buildOrderBy = () => {
      const dir: SortOrder = sortDir === 'asc' ? 'asc' : 'desc'
      switch (sortBy) {
        case 'name':
          return { card: { name: dir } }
        case 'price':
          return { card: { priceEur: dir } }
        case 'cmc':
          return { card: { cmc: dir } }
        case 'rarity':
          // Custom order: common < uncommon < rare < mythic
          return { card: { rarity: dir } }
        case 'set':
          return { card: { setCode: dir } }
        case 'date':
        default:
          return { createdAt: dir }
      }
    }

    const orderBy = buildOrderBy()

    // Fetch paginated items
    const [collectionItems, wantlistItems] = await Promise.all([
      collectionTake > 0
        ? prisma.collectionItem.findMany({
            where: collectionWhere,
            orderBy,
            skip: collectionSkip,
            take: collectionTake,
            select: {
              id: true,
              cardId: true,
              ownerId: true,
              quantity: true,
              condition: true,
              isFoil: true,
              notes: true,
              createdAt: true,
              updatedAt: true,
              card: { select: cardSelect },
              owner: { select: ownerSelect },
            },
          })
        : Promise.resolve([]),
      wantlistTake > 0
        ? prisma.wantlistItem.findMany({
            where: wantlistWhere,
            orderBy,
            skip: wantlistSkip,
            take: wantlistTake,
            select: {
              id: true,
              cardId: true,
              ownerId: true,
              quantity: true,
              priority: true,
              notes: true,
              isOrdered: true,
              orderedAt: true,
              isReceived: true,
              receivedAt: true,
              createdAt: true,
              card: { select: cardSelect },
              owner: { select: ownerSelect },
            },
          })
        : Promise.resolve([]),
    ])

    // Get total prices via SQL for global stats (runs in parallel with items fetch next time)
    const ownerFilter = ownerId ? `AND ci."ownerId" = '${ownerId}'` : ''
    const ownerFilterWant = ownerId ? `AND wi."ownerId" = '${ownerId}'` : ''

    const [ownedPriceResult, wantedPriceResult] = await Promise.all([
      filter !== 'wanted'
        ? prisma.$queryRawUnsafe<[{ total: number }]>(`
            SELECT COALESCE(SUM(
              ci.quantity *
              CASE ci.condition
                WHEN 'nm' THEN 1.0
                WHEN 'lp' THEN 0.9
                WHEN 'mp' THEN 0.75
                WHEN 'hp' THEN 0.5
                WHEN 'dmg' THEN 0.25
                ELSE 1.0
              END *
              COALESCE(
                CASE WHEN ci."isFoil" THEN c."priceEurFoil" ELSE c."priceEur" END,
                CASE WHEN ci."isFoil" THEN c."priceUsdFoil" * 0.92 ELSE c."priceUsd" * 0.92 END,
                0
              )
            ), 0) as total
            FROM "CollectionItem" ci
            JOIN "Card" c ON ci."cardId" = c.id
            WHERE 1=1 ${ownerFilter}
          `)
        : Promise.resolve([{ total: 0 }]),
      filter !== 'owned'
        ? prisma.$queryRawUnsafe<[{ total: number }]>(`
            SELECT COALESCE(SUM(
              wi.quantity *
              COALESCE(
                c."priceEur",
                c."priceUsd" * 0.92,
                0
              )
            ), 0) as total
            FROM "WantlistItem" wi
            JOIN "Card" c ON wi."cardId" = c.id
            WHERE 1=1 ${ownerFilterWant}
          `)
        : Promise.resolve([{ total: 0 }]),
    ])

    const ownedTotalPrice = Number(ownedPriceResult[0]?.total || 0)
    const wantedTotalPrice = Number(wantedPriceResult[0]?.total || 0)

    // Get oracle prices for cards without individual prices
    const allItems = [...collectionItems, ...wantlistItems]
    const cardIds = [...new Set(allItems.map((item) => item.cardId))]

    // Get decks containing these cards
    const deckCards = cardIds.length > 0 ? await prisma.deckCard.findMany({
      where: {
        cardId: { in: cardIds },
        ...(ownerId ? { deck: { ownerId } } : {}),
      },
      select: {
        cardId: true,
        quantity: true,
        deck: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }) : []

    // Build a map of cardId -> decks
    const cardDecksMap = new Map<string, { id: string; name: string; quantity: number }[]>()
    for (const dc of deckCards) {
      const existing = cardDecksMap.get(dc.cardId) || []
      const deckEntry = existing.find(d => d.id === dc.deck.id)
      if (deckEntry) {
        deckEntry.quantity += dc.quantity
      } else {
        existing.push({ id: dc.deck.id, name: dc.deck.name, quantity: dc.quantity })
      }
      cardDecksMap.set(dc.cardId, existing)
    }

    // Format items for response
    const formattedItems = allItems.map((item) => {
      const card = item.card
      const isOwned = 'condition' in item

      // Build price object from card-specific prices
      const hasCardPrice = card.priceEur !== null || card.priceUsd !== null

      const price = hasCardPrice
        ? {
            eur: card.priceEur,
            eurFoil: card.priceEurFoil,
            usd: card.priceUsd,
            usdFoil: card.priceUsdFoil,
          }
        : null

      const isFoil = isOwned ? (item as typeof collectionItems[0]).isFoil : false

      const wantItem = !isOwned ? (item as typeof wantlistItems[0]) : null

      return {
        id: item.id,
        cardId: item.cardId,
        ownerId: item.ownerId,
        owner: item.owner,
        quantity: item.quantity,
        type: isOwned ? 'owned' : 'wanted',
        condition: isOwned ? (item as typeof collectionItems[0]).condition : null,
        isFoil,
        updatedAt: isOwned ? (item as typeof collectionItems[0]).updatedAt : null,
        priority: wantItem?.priority ?? null,
        isOrdered: wantItem?.isOrdered ?? null,
        orderedAt: wantItem?.orderedAt ?? null,
        isReceived: wantItem?.isReceived ?? null,
        receivedAt: wantItem?.receivedAt ?? null,
        notes: item.notes,
        createdAt: item.createdAt,
        decksContaining: cardDecksMap.get(item.cardId) || [],
        card: {
          ...card,
          price,
        },
      }
    })

    return NextResponse.json({
      items: formattedItems,
      total: totalCount,
      page,
      pageSize,
      hasMore: skip + formattedItems.length < totalCount,
      owned: {
        count: ownedCount,
        cards: ownedStats._sum.quantity || 0,
        price: ownedTotalPrice,
      },
      wanted: {
        count: wantedCount,
        cards: wantedStats._sum.quantity || 0,
        price: wantedTotalPrice,
      },
    })
  } catch (error) {
    console.error('Error fetching collection:', error)
    return NextResponse.json({ error: 'Failed to fetch collection' }, { status: 500 })
  }
}

// POST /api/collection - Add item to collection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = addCollectionItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { cardId, quantity, condition, isFoil, notes, ownerId } = parsed.data

    // Check card exists and upsert in one query using unique constraint
    const existing = await prisma.collectionItem.findUnique({
      where: {
        cardId_ownerId_isFoil_condition: {
          cardId,
          ownerId: (ownerId ?? null) as string,
          isFoil,
          condition,
        },
      },
    })

    if (existing) {
      const updated = await prisma.collectionItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
        select: {
          id: true,
          cardId: true,
          quantity: true,
          condition: true,
          isFoil: true,
        },
      })
      return NextResponse.json({ item: updated })
    }

    const item = await prisma.collectionItem.create({
      data: {
        cardId,
        ownerId: (ownerId ?? null) as string,
        quantity: Math.max(1, quantity),
        condition,
        isFoil,
        notes: notes?.trim() || null,
      },
      select: {
        id: true,
        cardId: true,
        quantity: true,
        condition: true,
        isFoil: true,
      },
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('Error adding to collection:', error)
    return NextResponse.json({ error: 'Failed to add to collection' }, { status: 500 })
  }
}

// PATCH /api/collection - Update collection item
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = updateCollectionItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { id, quantity, condition, isFoil, notes, ownerId } = parsed.data

    if (quantity !== undefined && quantity <= 0) {
      await prisma.collectionItem.delete({ where: { id } })
      return NextResponse.json({ success: true, deleted: true })
    }

    const item = await prisma.collectionItem.update({
      where: { id },
      data: {
        ...(quantity !== undefined && { quantity }),
        ...(condition !== undefined && { condition }),
        ...(isFoil !== undefined && { isFoil }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(ownerId !== undefined && { ownerId: (ownerId ?? null) as string }),
      },
      select: {
        id: true,
        cardId: true,
        quantity: true,
        condition: true,
        isFoil: true,
      },
    })

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Error updating collection item:', error)
    return NextResponse.json({ error: 'Failed to update collection item' }, { status: 500 })
  }
}

// DELETE /api/collection - Remove item from collection
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = deleteCollectionItemParamsSchema.safeParse({
      id: searchParams.get('id'),
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { id } = parsed.data

    await prisma.collectionItem.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing from collection:', error)
    return NextResponse.json({ error: 'Failed to remove from collection' }, { status: 500 })
  }
}
