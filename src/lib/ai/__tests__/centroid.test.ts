// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  computeCentroid,
  parseVectorLiteral,
  isBasicLand,
} from '@/lib/ai/deck-analysis/centroid'
import { COMMANDER_CENTROID_WEIGHT, EMBEDDING_DIMENSIONS } from '@/lib/ai/config'
import type { DeckCardForCentroid } from '@/lib/ai/deck-analysis/centroid'

function mkVec(value: number): number[] {
  return new Array(EMBEDDING_DIMENSIONS).fill(value)
}

function mkCard(p: Partial<DeckCardForCentroid>): DeckCardForCentroid {
  return {
    cardId: p.cardId ?? 'id',
    oracleId: p.oracleId ?? 'oid',
    name: p.name ?? 'X',
    typeLine: p.typeLine ?? 'Instant',
    oracleText: p.oracleText ?? null,
    cmc: p.cmc ?? 1,
    primaryRole: p.primaryRole ?? null,
    archetypeTags: p.archetypeTags ?? [],
    category: p.category ?? 'mainboard',
    quantity: p.quantity ?? 1,
    embedding: p.embedding ?? null,
  }
}

describe('isBasicLand', () => {
  it('detects basic lands', () => {
    expect(isBasicLand('Basic Land - Forest')).toBe(true)
    expect(isBasicLand('Basic Snow Land - Mountain')).toBe(true)
  })
  it('rejects non-basic lands', () => {
    expect(isBasicLand('Land - Tropical Island')).toBe(false)
    expect(isBasicLand('Creature - Human')).toBe(false)
  })
})

describe('parseVectorLiteral', () => {
  it('parses a valid vector literal', () => {
    const literal = `[${new Array(EMBEDDING_DIMENSIONS).fill(0.5).join(',')}]`
    const out = parseVectorLiteral(literal)
    expect(out).not.toBeNull()
    expect(out!.length).toBe(EMBEDDING_DIMENSIONS)
    expect(out![0]).toBe(0.5)
  })

  it('returns null for malformed input', () => {
    expect(parseVectorLiteral(null)).toBeNull()
    expect(parseVectorLiteral('[]')).toBeNull()
    expect(parseVectorLiteral('[1,2,3]')).toBeNull() // wrong dim
  })
})

describe('computeCentroid', () => {
  it('returns null when no card has embedding', () => {
    const cards = [mkCard({ embedding: null })]
    expect(computeCentroid(cards)).toBeNull()
  })

  it('weighted average by quantity', () => {
    const cards = [
      mkCard({ embedding: mkVec(0), quantity: 1 }),
      mkCard({ embedding: mkVec(1), quantity: 3 }),
    ]
    const r = computeCentroid(cards)
    expect(r).not.toBeNull()
    // (0*1 + 1*3) / 4 = 0.75
    expect(r!.centroid[0]).toBeCloseTo(0.75, 6)
    expect(r!.totalWeight).toBe(4)
    expect(r!.usedCards).toBe(2)
  })

  it('commander gets COMMANDER_CENTROID_WEIGHT multiplier', () => {
    const cards = [
      mkCard({ embedding: mkVec(0), quantity: 1, category: 'mainboard' }),
      mkCard({ embedding: mkVec(1), quantity: 1, category: 'commander' }),
    ]
    const r = computeCentroid(cards)
    // weight: 1 (mainboard) + 3 (commander) = 4
    // centroid = (0*1 + 1*3)/4 = 0.75
    expect(r!.totalWeight).toBe(1 + COMMANDER_CENTROID_WEIGHT)
    expect(r!.centroid[0]).toBeCloseTo(
      COMMANDER_CENTROID_WEIGHT / (1 + COMMANDER_CENTROID_WEIGHT),
      6
    )
  })

  it('excludes basic lands by default', () => {
    const cards = [
      mkCard({
        embedding: mkVec(0.1),
        typeLine: 'Basic Land - Forest',
        quantity: 30,
      }),
      mkCard({ embedding: mkVec(0.9), typeLine: 'Creature', quantity: 1 }),
    ]
    const r = computeCentroid(cards)
    // Only the creature contributes
    expect(r!.centroid[0]).toBeCloseTo(0.9, 6)
    expect(r!.totalWeight).toBe(1)
  })
})
