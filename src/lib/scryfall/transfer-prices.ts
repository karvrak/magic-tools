import prisma from '@/lib/prisma'

/**
 * Transfer prices from EN cards to FR cards using a 3-tier matching strategy:
 * 1. Primary: oracleId + setCode + collectorNumber (exact match)
 * 2. Secondary: oracleId + setCode (lowest price in set if multiple EN)
 * 3. Tertiary: oracleId only (most recent/standard EN version)
 *
 * Called after:
 * - Daily price sync (syncPrices)
 * - Weekly card sync (syncAllCards)
 *
 * Returns total number of FR cards updated.
 */
export async function transferPricesEnToFr(): Promise<number> {
  let totalUpdated = 0

  // Tier 1: Exact match — oracleId + setCode + collectorNumber
  const tier1 = await prisma.$executeRaw`
    UPDATE "Card" fr
    SET
      "priceEur" = en."priceEur",
      "priceEurFoil" = en."priceEurFoil",
      "priceUsd" = en."priceUsd",
      "priceUsdFoil" = en."priceUsdFoil"
    FROM "Card" en
    WHERE fr.lang = 'fr'
      AND en.lang = 'en'
      AND fr."oracleId" = en."oracleId"
      AND fr."setCode" = en."setCode"
      AND fr."collectorNumber" = en."collectorNumber"
      AND (fr."priceEur" IS NULL AND fr."priceUsd" IS NULL)
      AND (en."priceEur" IS NOT NULL OR en."priceUsd" IS NOT NULL)
  `
  totalUpdated += tier1
  console.log(`[TRANSFER PRICES] Tier 1 (exact match): ${tier1} FR cards updated`)

  // Tier 2: Same set — oracleId + setCode, pick lowest price EN card
  const tier2 = await prisma.$executeRaw`
    UPDATE "Card" fr
    SET
      "priceEur" = sub."priceEur",
      "priceEurFoil" = sub."priceEurFoil",
      "priceUsd" = sub."priceUsd",
      "priceUsdFoil" = sub."priceUsdFoil"
    FROM (
      SELECT DISTINCT ON (en."oracleId", en."setCode")
        en."oracleId",
        en."setCode",
        en."priceEur",
        en."priceEurFoil",
        en."priceUsd",
        en."priceUsdFoil"
      FROM "Card" en
      WHERE en.lang = 'en'
        AND (en."priceEur" IS NOT NULL OR en."priceUsd" IS NOT NULL)
      ORDER BY en."oracleId", en."setCode",
        COALESCE(en."priceEur", en."priceUsd" * 0.92) ASC NULLS LAST
    ) sub
    WHERE fr.lang = 'fr'
      AND fr."oracleId" = sub."oracleId"
      AND fr."setCode" = sub."setCode"
      AND (fr."priceEur" IS NULL AND fr."priceUsd" IS NULL)
  `
  totalUpdated += tier2
  console.log(`[TRANSFER PRICES] Tier 2 (same set): ${tier2} FR cards updated`)

  // Tier 3: Oracle-level — oracleId only, pick most recent standard EN version
  const tier3 = await prisma.$executeRaw`
    UPDATE "Card" fr
    SET
      "priceEur" = sub."priceEur",
      "priceEurFoil" = sub."priceEurFoil",
      "priceUsd" = sub."priceUsd",
      "priceUsdFoil" = sub."priceUsdFoil"
    FROM (
      SELECT DISTINCT ON (en."oracleId")
        en."oracleId",
        en."priceEur",
        en."priceEurFoil",
        en."priceUsd",
        en."priceUsdFoil"
      FROM "Card" en
      WHERE en.lang = 'en'
        AND (en."priceEur" IS NOT NULL OR en."priceUsd" IS NOT NULL)
      ORDER BY en."oracleId",
        CASE WHEN en."isPromo" = false AND en."isVariation" = false THEN 0 ELSE 1 END,
        en."releasedAt" DESC NULLS LAST
    ) sub
    WHERE fr.lang = 'fr'
      AND fr."oracleId" = sub."oracleId"
      AND (fr."priceEur" IS NULL AND fr."priceUsd" IS NULL)
  `
  totalUpdated += tier3
  console.log(`[TRANSFER PRICES] Tier 3 (oracle-level): ${tier3} FR cards updated`)

  console.log(`[TRANSFER PRICES] Total: ${totalUpdated} FR cards updated`)
  return totalUpdated
}
