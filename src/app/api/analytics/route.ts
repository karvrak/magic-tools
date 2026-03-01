import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getRequestUser, getUserOwnerIds, buildOwnerFilter } from '@/lib/api-auth'

// GET /api/analytics - Get analytics data
export async function GET(request: NextRequest) {
  try {
    const { userId, role } = await getRequestUser()
    const ownerIds = await getUserOwnerIds(userId, role)

    const { searchParams } = request.nextUrl
    const ownerIdParam = searchParams.get('ownerId')
    const days = parseInt(searchParams.get('days') || '90', 10)

    const since = new Date()
    since.setDate(since.getDate() - days)
    since.setHours(0, 0, 0, 0)

    // Resolve effective owner filter respecting user scope
    let snapshotOwnerWhere: Record<string, unknown>
    let collectionOwnerWhere: Record<string, unknown>

    if (ownerIds === null) {
      // Admin: respect the query param as-is
      snapshotOwnerWhere = { ownerId: ownerIdParam || null }
      collectionOwnerWhere = ownerIdParam ? { ownerId: ownerIdParam } : {}
    } else {
      // Regular user: scope to their ownerIds
      if (ownerIdParam) {
        if (!ownerIds.includes(ownerIdParam)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        snapshotOwnerWhere = { ownerId: ownerIdParam }
        collectionOwnerWhere = { ownerId: ownerIdParam }
      } else {
        // No specific ownerId — filter across all of the user's owners
        const ownerFilter = buildOwnerFilter(ownerIds)
        snapshotOwnerWhere = ownerFilter
        collectionOwnerWhere = ownerFilter
      }
    }

    // 1. Value evolution from snapshots
    const snapshots = await prisma.collectionSnapshot.findMany({
      where: {
        ...snapshotOwnerWhere,
        date: { gte: since },
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        totalValue: true,
        totalCards: true,
        rarityBreakdown: true,
      },
    })

    // 2. Current rarity distribution from collection
    const collectionItems = await prisma.collectionItem.findMany({
      where: collectionOwnerWhere,
      include: {
        card: {
          select: {
            rarity: true,
            setCode: true,
            setName: true,
            oracleId: true,
            priceEur: true,
            priceUsd: true,
          },
        },
      },
    })

    const oracleIds = [...new Set(collectionItems.map((c) => c.card.oracleId))]

    // Rarity distribution
    const rarityDistribution: Record<string, number> = {
      common: 0,
      uncommon: 0,
      rare: 0,
      mythic: 0,
    }

    // Top sets by card count
    const setMap = new Map<string, { code: string; name: string; count: number; value: number }>()

    let totalValue = 0
    let totalCards = 0

    for (const item of collectionItems) {
      const rarity = item.card.rarity.toLowerCase()
      rarityDistribution[rarity] = (rarityDistribution[rarity] || 0) + item.quantity
      totalCards += item.quantity

      // Set tracking
      const setKey = item.card.setCode
      const setData = setMap.get(setKey) || { code: setKey, name: item.card.setName, count: 0, value: 0 }
      setData.count += item.quantity

      // Price
      let price = 0
      if (item.card.priceEur != null) {
        price = item.card.priceEur
      } else if (item.card.priceUsd != null) {
        price = item.card.priceUsd * 0.92
      }
      const itemValue = price * item.quantity
      totalValue += itemValue
      setData.value += itemValue
      setMap.set(setKey, setData)
    }

    // Sort sets by card count and take top 15
    const topSets = [...setMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)

    return NextResponse.json({
      valueEvolution: snapshots.map((s) => ({
        date: s.date,
        value: s.totalValue,
        cards: s.totalCards,
      })),
      rarityDistribution,
      topSets,
      kpi: {
        totalValue,
        totalCards,
        avgValue: totalCards > 0 ? totalValue / totalCards : 0,
        uniqueCards: oracleIds.length,
      },
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
