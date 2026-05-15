import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  COMMANDER_CENTROID_WEIGHT,
  EMBEDDING_DIMENSIONS,
} from '../config'

/**
 * Calcul du centroide d'un deck.
 * - Recupere les embeddings de chaque carte avec leur quantity, category, primary_role.
 * - Pondere: quantity (toujours) x COMMANDER_CENTROID_WEIGHT si category=commander.
 * - Exclut les terrains de base (vides de signal strategique).
 *
 * Note: on parse les vecteurs cote application (Prisma client ne supporte pas
 * le type vector). Memoire OK: 99 cartes x 1536 floats x 8 bytes = ~1.2MB.
 */

export interface DeckCardForCentroid {
  cardId: string
  oracleId: string
  name: string
  typeLine: string
  oracleText: string | null
  cmc: number
  primaryRole: string | null
  archetypeTags: string[]
  category: string
  quantity: number
  embedding: number[] | null
}

/**
 * Parse un litteral pgvector textuel "[0.1,0.2,...]" en number[].
 */
export function parseVectorLiteral(text: string | null): number[] | null {
  if (!text) return null
  const trimmed = text.replace(/^\[|\]$/g, '').trim()
  if (!trimmed) return null
  const arr = trimmed.split(',').map((x) => Number(x.trim()))
  if (arr.length !== EMBEDDING_DIMENSIONS) return null
  if (arr.some((n) => Number.isNaN(n))) return null
  return arr
}

/**
 * Charge les cartes d'un deck avec leur embedding (parseable).
 * On JOINe via oracleId pour que toutes les rows aient le meme vecteur.
 */
export async function loadDeckCardsForAnalysis(
  deckId: string
): Promise<DeckCardForCentroid[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      cardId: string
      oracleId: string
      name: string
      typeLine: string
      oracleText: string | null
      cmc: number
      primaryRole: string | null
      archetypeTags: string[]
      category: string
      quantity: number
      embeddingText: string | null
    }>
  >(Prisma.sql`
    SELECT
      dc."cardId" AS "cardId",
      c."oracleId" AS "oracleId",
      c."name" AS "name",
      c."typeLine" AS "typeLine",
      c."oracleText" AS "oracleText",
      c."cmc" AS "cmc",
      c."primaryRole" AS "primaryRole",
      c."archetypeTags" AS "archetypeTags",
      dc."category" AS "category",
      dc."quantity" AS "quantity",
      c."embedding"::text AS "embeddingText"
    FROM "DeckCard" dc
    JOIN "Card" c ON c."id" = dc."cardId"
    WHERE dc."deckId" = ${deckId}
  `)
  return rows.map((r) => ({
    cardId: r.cardId,
    oracleId: r.oracleId,
    name: r.name,
    typeLine: r.typeLine,
    oracleText: r.oracleText,
    cmc: Number(r.cmc),
    primaryRole: r.primaryRole,
    archetypeTags: r.archetypeTags ?? [],
    category: r.category,
    quantity: Number(r.quantity),
    embedding: parseVectorLiteral(r.embeddingText),
  }))
}

/**
 * Detecte si une carte est un terrain de base (Plains/Island/Swamp/Mountain/Forest/Wastes
 * mais SANS d'autres types speciaux comme Snow, dual, etc.).
 */
export function isBasicLand(typeLine: string): boolean {
  // "Basic Land — Plains" ou "Basic Snow Land — ..."
  return /\bBasic\b/i.test(typeLine) && /\bLand\b/i.test(typeLine)
}

/**
 * Calcule le centroide pondere d'un deck a partir de ses cartes.
 * Retourne null si aucune carte avec embedding utilisable.
 */
export function computeCentroid(
  cards: DeckCardForCentroid[],
  options: { excludeBasics?: boolean } = { excludeBasics: true }
): { centroid: number[]; usedCards: number; totalWeight: number } | null {
  const acc = new Array<number>(EMBEDDING_DIMENSIONS).fill(0)
  let totalWeight = 0
  let used = 0
  for (const c of cards) {
    if (!c.embedding) continue
    if (options.excludeBasics && isBasicLand(c.typeLine)) continue
    const baseWeight = c.quantity
    const isCommander = c.category === 'commander'
    const weight = baseWeight * (isCommander ? COMMANDER_CENTROID_WEIGHT : 1)
    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      acc[i] += c.embedding[i] * weight
    }
    totalWeight += weight
    used++
  }
  if (totalWeight === 0) return null
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) acc[i] /= totalWeight
  return { centroid: acc, usedCards: used, totalWeight }
}
