/**
 * Clear database and sync fresh English cards
 * Run with: npm run sync:fresh
 */

import { syncAllCards, clearAllCards } from '../src/lib/scryfall/sync-cards'
import { cleanupTempFile } from '../src/lib/scryfall/bulk-download'

async function main() {
  console.log('='.repeat(50))
  console.log('🗑️  CLEARING DATABASE AND SYNCING FRESH')
  console.log('='.repeat(50))

  // Clear existing cards
  await clearAllCards()
  
  // Delete temp file to force fresh download
  cleanupTempFile('all_cards')
  
  console.log('')
  console.log('Starting fresh sync...')
  
  const result = await syncAllCards(false) // Don't clear again

  console.log('='.repeat(50))
  if (result.success) {
    console.log('✓ Fresh sync completed successfully!')
    console.log(`  Cards imported: ${result.recordsProcessed}`)
    console.log(`  Duplicates skipped: ${result.skippedDuplicates}`)
    console.log(`  Language distribution: FR=${result.langStats['fr'] || 0}, EN=${result.langStats['en'] || 0}`)
    console.log(`  Duration: ${Math.round(result.durationMs / 1000)}s`)
  } else {
    console.log('✗ Sync failed!')
    console.log(`  Error: ${result.error}`)
  }
  console.log('='.repeat(50))

  process.exit(result.success ? 0 : 1)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
