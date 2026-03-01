import { NextRequest, NextResponse } from 'next/server'
import { rm } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import prisma from '@/lib/prisma'

const DATA_DIR = path.join(process.cwd(), 'data', 'custom-sets')

/**
 * GET /api/custom-sets
 * List all custom sets (setCode starting with 'cus_')
 */
export async function GET() {
  try {
    const sets = await prisma.$queryRaw<Array<{
      setCode: string
      setName: string
      total: bigint
      commons: bigint
      uncommons: bigint
      rares: bigint
      mythics: bigint
    }>>`
      SELECT
        "setCode",
        MAX("setName") as "setName",
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE "rarity" = 'common' AND "isBooster" = true) as commons,
        COUNT(*) FILTER (WHERE "rarity" = 'uncommon' AND "isBooster" = true) as uncommons,
        COUNT(*) FILTER (WHERE "rarity" = 'rare' AND "isBooster" = true) as rares,
        COUNT(*) FILTER (WHERE "rarity" = 'mythic' AND "isBooster" = true) as mythics
      FROM "Card"
      WHERE "setCode" LIKE 'cus_%'
      GROUP BY "setCode"
      ORDER BY "setCode"
    `

    const customSets = sets.map(s => ({
      setCode: s.setCode,
      setName: s.setName,
      total: Number(s.total),
      commons: Number(s.commons),
      uncommons: Number(s.uncommons),
      rares: Number(s.rares),
      mythics: Number(s.mythics),
    }))

    return NextResponse.json({ sets: customSets })
  } catch (error) {
    console.error('Error listing custom sets:', error)
    return NextResponse.json(
      { error: 'Failed to list custom sets', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/custom-sets?setCode=cus_xxx
 * Delete a custom set (cards from DB + images from disk)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const setCode = searchParams.get('setCode')

    if (!setCode || !setCode.startsWith('cus_')) {
      return NextResponse.json(
        { error: 'Valid custom set code (starting with cus_) is required' },
        { status: 400 }
      )
    }

    // Delete cards from database
    const deleteResult = await prisma.card.deleteMany({
      where: { setCode },
    })

    // Delete images from disk
    const setDir = path.join(DATA_DIR, setCode)
    if (existsSync(setDir)) {
      await rm(setDir, { recursive: true, force: true })
    }

    return NextResponse.json({
      success: true,
      deletedCards: deleteResult.count,
      setCode,
    })
  } catch (error) {
    console.error('Error deleting custom set:', error)
    return NextResponse.json(
      { error: 'Failed to delete custom set', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
