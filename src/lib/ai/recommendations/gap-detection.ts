import type { CardRole } from '../types'
import { CARD_ROLES } from '../types'
import { getArchetypeProfile, type RoleTarget } from './archetype-profiles'
import type { RoleDistribution } from '../deck-analysis/distributions'

export interface RoleGap {
  role: CardRole
  current: number
  target: RoleTarget
  needed: number // ideal - current (clamp >= 0)
  severity: 'critical' | 'low' | 'optimal' | 'overflow'
}

/**
 * Calcule les gaps de roles entre la distribution actuelle et le profil cible.
 * Retourne TOUS les roles definis dans le profil, classes du plus critique
 * au plus optimal.
 */
export function detectRoleGaps(args: {
  format: 'commander' | 'vintage'
  archetype: string | null
  roleDistribution: RoleDistribution
}): RoleGap[] {
  const profile = getArchetypeProfile({
    format: args.format,
    archetype: args.archetype,
  })
  const out: RoleGap[] = []
  for (const role of CARD_ROLES) {
    const target = profile[role]
    if (!target) continue
    const current = args.roleDistribution.counts[role] ?? 0
    let severity: RoleGap['severity']
    if (current < target.min) severity = 'critical'
    else if (current < target.ideal) severity = 'low'
    else if (current <= target.max) severity = 'optimal'
    else severity = 'overflow'
    const needed = Math.max(0, target.ideal - current)
    out.push({ role, current, target, needed, severity })
  }
  // Tri: critical > low > optimal > overflow, puis par needed desc
  const order = { critical: 0, low: 1, optimal: 2, overflow: 3 }
  out.sort((a, b) => {
    const d = order[a.severity] - order[b.severity]
    if (d !== 0) return d
    return b.needed - a.needed
  })
  return out
}
