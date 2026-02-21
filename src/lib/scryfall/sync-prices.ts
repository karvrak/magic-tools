import prisma from '@/lib/prisma'
import { downloadBulkData, streamJsonFile, cleanupTempFile } from './bulk-download'
import { startSync, updateSyncStatus, finishSync } from '@/lib/sync-status'
import { ScryfallCard } from '@/types/scryfall'
import { transferPricesEnToFr } from './transfer-prices'

const BATCH_SIZE = 1000

/**
 * Synchronize prices from Scryfall default_cards
 * default_cards contains one entry per printing (EN only), ~500MB
 * Updates Card.priceEur/priceUsd/etc. directly on EN cards,
 * then transfers prices to FR cards via transferPricesEnToFr()
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
      type: 'default_cards',
      status: 'started',
    },
  })

  try {
    console.log('[SYNC PRICES] Starting price synchronization (default_cards)...')
    startSync('prices')

    updateSyncStatus({ phase: 'downloading', progress: 5, message: 'Downloading price data from Scryfall...' })

    // Download the bulk data file
    const filePath = await downloadBulkData('default_cards')

    updateSyncStatus({ phase: 'processing', progress: 15, message: 'Processing prices...' })

    // Collect price updates in batches, then execute raw SQL for speed
    for await (const batch of streamJsonFile(filePath, BATCH_SIZE)) {
      // default_cards = one entry per printing, EN only, paper games
      const updates: { id: string; priceEur: number | null; priceEurFoil: number | null; priceUsd: number | null; priceUsdFoil: number | null }[] = []

      for (const card of batch) {
        // Only process cards that have prices
        const priceEur = card.prices?.eur ? parseFloat(card.prices.eur) : null
        const priceEurFoil = card.prices?.eur_foil ? parseFloat(card.prices.eur_foil) : null
        const priceUsd = card.prices?.usd ? parseFloat(card.prices.usd) : null
        const priceUsdFoil = card.prices?.usd_foil ? parseFloat(card.prices.usd_foil) : null

        if (priceEur === null && priceEurFoil === null && priceUsd === null && priceUsdFoil === null) {
          continue
        }

        updates.push({
          id: card.id,
          priceEur,
          priceEurFoil,
          priceUsd,
          priceUsdFoil,
        })
      }

      if (updates.length === 0) continue

      // Batch update using raw SQL for performance
      // Build a VALUES clause and use UPDATE FROM
      const valuesClauses = updates.map((u, i) => {
        const base = i * 5
        return `($${base + 1}, $${base + 2}::double precision, $${base + 3}::double precision, $${base + 4}::double precision, $${base + 5}::double precision)`
      })

      const flatParams: (string | number | null)[] = []
      for (const u of updates) {
        flatParams.push(u.id, u.priceEur, u.priceEurFoil, u.priceUsd, u.priceUsdFoil)
      }

      await prisma.$executeRawUnsafe(
        `UPDATE "Card" AS c SET
          "priceEur" = v.price_eur,
          "priceEurFoil" = v.price_eur_foil,
          "priceUsd" = v.price_usd,
          "priceUsdFoil" = v.price_usd_foil
        FROM (VALUES ${valuesClauses.join(',')}) AS v(id, price_eur, price_eur_foil, price_usd, price_usd_foil)
        WHERE c.id = v.id`,
        ...flatParams
      )

      recordsProcessed += updates.length

      if (recordsProcessed % 10000 === 0) {
        console.log(`[SYNC PRICES] Processed ${recordsProcessed} prices...`)
      }

      // Update progress: processing spans 15% to 75%
      const ESTIMATED_TOTAL = 100_000
      const processingProgress = Math.min(
        15 + Math.round((recordsProcessed / ESTIMATED_TOTAL) * 60),
        75
      )
      updateSyncStatus({
        progress: processingProgress,
        message: `Processing prices... ${recordsProcessed.toLocaleString()} updated`,
        recordsProcessed,
      })
    }

    // Cleanup temp file after successful sync
    cleanupTempFile('default_cards')

    // Transfer prices from EN to FR cards
    updateSyncStatus({ phase: 'processing', progress: 80, message: 'Transferring prices EN to FR...' })
    console.log('[SYNC PRICES] Transferring prices from EN to FR...')
    const transferred = await transferPricesEnToFr()
    console.log(`[SYNC PRICES] Transferred prices to ${transferred} FR cards`)

    updateSyncStatus({ progress: 95, message: 'Finalizing...' })

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

    finishSync(true, `Synchronized ${recordsProcessed.toLocaleString()} prices in ${Math.round(durationMs / 1000)}s`)
    console.log(`[SYNC PRICES] Completed! ${recordsProcessed} prices in ${Math.round(durationMs / 1000)}s`)

    return {
      success: true,
      recordsProcessed,
      durationMs,
    }
  } catch (error) {
    // Cleanup temp file on error too
    cleanupTempFile('default_cards')

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

    finishSync(false, `Sync failed: ${errorMessage}`)
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
      type: 'default_cards',
      status: 'completed',
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}
