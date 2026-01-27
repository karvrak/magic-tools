/**
 * Manual script to sync prices from Scryfall
 * Run with: npm run sync:prices
 */

import { syncPrices } from '../src/lib/scryfall/sync-prices'

async function main() {
  console.log('='.repeat(50))
  console.log('Starting manual price synchronization...')
  console.log('='.repeat(50))

  const result = await syncPrices()

  console.log('='.repeat(50))
  if (result.success) {
    console.log('✓ Sync completed successfully!')
    console.log(`  Records: ${result.recordsProcessed}`)
    console.log(`  Duration: ${Math.round(result.durationMs / 1000)}s`)
  } else {
    console.log('✗ Sync failed!')
    console.log(`  Error: ${result.error}`)
    console.log(`  Processed before failure: ${result.recordsProcessed}`)
  }
  console.log('='.repeat(50))

  process.exit(result.success ? 0 : 1)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
