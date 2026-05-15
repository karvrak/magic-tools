// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { detectRoleGaps } from '@/lib/ai/recommendations/gap-detection'
import { CARD_ROLES } from '@/lib/ai/types'

function mkRoleDist(counts: Record<string, number>) {
  const full: Record<string, number> = {}
  for (const r of CARD_ROLES) full[r] = counts[r] ?? 0
  full.unclassified = counts.unclassified ?? 0
  return {
    counts: full,
    total: Object.values(full).reduce((a, b) => a + b, 0),
  }
}

describe('detectRoleGaps', () => {
  it('flags critical gaps when below profile.min', () => {
    const gaps = detectRoleGaps({
      format: 'commander',
      archetype: null,
      roleDistribution: mkRoleDist({ ramp: 3, draw: 12, removal: 8 }),
    })
    const ramp = gaps.find((g) => g.role === 'ramp')!
    expect(ramp.severity).toBe('critical')
    expect(ramp.needed).toBeGreaterThan(0)
  })

  it('flags optimal when within ideal..max range', () => {
    const gaps = detectRoleGaps({
      format: 'commander',
      archetype: null,
      roleDistribution: mkRoleDist({ ramp: 10, draw: 10 }),
    })
    expect(gaps.find((g) => g.role === 'ramp')!.severity).toBe('optimal')
    expect(gaps.find((g) => g.role === 'draw')!.severity).toBe('optimal')
  })

  it('flags overflow when above max', () => {
    const gaps = detectRoleGaps({
      format: 'commander',
      archetype: null,
      roleDistribution: mkRoleDist({ ramp: 25 }),
    })
    expect(gaps.find((g) => g.role === 'ramp')!.severity).toBe('overflow')
  })

  it('uses storm profile when archetype=storm (commander)', () => {
    // Storm wants 14-22 draw. With only 8 draw it should be critical/low.
    const gaps = detectRoleGaps({
      format: 'commander',
      archetype: 'storm',
      roleDistribution: mkRoleDist({ draw: 8, ramp: 12, tutor: 8 }),
    })
    const draw = gaps.find((g) => g.role === 'draw')!
    expect(['critical', 'low']).toContain(draw.severity)
  })

  it('uses stax profile when archetype=stax (commander) — fewer ramp expected', () => {
    // Stax: ramp { min: 5, ideal: 7, max: 10 }. With 6 → low (not critical).
    const gaps = detectRoleGaps({
      format: 'commander',
      archetype: 'stax',
      roleDistribution: mkRoleDist({ ramp: 6, draw: 8, removal: 6, lock_piece: 10 }),
    })
    const ramp = gaps.find((g) => g.role === 'ramp')!
    expect(ramp.severity).toBe('low')
  })

  it('uses vintage shops profile when archetype=shops', () => {
    // Shops: lock_piece { min: 6, ideal: 10, max: 14 }
    const gaps = detectRoleGaps({
      format: 'vintage',
      archetype: 'shops',
      roleDistribution: mkRoleDist({ ramp: 10, lock_piece: 4, threat: 12 }),
    })
    const lock = gaps.find((g) => g.role === 'lock_piece')!
    expect(lock.severity).toBe('critical')
  })

  it('orders critical first', () => {
    const gaps = detectRoleGaps({
      format: 'commander',
      archetype: null,
      roleDistribution: mkRoleDist({ ramp: 0, draw: 0, removal: 8 }),
    })
    expect(gaps[0].severity).toBe('critical')
  })
})
