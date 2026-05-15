import type { DeckCardForCentroid } from './centroid'
import { isBasicLand } from './centroid'
import { COMMANDER_CENTROID_WEIGHT } from '../config'
import { KNOWN_ARCHETYPES } from '../types'

/**
 * Detection d'archetype par vote pondere sur les archetype_tags des cartes.
 *
 * Ponderation:
 *   - quantity (Vintage = relevant car restricted=1)
 *   - x COMMANDER_CENTROID_WEIGHT pour le commandant (signal majeur)
 *
 * On ne retient comme `detectedArchetype` qu'un tag de la liste KNOWN_ARCHETYPES
 * (les tags libres comme "tribal_dragons" peuvent etre voted mais ne sont pas
 * promus en archetype global). Confidence = top_score / total_votes.
 */

const KNOWN_SET = new Set(KNOWN_ARCHETYPES as readonly string[])

export interface ArchetypeDetectionResult {
  detected: string | null
  confidence: number // [0, 1]
  topTags: Array<{ tag: string; weight: number }>
  totalWeight: number
}

export function detectArchetype(
  cards: DeckCardForCentroid[]
): ArchetypeDetectionResult {
  const votes = new Map<string, number>()
  let totalWeight = 0
  for (const c of cards) {
    if (isBasicLand(c.typeLine)) continue
    if (!c.archetypeTags || c.archetypeTags.length === 0) continue
    const baseWeight = c.quantity
    const isCommander = c.category === 'commander'
    const weight = baseWeight * (isCommander ? COMMANDER_CENTROID_WEIGHT : 1)
    for (const tag of c.archetypeTags) {
      votes.set(tag, (votes.get(tag) ?? 0) + weight)
    }
    totalWeight += weight
  }
  const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1])
  const topTags = sorted.slice(0, 6).map(([tag, weight]) => ({ tag, weight }))
  // Choix de l'archetype: premier tag connu dans le top.
  const knownPick = sorted.find(([tag]) => KNOWN_SET.has(tag))
  if (!knownPick || totalWeight === 0) {
    return { detected: null, confidence: 0, topTags, totalWeight }
  }
  const [tag, weight] = knownPick
  return {
    detected: tag,
    confidence: weight / totalWeight,
    topTags,
    totalWeight,
  }
}
