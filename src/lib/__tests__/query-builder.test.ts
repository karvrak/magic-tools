import { describe, it, expect, vi } from 'vitest'
import {
  normalizeString,
  buildSearchQuery,
  getSortOrder,
  buildPriceFilter,
} from '@/lib/search/query-builder'

// ============================================
// normalizeString
// ============================================

describe('normalizeString', () => {
  it('removes diacritics from accented characters', () => {
    expect(normalizeString('Seance')).toBe('Seance')
    expect(normalizeString('Seance')).toBe('Seance') // already normalized
  })

  it('handles French accented characters', () => {
    expect(normalizeString('elephant')).toBe('elephant')
    expect(normalizeString('crepe')).toBe('crepe')
  })

  it('preserves ASCII characters', () => {
    expect(normalizeString('Lightning Bolt')).toBe('Lightning Bolt')
  })

  it('handles empty string', () => {
    expect(normalizeString('')).toBe('')
  })

  it('handles combined accents like circumflex', () => {
    // The NFD normalization should strip all combining marks
    const result = normalizeString('\u00E9') // e with acute
    expect(result).toBe('e')
  })
})

// ============================================
// buildSearchQuery
// ============================================

describe('buildSearchQuery', () => {
  it('returns a query with imageNormal and games filters for empty filters', () => {
    const result = buildSearchQuery({})
    expect(result).toHaveProperty('AND')
    const conditions = (result as { AND: unknown[] }).AND
    // Should always include imageNormal, games, and isVariation filters
    expect(conditions.length).toBeGreaterThanOrEqual(3)
  })

  it('adds name search condition', () => {
    const result = buildSearchQuery({ name: 'Bolt' })
    const conditions = (result as { AND: unknown[] }).AND
    const nameCondition = conditions.find(
      (c: any) => c.OR && c.OR.some((o: any) => o.printedName)
    )
    expect(nameCondition).toBeDefined()
  })

  it('adds text search condition', () => {
    const result = buildSearchQuery({ text: 'draw a card' })
    const conditions = (result as { AND: unknown[] }).AND
    const textCondition = conditions.find(
      (c: any) => c.OR && c.OR.some((o: any) => o.printedText)
    )
    expect(textCondition).toBeDefined()
  })

  it('adds type search condition', () => {
    const result = buildSearchQuery({ type: 'Creature' })
    const conditions = (result as { AND: unknown[] }).AND
    const typeCondition = conditions.find(
      (c: any) => c.OR && c.OR.some((o: any) => o.printedTypeLine)
    )
    expect(typeCondition).toBeDefined()
  })

  it('handles exact color mode', () => {
    const result = buildSearchQuery({
      colors: ['W', 'U'],
      colorMode: 'exact',
    })
    const conditions = (result as { AND: unknown[] }).AND
    const colorCondition = conditions.find(
      (c: any) => c.colors && c.colors.equals
    )
    expect(colorCondition).toBeDefined()
  })

  it('handles include color mode (default)', () => {
    const result = buildSearchQuery({
      colors: ['R'],
      colorMode: 'include',
    })
    const conditions = (result as { AND: unknown[] }).AND
    const colorCondition = conditions.find(
      (c: any) => c.colors && c.colors.hasEvery
    )
    expect(colorCondition).toBeDefined()
  })

  it('handles atMost color mode', () => {
    const result = buildSearchQuery({
      colors: ['W'],
      colorMode: 'atMost',
    })
    const conditions = (result as { AND: unknown[] }).AND
    const atMostCondition = conditions.find((c: any) => c.AND)
    expect(atMostCondition).toBeDefined()
  })

  it('adds CMC exact filter', () => {
    const result = buildSearchQuery({ cmcExact: 3 })
    const conditions = (result as { AND: unknown[] }).AND
    const cmcCondition = conditions.find(
      (c: any) => c.cmc && c.cmc.equals === 3
    )
    expect(cmcCondition).toBeDefined()
  })

  it('adds CMC range filters', () => {
    const result = buildSearchQuery({ cmcMin: 2, cmcMax: 5 })
    const conditions = (result as { AND: unknown[] }).AND
    const gteCondition = conditions.find(
      (c: any) => c.cmc && c.cmc.gte === 2
    )
    const lteCondition = conditions.find(
      (c: any) => c.cmc && c.cmc.lte === 5
    )
    expect(gteCondition).toBeDefined()
    expect(lteCondition).toBeDefined()
  })

  it('adds rarity filter', () => {
    const result = buildSearchQuery({ rarity: ['rare', 'mythic'] })
    const conditions = (result as { AND: unknown[] }).AND
    const rarityCondition = conditions.find(
      (c: any) => c.rarity && c.rarity.in
    )
    expect(rarityCondition).toBeDefined()
  })

  it('adds set filter', () => {
    const result = buildSearchQuery({ set: 'MKM' })
    const conditions = (result as { AND: unknown[] }).AND
    const setCondition = conditions.find((c: any) => c.setCode)
    expect(setCondition).toBeDefined()
  })

  it('adds format legality filter', () => {
    const result = buildSearchQuery({ format: 'standard' })
    const conditions = (result as { AND: unknown[] }).AND
    const legalityCondition = conditions.find(
      (c: any) => c.legalities
    )
    expect(legalityCondition).toBeDefined()
  })

  it('adds keywords filter', () => {
    const result = buildSearchQuery({ keywords: ['flying', 'deathtouch'] })
    const conditions = (result as { AND: unknown[] }).AND
    const keywordsCondition = conditions.find(
      (c: any) => c.keywords && c.keywords.hasSome
    )
    expect(keywordsCondition).toBeDefined()
  })

  it('trims whitespace from name filter', () => {
    const result = buildSearchQuery({ name: '  Bolt  ' })
    const conditions = (result as { AND: unknown[] }).AND
    const nameCondition = conditions.find(
      (c: any) => c.OR && c.OR.some((o: any) => o.printedName)
    ) as any
    expect(nameCondition.OR[0].printedName.contains).toBe('Bolt')
  })

  it('skips empty name/text/type when whitespace only', () => {
    const result = buildSearchQuery({ name: '   ', text: '  ', type: '  ' })
    const conditions = (result as { AND: unknown[] }).AND
    // Should only have imageNormal, games, and isVariation filters
    expect(conditions.length).toBe(3)
  })
})

// ============================================
// getSortOrder
// ============================================

describe('getSortOrder', () => {
  it('defaults to name ascending', () => {
    expect(getSortOrder()).toEqual({ name: 'asc' })
  })

  it('returns name with specified direction', () => {
    expect(getSortOrder('name', 'desc')).toEqual({ name: 'desc' })
  })

  it('returns cmc sorting', () => {
    expect(getSortOrder('cmc', 'asc')).toEqual({ cmc: 'asc' })
  })

  it('returns rarity sorting', () => {
    expect(getSortOrder('rarity', 'desc')).toEqual({ rarity: 'desc' })
  })

  it('returns releasedAt for set sorting', () => {
    expect(getSortOrder('set', 'asc')).toEqual({ releasedAt: 'asc' })
  })

  it('defaults direction to asc for unknown sortDir', () => {
    expect(getSortOrder('name', 'invalid')).toEqual({ name: 'asc' })
  })
})

// ============================================
// buildPriceFilter
// ============================================

describe('buildPriceFilter', () => {
  it('returns null when no price filters are set', async () => {
    const mockPrisma = {} as any
    const result = await buildPriceFilter(mockPrisma, {})
    expect(result).toBeNull()
  })

  it('returns null when price filters are undefined', async () => {
    const mockPrisma = {} as any
    const result = await buildPriceFilter(mockPrisma, {
      priceMinEur: undefined,
      priceMaxEur: undefined,
    })
    expect(result).toBeNull()
  })

  it('queries Card when EUR price range is set', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([
      { oracleId: 'oracle-1' },
      { oracleId: 'oracle-2' },
    ])
    const mockPrisma = {
      card: { findMany: mockFindMany },
    } as any

    const result = await buildPriceFilter(mockPrisma, {
      priceMinEur: 1,
      priceMaxEur: 10,
    })

    expect(mockFindMany).toHaveBeenCalledOnce()
    expect(result).toEqual(['oracle-1', 'oracle-2'])

    // Verify the where clause structure
    const call = mockFindMany.mock.calls[0][0]
    expect(call.where.AND).toHaveLength(2)
  })

  it('queries Card when USD price range is set', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([])
    const mockPrisma = {
      card: { findMany: mockFindMany },
    } as any

    const result = await buildPriceFilter(mockPrisma, {
      priceMinUsd: 5,
    })

    expect(mockFindMany).toHaveBeenCalledOnce()
    expect(result).toEqual([])
  })
})
