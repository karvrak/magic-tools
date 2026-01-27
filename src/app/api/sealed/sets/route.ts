import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * Get available sets for sealed play
 * Only returns sets with enough cards for sealed (at least some commons, uncommons, rares)
 */
export async function GET() {
  try {
    // Get sets with card counts by rarity
    const setsWithCounts = await prisma.$queryRaw<Array<{
      setCode: string
      setName: string
      commons: bigint
      uncommons: bigint
      rares: bigint
      mythics: bigint
      releasedAt: Date | null
    }>>`
      SELECT
        "setCode",
        MAX("setName") as "setName",
        COUNT(*) FILTER (WHERE "rarity" = 'common' AND "typeLine" NOT LIKE '%Basic Land%') as commons,
        COUNT(*) FILTER (WHERE "rarity" = 'uncommon') as uncommons,
        COUNT(*) FILTER (WHERE "rarity" = 'rare') as rares,
        COUNT(*) FILTER (WHERE "rarity" = 'mythic') as mythics,
        MAX("releasedAt") as "releasedAt"
      FROM "Card"
      WHERE "imageNormal" IS NOT NULL
        AND "isBooster" = true
        AND 'paper' = ANY("games")
      GROUP BY "setCode"
      HAVING
        COUNT(*) FILTER (WHERE "rarity" = 'common' AND "typeLine" NOT LIKE '%Basic Land%') >= 7
        AND COUNT(*) FILTER (WHERE "rarity" = 'uncommon') >= 3
        AND COUNT(*) FILTER (WHERE "rarity" = 'rare') >= 1
      ORDER BY MAX("releasedAt") DESC NULLS LAST
    `

    const sets = setsWithCounts.map(s => ({
      setCode: s.setCode,
      setName: s.setName,
      commons: Number(s.commons),
      uncommons: Number(s.uncommons),
      rares: Number(s.rares),
      mythics: Number(s.mythics),
      releasedAt: s.releasedAt,
    }))

    return NextResponse.json({ sets })
  } catch (error) {
    console.error('Error fetching sealed sets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sets', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
