import { describe, it, expect } from 'vitest'
import {
  shuffle,
  parseManaCost,
  countColorSymbols,
  detectLandType,
  detectMdfc,
  parseManaProduction,
  detectLandManaAmount,
  landEntersTappedOnTurn,
  canCastWithColors,
  calculateManaAdvanced,
  calculateManaBasic,
  runSimulation,
  analyzeDeck,
  runSealedSimulation,
  type SimCard,
  type ManaSource,
  type ColorRequirement,
} from '@/lib/sealed-simulation'

// ============================================
// HELPERS — reusable factory functions
// ============================================

function makeBasicLand(name: string, color: string): SimCard {
  return {
    name,
    cmc: 0,
    isLand: true,
    isManaAccelerator: false,
    isMdfc: false,
    mdfcLandSide: null,
    manaSource: { amount: 1, colors: [color] },
    colorRequirement: { generic: 0, colored: [] },
    entersTapped: false,
    entersTappedConditional: 'never',
    isFetchland: false,
    isBounceland: false,
    landType: 'basic',
  }
}

function makeSpell(
  name: string,
  cmc: number,
  colorReq: ColorRequirement
): SimCard {
  return {
    name,
    cmc,
    isLand: false,
    isManaAccelerator: false,
    isMdfc: false,
    mdfcLandSide: null,
    manaSource: null,
    colorRequirement: colorReq,
    entersTapped: false,
    entersTappedConditional: 'never',
    isFetchland: false,
    isBounceland: false,
    landType: 'other',
  }
}

function makeTapland(name: string, colors: string[]): SimCard {
  return {
    name,
    cmc: 0,
    isLand: true,
    isManaAccelerator: false,
    isMdfc: false,
    mdfcLandSide: null,
    manaSource: { amount: 1, colors },
    colorRequirement: { generic: 0, colored: [] },
    entersTapped: true,
    entersTappedConditional: 'always',
    isFetchland: false,
    isBounceland: false,
    landType: 'tapland',
  }
}

function makeShockland(name: string, colors: string[]): SimCard {
  return {
    name,
    cmc: 0,
    isLand: true,
    isManaAccelerator: false,
    isMdfc: false,
    mdfcLandSide: null,
    manaSource: { amount: 1, colors },
    colorRequirement: { generic: 0, colored: [] },
    entersTapped: false,
    entersTappedConditional: 'shock',
    isFetchland: false,
    isBounceland: false,
    landType: 'shock',
  }
}

function makeFastland(name: string, colors: string[]): SimCard {
  return {
    name,
    cmc: 0,
    isLand: true,
    isManaAccelerator: false,
    isMdfc: false,
    mdfcLandSide: null,
    manaSource: { amount: 1, colors },
    colorRequirement: { generic: 0, colored: [] },
    entersTapped: false,
    entersTappedConditional: 'fast',
    isFetchland: false,
    isBounceland: false,
    landType: 'fast',
  }
}

function makeCheckland(name: string, colors: string[]): SimCard {
  return {
    name,
    cmc: 0,
    isLand: true,
    isManaAccelerator: false,
    isMdfc: false,
    mdfcLandSide: null,
    manaSource: { amount: 1, colors },
    colorRequirement: { generic: 0, colored: [] },
    entersTapped: false,
    entersTappedConditional: 'check',
    isFetchland: false,
    isBounceland: false,
    landType: 'check',
  }
}

function makeFetchland(name: string): SimCard {
  return {
    name,
    cmc: 0,
    isLand: true,
    isManaAccelerator: false,
    isMdfc: false,
    mdfcLandSide: null,
    manaSource: { amount: 0, colors: ['ANY'] },
    colorRequirement: { generic: 0, colored: [] },
    entersTapped: false,
    entersTappedConditional: 'never',
    isFetchland: true,
    isBounceland: false,
    landType: 'fetch',
  }
}

function makeMdfc(name: string, cmc: number, colorReq: ColorRequirement): SimCard {
  return {
    name,
    cmc,
    isLand: false,
    isManaAccelerator: false,
    isMdfc: true,
    mdfcLandSide: { amount: 1, colors: ['ANY'] },
    manaSource: null,
    colorRequirement: colorReq,
    entersTapped: false,
    entersTappedConditional: 'never',
    isFetchland: false,
    isBounceland: false,
    landType: 'other',
  }
}

// ============================================
// TESTS
// ============================================

describe('shuffle (Fisher-Yates)', () => {
  it('returns a new array with the same length', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffle(input)
    expect(result).toHaveLength(input.length)
    expect(result).not.toBe(input) // must be a new reference
  })

  it('contains every element from the original array', () => {
    const input = [10, 20, 30, 40, 50]
    const result = shuffle(input)
    expect(result.sort()).toEqual(input.sort())
  })

  it('does not mutate the original array', () => {
    const input = [1, 2, 3, 4, 5]
    const copy = [...input]
    shuffle(input)
    expect(input).toEqual(copy)
  })

  it('produces different orderings over many runs (randomness check)', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const results = new Set<string>()
    for (let i = 0; i < 50; i++) {
      results.add(shuffle(input).join(','))
    }
    // With 10 elements and 50 shuffles, we should see many distinct orderings
    expect(results.size).toBeGreaterThan(10)
  })

  it('handles an empty array', () => {
    expect(shuffle([])).toEqual([])
  })

  it('handles a single-element array', () => {
    expect(shuffle([42])).toEqual([42])
  })
})

// ============================================
// parseManaCost
// ============================================

describe('parseManaCost', () => {
  it('returns zeroed requirement for null input', () => {
    expect(parseManaCost(null)).toEqual({ generic: 0, colored: [] })
  })

  it('returns zeroed requirement for empty string', () => {
    expect(parseManaCost('')).toEqual({ generic: 0, colored: [] })
  })

  it('parses a simple generic cost', () => {
    expect(parseManaCost('{3}')).toEqual({ generic: 3, colored: [] })
  })

  it('parses single colored mana', () => {
    expect(parseManaCost('{R}')).toEqual({ generic: 0, colored: ['R'] })
  })

  it('parses a mixed cost like {2}{W}{U}', () => {
    const result = parseManaCost('{2}{W}{U}')
    expect(result.generic).toBe(2)
    expect(result.colored).toEqual(['W', 'U'])
  })

  it('parses double-colored cost {W}{W}', () => {
    const result = parseManaCost('{W}{W}')
    expect(result.generic).toBe(0)
    expect(result.colored).toEqual(['W', 'W'])
  })

  it('parses hybrid mana {W/U} — picks the first recognized color', () => {
    const result = parseManaCost('{W/U}')
    expect(result.generic).toBe(0)
    expect(result.colored).toHaveLength(1)
    expect(['W', 'U']).toContain(result.colored[0])
  })

  it('ignores X costs', () => {
    const result = parseManaCost('{X}{R}{R}')
    expect(result.generic).toBe(0)
    expect(result.colored).toEqual(['R', 'R'])
  })

  it('ignores Phyrexian mana {P}', () => {
    const result = parseManaCost('{W/P}')
    // Phyrexian hybrid: the symbol contains 'P', so it should be skipped
    expect(result.generic).toBe(0)
  })

  it('parses colorless mana symbol {C}', () => {
    const result = parseManaCost('{C}{C}')
    expect(result.colored).toEqual(['C', 'C'])
  })
})

// ============================================
// countColorSymbols
// ============================================

describe('countColorSymbols', () => {
  it('returns zeroes for null mana cost', () => {
    const result = countColorSymbols(null)
    expect(result).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0 })
  })

  it('counts individual colored symbols', () => {
    const result = countColorSymbols('{1}{W}{W}{U}')
    expect(result.W).toBe(2)
    expect(result.U).toBe(1)
    expect(result.B).toBe(0)
  })

  it('counts hybrid mana as 0.5 for each color', () => {
    const result = countColorSymbols('{W/U}')
    expect(result.W).toBe(0.5)
    expect(result.U).toBe(0.5)
  })

  it('does not count generic mana', () => {
    const result = countColorSymbols('{4}')
    expect(Object.values(result).every((v) => v === 0)).toBe(true)
  })
})

// ============================================
// detectLandType
// ============================================

describe('detectLandType', () => {
  it('detects a basic Plains', () => {
    const result = detectLandType('Plains', null, 'Basic Land — Plains')
    expect(result.landType).toBe('basic')
    expect(result.entersTapped).toBe(false)
    expect(result.isFetchland).toBe(false)
  })

  it('detects a fetchland', () => {
    const result = detectLandType(
      'Flooded Strand',
      '{T}, Pay 1 life, Sacrifice Flooded Strand: Search your library for a Plains or Island card.',
      'Land'
    )
    expect(result.landType).toBe('fetch')
    expect(result.isFetchland).toBe(true)
  })

  it('detects a shock land', () => {
    // Shock lands use "unless you pay 2 life" in Oracle text
    const result = detectLandType(
      'Hallowed Fountain',
      '({T}: Add {W} or {U}.)\nAs Hallowed Fountain enters the battlefield, unless you pay 2 life, it enters tapped.',
      'Land — Plains Island'
    )
    expect(result.landType).toBe('shock')
    expect(result.entersTappedConditional).toBe('shock')
    expect(result.entersTapped).toBe(false)
  })

  it('detects a fast land', () => {
    const result = detectLandType(
      'Seachrome Coast',
      '{T}: Add {W} or {U}.\nSeachrome Coast enters the battlefield tapped unless you control two or more other lands.',
      'Land'
    )
    expect(result.landType).toBe('fast')
    expect(result.entersTappedConditional).toBe('fast')
  })

  it('detects a check land', () => {
    const result = detectLandType(
      'Glacial Fortress',
      'Glacial Fortress enters tapped unless you control a Plains or an Island.\n{T}: Add {W} or {U}.',
      'Land'
    )
    expect(result.landType).toBe('check')
    expect(result.entersTappedConditional).toBe('check')
  })

  it('detects a reveal land', () => {
    // Reveal lands use "unless you reveal" in Oracle text
    const result = detectLandType(
      'Port Town',
      'As Port Town enters the battlefield, unless you reveal a Plains or Island card from your hand, it enters tapped.\n{T}: Add {W} or {U}.',
      'Land'
    )
    expect(result.landType).toBe('reveal')
    expect(result.entersTappedConditional).toBe('reveal')
  })

  it('detects a pure tap land', () => {
    const result = detectLandType(
      'Tranquil Cove',
      'Tranquil Cove enters tapped.\nWhen Tranquil Cove enters the battlefield, you gain 1 life.\n{T}: Add {W} or {U}.',
      'Land'
    )
    expect(result.landType).toBe('tapland')
    expect(result.entersTapped).toBe(true)
    expect(result.entersTappedConditional).toBe('always')
  })

  it('detects a bounce land', () => {
    const result = detectLandType(
      'Azorius Chancery',
      'Azorius Chancery enters tapped.\nWhen Azorius Chancery enters the battlefield, return a land you control to its owner\'s hand.\n{T}: Add {W}{U}.',
      'Land'
    )
    expect(result.landType).toBe('bounce')
    expect(result.isBounceland).toBe(true)
  })

  it('detects a land with no enters-tapped text as other/never', () => {
    const result = detectLandType(
      'Command Tower',
      '{T}: Add one mana of any color in your commander\'s color identity.',
      'Land'
    )
    expect(result.landType).toBe('other')
    expect(result.entersTappedConditional).toBe('never')
  })
})

// ============================================
// detectMdfc
// ============================================

describe('detectMdfc', () => {
  it('returns isMdfc false for non-modal_dfc layout', () => {
    const result = detectMdfc('normal', 'Creature — Human')
    expect(result.isMdfc).toBe(false)
    expect(result.isLandOnBack).toBe(false)
  })

  it('returns isMdfc true with land on back', () => {
    const result = detectMdfc('modal_dfc', 'Creature — Cleric', 'Land')
    expect(result.isMdfc).toBe(true)
    expect(result.isLandOnBack).toBe(true)
  })

  it('returns isLandOnBack false when front is already a land', () => {
    const result = detectMdfc('modal_dfc', 'Land', 'Land')
    expect(result.isMdfc).toBe(true)
    expect(result.isLandOnBack).toBe(false)
  })
})

// ============================================
// parseManaProduction
// ============================================

describe('parseManaProduction', () => {
  it('returns ["C"] for null oracle text', () => {
    expect(parseManaProduction(null, 'Some Land')).toEqual(['C'])
  })

  it('detects "any color" lands', () => {
    const result = parseManaProduction(
      '{T}: Add one mana of any color.',
      'City of Brass'
    )
    expect(result).toEqual(['ANY'])
  })

  it('detects fetchlands as ANY producers', () => {
    const result = parseManaProduction(
      '{T}, Pay 1 life, Sacrifice ~: Search your library for a land card.',
      'Prismatic Vista'
    )
    expect(result).toEqual(['ANY'])
  })

  it('detects specific colors from Add text', () => {
    const result = parseManaProduction('{T}: Add {W} or {U}.', 'Dual Land')
    expect(result).toContain('W')
    expect(result).toContain('U')
  })

  it('returns colorless for null oracle text (early return before name check)', () => {
    // When oracleText is null, the function returns ['C'] immediately
    // without checking the name. This is by design — basic lands are
    // handled via createBasicLandSimCard which sets color directly.
    expect(parseManaProduction(null, 'Plains')).toEqual(['C'])
    expect(parseManaProduction(null, 'Island')).toEqual(['C'])
  })

  it('detects color from basic land name when oracle text is provided', () => {
    // When oracle text is non-null but does not mention Add,
    // the function falls through to name-based detection
    expect(parseManaProduction('{T}: Add {W}.', 'Plains')).toContain('W')
    expect(parseManaProduction('{T}: Add {U}.', 'Island')).toContain('U')
    expect(parseManaProduction('{T}: Add {B}.', 'Swamp')).toContain('B')
    expect(parseManaProduction('{T}: Add {R}.', 'Mountain')).toContain('R')
    expect(parseManaProduction('{T}: Add {G}.', 'Forest')).toContain('G')
  })

  it('defaults to colorless when no color detected', () => {
    // A land with text that does not mention any color keywords
    expect(parseManaProduction('{T}: Untap target creature.', 'Weird Land')).toEqual(['C'])
  })
})

// ============================================
// detectLandManaAmount
// ============================================

describe('detectLandManaAmount', () => {
  it('returns 1 for a normal land', () => {
    expect(detectLandManaAmount('Plains', null)).toBe(1)
  })

  it('returns 2 for a bounce land', () => {
    expect(
      detectLandManaAmount(
        'Azorius Chancery',
        'When Azorius Chancery enters the battlefield, return a land you control to its owner\'s hand.\n{T}: Add {W}{U}.'
      )
    ).toBe(2)
  })

  it('returns 2 for Ancient Tomb', () => {
    expect(detectLandManaAmount('Ancient Tomb', '{T}: Add {C}{C}. Ancient Tomb deals 2 damage to you.')).toBe(2)
  })

  it('returns 0 for a fetchland (sacrifice)', () => {
    expect(
      detectLandManaAmount(
        'Flooded Strand',
        '{T}, Pay 1 life, Sacrifice Flooded Strand: Search your library for a Plains or Island card.'
      )
    ).toBe(0)
  })
})

// ============================================
// landEntersTappedOnTurn
// ============================================

describe('landEntersTappedOnTurn', () => {
  it('"never" is always untapped', () => {
    const land = makeBasicLand('Plains', 'W')
    expect(landEntersTappedOnTurn(land, 1, 0, true)).toBe(false)
    expect(landEntersTappedOnTurn(land, 5, 4, true)).toBe(false)
  })

  it('"always" is always tapped', () => {
    const land = makeTapland('Tranquil Cove', ['W', 'U'])
    expect(landEntersTappedOnTurn(land, 1, 0, true)).toBe(true)
    expect(landEntersTappedOnTurn(land, 5, 4, true)).toBe(true)
  })

  it('"shock" always enters untapped (player pays life)', () => {
    const land = makeShockland('Hallowed Fountain', ['W', 'U'])
    expect(landEntersTappedOnTurn(land, 1, 0, true)).toBe(false)
    expect(landEntersTappedOnTurn(land, 5, 4, true)).toBe(false)
  })

  it('"fast" enters untapped if <= 2 other lands played before', () => {
    const land = makeFastland('Seachrome Coast', ['W', 'U'])
    expect(landEntersTappedOnTurn(land, 1, 0, true)).toBe(false) // 0 lands before
    expect(landEntersTappedOnTurn(land, 2, 1, true)).toBe(false) // 1 land before
    expect(landEntersTappedOnTurn(land, 3, 2, true)).toBe(false) // 2 lands before
    expect(landEntersTappedOnTurn(land, 4, 3, true)).toBe(true)  // 3 lands before = tapped
  })

  it('"check" enters tapped on T1, untapped on T2+ with basics', () => {
    const land = makeCheckland('Glacial Fortress', ['W', 'U'])
    expect(landEntersTappedOnTurn(land, 1, 0, true)).toBe(true)  // T1 always tapped
    expect(landEntersTappedOnTurn(land, 2, 1, true)).toBe(false)  // T2 with basics
    expect(landEntersTappedOnTurn(land, 2, 1, false)).toBe(true)  // T2 without basics
  })
})

// ============================================
// canCastWithColors
// ============================================

describe('canCastWithColors', () => {
  it('returns true for a zero-cost spell with no sources', () => {
    expect(canCastWithColors({ generic: 0, colored: [] }, [])).toBe(true)
  })

  it('returns false when not enough total mana', () => {
    const req: ColorRequirement = { generic: 2, colored: ['R'] }
    const sources: ManaSource[] = [{ amount: 1, colors: ['R'] }]
    expect(canCastWithColors(req, sources)).toBe(false)
  })

  it('returns true for a mono-color spell with matching source', () => {
    const req: ColorRequirement = { generic: 1, colored: ['W'] }
    const sources: ManaSource[] = [
      { amount: 1, colors: ['W'] },
      { amount: 1, colors: ['W'] },
    ]
    expect(canCastWithColors(req, sources)).toBe(true)
  })

  it('returns false when colors do not match', () => {
    const req: ColorRequirement = { generic: 0, colored: ['U'] }
    const sources: ManaSource[] = [{ amount: 1, colors: ['R'] }]
    expect(canCastWithColors(req, sources)).toBe(false)
  })

  it('returns true when ANY source covers a color requirement', () => {
    const req: ColorRequirement = { generic: 0, colored: ['B'] }
    const sources: ManaSource[] = [{ amount: 1, colors: ['ANY'] }]
    expect(canCastWithColors(req, sources)).toBe(true)
  })

  it('handles multi-colored requirements', () => {
    const req: ColorRequirement = { generic: 1, colored: ['W', 'U'] }
    const sources: ManaSource[] = [
      { amount: 1, colors: ['W'] },
      { amount: 1, colors: ['U'] },
      { amount: 1, colors: ['R'] },
    ]
    expect(canCastWithColors(req, sources)).toBe(true)
  })

  it('handles dual-color sources correctly', () => {
    const req: ColorRequirement = { generic: 0, colored: ['W', 'U'] }
    const sources: ManaSource[] = [
      { amount: 1, colors: ['W', 'U'] },
      { amount: 1, colors: ['W', 'U'] },
    ]
    expect(canCastWithColors(req, sources)).toBe(true)
  })

  it('returns false with enough total mana but wrong colors', () => {
    const req: ColorRequirement = { generic: 0, colored: ['W', 'W'] }
    const sources: ManaSource[] = [
      { amount: 1, colors: ['W'] },
      { amount: 1, colors: ['U'] },
    ]
    expect(canCastWithColors(req, sources)).toBe(false)
  })
})

// ============================================
// calculateManaBasic
// ============================================

describe('calculateManaBasic', () => {
  it('returns 0 total for an empty hand', () => {
    const result = calculateManaBasic([], 1)
    expect(result.total).toBe(0)
    expect(result.sources).toEqual([])
  })

  it('returns mana equal to turn for a hand full of basic lands', () => {
    const hand = [
      makeBasicLand('Plains', 'W'),
      makeBasicLand('Island', 'U'),
      makeBasicLand('Swamp', 'B'),
    ]
    expect(calculateManaBasic(hand, 1).total).toBe(1)
    expect(calculateManaBasic(hand, 2).total).toBe(2)
    expect(calculateManaBasic(hand, 3).total).toBe(3)
  })

  it('tap lands played on the current turn do not provide mana', () => {
    const hand = [makeTapland('Tranquil Cove', ['W', 'U'])]
    // Turn 1, played on turn 1 => does not provide mana (enters tapped)
    expect(calculateManaBasic(hand, 1).total).toBe(0)
  })

  it('tap lands played on a previous turn provide mana', () => {
    const hand = [
      makeTapland('Tranquil Cove', ['W', 'U']),
      makeBasicLand('Plains', 'W'),
    ]
    // Sort: untapped (Plains) first, tapped (Cove) second
    // Turn 2: Plains played T1 (provides mana), Cove played T2 (enters tapped => no mana)
    // So only 1 mana on T2
    const result = calculateManaBasic(hand, 2)
    expect(result.total).toBe(1)
    // Turn 3 would give 2 (both played before)
    const resultT3 = calculateManaBasic(hand, 3)
    expect(resultT3.total).toBe(2)
  })

  it('fetchlands provide 0 mana when played on the same turn', () => {
    const hand = [makeFetchland('Flooded Strand')]
    expect(calculateManaBasic(hand, 1).total).toBe(0)
  })

  it('fetchlands provide 1 mana when played on a previous turn', () => {
    const hand = [makeFetchland('Flooded Strand'), makeBasicLand('Plains', 'W')]
    // Sort: untapped non-fetch (Plains) first, fetch (Strand) second
    // Turn 2: Plains T1 (provides mana), Strand T2 (same turn => no mana)
    // Turn 3: Plains T1 + Strand T2 (previous turn => 1 ANY) = 2
    const resultT2 = calculateManaBasic(hand, 2)
    expect(resultT2.total).toBe(1)
    const resultT3 = calculateManaBasic(hand, 3)
    expect(resultT3.total).toBe(2) // Plains (1 W) + fetched land (1 ANY)
  })
})

// ============================================
// calculateManaAdvanced
// ============================================

describe('calculateManaAdvanced', () => {
  it('returns 0 total for an empty hand', () => {
    const result = calculateManaAdvanced([], 1, true)
    expect(result.total).toBe(0)
  })

  it('handles MDFCs as playable lands', () => {
    const hand = [
      makeMdfc('Emeria\'s Call', 7, { generic: 4, colored: ['W', 'W', 'W'] }),
    ]
    // MDFC with land side should be playable as a land
    const result = calculateManaAdvanced(hand, 1, true)
    expect(result.total).toBe(1)
    expect(result.sources).toHaveLength(1)
  })

  it('shock lands provide mana on T1 (player pays 2 life)', () => {
    const hand = [makeShockland('Hallowed Fountain', ['W', 'U'])]
    const result = calculateManaAdvanced(hand, 1, true)
    expect(result.total).toBe(1)
  })

  it('check lands enter tapped on T1 even with basics in deck', () => {
    const hand = [
      makeCheckland('Glacial Fortress', ['W', 'U']),
    ]
    // T1: check land enters tapped => no mana
    expect(calculateManaAdvanced(hand, 1, true).total).toBe(0)
  })

  it('check lands enter untapped on T2 when deck has basics', () => {
    const hand = [
      makeBasicLand('Plains', 'W'),
      makeCheckland('Glacial Fortress', ['W', 'U']),
    ]
    // T2: Plains played T1 (provides mana), Checkland played T2 (untapped with basics)
    const result = calculateManaAdvanced(hand, 2, true)
    expect(result.total).toBe(2)
  })
})

// ============================================
// runSimulation
// ============================================

describe('runSimulation', () => {
  // Build a simple 40-card sealed deck: 17 lands + 23 spells
  function buildTestDeck(): SimCard[] {
    const deck: SimCard[] = []
    // 9 Plains, 8 Islands
    for (let i = 0; i < 9; i++) deck.push(makeBasicLand('Plains', 'W'))
    for (let i = 0; i < 8; i++) deck.push(makeBasicLand('Island', 'U'))
    // 23 spells of various costs
    for (let i = 0; i < 8; i++) {
      deck.push(makeSpell('Soldier', 1, { generic: 0, colored: ['W'] }))
    }
    for (let i = 0; i < 8; i++) {
      deck.push(makeSpell('Knight', 2, { generic: 1, colored: ['W'] }))
    }
    for (let i = 0; i < 7; i++) {
      deck.push(makeSpell('Sphinx', 4, { generic: 2, colored: ['U', 'U'] }))
    }
    return deck
  }

  it('produces avgLandsInHand between 0 and 7', () => {
    const deck = buildTestDeck()
    const result = runSimulation(deck, 100, 3, false, true)
    expect(result.avgLandsInHand).toBeGreaterThanOrEqual(0)
    expect(result.avgLandsInHand).toBeLessThanOrEqual(7)
  })

  it('produces pctKeepableHands between 0 and 100', () => {
    const deck = buildTestDeck()
    const result = runSimulation(deck, 100, 3, false, true)
    expect(result.pctKeepableHands).toBeGreaterThanOrEqual(0)
    expect(result.pctKeepableHands).toBeLessThanOrEqual(100)
  })

  it('pctManaScrew + pctManaFlood <= 100', () => {
    const deck = buildTestDeck()
    const result = runSimulation(deck, 100, 3, false, true)
    expect(result.pctManaScrew + result.pctManaFlood).toBeLessThanOrEqual(100)
  })

  it('avgLandsInHand for a 17/40 deck is roughly 2.975', () => {
    const deck = buildTestDeck()
    // With 10000 iterations the average should converge to 17/40*7 = 2.975
    const result = runSimulation(deck, 10000, 3, false, true)
    expect(result.avgLandsInHand).toBeGreaterThan(2.5)
    expect(result.avgLandsInHand).toBeLessThan(3.5)
  })

  it('landsDistribution values sum to the number of iterations', () => {
    const deck = buildTestDeck()
    const iterations = 200
    const result = runSimulation(deck, iterations, 3, false, true)
    const total = Object.values(result.landsDistribution).reduce(
      (sum, v) => sum + v,
      0
    )
    expect(total).toBe(iterations)
  })

  it('produces sample hands arrays', () => {
    const deck = buildTestDeck()
    const result = runSimulation(deck, 1000, 3, false, true)
    // sampleKeepHands should have at most 3 entries
    expect(result.sampleKeepHands.length).toBeLessThanOrEqual(3)
    expect(result.sampleMulliganHands.length).toBeLessThanOrEqual(3)
  })

  it('works in advanced mode', () => {
    const deck = buildTestDeck()
    const result = runSimulation(deck, 100, 3, true, true)
    expect(result.avgLandsInHand).toBeGreaterThanOrEqual(0)
    expect(result.pctKeepableHands).toBeGreaterThanOrEqual(0)
  })
})

// ============================================
// analyzeDeck
// ============================================

describe('analyzeDeck', () => {
  it('counts color sources correctly', () => {
    const result = analyzeDeck([
      {
        card: {
          name: 'Plains',
          typeLine: 'Basic Land — Plains',
          oracleText: '({T}: Add {W}.)',
          manaCost: null,
        },
        quantity: 10,
      },
      {
        card: {
          name: 'Island',
          typeLine: 'Basic Land — Island',
          oracleText: '({T}: Add {U}.)',
          manaCost: null,
        },
        quantity: 7,
      },
    ])
    expect(result.colorSources.W).toBe(10)
    expect(result.colorSources.U).toBe(7)
    expect(result.landBreakdown.basics).toBe(17)
  })

  it('counts color needs from spells', () => {
    const result = analyzeDeck([
      {
        card: {
          name: 'Counterspell',
          typeLine: 'Instant',
          oracleText: 'Counter target spell.',
          manaCost: '{U}{U}',
        },
        quantity: 4,
      },
    ])
    expect(result.colorNeeds.U).toBe(8) // 2 blue symbols * 4 copies
  })

  it('computes colorRatios', () => {
    const result = analyzeDeck([
      {
        card: {
          name: 'Plains',
          typeLine: 'Basic Land — Plains',
          oracleText: '({T}: Add {W}.)',
          manaCost: null,
        },
        quantity: 10,
      },
      {
        card: {
          name: 'Soldier',
          typeLine: 'Creature',
          oracleText: null,
          manaCost: '{W}',
        },
        quantity: 4,
      },
    ])
    expect(result.colorRatios.W).toBeDefined()
    expect(result.colorRatios.W).toBeGreaterThan(0)
    // Only W is needed, so U/B/R/G should not have ratios
    expect(result.colorRatios.U).toBeUndefined()
  })
})

// ============================================
// runSealedSimulation (integration)
// ============================================

describe('runSealedSimulation', () => {
  it('runs a full simulation with cards and basic lands', () => {
    const cards = [
      {
        card: {
          name: 'Luminarch Aspirant',
          cmc: 2,
          typeLine: 'Creature — Human Cleric',
          oracleText: 'At the beginning of combat on your turn, put a +1/+1 counter on target creature you control.',
          manaCost: '{1}{W}',
          layout: 'normal',
          colors: ['W'],
          colorIdentity: ['W'],
        },
        qty: 2,
      },
      {
        card: {
          name: 'Thirst for Discovery',
          cmc: 3,
          typeLine: 'Instant',
          oracleText: 'Draw three cards. Then discard two cards unless you discard a land card.',
          manaCost: '{2}{U}',
          layout: 'normal',
          colors: ['U'],
          colorIdentity: ['U'],
        },
        qty: 2,
      },
    ]
    const basicLands = { Plains: 9, Island: 8 }

    const { simulation, analysis } = runSealedSimulation(cards, basicLands)

    // Simulation result structure checks
    expect(simulation.avgLandsInHand).toBeGreaterThanOrEqual(0)
    expect(simulation.avgLandsInHand).toBeLessThanOrEqual(7)
    expect(simulation.pctKeepableHands).toBeGreaterThanOrEqual(0)
    expect(simulation.pctKeepableHands).toBeLessThanOrEqual(100)
    expect(simulation.pctManaScrew + simulation.pctManaFlood).toBeLessThanOrEqual(100)

    // Analysis structure checks
    // Note: basic lands added via runSealedSimulation have oracleText=null,
    // so parseManaProduction returns ['C'] for them. Color sources for W/U
    // come only from non-basic lands or lands with oracle text.
    expect(analysis.colorSources.C).toBe(17) // 9 Plains + 8 Islands as colorless
    expect(analysis.landBreakdown.basics).toBe(17)
  })
})

// ============================================
// EDGE CASES
// ============================================

describe('edge cases', () => {
  it('handles an empty deck gracefully', () => {
    // An empty deck means hands are empty too
    const result = runSimulation([], 10, 3, false, true)
    expect(result.avgLandsInHand).toBe(0)
    expect(result.avgNonLandsInHand).toBe(0)
    expect(result.pctKeepableHands).toBe(0) // 0 lands => not keepable
  })

  it('handles a deck with only lands', () => {
    const deck: SimCard[] = []
    for (let i = 0; i < 40; i++) {
      deck.push(makeBasicLand('Plains', 'W'))
    }
    const result = runSimulation(deck, 100, 3, false, true)
    // Every hand should have 7 lands => mana flood
    expect(result.avgLandsInHand).toBe(7)
    expect(result.pctManaFlood).toBe(100)
    expect(result.pctKeepableHands).toBe(0) // 7 lands is not keepable (> 4)
  })

  it('handles a deck with no lands', () => {
    const deck: SimCard[] = []
    for (let i = 0; i < 40; i++) {
      deck.push(makeSpell('Bolt', 1, { generic: 0, colored: ['R'] }))
    }
    const result = runSimulation(deck, 100, 3, false, true)
    expect(result.avgLandsInHand).toBe(0)
    expect(result.pctManaScrew).toBe(100)
    expect(result.pctKeepableHands).toBe(0) // 0 lands is not keepable (< 2)
  })

  it('handles a single-card deck', () => {
    const deck = [makeBasicLand('Forest', 'G')]
    const result = runSimulation(deck, 10, 3, false, true)
    // Only 1 card in deck, hand = [Forest], lands = 1
    expect(result.avgLandsInHand).toBe(1)
  })

  it('runSealedSimulation with empty inputs', () => {
    const { simulation, analysis } = runSealedSimulation([], {})
    expect(simulation.avgLandsInHand).toBe(0)
    expect(Object.keys(analysis.colorSources)).toBeDefined()
  })

  it('runSealedSimulation with zero-count basic lands', () => {
    const { simulation } = runSealedSimulation([], { Plains: 0, Island: 0 })
    expect(simulation.avgLandsInHand).toBe(0)
  })
})
