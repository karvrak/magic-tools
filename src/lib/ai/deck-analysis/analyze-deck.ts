import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  computeCentroid,
  loadDeckCardsForAnalysis,
  type DeckCardForCentroid,
} from './centroid'
import {
  computeCurveDistribution,
  computeRoleDistribution,
  type CurveDistribution,
  type RoleDistribution,
} from './distributions'
import { detectArchetype, type ArchetypeDetectionResult } from './archetype'
import { toVectorLiteral } from '../embeddings/embed-cards'

export interface DeckAnalysis {
  deckId: string
  cardsLoaded: number
  cardsWithEmbedding: number
  centroid: number[] | null
  archetype: ArchetypeDetectionResult
  roles: RoleDistribution
  curve: CurveDistribution
  cards: DeckCardForCentroid[]
}

/**
 * Calcule l'analyse complete d'un deck (centroide + archetype + distributions).
 * Retourne null seulement si le deck n'existe pas.
 */
export async function computeDeckAnalysis(
  deckId: string
): Promise<DeckAnalysis | null> {
  const exists = await prisma.deck.findUnique({
    where: { id: deckId },
    select: { id: true },
  })
  if (!exists) return null

  const cards = await loadDeckCardsForAnalysis(deckId)
  const cardsWithEmbedding = cards.filter((c) => c.embedding !== null).length
  const centroidResult = computeCentroid(cards, { excludeBasics: true })
  const archetype = detectArchetype(cards)
  const roles = computeRoleDistribution(cards, { excludeBasics: false })
  const curve = computeCurveDistribution(cards, { excludeLands: true })

  return {
    deckId,
    cardsLoaded: cards.length,
    cardsWithEmbedding,
    centroid: centroidResult?.centroid ?? null,
    archetype,
    roles,
    curve,
    cards,
  }
}

/**
 * Persiste l'analyse dans les colonnes du Deck.
 */
export async function persistDeckAnalysis(
  analysis: DeckAnalysis
): Promise<void> {
  // Update non-vector fields via Prisma client.
  await prisma.deck.update({
    where: { id: analysis.deckId },
    data: {
      detectedArchetype: analysis.archetype.detected,
      archetypeConfidence: analysis.archetype.confidence,
      roleDistribution: analysis.roles as unknown as Prisma.InputJsonValue,
      curveDistribution: analysis.curve as unknown as Prisma.InputJsonValue,
      analyzedAt: new Date(),
    },
  })
  // Update centroid via raw SQL (vector type).
  if (analysis.centroid) {
    const literal = toVectorLiteral(analysis.centroid)
    await prisma.$executeRaw`
      UPDATE "Deck"
      SET "centroid" = ${literal}::vector(1536)
      WHERE "id" = ${analysis.deckId}
    `
  } else {
    await prisma.$executeRaw`
      UPDATE "Deck"
      SET "centroid" = NULL
      WHERE "id" = ${analysis.deckId}
    `
  }
}

/**
 * Calcule l'analyse + persiste les champs caches sur le Deck.
 * Le centroide reste en BDD (via raw SQL); les cartes sont retournees
 * pour les consommateurs qui en ont besoin (recommandations).
 *
 * On ne court-circuite PAS sur analyzedAt: l'analyse est suffisamment rapide
 * (~10-30 ms pour 99 cartes) pour qu'une logique de cache ajoute plus de
 * fragilite que de gain. La cle de cache effective est dans le centroide
 * persiste, qui est consulte par les endpoints de recommandations.
 */
export async function getOrComputeDeckAnalysis(
  deckId: string
): Promise<DeckAnalysis | null> {
  const fresh = await computeDeckAnalysis(deckId)
  if (!fresh) return null
  await persistDeckAnalysis(fresh)
  return fresh
}

/**
 * Marque un deck comme "a re-analyser" sans recalculer immediatement.
 * Appele par les hooks applicatifs apres mutation des DeckCard.
 *
 * Implementation: on bump updatedAt > analyzedAt en effacant analyzedAt.
 * Le prochain appel a getOrComputeDeckAnalysis fera le travail.
 */
export async function invalidateDeckAnalysis(deckId: string): Promise<void> {
  await prisma.deck.update({
    where: { id: deckId },
    data: { analyzedAt: null },
  })
}
