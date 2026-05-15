import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getOpenAI } from '../clients'
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
} from '../config'
import { buildCanonicalText, hashCanonicalText } from './canonical-text'

/**
 * ETL des embeddings.
 *
 * Strategie:
 * 1. Selection des cartes qui ont besoin d'un (re)embedding:
 *    - embedding NULL, OU
 *    - embeddingModel != EMBEDDING_MODEL, OU
 *    - embeddingVersion != EMBEDDING_VERSION, OU
 *    - embeddingTextHash != hash(canonicalText) (errata)
 * 2. Deduplication par hash texte canonique au sein du batch
 *    (les multiples printings d'une meme oracleId partagent le meme texte).
 * 3. Appel OpenAI Embeddings API par chunks de jusqu'a EMBEDDING_API_MAX_INPUTS.
 * 4. UPDATE en raw SQL (le type vector n'est pas supporte par le client Prisma)
 *    en touchant TOUTES les rows partageant le meme hash en une seule passe.
 * 5. Idempotent + resumable: une interruption ne perd pas le travail deja
 *    persiste, le run suivant reprendra ou il s'est arrete.
 */

export interface EmbedRunOptions {
  /** Limite le nombre de cartes a traiter (utile en dev / tests) */
  limit?: number
  /** Si true, ne touche pas la BDD: simule + log */
  dryRun?: boolean
  /** Callback de progression (rows traitees, total estime) */
  onProgress?: (done: number, total: number) => void
}

export interface EmbedRunResult {
  selected: number
  apiCalls: number
  uniqueTexts: number
  rowsUpdated: number
  skipped: number
  errors: number
}

interface CardForEmbedding {
  id: string
  oracleId: string
  name: string
  typeLine: string
  oracleText: string | null
  manaCost: string | null
  keywords: string[]
}

/**
 * Selectionne les cartes qui ont besoin d'un (re)embedding.
 * On exclut les cartes avec lang != 'en' uniquement si la version anglaise
 * existe deja: en pratique toutes les cartes ont un oracleText anglais.
 *
 * On dedoublonne au niveau applicatif par oracleId pour eviter de payer
 * plusieurs fois le meme texte.
 */
export async function selectCardsToEmbed(opts: { limit?: number } = {}): Promise<
  CardForEmbedding[]
> {
  // On selectionne UNE row representative par oracleId. Le UPDATE final
  // applique le vecteur a toutes les rows du meme oracleId via le hash texte.
  // SQL: DISTINCT ON (oracleId).
  const limitClause = opts.limit
    ? Prisma.sql`LIMIT ${opts.limit}`
    : Prisma.empty
  const rows = await prisma.$queryRaw<CardForEmbedding[]>(Prisma.sql`
    SELECT DISTINCT ON ("oracleId")
      "id",
      "oracleId",
      "name",
      "typeLine",
      "oracleText",
      "manaCost",
      "keywords"
    FROM "Card"
    WHERE
      "embedding" IS NULL
      OR "embeddingModel" IS DISTINCT FROM ${EMBEDDING_MODEL}
      OR "embeddingVersion" IS DISTINCT FROM ${EMBEDDING_VERSION}
    ORDER BY "oracleId", "releasedAt" ASC NULLS LAST
    ${limitClause}
  `)
  return rows
}

/**
 * Convertit un vecteur JS en litteral pgvector textuel.
 */
export function toVectorLiteral(vec: number[]): string {
  if (vec.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Vector dimension mismatch: got ${vec.length}, expected ${EMBEDDING_DIMENSIONS}`
    )
  }
  return `[${vec.join(',')}]`
}

/**
 * UPDATE atomique: pousse un vecteur sur toutes les rows ayant le meme hash texte.
 * Cela couvre toutes les printings d'une meme oracleId (meme oracleText/keywords).
 */
async function persistEmbeddingByHash(args: {
  hash: string
  vector: number[]
}): Promise<number> {
  const literal = toVectorLiteral(args.vector)
  // $executeRaw avec interpolation typee: on passe le vecteur en string castee a vector.
  const result = await prisma.$executeRaw`
    UPDATE "Card"
    SET
      "embedding" = ${literal}::vector(1536),
      "embeddingModel" = ${EMBEDDING_MODEL},
      "embeddingVersion" = ${EMBEDDING_VERSION},
      "embeddingTextHash" = ${args.hash},
      "embeddedAt" = NOW()
    WHERE "embeddingTextHash" = ${args.hash}
       OR "embedding" IS NULL
       OR "embeddingModel" IS DISTINCT FROM ${EMBEDDING_MODEL}
       OR "embeddingVersion" IS DISTINCT FROM ${EMBEDDING_VERSION}
  `
  return Number(result)
}

/**
 * Pousse les vecteurs sur les rows correspondantes en se basant sur l'oracleId
 * de la carte source du batch (plus precis que par hash quand plusieurs textes
 * coexistent dans le meme run).
 */
async function persistEmbeddingByOracleId(args: {
  oracleId: string
  hash: string
  vector: number[]
}): Promise<number> {
  const literal = toVectorLiteral(args.vector)
  const result = await prisma.$executeRaw`
    UPDATE "Card"
    SET
      "embedding" = ${literal}::vector(1536),
      "embeddingModel" = ${EMBEDDING_MODEL},
      "embeddingVersion" = ${EMBEDDING_VERSION},
      "embeddingTextHash" = ${args.hash},
      "embeddedAt" = NOW()
    WHERE "oracleId" = ${args.oracleId}
  `
  return Number(result)
}

/**
 * Taille du lot externe (selection + embed + persist).
 * Doit rester <= EMBEDDING_API_MAX_INPUTS (2048 OpenAI).
 * 1000 = bon compromis memoire (12MB de vecteurs) / latence.
 */
const OUTER_BATCH_SIZE = 1000

/**
 * Pipeline principal d'embeddings — streaming par lots resumables.
 *
 * Chaque iteration:
 *  1. SELECT OUTER_BATCH_SIZE cartes restantes a embedder.
 *  2. Build canonical text + hash.
 *  3. Dedupe intra-batch par hash.
 *  4. UN call OpenAI (<= 1000 inputs).
 *  5. Persist immediatement (UPDATE par oracleId).
 *  6. Boucle: la SELECT suivante ignore les rows deja embedees.
 *
 * Resumable: une interruption (OOM, kill) ne perd pas les batches deja
 * persistes. Memoire bornee independamment du total de cartes.
 */
export async function runEmbeddingsPipeline(
  options: EmbedRunOptions = {}
): Promise<EmbedRunResult> {
  const { limit, dryRun = false, onProgress } = options

  // Total estime au demarrage (juste pour la barre de progression).
  const totalEstimateRows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT COUNT(DISTINCT "oracleId")::bigint AS count
    FROM "Card"
    WHERE "embedding" IS NULL
       OR "embeddingModel" IS DISTINCT FROM ${EMBEDDING_MODEL}
       OR "embeddingVersion" IS DISTINCT FROM ${EMBEDDING_VERSION}
  `)
  const totalEstimate = Number(totalEstimateRows[0]?.count ?? 0)

  const result: EmbedRunResult = {
    selected: 0,
    apiCalls: 0,
    uniqueTexts: 0,
    rowsUpdated: 0,
    skipped: 0,
    errors: 0,
  }

  let remainingLimit = limit ?? Number.POSITIVE_INFINITY
  let processed = 0
  let consecutiveEmpty = 0

  while (remainingLimit > 0) {
    const batchLimit = Math.min(OUTER_BATCH_SIZE, remainingLimit)
    const cards = await selectCardsToEmbed({ limit: batchLimit })
    if (cards.length === 0) {
      consecutiveEmpty++
      if (consecutiveEmpty >= 1) break
      continue
    }
    consecutiveEmpty = 0
    result.selected += cards.length

    // Build texts + dedupe par hash.
    type Item = { card: CardForEmbedding; text: string; hash: string }
    const items: Item[] = cards.map((c) => {
      const text = buildCanonicalText({
        name: c.name,
        typeLine: c.typeLine,
        oracleText: c.oracleText,
        manaCost: c.manaCost,
        keywords: c.keywords,
      })
      return { card: c, text, hash: hashCanonicalText(text) }
    })
    const byHash = new Map<string, Item[]>()
    for (const it of items) {
      const arr = byHash.get(it.hash)
      if (arr) arr.push(it)
      else byHash.set(it.hash, [it])
    }
    const uniqueHashes = [...byHash.keys()]
    result.uniqueTexts += uniqueHashes.length

    if (dryRun) {
      result.apiCalls++
      processed += cards.length
      remainingLimit -= cards.length
      onProgress?.(processed, totalEstimate)
      continue
    }

    // Embed: un seul call OpenAI pour ce batch.
    let vectors: number[][]
    try {
      const inputs = uniqueHashes.map((h) => byHash.get(h)![0].text)
      const openai = getOpenAI()
      const resp = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: inputs,
        dimensions: EMBEDDING_DIMENSIONS,
        encoding_format: 'float',
      })
      result.apiCalls++
      vectors = resp.data.map((d) => d.embedding as number[])
      if (vectors.length !== uniqueHashes.length) {
        console.error(
          `[ai/embeddings] count mismatch in batch: got ${vectors.length}, expected ${uniqueHashes.length}`
        )
        result.errors++
        processed += cards.length
        remainingLimit -= cards.length
        onProgress?.(processed, totalEstimate)
        continue
      }
    } catch (err) {
      console.error('[ai/embeddings] OpenAI batch failed:', err)
      result.errors++
      processed += cards.length
      remainingLimit -= cards.length
      onProgress?.(processed, totalEstimate)
      continue
    }

    // Persist par oracleId (fallback par hash si erreur).
    for (let i = 0; i < uniqueHashes.length; i++) {
      const hash = uniqueHashes[i]
      const vector = vectors[i]
      const hashItems = byHash.get(hash)!
      try {
        for (const item of hashItems) {
          const updated = await persistEmbeddingByOracleId({
            oracleId: item.card.oracleId,
            hash,
            vector,
          })
          result.rowsUpdated += updated
        }
      } catch (err) {
        console.error('[ai/embeddings] persist failed for hash', hash, err)
        result.errors++
        try {
          const updated = await persistEmbeddingByHash({ hash, vector })
          result.rowsUpdated += updated
        } catch (err2) {
          console.error('[ai/embeddings] fallback persist also failed:', err2)
        }
      }
    }

    processed += cards.length
    remainingLimit -= cards.length
    onProgress?.(processed, totalEstimate)
    // Hint GC entre batchs (libere les vecteurs precedents).
    vectors.length = 0
  }

  return result
}
