import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/shared/custom/[token] - Public read-only custom set data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const shared = await prisma.sharedCustomSet.findUnique({
      where: { shareToken: token },
    })

    if (!shared) {
      return NextResponse.json({ error: 'Set not found' }, { status: 404 })
    }

    const cards = await prisma.card.findMany({
      where: { setCode: shared.setCode },
      select: {
        id: true,
        name: true,
        printedName: true,
        typeLine: true,
        printedTypeLine: true,
        rarity: true,
        setCode: true,
        setName: true,
        imageNormal: true,
        manaCost: true,
        cmc: true,
        colors: true,
        power: true,
        toughness: true,
        loyalty: true,
        oracleText: true,
        printedText: true,
        isBooster: true,
      },
      orderBy: [{ rarity: 'asc' }, { name: 'asc' }],
    })

    // Compute stats
    const stats = {
      total: cards.length,
      commons: cards.filter(c => c.rarity === 'common' && c.isBooster).length,
      uncommons: cards.filter(c => c.rarity === 'uncommon' && c.isBooster).length,
      rares: cards.filter(c => c.rarity === 'rare' && c.isBooster).length,
      mythics: cards.filter(c => c.rarity === 'mythic' && c.isBooster).length,
    }

    return NextResponse.json({
      setName: cards[0]?.setName || shared.setCode,
      setCode: shared.setCode,
      cards,
      stats,
    })
  } catch (error) {
    console.error('Error fetching shared custom set:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shared set' },
      { status: 500 }
    )
  }
}
