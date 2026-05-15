import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { SYNERGY_ALPHA } from '../config'
import { toVectorLiteral } from '../embeddings/embed-cards'
import type { DeckCardForCentroid } from '../deck-analysis/centroid'
import { buildDeterministicWhere, type DeterministicFilterContext } from './filters'

/**
 * Vector search hybride.
 *
 * Score = alpha * sim_centroid + (1 - alpha) * sim_max_to_deck
 *
 * - sim_centroid:    cosine similarity entre la carte candidate et le centroide
 *                    du deck (capture la coherence globale).
 * - sim_max_to_deck: max(cosine(carte, c)) for c in deck — capture "ressemble
 *                    a au moins une carte du deck", utile pour les decks
 *                    multi-thematiques.
 *
 * Le filtrage deterministe est applique en SQL avant la similarite.
 *
 * Pgvector: l'operateur <=> retourne la "cosine distance" (1 - cos sim).
 * Donc cosine_sim = 1 - (a <=> b).
 */

export interface SynergyCandidate {
  cardId: string
  oracleId: string
  name: string
  manaCost: string | null
  typeLine: string
  oracleText: string | null
  primaryRole: string | null
  secondaryRoles: string[]
  archetypeTags: string[]
  cmc: number
  imageNormal: string | null
  priceEur: number | null
  similarityCentroid: number
  similarityMaxToDeck: number
  similarityHybrid: number
}

export interface SynergyQueryArgs {
  centroid: number[] | null
  /** Vecteurs des cartes du deck (deja excluant les terrains de base). */
  deckVectors: number[][]
  filter: DeterministicFilterContext
  /** Filtre supplementaire: primary_role IN (...). */
  primaryRoles?: string[]
  /** Filtre optionnel: oracleText ILIKE pattern (ex: '%cycling%'). */
  oracleTextLike?: string
  /** Filtre optionnel: la carte doit avoir au moins UN des tags listes. */
  archetypeTagsAny?: string[]
  /**
   * Override l'alpha du score hybride. Default = SYNERGY_ALPHA (0.6).
   * Mettre a 1.0 pour scoring pur centroid (utile sur les pools FTS ou la
   * pertinence est deja acquise par le filtre texte — on veut juste ranker
   * par alignement global avec le deck, sans biaiser vers les "copies" via
   * max-similarite-a-une-carte).
   */
  alphaOverride?: number
  limit: number
}

/**
 * Recherche par similarite hybride avec pgvector.
 *
 * On construit un littoral pgvector pour le centroide, puis pour la "max to deck"
 * on utilise un trick: on push une CTE avec les vecteurs du deck et on prend le
 * MAX(1 - (c.embedding <=> d.embedding)) sur les jointures.
 *
 * Pour rester performant on limite la CTE deck a 99 entrees max (un deck EDH).
 */
export async function querySynergies(
  args: SynergyQueryArgs
): Promise<SynergyCandidate[]> {
  if (!args.centroid && args.deckVectors.length === 0) return []

  const where = buildDeterministicWhere(args.filter)
  const roleClause =
    args.primaryRoles && args.primaryRoles.length > 0
      ? Prisma.sql`AND c."primaryRole" IN (${Prisma.join(args.primaryRoles)})`
      : Prisma.empty
  const oracleTextClause =
    args.oracleTextLike && args.oracleTextLike.length > 0
      ? Prisma.sql`AND c."oracleText" ILIKE ${args.oracleTextLike}`
      : Prisma.empty
  const archetypeTagsClause =
    args.archetypeTagsAny && args.archetypeTagsAny.length > 0
      ? Prisma.sql`AND c."archetypeTags" && ${args.archetypeTagsAny}::text[]`
      : Prisma.empty

  // Le centroide. Si null (deck sans embedding), on tombe sur deckVectors uniquement.
  const centroidLiteral = args.centroid
    ? toVectorLiteral(args.centroid)
    : null

  // CTE deck_vecs: contient les vecteurs du deck.
  // On les passe en VALUES via litteraux pgvector.
  const deckVecLiterals = args.deckVectors
    .slice(0, 100)
    .map((v) => toVectorLiteral(v))

  // Nombre fixe de candidats a recuperer en premiere passe (top par centroide
  // si dispo, sinon par max-to-deck). On prend un peu plus que `limit` pour
  // permettre au scoring hybride de re-trier.
  const prefetch = Math.max(args.limit * 3, 90)

  // Construit la CTE deck_vecs.
  const deckVecsCte = deckVecLiterals.length
    ? Prisma.sql`
        WITH deck_vecs AS (
          SELECT v::vector(1536) AS embedding
          FROM unnest(ARRAY[${Prisma.join(
            deckVecLiterals.map((l) => Prisma.sql`${l}`),
            ','
          )}]::text[]) AS v
        )`
    : Prisma.sql`
        WITH deck_vecs AS (
          SELECT NULL::vector(1536) AS embedding WHERE false
        )`

  // Strategie en deux temps pour rester compatible avec DISTINCT ON
  // (qui requiert que ORDER BY commence par l'expression de DISTINCT ON):
  //   1) oracle_reps: DISTINCT ON (oracleId) ORDER BY oracleId, releasedAt
  //      pour obtenir la printing canonique de chaque oracle. Tous les
  //      printings d'un meme oracleId partagent le meme embedding, donc le
  //      choix de la printing n'affecte pas la similarite.
  //   2) candidates: ORDER BY similarite au centroide LIMIT prefetch.

  const orderByCentroid = centroidLiteral
    ? Prisma.sql`ORDER BY rep."embedding" <=> ${centroidLiteral}::vector(1536) ASC`
    : Prisma.sql`ORDER BY rep."oracleId" ASC`

  const rows = await prisma.$queryRaw<
    Array<{
      cardId: string
      oracleId: string
      name: string
      manaCost: string | null
      typeLine: string
      oracleText: string | null
      primaryRole: string | null
      secondaryRoles: string[]
      archetypeTags: string[]
      cmc: number | null
      imageNormal: string | null
      priceEur: number | null
      simCentroid: number
      simMaxToDeck: number
    }>
  >(Prisma.sql`
    ${deckVecsCte}
    , oracle_reps AS (
      SELECT DISTINCT ON (c."oracleId")
        c."id" AS "cardId",
        c."oracleId" AS "oracleId",
        c."name" AS "name",
        c."manaCost" AS "manaCost",
        c."typeLine" AS "typeLine",
        c."oracleText" AS "oracleText",
        c."primaryRole" AS "primaryRole",
        c."secondaryRoles" AS "secondaryRoles",
        c."archetypeTags" AS "archetypeTags",
        c."cmc" AS "cmc",
        c."imageNormal" AS "imageNormal",
        c."priceEur" AS "priceEur",
        c."embedding" AS "embedding"
      FROM "Card" c
      WHERE ${where}
        ${roleClause}
        ${oracleTextClause}
        ${archetypeTagsClause}
      ORDER BY c."oracleId", c."releasedAt" ASC NULLS LAST, c."id" ASC
    )
    , candidates AS (
      SELECT rep.*
      FROM oracle_reps rep
      ${orderByCentroid}
      LIMIT ${prefetch}
    )
    SELECT
      cand."cardId",
      cand."oracleId",
      cand."name",
      cand."manaCost",
      cand."typeLine",
      cand."oracleText",
      cand."primaryRole",
      cand."secondaryRoles",
      cand."archetypeTags",
      cand."cmc",
      cand."imageNormal",
      cand."priceEur",
      ${
        centroidLiteral
          ? Prisma.sql`(1 - (cand."embedding" <=> ${centroidLiteral}::vector(1536)))::float8`
          : Prisma.sql`0::float8`
      } AS "simCentroid",
      COALESCE(
        (SELECT MAX(1 - (cand."embedding" <=> dv."embedding"))::float8
         FROM deck_vecs dv WHERE dv."embedding" IS NOT NULL),
        0
      ) AS "simMaxToDeck"
    FROM candidates cand
  `)

  // Score hybride client-side
  const alpha = args.alphaOverride ?? SYNERGY_ALPHA
  const scored: SynergyCandidate[] = rows.map((r) => {
    const simC = Number(r.simCentroid) || 0
    const simM = Number(r.simMaxToDeck) || 0
    const hybrid = alpha * simC + (1 - alpha) * simM
    return {
      cardId: r.cardId,
      oracleId: r.oracleId,
      name: r.name,
      manaCost: r.manaCost,
      typeLine: r.typeLine,
      oracleText: r.oracleText,
      primaryRole: r.primaryRole,
      secondaryRoles: r.secondaryRoles ?? [],
      archetypeTags: r.archetypeTags ?? [],
      cmc: Number(r.cmc) || 0,
      imageNormal: r.imageNormal,
      priceEur: r.priceEur != null ? Number(r.priceEur) : null,
      similarityCentroid: simC,
      similarityMaxToDeck: simM,
      similarityHybrid: hybrid,
    }
  })

  scored.sort((a, b) => b.similarityHybrid - a.similarityHybrid)
  return scored.slice(0, args.limit)
}

/**
 * Helper: extrait les vecteurs d'un set de DeckCard (pour la CTE deck_vecs).
 * Filtre les terrains de base (pas de signal strategique).
 */
export function extractDeckVectors(cards: DeckCardForCentroid[]): number[][] {
  const out: number[][] = []
  for (const c of cards) {
    if (!c.embedding) continue
    if (/\bBasic\b/i.test(c.typeLine)) continue
    out.push(c.embedding)
  }
  return out
}
