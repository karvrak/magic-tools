import prisma from '@/lib/prisma'
import { downloadBulkData, streamJsonFile, transformCard, cleanupTempFile, TransformedCard } from './bulk-download'
import { startSync, updateSyncStatus, finishSync } from '@/lib/sync-status'
import { transferPricesEnToFr } from './transfer-prices'

const BATCH_SIZE = 100 // Small batches for memory efficiency

// ============================================
// NEWNESS DETECTION
// ============================================

interface NewnessRecord {
  oracleId: string
  illustrationId: string | null
  type: 'NEW_CARD' | 'NEW_ART'
}

/**
 * Detect new cards and new artworks BEFORE upserting (identification only)
 * Returns the records to insert - actual insertion happens AFTER successful upsert
 * - NEW_CARD: oracleId that doesn't exist in the database
 * - NEW_ART: new illustrationId for an existing oracleId
 */
async function detectNewness(
  cards: TransformedCard[]
): Promise<NewnessRecord[]> {
  if (cards.length === 0) return []

  // 1. Collect unique identifiers from the batch
  const batchOracleIds = [...new Set(cards.map(c => c.oracleId).filter(Boolean))]
  const batchIllustrationIds = [...new Set(
    cards.map(c => c.illustrationId).filter((id): id is string => id != null)
  )]

  if (batchOracleIds.length === 0) return []

  // 2. Find existing oracleIds in the database
  const existingOracleIds = await prisma.card.findMany({
    where: { oracleId: { in: batchOracleIds } },
    select: { oracleId: true },
    distinct: ['oracleId']
  })
  const existingOracleIdSet = new Set(existingOracleIds.map(c => c.oracleId))

  // 3. Find existing illustrationIds in the database
  const existingIllustrations = batchIllustrationIds.length > 0
    ? await prisma.card.findMany({
        where: { illustrationId: { in: batchIllustrationIds } },
        select: { illustrationId: true },
        distinct: ['illustrationId']
      })
    : []
  const existingIllustrationSet = new Set(
    existingIllustrations.map(c => c.illustrationId).filter(Boolean)
  )

  // 4. Check already detected newness to avoid duplicates
  const alreadyDetected = await prisma.cardNewness.findMany({
    where: {
      OR: [
        { oracleId: { in: batchOracleIds }, type: 'NEW_CARD' },
        { illustrationId: { in: batchIllustrationIds }, type: 'NEW_ART' }
      ]
    },
    select: { oracleId: true, illustrationId: true, type: true }
  })
  const alreadyDetectedNewCards = new Set(
    alreadyDetected.filter((d: { type: string }) => d.type === 'NEW_CARD').map((d: { oracleId: string }) => d.oracleId)
  )
  const alreadyDetectedNewArt = new Set(
    alreadyDetected.filter((d: { type: string }) => d.type === 'NEW_ART').map((d: { illustrationId: string | null }) => d.illustrationId)
  )

  // 5. Detect new items (but don't insert yet)
  const newness: NewnessRecord[] = []
  const seenOracleIds = new Set<string>()
  const seenIllustrations = new Set<string>()

  for (const card of cards) {
    if (!card.oracleId) continue

    // New card (oracleId never seen before)
    if (
      !existingOracleIdSet.has(card.oracleId) &&
      !seenOracleIds.has(card.oracleId) &&
      !alreadyDetectedNewCards.has(card.oracleId)
    ) {
      newness.push({
        oracleId: card.oracleId,
        illustrationId: null,
        type: 'NEW_CARD'
      })
      seenOracleIds.add(card.oracleId)
    }
    // New art (oracleId exists, but new illustrationId)
    else if (
      card.illustrationId &&
      existingOracleIdSet.has(card.oracleId) &&
      !existingIllustrationSet.has(card.illustrationId) &&
      !seenIllustrations.has(card.illustrationId) &&
      !alreadyDetectedNewArt.has(card.illustrationId)
    ) {
      newness.push({
        oracleId: card.oracleId,
        illustrationId: card.illustrationId,
        type: 'NEW_ART'
      })
      seenIllustrations.add(card.illustrationId)
    }
  }

  return newness
}

/**
 * Save detected newness records to DB (called AFTER successful card upsert)
 */
async function saveNewness(
  newness: NewnessRecord[],
  syncLogId: string
): Promise<{ newCards: number; newArt: number }> {
  if (newness.length === 0) return { newCards: 0, newArt: 0 }

  await prisma.cardNewness.createMany({
    data: newness.map(n => ({
      oracleId: n.oracleId,
      illustrationId: n.illustrationId,
      type: n.type,
      syncLogId
    })),
    skipDuplicates: true
  })

  const newCards = newness.filter(n => n.type === 'NEW_CARD').length
  const newArt = newness.filter(n => n.type === 'NEW_ART').length

  return { newCards, newArt }
}

/**
 * Clear all cards from database (and related data)
 * WARNING: This deletes wantlist and deck data! Use only for fresh start.
 */
export async function clearAllCards(): Promise<number> {
  console.log('[SYNC CARDS] ⚠️  Clearing all cards from database (including decks and wantlist)...')
  
  const wantlistDeleted = await prisma.wantlistItem.deleteMany({})
  console.log(`[SYNC CARDS] Deleted ${wantlistDeleted.count} wantlist items`)
  
  const deckCardsDeleted = await prisma.deckCard.deleteMany({})
  console.log(`[SYNC CARDS] Deleted ${deckCardsDeleted.count} deck cards`)
  
  const result = await prisma.card.deleteMany({})
  console.log(`[SYNC CARDS] Deleted ${result.count} cards`)
  
  return result.count
}

/**
 * Synchronize all cards from Scryfall bulk data
 * Strategy: Insert FR+EN cards, then deduplicate with SQL
 */
export async function syncAllCards(clearFirst: boolean = false): Promise<{
  success: boolean
  recordsProcessed: number
  skippedDuplicates: number
  langStats: Record<string, number>
  newCards: number
  newArt: number
  durationMs: number
  error?: string
}> {
  const startTime = Date.now()
  let recordsProcessed = 0
  let skippedDuplicates = 0
  let totalNewCards = 0
  let totalNewArt = 0
  const langStats: Record<string, number> = {}

  const syncLog = await prisma.syncLog.create({
    data: {
      type: 'all_cards',
      status: 'started',
    },
  })

  try {
    console.log('[SYNC CARDS] Starting sync (FR+EN only, SQL deduplication)...')
    startSync('cards')

    // Only clear if explicitly requested (destroys deck/wantlist data!)
    if (clearFirst) {
      await clearAllCards()
    }

    updateSyncStatus({
      phase: 'downloading',
      progress: 5,
      message: 'Downloading bulk data from Scryfall...',
    })

    const filePath = await downloadBulkData('all_cards', true)

    let totalParsed = 0

    updateSyncStatus({
      phase: 'processing',
      progress: 10,
      message: 'Processing cards...',
    })

    console.log('[SYNC CARDS] Inserting FR and EN cards...')
    
    for await (const batch of streamJsonFile(filePath, BATCH_SIZE * 10)) {
      totalParsed += batch.length
      
      // Only FR and EN cards for paper
      const cards = batch.filter(card => 
        card.oracle_id != null && 
        card.oracle_id !== '' &&
        card.games?.includes('paper') &&
        (card.lang === 'fr' || card.lang === 'en')
      )
      
      if (cards.length > 0) {
        for (let i = 0; i < cards.length; i += BATCH_SIZE) {
          const chunk = cards.slice(i, i + BATCH_SIZE)
          const transformed = chunk.map(transformCard)

          // 1. Detect new cards/artworks BEFORE upserting (identification only)
          const newnessRecords = await detectNewness(transformed)

          // 2. Upsert cards
          await prisma.$transaction(
            transformed.map((card) =>
              prisma.card.upsert({
                where: { id: card.id },
                create: card,
                update: card,
              })
            )
          )

          // 3. Save newness records AFTER successful upsert (no orphans!)
          const { newCards, newArt } = await saveNewness(newnessRecords, syncLog.id)
          totalNewCards += newCards
          totalNewArt += newArt

          recordsProcessed += chunk.length
          for (const c of chunk) {
            langStats[c.lang] = (langStats[c.lang] || 0) + 1
          }
        }
      }
      
      if (totalParsed % 200000 === 0) {
        console.log(`[SYNC CARDS] Parsed ${totalParsed}, inserted ${recordsProcessed} cards (FR: ${langStats['fr'] || 0}, EN: ${langStats['en'] || 0}, new: ${totalNewCards} cards, ${totalNewArt} arts)`)
      }

      // Update progress: processing phase spans from 10% to 70%
      const ESTIMATED_TOTAL = 5_000_000
      const processingProgress = Math.min(
        10 + Math.round((totalParsed / ESTIMATED_TOTAL) * 60),
        70
      )
      updateSyncStatus({
        progress: processingProgress,
        message: `Processing cards... ${recordsProcessed.toLocaleString()} inserted`,
        recordsProcessed,
      })
    }

    console.log(`[SYNC CARDS] Import complete: ${recordsProcessed} cards`)
    console.log(`[SYNC CARDS] New items detected: ${totalNewCards} new cards, ${totalNewArt} new artworks`)
    console.log(`[SYNC CARDS] Language distribution:`, langStats)
    
    // Phase 2: Transfer prices from EN to FR before deduplication
    // French cards on Scryfall don't have prices, only English versions do
    updateSyncStatus({ phase: 'deduplicating', progress: 72, message: 'Transferring prices from EN to FR...' })
    console.log('[SYNC CARDS] Transferring prices from EN to FR versions...')

    const priceTransferResult = await transferPricesEnToFr()

    console.log(`[SYNC CARDS] Transferred prices to ${priceTransferResult} FR cards`)

    // Phase 3: Deduplicate using SQL - keep FR over EN for same illustration
    // IMPORTANT: Don't delete cards that are referenced in decks or wantlist!
    updateSyncStatus({ progress: 78, message: 'Deduplicating cards (FR over EN)...' })
    console.log('[SYNC CARDS] Deduplicating: keeping FR over EN for same illustration...')

    const deleteResult = await prisma.$executeRaw`
      DELETE FROM "Card" c1
      WHERE c1.lang = 'en'
      AND NOT EXISTS (SELECT 1 FROM "DeckCard" dc WHERE dc."cardId" = c1.id)
      AND NOT EXISTS (SELECT 1 FROM "WantlistItem" wi WHERE wi."cardId" = c1.id)
      AND EXISTS (
        SELECT 1 FROM "Card" c2 
        WHERE c2.lang = 'fr'
        AND (
          (c1."illustrationId" IS NOT NULL AND c1."illustrationId" = c2."illustrationId")
          OR 
          (c1."illustrationId" IS NULL AND c1."oracleId" = c2."oracleId" AND c1."setCode" = c2."setCode" AND c1."collectorNumber" = c2."collectorNumber")
        )
      )
    `
    
    skippedDuplicates = Number(deleteResult)
    console.log(`[SYNC CARDS] Removed ${skippedDuplicates} EN duplicates (FR version exists)`)

    cleanupTempFile('all_cards')

    updateSyncStatus({ phase: 'finalizing', progress: 85, message: 'Counting final records...' })

    const finalCount = await prisma.card.count()
    const durationMs = Date.now() - startTime

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'completed',
        recordsProcessed: finalCount,
        durationMs,
      },
    })

    updateSyncStatus({ progress: 90, message: 'Refreshing materialized views...' })

    // Refresh the card_type_words materialized view for autocomplete
    try {
      console.log('[SYNC CARDS] Refreshing card_type_words view...')
      await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW card_type_words')
      console.log('[SYNC CARDS] card_type_words view refreshed')
    } catch (viewError) {
      // View might not exist yet, that's OK
      console.warn('[SYNC CARDS] Could not refresh card_type_words view:', viewError)
    }

    // Refresh the card_sets materialized view for set autocomplete
    try {
      console.log('[SYNC CARDS] Refreshing card_sets view...')
      await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW card_sets')
      console.log('[SYNC CARDS] card_sets view refreshed')
    } catch (viewError) {
      console.warn('[SYNC CARDS] Could not refresh card_sets view:', viewError)
    }

    // Refresh the deck_card_names materialized view for deck card search
    try {
      console.log('[SYNC CARDS] Refreshing deck_card_names view...')
      await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW deck_card_names')
      console.log('[SYNC CARDS] deck_card_names view refreshed')
    } catch (viewError) {
      console.warn('[SYNC CARDS] Could not refresh deck_card_names view:', viewError)
    }

    finishSync(true, `Synchronized ${finalCount.toLocaleString()} cards in ${Math.round(durationMs / 1000)}s`)
    console.log(`[SYNC CARDS] Completed! ${finalCount} unique cards in ${Math.round(durationMs / 1000)}s (${totalNewCards} new cards, ${totalNewArt} new artworks)`)

    return {
      success: true,
      recordsProcessed: finalCount,
      skippedDuplicates,
      langStats,
      newCards: totalNewCards,
      newArt: totalNewArt,
      durationMs,
    }
  } catch (error) {
    console.error('[SYNC CARDS] Error occurred, temp file kept for debugging')

    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

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
    console.error('[SYNC CARDS] Failed:', errorMessage)

    return {
      success: false,
      recordsProcessed,
      skippedDuplicates,
      langStats,
      newCards: totalNewCards,
      newArt: totalNewArt,
      durationMs,
      error: errorMessage,
    }
  }
}

/**
 * Get the last successful card sync
 */
export async function getLastCardSync() {
  return prisma.syncLog.findFirst({
    where: {
      type: 'all_cards',
      status: 'completed',
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}
