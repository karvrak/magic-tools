import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/collection/import-decks - List decks with import status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ownerId = searchParams.get('ownerId')

    // Get all decks with their cards
    const decks = await prisma.deck.findMany({
      where: ownerId ? { ownerId } : {},
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        format: true,
        ownerId: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        cards: {
          select: {
            cardId: true,
            quantity: true,
            card: {
              select: {
                name: true,
                imageArtCrop: true,
              },
            },
          },
        },
      },
    })

    // Get all collection items to check what's already imported
    const collectionItems = await prisma.collectionItem.findMany({
      where: ownerId ? { ownerId } : {},
      select: {
        cardId: true,
        ownerId: true,
        quantity: true,
      },
    })

    // Build a map of cardId+ownerId -> quantity in collection
    const collectionMap = new Map<string, number>()
    for (const item of collectionItems) {
      const key = `${item.cardId}-${item.ownerId || 'null'}`
      collectionMap.set(key, (collectionMap.get(key) || 0) + item.quantity)
    }

    // Calculate import status for each deck
    const decksWithStatus = decks.map((deck) => {
      let totalCards = 0
      let cardsInCollection = 0
      let missingCards = 0
      let newCardsToImport = 0

      for (const dc of deck.cards) {
        totalCards += dc.quantity
        const collectionKey = `${dc.cardId}-${deck.ownerId || 'null'}`
        const inCollection = collectionMap.get(collectionKey) || 0

        if (inCollection >= dc.quantity) {
          cardsInCollection += dc.quantity
        } else if (inCollection > 0) {
          cardsInCollection += inCollection
          missingCards += dc.quantity - inCollection
          newCardsToImport += dc.quantity - inCollection
        } else {
          missingCards += dc.quantity
          newCardsToImport += dc.quantity
        }
      }

      const isFullyImported = missingCards === 0
      const isPartiallyImported = cardsInCollection > 0 && missingCards > 0

      // Get first card image for preview
      const previewImage = deck.cards[0]?.card?.imageArtCrop || null

      return {
        id: deck.id,
        name: deck.name,
        format: deck.format,
        owner: deck.owner,
        updatedAt: deck.updatedAt,
        previewImage,
        stats: {
          totalCards,
          cardsInCollection,
          missingCards,
          newCardsToImport,
          isFullyImported,
          isPartiallyImported,
          uniqueCards: deck.cards.length,
        },
      }
    })

    // Sort: not imported first, then partially, then fully imported
    decksWithStatus.sort((a, b) => {
      if (a.stats.isFullyImported !== b.stats.isFullyImported) {
        return a.stats.isFullyImported ? 1 : -1
      }
      if (a.stats.isPartiallyImported !== b.stats.isPartiallyImported) {
        return a.stats.isPartiallyImported ? -1 : 1
      }
      return 0
    })

    // Summary stats
    const summary = {
      totalDecks: decks.length,
      fullyImported: decksWithStatus.filter((d) => d.stats.isFullyImported).length,
      partiallyImported: decksWithStatus.filter((d) => d.stats.isPartiallyImported).length,
      notImported: decksWithStatus.filter(
        (d) => !d.stats.isFullyImported && !d.stats.isPartiallyImported
      ).length,
    }

    return NextResponse.json({ decks: decksWithStatus, summary })
  } catch (error) {
    console.error('Error fetching decks import status:', error)
    return NextResponse.json({ error: 'Failed to fetch decks' }, { status: 500 })
  }
}

// POST /api/collection/import-decks - Import selected decks into collection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deckIds, onlyMissing = true } = body

    if (!deckIds || !Array.isArray(deckIds) || deckIds.length === 0) {
      return NextResponse.json({ error: 'deckIds array is required' }, { status: 400 })
    }

    // Get deck cards for selected decks
    const deckCards = await prisma.deckCard.findMany({
      where: {
        deckId: { in: deckIds },
      },
      include: {
        deck: {
          select: {
            id: true,
            name: true,
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

    if (deckCards.length === 0) {
      return NextResponse.json({
        success: true,
        imported: 0,
        updated: 0,
        skipped: 0,
        message: 'No cards to import',
      })
    }

    // Group by cardId + ownerId to combine quantities
    const grouped = new Map<
      string,
      { cardId: string; ownerId: string | null; quantity: number; cardName: string; deckNames: string[] }
    >()

    for (const dc of deckCards) {
      const key = `${dc.cardId}-${dc.deck.ownerId || 'null'}`
      const existing = grouped.get(key)
      if (existing) {
        existing.quantity += dc.quantity
        if (!existing.deckNames.includes(dc.deck.name)) {
          existing.deckNames.push(dc.deck.name)
        }
      } else {
        grouped.set(key, {
          cardId: dc.cardId,
          ownerId: dc.deck.ownerId,
          quantity: dc.quantity,
          cardName: dc.card.name,
          deckNames: [dc.deck.name],
        })
      }
    }

    let created = 0
    let updated = 0
    let skipped = 0

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
          if (onlyMissing) {
            // Only add the difference if we need more
            const needed = Math.max(0, item.quantity - existing.quantity)
            if (needed > 0) {
              await prisma.collectionItem.update({
                where: { id: existing.id },
                data: { quantity: existing.quantity + needed },
              })
              updated++
            } else {
              skipped++
            }
          } else {
            // Add all quantities
            await prisma.collectionItem.update({
              where: { id: existing.id },
              data: { quantity: existing.quantity + item.quantity },
            })
            updated++
          }
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
        console.error(`[Import] Error processing ${item.cardName}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      decksProcessed: deckIds.length,
      cardsProcessed: grouped.size,
      created,
      updated,
      skipped,
    })
  } catch (error) {
    console.error('Error importing decks:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
