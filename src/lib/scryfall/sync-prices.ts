import prisma from '@/lib/prisma'
import { downloadBulkData, streamJsonFile, transformPrice, cleanupTempFile } from './bulk-download'

const BATCH_SIZE = 1000

/**
 * Synchronize prices from Scryfall oracle_cards
 * oracle_cards is smaller (~80MB) and contains one entry per unique card
 * Perfect for price updates as we only need one price per oracle_id
 */
export async function syncPrices(): Promise<{
  success: boolean
  recordsProcessed: number
  durationMs: number
  error?: string
}> {
  const startTime = Date.now()
  let recordsProcessed = 0

  // Create sync log entry
  const syncLog = await prisma.syncLog.create({
    data: {
      type: 'oracle_cards',
      status: 'started',
    },
  })

  try {
    console.log('[SYNC PRICES] Starting price synchronization...')

    // Download the bulk data file
    const filePath = await downloadBulkData('oracle_cards')

    // Track unique oracle IDs to avoid duplicates
    const processedOracleIds = new Set<string>()

    // Process cards in batches from the file
    for await (const batch of streamJsonFile(filePath, BATCH_SIZE)) {
      const prices = batch
        .filter((card) => {
          // Only process each oracle_id once
          if (processedOracleIds.has(card.oracle_id)) {
            return false
          }
          processedOracleIds.add(card.oracle_id)
          return true
        })
        .map(transformPrice)

      if (prices.length === 0) continue

      // Upsert prices in batch using transaction
      await prisma.$transaction(
        prices.map((price) =>
          prisma.cardPrice.upsert({
            where: { oracleId: price.oracleId },
            create: price,
            update: price,
          })
        )
      )

      recordsProcessed += prices.length
      
      if (recordsProcessed % 10000 === 0) {
        console.log(`[SYNC PRICES] Processed ${recordsProcessed} prices...`)
      }
    }

    // Cleanup temp file after successful sync
    cleanupTempFile('oracle_cards')

    const durationMs = Date.now() - startTime

    // Update sync log
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'completed',
        recordsProcessed,
        durationMs,
      },
    })

    console.log(`[SYNC PRICES] Completed! ${recordsProcessed} prices in ${Math.round(durationMs / 1000)}s`)

    return {
      success: true,
      recordsProcessed,
      durationMs,
    }
  } catch (error) {
    // Cleanup temp file on error too
    cleanupTempFile('oracle_cards')
    
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Update sync log with error
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'failed',
        recordsProcessed,
        durationMs,
        error: errorMessage,
      },
    })

    console.error('[SYNC PRICES] Failed:', errorMessage)

    return {
      success: false,
      recordsProcessed,
      durationMs,
      error: errorMessage,
    }
  }
}

/**
 * Get the last successful price sync
 */
export async function getLastPriceSync() {
  return prisma.syncLog.findFirst({
    where: {
      type: 'oracle_cards',
      status: 'completed',
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}
