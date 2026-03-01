import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { buildPriceFilter, normalizeString } from '@/lib/search/query-builder'
import { SearchFilters } from '@/types/search'
import { CardWithPrice } from '@/types/scryfall'
import { normalizeForSearch } from '@/lib/scryfall/bulk-download'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '24')))
    const skip = (page - 1) * pageSize

    // Parse filters from query params
    const filters: Partial<SearchFilters> = {
      name: searchParams.get('name') || undefined,
      text: searchParams.get('text') || undefined,
      type: searchParams.get('type') || undefined,
      colors: searchParams.get('colors')?.split(',').filter(Boolean) || undefined,
      colorIdentity: searchParams.get('colorIdentity')?.split(',').filter(Boolean) || undefined,
      colorMode: (searchParams.get('colorMode') as 'exact' | 'include' | 'atMost') || 'include',
      cmcMin: searchParams.get('cmcMin') ? parseFloat(searchParams.get('cmcMin')!) : undefined,
      cmcMax: searchParams.get('cmcMax') ? parseFloat(searchParams.get('cmcMax')!) : undefined,
      cmcExact: searchParams.get('cmcExact') ? parseFloat(searchParams.get('cmcExact')!) : undefined,
      rarity: searchParams.get('rarity')?.split(',').filter(Boolean) || undefined,
      set: searchParams.get('set') || undefined,
      format: searchParams.get('format') || undefined,
      priceMinEur: searchParams.get('priceMinEur') ? parseFloat(searchParams.get('priceMinEur')!) : undefined,
      priceMaxEur: searchParams.get('priceMaxEur') ? parseFloat(searchParams.get('priceMaxEur')!) : undefined,
      priceMinUsd: searchParams.get('priceMinUsd') ? parseFloat(searchParams.get('priceMinUsd')!) : undefined,
      priceMaxUsd: searchParams.get('priceMaxUsd') ? parseFloat(searchParams.get('priceMaxUsd')!) : undefined,
      keywords: searchParams.get('keywords')?.split(',').filter(Boolean) || undefined,
      // Newness filter (new cards / new artworks)
      newness: searchParams.get('newness') as 'new_card' | 'new_art' | 'all_new' | undefined,
      newnessSince: searchParams.get('newnessSince') || undefined,
      // Custom sets filter
      customSets: searchParams.get('customSets') === 'true',
    }

    // Sort options
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortDir = searchParams.get('sortDir') || 'asc'

    // All searches now use the deduplicated SQL search
    return await handleDeduplicatedSearch(
      filters,
      { page, pageSize, skip, sortBy, sortDir }
    )
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Handle search with deduplication by oracleId
 * Returns ONE version per unique card, prioritizing:
 * 1. Normal versions (not promo, not variation, no special frames)
 * 2. Versions with prices
 * 3. French versions
 * 4. Most recent release
 * 
 * Also includes a "reference price" from other versions if the selected version has no price
 */
async function handleDeduplicatedSearch(
  filters: Partial<SearchFilters>,
  pagination: { page: number; pageSize: number; skip: number; sortBy: string; sortDir: string }
) {
  const { page, pageSize, skip, sortBy, sortDir } = pagination

  // Characters for TRANSLATE (accent-insensitive search)
  const ACCENTED_CHARS = 'àáâãäåèéêëìíîïòóôõöùúûüýÿñçœæÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÑÇŒÆ'
  const UNACCENTED_CHARS = 'aaaaaaeeeeiiiioooooouuuuyyncoeaeAAAAAAEEEEIIIIOOOOOUUUUYYNCOEAE'

  // Build WHERE conditions array
  const whereConditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  // Name search - use pre-normalized column (FAST!)
  const nameSearch = filters.name?.trim()
  if (nameSearch) {
    const normalizedSearch = normalizeForSearch(nameSearch)
    whereConditions.push(`"nameNormalized" LIKE $${paramIndex}`)
    params.push(`%${normalizedSearch}%`)
    paramIndex++
  }

  // Text search (uses TRANSLATE - less common, acceptable perf)
  const textSearch = filters.text?.trim()
  if (textSearch) {
    const normalizedSearch = normalizeString(textSearch).toLowerCase()
    whereConditions.push(`(
      LOWER(TRANSLATE(COALESCE("printedText", ''), '${ACCENTED_CHARS}', '${UNACCENTED_CHARS}')) LIKE $${paramIndex}
      OR LOWER(TRANSLATE(COALESCE("oracleText", ''), '${ACCENTED_CHARS}', '${UNACCENTED_CHARS}')) LIKE $${paramIndex}
    )`)
    params.push(`%${normalizedSearch}%`)
    paramIndex++
  }

  // Type search (uses TRANSLATE - less common, acceptable perf)
  const typeSearch = filters.type?.trim()
  if (typeSearch) {
    const normalizedSearch = normalizeString(typeSearch).toLowerCase()
    whereConditions.push(`(
      LOWER(TRANSLATE(COALESCE("printedTypeLine", ''), '${ACCENTED_CHARS}', '${UNACCENTED_CHARS}')) LIKE $${paramIndex}
      OR LOWER(TRANSLATE("typeLine", '${ACCENTED_CHARS}', '${UNACCENTED_CHARS}')) LIKE $${paramIndex}
    )`)
    params.push(`%${normalizedSearch}%`)
    paramIndex++
  }

  // Color filter
  if (filters.colors && filters.colors.length > 0) {
    switch (filters.colorMode) {
      case 'exact':
        whereConditions.push(`"colors" = ARRAY[${filters.colors.map(c => `'${c}'`).join(',')}]::text[]`)
        break
      case 'atMost':
        const otherColors = ['W', 'U', 'B', 'R', 'G'].filter(c => !filters.colors!.includes(c))
        if (otherColors.length > 0) {
          whereConditions.push(`NOT ("colors" && ARRAY[${otherColors.map(c => `'${c}'`).join(',')}]::text[])`)
        }
        whereConditions.push(`"colors" && ARRAY[${filters.colors.map(c => `'${c}'`).join(',')}]::text[]`)
        break
      case 'include':
      default:
        whereConditions.push(`"colors" @> ARRAY[${filters.colors.map(c => `'${c}'`).join(',')}]::text[]`)
        break
    }
  }

  // Color identity filter
  if (filters.colorIdentity && filters.colorIdentity.length > 0) {
    whereConditions.push(`"colorIdentity" && ARRAY[${filters.colorIdentity.map(c => `'${c}'`).join(',')}]::text[]`)
  }

  // CMC filters
  if (filters.cmcExact !== null && filters.cmcExact !== undefined) {
    whereConditions.push(`"cmc" = ${filters.cmcExact}`)
  } else {
    if (filters.cmcMin !== null && filters.cmcMin !== undefined) {
      whereConditions.push(`"cmc" >= ${filters.cmcMin}`)
    }
    if (filters.cmcMax !== null && filters.cmcMax !== undefined) {
      whereConditions.push(`"cmc" <= ${filters.cmcMax}`)
    }
  }

  // Rarity filter
  if (filters.rarity && filters.rarity.length > 0) {
    whereConditions.push(`"rarity" IN (${filters.rarity.map(r => `'${r}'`).join(',')})`)
  }

  // Set filter
  if (filters.set?.trim()) {
    whereConditions.push(`LOWER("setCode") = $${paramIndex}`)
    params.push(filters.set.toLowerCase())
    paramIndex++
  }

  // Format legality filter
  if (filters.format?.trim()) {
    whereConditions.push(`"legalities"->>'${filters.format}' = 'legal'`)
  }

  // Keywords filter
  if (filters.keywords && filters.keywords.length > 0) {
    whereConditions.push(`"keywords" && ARRAY[${filters.keywords.map(k => `'${k}'`).join(',')}]::text[]`)
  }

  // Only include cards with images
  whereConditions.push(`"imageNormal" IS NOT NULL`)

  // Only include paper cards
  whereConditions.push(`'paper' = ANY("games")`)

  // Apply price filter if needed
  const priceOracleIds = await buildPriceFilter(prisma, filters)
  if (priceOracleIds !== null) {
    if (priceOracleIds.length === 0) {
      return NextResponse.json({
        cards: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
      })
    }
    whereConditions.push(`"oracleId" IN (${priceOracleIds.map(id => `'${id}'`).join(',')})`)
  }

  // Custom sets filter
  if (filters.customSets) {
    whereConditions.push(`"setCode" LIKE 'cus_%'`)
  }

  // Newness filter (new cards / new artworks)
  if (filters.newness) {
    const newnessType = filters.newness === 'new_card' ? "'NEW_CARD'"
      : filters.newness === 'new_art' ? "'NEW_ART'"
      : "'NEW_CARD', 'NEW_ART'" // all_new

    let newnessSubquery = `
      SELECT "oracleId" FROM "CardNewness"
      WHERE type::text IN (${newnessType})
    `

    // Optional: filter by detection date
    if (filters.newnessSince) {
      newnessSubquery += ` AND "detectedAt" >= '${filters.newnessSince}'`
    }

    // For NEW_ART, also filter by illustrationId to get the specific artwork
    if (filters.newness === 'new_art') {
      whereConditions.push(`(
        "oracleId" IN (${newnessSubquery})
        AND "illustrationId" IN (
          SELECT "illustrationId" FROM "CardNewness"
          WHERE type::text = 'NEW_ART' AND "illustrationId" IS NOT NULL
          ${filters.newnessSince ? `AND "detectedAt" >= '${filters.newnessSince}'` : ''}
        )
      )`)
    } else {
      whereConditions.push(`"oracleId" IN (${newnessSubquery})`)
    }
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

  // Build ORDER BY clause for final sort
  const orderColumn = sortBy === 'cmc' ? '"cmc"' : sortBy === 'rarity' ? '"rarity"' : sortBy === 'set' ? '"releasedAt"' : '"name"'
  const orderDir = sortDir === 'desc' ? 'DESC' : 'ASC'

  // Priority ORDER BY for DISTINCT ON - determines which version to keep per oracleId:
  // 1. Normal versions first (not promo, not variation, no special frames)
  // 2. Versions with prices
  // 3. French versions
  // 4. Most recent release
  const priorityOrder = `
    "oracleId",
    CASE WHEN "isPromo" = false AND "isVariation" = false 
         AND NOT ("frameEffects" && ARRAY['showcase', 'extendedart', 'borderless', 'etched']::text[]) 
         THEN 0 ELSE 1 END,
    CASE WHEN "priceEur" IS NOT NULL OR "priceUsd" IS NOT NULL THEN 0 ELSE 1 END,
    CASE WHEN "lang" = 'fr' THEN 0 ELSE 1 END,
    "releasedAt" DESC NULLS LAST
  `

  // Count unique oracleIds for pagination
  const countQuery = `
    SELECT COUNT(DISTINCT "oracleId") as count 
    FROM "Card" 
    ${whereClause}
  `
  const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(countQuery, ...params)
  const total = Number(countResult[0].count)

  // Main query with DISTINCT ON to get one version per oracleId
  // Uses a subquery to first select the best version, then applies final sorting
  const selectQuery = `
    WITH best_versions AS (
      SELECT DISTINCT ON ("oracleId") *
      FROM "Card"
      ${whereClause}
      ORDER BY ${priorityOrder}
    )
    SELECT * FROM best_versions
    ORDER BY ${orderColumn} ${orderDir}
    LIMIT ${pageSize} OFFSET ${skip}
  `

  const cards = await prisma.$queryRawUnsafe<Array<{
    id: string
    oracleId: string
    illustrationId: string | null
    name: string
    printedName: string | null
    nameNormalized: string | null
    lang: string
    layout: string
    manaCost: string | null
    cmc: number
    typeLine: string
    printedTypeLine: string | null
    oracleText: string | null
    printedText: string | null
    flavorText: string | null
    colors: string[]
    colorIdentity: string[]
    keywords: string[]
    setCode: string
    setName: string
    collectorNumber: string
    rarity: string
    imageSmall: string | null
    imageNormal: string | null
    imageLarge: string | null
    imageArtCrop: string | null
    imageBorderCrop: string | null
    imageNormalBack: string | null
    imageLargeBack: string | null
    power: string | null
    toughness: string | null
    loyalty: string | null
    legalities: Record<string, string>
    games: string[]
    isPromo: boolean
    isBooster: boolean
    frameEffects: string[]
    isFullArt: boolean
    isTextless: boolean
    isVariation: boolean
    priceEur: number | null
    priceEurFoil: number | null
    priceUsd: number | null
    priceUsdFoil: number | null
    releasedAt: Date | null
    syncedAt: Date
  }>>(selectQuery, ...params)

  // For cards without prices, find the best price from any version (reference price)
  const oracleIdsWithoutPrice = cards
    .filter(c => c.priceEur === null && c.priceUsd === null)
    .map(c => c.oracleId)

  let referencePrices: Map<string, { eur: number | null; usd: number | null; eurFoil: number | null; usdFoil: number | null }> = new Map()

  if (oracleIdsWithoutPrice.length > 0) {
    // Get the best price from any version for each oracleId
    const priceQuery = `
      SELECT DISTINCT ON ("oracleId")
        "oracleId",
        "priceEur",
        "priceEurFoil", 
        "priceUsd",
        "priceUsdFoil"
      FROM "Card"
      WHERE "oracleId" IN (${oracleIdsWithoutPrice.map(id => `'${id}'`).join(',')})
        AND ("priceEur" IS NOT NULL OR "priceUsd" IS NOT NULL)
      ORDER BY "oracleId", 
        CASE WHEN "priceEur" IS NOT NULL THEN 0 ELSE 1 END,
        "priceEur" ASC NULLS LAST
    `
    const priceResults = await prisma.$queryRawUnsafe<Array<{
      oracleId: string
      priceEur: number | null
      priceEurFoil: number | null
      priceUsd: number | null
      priceUsdFoil: number | null
    }>>(priceQuery)

    referencePrices = new Map(priceResults.map(p => [p.oracleId, {
      eur: p.priceEur,
      eurFoil: p.priceEurFoil,
      usd: p.priceUsd,
      usdFoil: p.priceUsdFoil,
    }]))
  }

  const oracleIds = [...new Set(cards.map((c) => c.oracleId))]

  // Count versions for each card (to show in UI)
  const versionCountQuery = `
    SELECT "oracleId", COUNT(*) as count
    FROM "Card"
    WHERE "oracleId" IN (${oracleIds.map(id => `'${id}'`).join(',')})
      AND "imageNormal" IS NOT NULL
    GROUP BY "oracleId"
  `
  const versionCounts = oracleIds.length > 0 
    ? await prisma.$queryRawUnsafe<Array<{ oracleId: string; count: bigint }>>(versionCountQuery)
    : []
  const versionCountMap = new Map(versionCounts.map(v => [v.oracleId, Number(v.count)]))

  // Build final response with prices
  const cardsWithPrices: (CardWithPrice & { versionCount: number; isReferencePrice: boolean })[] = cards.map((card) => {
    const referencePrice = referencePrices.get(card.oracleId)
    const hasOwnPrice = card.priceEur !== null || card.priceUsd !== null

    // Determine the price to use
    let finalPrice: {
      eur: number | null
      eurFoil: number | null
      usd: number | null
      usdFoil: number | null
    } | null = null
    let isReferencePrice = false

    if (hasOwnPrice) {
      finalPrice = {
        eur: card.priceEur,
        eurFoil: card.priceEurFoil,
        usd: card.priceUsd,
        usdFoil: card.priceUsdFoil,
      }
    } else if (referencePrice && (referencePrice.eur !== null || referencePrice.usd !== null)) {
      finalPrice = {
        eur: referencePrice.eur,
        eurFoil: referencePrice.eurFoil,
        usd: referencePrice.usd,
        usdFoil: referencePrice.usdFoil,
      }
      isReferencePrice = true
    }

    return {
      ...card,
      legalities: card.legalities as Record<string, string>,
      priceEur: finalPrice?.eur ?? null,
      priceEurFoil: finalPrice?.eurFoil ?? null,
      priceUsd: finalPrice?.usd ?? null,
      priceUsdFoil: finalPrice?.usdFoil ?? null,
      price: finalPrice,
      versionCount: versionCountMap.get(card.oracleId) || 1,
      isReferencePrice,
    }
  })

  return NextResponse.json({
    cards: cardsWithPrices,
    total,
    page,
    pageSize,
    hasMore: skip + cards.length < total,
  })
}
