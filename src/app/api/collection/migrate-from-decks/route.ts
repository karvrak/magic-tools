import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// POST /api/collection/migrate-from-decks - Import all deck cards into collection
export async function POST() {
  try {
    console.log('[Migration] Starting deck to collection migration...')

    // Get all deck cards with their deck owner
    const deckCards = await prisma.deckCard.findMany({
      include: {
        deck: {
          select: {
            ownerId: true,
          },
        },
        card: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    console.log(`[Migration] Found ${deckCards.length} deck cards to process`)

    // Group by cardId + ownerId to combine quantities
    const grouped = new Map<string, { cardId: string; ownerId: string | null; quantity: number; cardName: string }>()

    for (const dc of deckCards) {
      const key = `${dc.cardId}-${dc.deck.ownerId || 'null'}`
      const existing = grouped.get(key)
      if (existing) {
        existing.quantity += dc.quantity
      } else {
        grouped.set(key, {
          cardId: dc.cardId,
          ownerId: dc.deck.ownerId,
          quantity: dc.quantity,
          cardName: dc.card.name,
        })
      }
    }

    console.log(`[Migration] Grouped into ${grouped.size} unique card+owner combinations`)

    let created = 0
    let updated = 0
    let errors = 0

    for (const [, item] of grouped) {
      try {
        // Check if already exists in collection
        const existing = await prisma.collectionItem.findFirst({
          where: {
            cardId: item.cardId,
            ownerId: item.ownerId,
            isFoil: false,
            condition: 'nm',
          },
        })

        if (existing) {
          // Update quantity
          await prisma.collectionItem.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + item.quantity },
          })
          updated++
        } else {
          // Create new
          await prisma.collectionItem.create({
            data: {
              cardId: item.cardId,
              ownerId: item.ownerId,
              quantity: item.quantity,
              condition: 'nm',
              isFoil: false,
            },
          })
          created++
        }
      } catch (error) {
        console.error(`[Migration] Error processing ${item.cardName}:`, error)
        errors++
      }
    }

    // Get collection stats
    const stats = await prisma.collectionItem.groupBy({
      by: ['ownerId'],
      _sum: { quantity: true },
      _count: true,
    })

    const owners = await prisma.owner.findMany()
    const ownerMap = new Map(owners.map(o => [o.id, o.name]))

    const collectionStats = stats.map(stat => ({
      owner: stat.ownerId ? ownerMap.get(stat.ownerId) || 'Unknown' : 'No owner',
      entries: stat._count,
      totalCards: stat._sum.quantity || 0,
    }))

    console.log(`[Migration] Complete - Created: ${created}, Updated: ${updated}, Errors: ${errors}`)

    return NextResponse.json({
      success: true,
      deckCardsProcessed: deckCards.length,
      uniqueCombinations: grouped.size,
      created,
      updated,
      errors,
      collectionStats,
    })
  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
