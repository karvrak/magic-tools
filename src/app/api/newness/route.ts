import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/newness
 * Get statistics about new cards and artworks detected during syncs
 */
export async function GET() {
  try {
    // Get counts by type - only count cards that have valid Card entries (with image and paper)
    // This aligns with the search API which filters by imageNormal IS NOT NULL and paper games
    const countQuery = await prisma.$queryRaw<Array<{ type: string; count: bigint }>>`
      SELECT cn.type::text as type, COUNT(DISTINCT cn."oracleId") as count
      FROM "CardNewness" cn
      INNER JOIN "Card" c ON c."oracleId" = cn."oracleId"
      WHERE c."imageNormal" IS NOT NULL
        AND 'paper' = ANY(c."games")
      GROUP BY cn.type
    `

    const newCardsCount = Number(countQuery.find((s) => s.type === 'NEW_CARD')?.count ?? 0)
    const newArtCount = Number(countQuery.find((s) => s.type === 'NEW_ART')?.count ?? 0)

    // Get the latest detection date
    const latestDetection = await prisma.cardNewness.findFirst({
      orderBy: { detectedAt: 'desc' },
      select: { detectedAt: true },
    })

    // Get counts by sync
    const recentSyncs = await prisma.syncLog.findMany({
      where: {
        type: 'all_cards',
        status: 'completed',
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        _count: {
          select: { detectedNewness: true },
        },
      },
    })

    return NextResponse.json({
      newCards: newCardsCount,
      newArt: newArtCount,
      total: newCardsCount + newArtCount,
      latestDetection: latestDetection?.detectedAt ?? null,
      recentSyncs: recentSyncs.map(s => ({
        id: s.id,
        date: s.createdAt,
        newItems: s._count.detectedNewness,
      })),
    })
  } catch (error) {
    console.error('Failed to get newness stats:', error)
    return NextResponse.json(
      { error: 'Failed to get newness stats' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/newness
 * Clear all newness records or filter by type/age
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'new_card' | 'new_art' | null (all)
    const olderThanDays = searchParams.get('olderThanDays')

    const where: { type?: 'NEW_CARD' | 'NEW_ART'; detectedAt?: { lt: Date } } = {}

    if (type === 'new_card') {
      where.type = 'NEW_CARD'
    } else if (type === 'new_art') {
      where.type = 'NEW_ART'
    }

    if (olderThanDays) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThanDays))
      where.detectedAt = { lt: cutoffDate }
    }

    const result = await prisma.cardNewness.deleteMany({ where })

    return NextResponse.json({
      deleted: result.count,
      message: `Deleted ${result.count} newness records`,
    })
  } catch (error) {
    console.error('Failed to clear newness:', error)
    return NextResponse.json(
      { error: 'Failed to clear newness records' },
      { status: 500 }
    )
  }
}
