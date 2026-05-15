// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  computeRoleDistribution,
  computeCurveDistribution,
} from '@/lib/ai/deck-analysis/distributions'
import type { DeckCardForCentroid } from '@/lib/ai/deck-analysis/centroid'

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

describe('computeRoleDistribution', () => {
  it('counts by primary_role weighted by quantity', () => {
    const cards = [
      mkCard({ primaryRole: 'ramp', quantity: 4 }),
      mkCard({ primaryRole: 'ramp', quantity: 2 }),
      mkCard({ primaryRole: 'removal', quantity: 1 }),
      mkCard({ primaryRole: null, quantity: 3 }),
    ]
    const r = computeRoleDistribution(cards)
    expect(r.counts.ramp).toBe(6)
    expect(r.counts.removal).toBe(1)
    expect(r.counts.unclassified).toBe(3)
    expect(r.total).toBe(10)
  })

  it('excludeBasics removes Basic Land entries', () => {
    const cards = [
      mkCard({ typeLine: 'Basic Land - Plains', primaryRole: 'land', quantity: 10 }),
      mkCard({ typeLine: 'Instant', primaryRole: 'removal', quantity: 1 }),
    ]
    const r = computeRoleDistribution(cards, { excludeBasics: true })
    expect(r.total).toBe(1)
    expect(r.counts.removal).toBe(1)
    expect(r.counts.land).toBe(0)
  })
})

describe('computeCurveDistribution', () => {
  it('groups CMC into buckets and excludes lands by default', () => {
    const cards = [
      mkCard({ cmc: 0, typeLine: 'Sorcery', quantity: 1 }),
      mkCard({ cmc: 1, typeLine: 'Instant', quantity: 4 }),
      mkCard({ cmc: 4, typeLine: 'Creature', quantity: 2 }),
      mkCard({ cmc: 9, typeLine: 'Creature', quantity: 1 }),
      mkCard({ cmc: 0, typeLine: 'Land', quantity: 24 }), // exclu
    ]
    const c = computeCurveDistribution(cards)
    expect(c.buckets['0']).toBe(1)
    expect(c.buckets['1']).toBe(4)
    expect(c.buckets['4']).toBe(2)
    expect(c.buckets['7+']).toBe(1)
    expect(c.total).toBe(8)
    // average = (0*1 + 1*4 + 4*2 + 9*1) / 8 = 21/8 = 2.625
    expect(c.averageCmc).toBeCloseTo(2.625, 3)
  })
})
