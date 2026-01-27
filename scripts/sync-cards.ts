/**
 * Manual script to sync all cards from Scryfall
 * Run with: npm run sync:cards
 * Run with clear: npm run sync:cards -- --clear
 */

import { syncAllCards } from '../src/lib/scryfall/sync-cards'

async function main() {
  const clearFirst = process.argv.includes('--clear')
  
  console.log('='.repeat(50))
  console.log('Starting manual card synchronization...')
  console.log('Mode: FR > EN > other (language priority)')
  if (clearFirst) {
    console.log('⚠️  Will clear existing cards first!')
  }
  console.log('='.repeat(50))

  const result = await syncAllCards(clearFirst)

  console.log('='.repeat(50))
  if (result.success) {
    console.log('✓ Sync completed successfully!')
    console.log(`  Cards imported: ${result.recordsProcessed}`)
    console.log(`  Duplicates skipped: ${result.skippedDuplicates}`)
    console.log(`  Language distribution: FR=${result.langStats['fr'] || 0}, EN=${result.langStats['en'] || 0}`)
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
