import { Prisma } from '@prisma/client'
import { SearchFilters } from '@/types/search'

/**
 * Normalize a string by removing diacritics (accents)
 * "Séance" -> "Seance", "éléphant" -> "elephant"
 */
export function normalizeString(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Build Prisma where clause from search filters
 * Searches in French (printed_*) fields first, with fallback to English (name, oracleText, typeLine)
 * Supports accent-insensitive search (e.g., "seance" matches "Séance")
 */
export function buildSearchQuery(filters: Partial<SearchFilters>): Prisma.CardWhereInput {
  const conditions: Prisma.CardWhereInput[] = []

  // Name search - search in both printedName (FR) and name (EN)
  if (filters.name?.trim()) {
    const searchTerm = filters.name.trim()
    conditions.push({
      OR: [
        {
          printedName: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        {
          name: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      ],
    })
  }

  // Text search - search in both printedText (FR) and oracleText (EN)
  if (filters.text?.trim()) {
    const searchTerm = filters.text.trim()
    conditions.push({
      OR: [
        {
          printedText: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        {
          oracleText: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      ],
    })
  }

  // Type line search - search in both printedTypeLine (FR) and typeLine (EN)
  if (filters.type?.trim()) {
    const searchTerm = filters.type.trim()
    conditions.push({
      OR: [
        {
          printedTypeLine: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        {
          typeLine: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      ],
    })
  }

  // Color filter
  if (filters.colors && filters.colors.length > 0) {
    switch (filters.colorMode) {
      case 'exact':
        // Exact color match
        conditions.push({
          colors: {
            equals: filters.colors,
          },
        })
        break
      case 'atMost':
        // Colors are subset of selected (no other colors)
        conditions.push({
          AND: [
            // All card colors must be in selected colors
            ...filters.colors.length > 0 ? [{
              colors: {
                hasSome: filters.colors,
              },
            }] : [],
            // Card must not have colors outside selection
            {
              NOT: {
                colors: {
                  hasSome: ['W', 'U', 'B', 'R', 'G'].filter(c => !filters.colors!.includes(c)),
                },
              },
            },
          ],
        })
        break
      case 'include':
      default:
        // Card has at least these colors
        conditions.push({
          colors: {
            hasEvery: filters.colors,
          },
        })
        break
    }
  }

  // Color identity filter
  if (filters.colorIdentity && filters.colorIdentity.length > 0) {
    conditions.push({
      colorIdentity: {
        hasSome: filters.colorIdentity,
      },
    })
  }

  // CMC filters
  if (filters.cmcExact !== null && filters.cmcExact !== undefined) {
    conditions.push({
      cmc: {
        equals: filters.cmcExact,
      },
    })
  } else {
    if (filters.cmcMin !== null && filters.cmcMin !== undefined) {
      conditions.push({
        cmc: {
          gte: filters.cmcMin,
        },
      })
    }
    if (filters.cmcMax !== null && filters.cmcMax !== undefined) {
      conditions.push({
        cmc: {
          lte: filters.cmcMax,
        },
      })
    }
  }

  // Rarity filter
  if (filters.rarity && filters.rarity.length > 0) {
    conditions.push({
      rarity: {
        in: filters.rarity,
      },
    })
  }

  // Set filter
  if (filters.set?.trim()) {
    conditions.push({
      setCode: {
        equals: filters.set.toLowerCase(),
        mode: 'insensitive',
      },
    })
  }

  // Format legality filter
  if (filters.format?.trim()) {
    conditions.push({
      legalities: {
        path: [filters.format],
        equals: 'legal',
      },
    })
  }

  // Keywords filter
  if (filters.keywords && filters.keywords.length > 0) {
    conditions.push({
      keywords: {
        hasSome: filters.keywords,
      },
    })
  }

  // Only include cards with images (filter out tokens without images etc.)
  conditions.push({
    imageNormal: {
      not: null,
    },
  })

  // Only include paper cards by default
  conditions.push({
    games: {
      has: 'paper',
    },
  })

  // Filter out alternate arts - prefer "base" versions but include promos/variants if it's the only version
  // Note: This Prisma filter is simpler - we exclude obvious variations but keep promos
  // The SQL version (in route.ts) has the full logic with EXISTS subquery
  // Here we just exclude true variations but allow promos (they're often the only version for Commander cards)
  conditions.push({
    isVariation: false,
  })

  return conditions.length > 0 ? { AND: conditions } : {}
}

/**
 * Build price filter conditions
 * Returns oracle IDs that match the price criteria
 */
export async function buildPriceFilter(
  prisma: any,
  filters: Partial<SearchFilters>
): Promise<string[] | null> {
  const priceConditions: Prisma.CardPriceWhereInput[] = []

  // EUR price filters
  if (filters.priceMinEur !== null && filters.priceMinEur !== undefined) {
    priceConditions.push({
      eur: {
        gte: filters.priceMinEur,
      },
    })
  }
  if (filters.priceMaxEur !== null && filters.priceMaxEur !== undefined) {
    priceConditions.push({
      eur: {
        lte: filters.priceMaxEur,
      },
    })
  }

  // USD price filters
  if (filters.priceMinUsd !== null && filters.priceMinUsd !== undefined) {
    priceConditions.push({
      usd: {
        gte: filters.priceMinUsd,
      },
    })
  }
  if (filters.priceMaxUsd !== null && filters.priceMaxUsd !== undefined) {
    priceConditions.push({
      usd: {
        lte: filters.priceMaxUsd,
      },
    })
  }

  if (priceConditions.length === 0) {
    return null // No price filter needed
  }

  // Get oracle IDs matching price criteria
  const matchingPrices = await prisma.cardPrice.findMany({
    where: {
      AND: priceConditions,
    },
    select: {
      oracleId: true,
    },
  })

  return matchingPrices.map((p: { oracleId: string }) => p.oracleId)
}

/**
 * Get sort order from query parameters
 */
export function getSortOrder(
  sortBy?: string,
  sortDir?: string
): Prisma.CardOrderByWithRelationInput {
  const direction: 'asc' | 'desc' = sortDir === 'desc' ? 'desc' : 'asc'

  switch (sortBy) {
    case 'name':
      return { name: direction }
    case 'cmc':
      return { cmc: direction }
    case 'rarity':
      return { rarity: direction }
    case 'set':
      return { releasedAt: direction }
    default:
      return { name: 'asc' }
  }
}
