import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { CollectionBulkResponse } from '@/types/scanner'
import { bulkCollectionSchema } from '@/lib/validations'

/**
 * POST /api/collection/bulk - Add multiple items to collection
 * Handles duplicates by incrementing quantity
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = bulkCollectionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { items } = parsed.data

    // Limit to 100 items per request
    const limitedItems = items.slice(0, 100)

    const validConditions = ['nm', 'lp', 'mp', 'hp', 'dmg']
    const errors: string[] = []
    let added = 0
    let updated = 0

    // Process items in a transaction
    await prisma.$transaction(async (tx) => {
      for (const item of limitedItems) {
        const {
          cardId,
          quantity = 1,
          condition = 'nm',
          isFoil = false,
          ownerId = null,
        } = item

        // Validate
        if (!cardId) {
          errors.push(`Missing cardId for item`)
          continue
        }

        if (!validConditions.includes(condition)) {
          errors.push(`Invalid condition "${condition}" for card ${cardId}`)
          continue
        }

        if (quantity < 1) {
          errors.push(`Invalid quantity ${quantity} for card ${cardId}`)
          continue
        }

        try {
          // Check if item already exists (use type assertion for nullable ownerId in composite key)
          const existing = await tx.collectionItem.findUnique({
            where: {
              cardId_ownerId_isFoil_condition: {
                cardId,
                ownerId: (ownerId || null) as string,
                isFoil,
                condition,
              },
            },
          })

          if (existing) {
            // Update quantity
            await tx.collectionItem.update({
              where: { id: existing.id },
              data: { quantity: existing.quantity + quantity },
            })
            updated++
          } else {
            // Create new item
            await tx.collectionItem.create({
              data: {
                cardId,
                ownerId: (ownerId ?? null) as string,
                quantity,
                condition,
                isFoil,
              },
            })
            added++
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error'
          errors.push(`Failed to add card ${cardId}: ${errorMessage}`)
        }
      }
    })

    const response: CollectionBulkResponse = {
      added,
      updated,
      errors,
    }

    return NextResponse.json(response, {
      status: errors.length > 0 && added === 0 && updated === 0 ? 400 : 200,
    })
  } catch (error) {
    console.error('Bulk collection error:', error)
    return NextResponse.json(
      { error: 'Failed to add items to collection' },
      { status: 500 }
    )
  }
}
