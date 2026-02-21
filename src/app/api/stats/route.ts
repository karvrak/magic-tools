import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/stats - Get database statistics
export async function GET() {
  try {
    const [
      cardCount,
      cardsWithPriceCount,
      deckCount,
      wantlistCount,
      lastCardSync,
      lastPriceSync,
    ] = await Promise.all([
      prisma.card.count(),
      prisma.card.count({
        where: { OR: [{ priceEur: { not: null } }, { priceUsd: { not: null } }] },
      }),
      prisma.deck.count(),
      prisma.wantlistItem.count(),
      prisma.syncLog.findFirst({
        where: { type: 'all_cards', status: 'completed' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.syncLog.findFirst({
        where: { type: 'default_cards', status: 'completed' },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return NextResponse.json({
      cards: {
        total: cardCount,
        lastSync: lastCardSync?.createdAt || null,
      },
      prices: {
        total: cardsWithPriceCount,
        lastSync: lastPriceSync?.createdAt || null,
      },
      decks: deckCount,
      wantlistItems: wantlistCount,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
