import type { DeckCardForCentroid } from './centroid'
import { isBasicLand } from './centroid'
import { CARD_ROLES } from '../types'

/**
 * Distributions structurelles d'un deck.
 * Tout est calcule client-side a partir des rows DeckCard / Card deja chargees.
 */

export interface RoleDistribution {
  // Counts par primary_role (toutes les valeurs CARD_ROLES + "unclassified").
  counts: Record<string, number>
  // Total pris en compte (= sum des quantities, terrains de base inclus ou non
  // selon `excludeBasics`).
  total: number
}

export interface CurveDistribution {
  // Cles: "0", "1", "2", "3", "4", "5", "6", "7+"
  buckets: Record<string, number>
  averageCmc: number
  total: number
}

export function computeRoleDistribution(
  cards: DeckCardForCentroid[],
  options: { excludeBasics?: boolean } = { excludeBasics: false }
): RoleDistribution {
  const counts: Record<string, number> = {}
  for (const r of CARD_ROLES) counts[r] = 0
  counts.unclassified = 0
  let total = 0
  for (const c of cards) {
    if (options.excludeBasics && isBasicLand(c.typeLine)) continue
    const role = c.primaryRole ?? 'unclassified'
    counts[role] = (counts[role] ?? 0) + c.quantity
    total += c.quantity
  }
  return { counts, total }
}

export function computeCurveDistribution(
  cards: DeckCardForCentroid[],
  options: { excludeLands?: boolean } = { excludeLands: true }
): CurveDistribution {
  const buckets: Record<string, number> = {
    '0': 0,
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
    '6': 0,
    '7+': 0,
  }
  let total = 0
  let cmcSum = 0
  for (const c of cards) {
    // On exclut les terrains (CMC=0 mais non significatif pour la courbe).
    if (options.excludeLands && /\bLand\b/i.test(c.typeLine)) continue
    const cmc = Math.floor(Number(c.cmc) || 0)
    const key = cmc >= 7 ? '7+' : String(cmc)
    buckets[key] = (buckets[key] ?? 0) + c.quantity
    total += c.quantity
    cmcSum += cmc * c.quantity
  }
  const averageCmc = total > 0 ? cmcSum / total : 0
  return { buckets, averageCmc, total }
}
