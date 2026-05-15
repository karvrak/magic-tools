// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  parseCardTypes,
  extractProducedMana,
} from '@/lib/ai/classification/classify-cards'

describe('parseCardTypes', () => {
  it('splits supertypes, types, and subtypes', () => {
    expect(parseCardTypes('Legendary Creature - Human Wizard')).toEqual([
      'legendary',
      'creature',
      'human',
      'wizard',
    ])
  })

  it('handles em-dash separator', () => {
    expect(parseCardTypes('Land — Forest')).toEqual(['land', 'forest'])
  })

  it('handles split cards via //', () => {
    const out = parseCardTypes('Instant // Sorcery')
    expect(out).toContain('instant')
    expect(out).toContain('sorcery')
  })

  it('deduplicates tokens', () => {
    expect(parseCardTypes('Artifact Creature - Construct')).toEqual([
      'artifact',
      'creature',
      'construct',
    ])
  })
})

describe('extractProducedMana', () => {
  it('detects basic land mana', () => {
    expect(
      extractProducedMana({ typeLine: 'Basic Land - Plains', oracleText: null })
    ).toEqual(['W'])
    expect(
      extractProducedMana({ typeLine: 'Basic Land - Forest', oracleText: null })
    ).toEqual(['G'])
    expect(
      extractProducedMana({ typeLine: 'Basic Land - Wastes', oracleText: null })
    ).toEqual(['C'])
  })

  it('detects "any color" producers', () => {
    const out = extractProducedMana({
      typeLine: 'Land',
      oracleText: '{T}: Add one mana of any color.',
    })
    expect(out).toContain('ANY')
  })

  it('parses {T}: Add {U} pattern', () => {
    const out = extractProducedMana({
      typeLine: 'Artifact',
      oracleText: '{T}: Add {U}.',
    })
    expect(out).toContain('U')
  })

  it('does not capture stray symbols outside add context', () => {
    // "Pay {W}" is not adding mana
    const out = extractProducedMana({
      typeLine: 'Creature',
      oracleText: 'Pay {W}: Gain 1 life.',
    })
    expect(out).toEqual([])
  })
})
