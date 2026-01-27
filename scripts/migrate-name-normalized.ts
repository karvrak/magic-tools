/**
 * Migration script to populate nameNormalized column for existing cards
 * Run this ONCE after adding the nameNormalized column to the schema
 * 
 * Usage: npx tsx scripts/migrate-name-normalized.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Normalize a string for search: lowercase + remove diacritics (accents)
 * "Séance" -> "seance", "Éléphant" -> "elephant"
 */
function normalizeForSearch(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
}

async function main() {
  console.log('[MIGRATE] Starting nameNormalized migration...')
  
  const startTime = Date.now()
  
  // Count total cards to process
  const totalCards = await prisma.card.count({
    where: { nameNormalized: null }
  })
  
  if (totalCards === 0) {
    console.log('[MIGRATE] All cards already have nameNormalized set. Nothing to do.')
    return
  }
  
  console.log(`[MIGRATE] Found ${totalCards} cards to update`)
  
  const BATCH_SIZE = 1000
  let processed = 0
  let lastLogPercent = 0
  
  // Process in batches to avoid memory issues
  while (true) {
    // Get batch of cards without nameNormalized
    const cards = await prisma.card.findMany({
      where: { nameNormalized: null },
      select: { id: true, name: true, printedName: true },
      take: BATCH_SIZE,
    })
    
    if (cards.length === 0) break
    
    // Update each card in the batch
    await prisma.$transaction(
      cards.map(card => {
        const nameParts = [card.printedName, card.name].filter(Boolean)
        const nameNormalized = nameParts.map(n => normalizeForSearch(n!)).join(' ')
        
        return prisma.card.update({
          where: { id: card.id },
          data: { nameNormalized },
        })
      })
    )
    
    processed += cards.length
    
    // Log progress every 5%
    const percent = Math.floor((processed / totalCards) * 100)
    if (percent >= lastLogPercent + 5) {
      console.log(`[MIGRATE] Progress: ${percent}% (${processed}/${totalCards})`)
      lastLogPercent = percent
    }
  }
  
  const durationMs = Date.now() - startTime
  console.log(`[MIGRATE] ✅ Migration complete! Updated ${processed} cards in ${Math.round(durationMs / 1000)}s`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
