// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  buildCanonicalText,
  hashCanonicalText,
} from '@/lib/ai/embeddings/canonical-text'

describe('buildCanonicalText', () => {
  it('produces a deterministic string for the same inputs', () => {
    const a = buildCanonicalText({
      name: 'Lightning Bolt',
      typeLine: 'Instant',
      oracleText: 'Lightning Bolt deals 3 damage to any target.',
      manaCost: '{R}',
      keywords: [],
    })
    const b = buildCanonicalText({
      name: 'Lightning Bolt',
      typeLine: 'Instant',
      oracleText: 'Lightning Bolt deals 3 damage to any target.',
      manaCost: '{R}',
      keywords: [],
    })
    expect(a).toBe(b)
    expect(a).toContain('Name: Lightning Bolt')
    expect(a).toContain('Type: Instant')
    expect(a).toContain('Mana: {R}')
  })

  it('sorts keywords for stable hash', () => {
    const a = buildCanonicalText({
      name: 'X',
      typeLine: 'Creature',
      oracleText: null,
      manaCost: null,
      keywords: ['Flying', 'Trample', 'Vigilance'],
    })
    const b = buildCanonicalText({
      name: 'X',
      typeLine: 'Creature',
      oracleText: null,
      manaCost: null,
      keywords: ['Trample', 'Vigilance', 'Flying'],
    })
    expect(a).toBe(b)
  })

  it('omits oracle text and mana cost when null', () => {
    const t = buildCanonicalText({
      name: 'Plains',
      typeLine: 'Basic Land - Plains',
      oracleText: null,
      manaCost: null,
      keywords: [],
    })
    expect(t).toContain('Name: Plains')
    expect(t).not.toMatch(/Mana:/)
    expect(t).not.toMatch(/Text:/)
  })
})

describe('hashCanonicalText', () => {
  it('returns the same hash for the same input', () => {
    expect(hashCanonicalText('hello')).toBe(hashCanonicalText('hello'))
  })

  it('differs when text differs (errata simulation)', () => {
    const before = buildCanonicalText({
      name: 'Card X',
      typeLine: 'Instant',
      oracleText: 'Deal 2 damage to any target.',
      manaCost: '{R}',
      keywords: [],
    })
    const after = buildCanonicalText({
      name: 'Card X',
      typeLine: 'Instant',
      oracleText: 'Deal 3 damage to any target.', // errata
      manaCost: '{R}',
      keywords: [],
    })
    expect(hashCanonicalText(before)).not.toBe(hashCanonicalText(after))
  })
})
