// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { detectArchetype } from '@/lib/ai/deck-analysis/archetype'
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

describe('detectArchetype', () => {
  it('returns null when no tags', () => {
    const cards = [mkCard({ archetypeTags: [] })]
    const r = detectArchetype(cards)
    expect(r.detected).toBeNull()
    expect(r.confidence).toBe(0)
  })

  it('elects the most-voted KNOWN archetype', () => {
    const cards = [
      mkCard({ archetypeTags: ['storm', 'spellslinger'], quantity: 1 }),
      mkCard({ archetypeTags: ['storm'], quantity: 1 }),
      mkCard({ archetypeTags: ['storm'], quantity: 1 }),
      mkCard({ archetypeTags: ['stax'], quantity: 1 }),
    ]
    const r = detectArchetype(cards)
    expect(r.detected).toBe('storm')
    expect(r.confidence).toBeGreaterThan(0)
  })

  it('ignores free tags that are not in KNOWN_ARCHETYPES for the pick', () => {
    const cards = [
      mkCard({ archetypeTags: ['tribal_dragons', 'tribal_dragons'], quantity: 4 }),
      mkCard({ archetypeTags: ['tribal'], quantity: 1 }),
    ]
    const r = detectArchetype(cards)
    expect(r.detected).toBe('tribal') // KNOWN
    // tribal_dragons should still appear in topTags
    expect(r.topTags.some((t) => t.tag === 'tribal_dragons')).toBe(true)
  })

  it('weights commander x3 in the vote', () => {
    const cards = [
      mkCard({
        archetypeTags: ['stax'],
        quantity: 1,
        category: 'commander',
      }),
      mkCard({ archetypeTags: ['storm'], quantity: 2 }),
    ]
    // storm: 2 * 1 = 2. stax: 1 * 3 = 3. stax wins.
    const r = detectArchetype(cards)
    expect(r.detected).toBe('stax')
  })

  it('skips basic lands', () => {
    const cards = [
      mkCard({
        archetypeTags: ['stax'],
        typeLine: 'Basic Land - Plains',
        quantity: 30,
      }),
      mkCard({ archetypeTags: ['storm'], quantity: 1 }),
    ]
    const r = detectArchetype(cards)
    expect(r.detected).toBe('storm')
  })
})
