import cron from 'node-cron'
import { syncAllCards } from './scryfall/sync-cards'
import { syncPrices } from './scryfall/sync-prices'
import { generateAllSnapshots } from './analytics/generate-snapshot'

let cronInitialized = false

/**
 * Initialize cron jobs for data synchronization
 * - Daily at 10:00 AM: Sync prices (default_cards ~500MB, per-printing prices)
 * - Weekly on Sunday at 3:00 AM: Sync all cards (all_cards ~1.5GB)
 */
export function initCronJobs() {
  if (cronInitialized) {
    console.log('[CRON] Jobs already initialized, skipping...')
    return
  }

  // Daily price sync at 10:00 AM (after Scryfall updates around 9 AM UTC)
  cron.schedule('0 10 * * *', async () => {
    console.log('[CRON] Starting daily price sync...')
    try {
      const result = await syncPrices()
      if (result.success) {
        console.log(`[CRON] Price sync completed: ${result.recordsProcessed} prices in ${result.durationMs}ms`)
      } else {
        console.error(`[CRON] Price sync failed: ${result.error}`)
      }
    } catch (error) {
      console.error('[CRON] Price sync error:', error)
    }
  }, {
    timezone: 'Europe/Paris'
  })

  // Weekly card sync on Sunday at 3:00 AM
  cron.schedule('0 3 * * 0', async () => {
    console.log('[CRON] Starting weekly card sync...')
    try {
      const result = await syncAllCards()
      if (result.success) {
        console.log(`[CRON] Card sync completed: ${result.recordsProcessed} cards in ${result.durationMs}ms`)
      } else {
        console.error(`[CRON] Card sync failed: ${result.error}`)
      }
    } catch (error) {
      console.error('[CRON] Card sync error:', error)
    }
  }, {
    timezone: 'Europe/Paris'
  })

  // Daily collection snapshot at 11:00 AM (after price sync at 10:00 AM)
  cron.schedule('0 11 * * *', async () => {
    console.log('[CRON] Starting daily collection snapshot...')
    try {
      const results = await generateAllSnapshots()
      console.log(`[CRON] Collection snapshots generated: ${results.length} snapshots`)
    } catch (error) {
      console.error('[CRON] Collection snapshot error:', error)
    }
  }, {
    timezone: 'Europe/Paris'
  })

  cronInitialized = true
  console.log('[CRON] Jobs scheduled:')
  console.log('  - Prices: Daily at 10:00 AM (Europe/Paris)')
  console.log('  - Snapshots: Daily at 11:00 AM (Europe/Paris)')
  console.log('  - Cards: Sunday at 3:00 AM (Europe/Paris)')
}

/**
 * Check if cron jobs are initialized
 */
export function isCronInitialized(): boolean {
  return cronInitialized
}
