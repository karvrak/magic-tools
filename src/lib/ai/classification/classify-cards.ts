import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getOpenAI } from '../clients'
import {
  CLASSIFICATION_BATCH_SIZE,
  CLASSIFICATION_MODEL,
  CLASSIFICATION_VERSION,
} from '../config'
import {
  buildClassificationUserPrompt,
  CLASSIFICATION_SYSTEM_PROMPT,
} from '../prompts/classification'
import { ClassificationBatchResponseSchema } from '../schemas'
import { CARD_ROLES, INTERACTION_TYPES } from '../types'

/**
 * Classification one-shot des cartes en sync mode.
 *
 * Strategie:
 * - Selectionne les cartes a (re)classifier:
 *     classifiedAt NULL OR classificationVersion != CLASSIFICATION_VERSION
 * - Deduplique par oracleId (un meme oracle = une meme classification).
 * - Envoie par batchs de CLASSIFICATION_BATCH_SIZE cartes au LLM.
 * - Valide la sortie via zod, retry x1 si la sortie est malformee.
 * - Persiste atomiquement par oracleId (toutes les printings).
 *
 * Egalement: extrait cardTypes (parse type_line) et producedMana
 * (heuristique sur l'oracle text).
 */

export interface ClassifyOptions {
  limit?: number
  dryRun?: boolean
  onProgress?: (done: number, total: number) => void
}

export interface ClassifyResult {
  selected: number
  apiCalls: number
  classified: number
  rowsUpdated: number
  errors: number
}

interface CardForClassification {
  id: string
  oracleId: string
  name: string
  typeLine: string
  oracleText: string | null
  manaCost: string | null
  keywords: string[]
}

async function selectCardsToClassify(opts: { limit?: number } = {}): Promise<
  CardForClassification[]
> {
  const limitClause = opts.limit ? Prisma.sql`LIMIT ${opts.limit}` : Prisma.empty
  return prisma.$queryRaw<CardForClassification[]>(Prisma.sql`
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
      "classifiedAt" IS NULL
      OR "classificationVersion" IS DISTINCT FROM ${CLASSIFICATION_VERSION}
    ORDER BY "oracleId", "releasedAt" ASC NULLS LAST
    ${limitClause}
  `)
}

/**
 * Parse type_line Scryfall en types canoniques.
 * Ex: "Legendary Creature - Human Wizard" -> ["legendary", "creature", "human", "wizard"]
 * Ex: "Land - Mountain" -> ["land", "mountain"]
 */
export function parseCardTypes(typeLine: string): string[] {
  // Separe avant et apres le tiret " — " ou " - " ou " // "
  const cleaned = typeLine.replace(/[—–]/g, '-')
  const parts = cleaned.split(/\s*\/\/\s*|\s+-\s+/)
  const tokens: string[] = []
  for (const p of parts) {
    for (const tok of p.split(/\s+/)) {
      const t = tok.trim().toLowerCase()
      if (t) tokens.push(t)
    }
  }
  // Dedup en preservant l'ordre
  const seen = new Set<string>()
  return tokens.filter((t) => {
    if (seen.has(t)) return false
    seen.add(t)
    return true
  })
}

/**
 * Heuristique simple pour extraire les couleurs de mana produites par une carte.
 * Regarde dans l'oracle text les patterns "{T}: Add {X}" et synonymes.
 * Pour les cartes complexes (cascade, X mana sources), c'est approximatif —
 * acceptable car on a deja la color_identity comme garde-fou.
 */
export function extractProducedMana(args: {
  typeLine: string
  oracleText: string | null
}): string[] {
  const text = (args.oracleText ?? '').toLowerCase()
  const found = new Set<string>()
  // Pattern "add {W}" / "add one mana of any color" / etc.
  const symbolRegex = /\{([wubrgc])\}/gi
  let m: RegExpExecArray | null
  // On ne capture que ceux precedes de "add" ou "produce" pour eviter les bruits.
  const addCtxRegex = /(add|produce|adds)[^.]{0,80}?\{([wubrgc])\}/gi
  while ((m = addCtxRegex.exec(text))) {
    found.add(m[2].toUpperCase())
  }
  // "any color" / "of any one color"
  if (/add[^.]{0,40}any (?:one )?color/i.test(args.oracleText ?? '')) {
    found.add('ANY')
  }
  // Basic lands: type-based shortcut
  const tl = args.typeLine.toLowerCase()
  if (tl.includes('plains')) found.add('W')
  if (tl.includes('island')) found.add('U')
  if (tl.includes('swamp')) found.add('B')
  if (tl.includes('mountain')) found.add('R')
  if (tl.includes('forest')) found.add('G')
  // Les colorless lands type Wastes
  if (tl.includes('wastes')) found.add('C')
  // Avoid unused-var lint
  void symbolRegex
  void m
  return [...found]
}

interface ParsedClassification {
  primary_role: string
  secondary_roles: string[]
  archetype_tags: string[]
  interaction_type: string
}

/**
 * Appelle le LLM pour un batch de cartes. Retourne un map id -> classification valide.
 * Fait un retry simple en cas de JSON invalide.
 */
async function classifyBatch(
  cards: CardForClassification[]
): Promise<Map<string, ParsedClassification>> {
  const openai = getOpenAI()
  const userPrompt = buildClassificationUserPrompt(cards)

  const callOnce = async (): Promise<unknown> => {
    const completion = await openai.chat.completions.create({
      model: CLASSIFICATION_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    })
    const content = completion.choices[0]?.message?.content
    if (!content) throw new Error('Empty completion content')
    return JSON.parse(content)
  }

  let raw: unknown
  try {
    raw = await callOnce()
  } catch (err) {
    console.warn('[ai/classify] first call failed, retrying once:', err)
    raw = await callOnce()
  }

  // Le LLM retourne des cles "c0", "c1", ... -> on remappe vers card.id.
  const remap = (
    src: Map<string, ParsedClassification>
  ): Map<string, ParsedClassification> => {
    const out = new Map<string, ParsedClassification>()
    for (const [key, cls] of src) {
      const m = key.match(/^c(\d+)$/)
      if (!m) continue
      const idx = Number(m[1])
      if (idx < 0 || idx >= cards.length) continue
      out.set(cards[idx].id, cls)
    }
    return out
  }

  const parsed = ClassificationBatchResponseSchema.safeParse(raw)
  if (!parsed.success) {
    return remap(tolerantParse(raw, cards))
  }
  const indexed = new Map<string, ParsedClassification>()
  for (const [key, cls] of Object.entries(parsed.data.classifications)) {
    indexed.set(key, cls as ParsedClassification)
  }
  return remap(indexed)
}

/**
 * Parse tolerant: coerce les valeurs hors enum vers des fallbacks plutot que
 * de jeter l'entree complete. C'est meilleur que de perdre la classification
 * quand le LLM glisse legerement (ex: "value" au lieu de "utility").
 */
function tolerantParse(
  raw: unknown,
  _cards: CardForClassification[]
): Map<string, ParsedClassification> {
  const out = new Map<string, ParsedClassification>()
  if (!raw || typeof raw !== 'object') return out
  const candidate = (raw as { classifications?: Record<string, unknown> })
    .classifications
  if (!candidate || typeof candidate !== 'object') return out
  const ROLES = CARD_ROLES as readonly string[]
  const INTERACTIONS = INTERACTION_TYPES as readonly string[]
  for (const [id, value] of Object.entries(candidate)) {
    // La cle est "cN" (filtree par remap a la sortie). On accepte tout ici.
    if (!value || typeof value !== 'object') continue
    const v = value as Record<string, unknown>
    const rawPrimary = String(v.primary_role ?? '').toLowerCase()
    const rawInteraction = String(v.interaction_type ?? '').toLowerCase()
    // Coercion plutot que rejet: si hors enum, fallback raisonnable.
    const primary = ROLES.includes(rawPrimary) ? rawPrimary : 'utility'
    const interaction = INTERACTIONS.includes(rawInteraction)
      ? rawInteraction
      : 'mixed'
    const secondary = Array.isArray(v.secondary_roles)
      ? v.secondary_roles
          .filter((r): r is string => typeof r === 'string')
          .map((r) => r.toLowerCase())
          .filter((r) => ROLES.includes(r))
      : []
    const tags = Array.isArray(v.archetype_tags)
      ? v.archetype_tags
          .filter((t): t is string => typeof t === 'string')
          .map((t) => t.toLowerCase().replace(/\s+/g, '_'))
          .filter((t) => t.length > 0 && t.length < 40)
      : []
    out.set(id, {
      primary_role: primary,
      secondary_roles: secondary,
      archetype_tags: tags,
      interaction_type: interaction,
    })
  }
  return out
}

/**
 * Persist la classification + features structurees pour TOUTES les printings
 * du meme oracleId.
 */
async function persistClassification(args: {
  oracleId: string
  cls: ParsedClassification
  cardTypes: string[]
  producedMana: string[]
}): Promise<number> {
  const result = await prisma.$executeRaw`
    UPDATE "Card"
    SET
      "primaryRole" = ${args.cls.primary_role},
      "secondaryRoles" = ${args.cls.secondary_roles}::text[],
      "archetypeTags" = ${args.cls.archetype_tags}::text[],
      "interactionType" = ${args.cls.interaction_type},
      "cardTypes" = ${args.cardTypes}::text[],
      "producedMana" = ${args.producedMana}::text[],
      "classificationVersion" = ${CLASSIFICATION_VERSION},
      "classifiedAt" = NOW()
    WHERE "oracleId" = ${args.oracleId}
  `
  return Number(result)
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Concurrence: nb de batches LLM traites en parallele.
 * 5 reste sous les rate limits OpenRouter standards et accelere x5.
 */
const CLASSIFY_CONCURRENCY = 5

async function processBatch(
  batch: CardForClassification[],
  options: ClassifyOptions,
  result: ClassifyResult
): Promise<number> {
  if (options.dryRun) {
    result.apiCalls++
    return batch.length
  }
  let classified: Map<string, ParsedClassification>
  try {
    classified = await classifyBatch(batch)
    result.apiCalls++
  } catch (err) {
    console.error('[ai/classify] batch failed:', err)
    result.errors++
    return batch.length
  }
  for (const card of batch) {
    const cls = classified.get(card.id)
    if (!cls) {
      result.errors++
      continue
    }
    const cardTypes = parseCardTypes(card.typeLine)
    const producedMana = extractProducedMana({
      typeLine: card.typeLine,
      oracleText: card.oracleText,
    })
    try {
      const updated = await persistClassification({
        oracleId: card.oracleId,
        cls,
        cardTypes,
        producedMana,
      })
      result.classified++
      result.rowsUpdated += updated
    } catch (err) {
      console.error('[ai/classify] persist failed for', card.id, err)
      result.errors++
    }
  }
  return batch.length
}

export async function runClassificationPipeline(
  options: ClassifyOptions = {}
): Promise<ClassifyResult> {
  const cards = await selectCardsToClassify({ limit: options.limit })
  const total = cards.length
  if (total === 0) {
    return { selected: 0, apiCalls: 0, classified: 0, rowsUpdated: 0, errors: 0 }
  }
  const result: ClassifyResult = {
    selected: total,
    apiCalls: 0,
    classified: 0,
    rowsUpdated: 0,
    errors: 0,
  }
  const batches = chunk(cards, CLASSIFICATION_BATCH_SIZE)
  let processed = 0
  // Process batches in groups of CLASSIFY_CONCURRENCY in parallel.
  for (let i = 0; i < batches.length; i += CLASSIFY_CONCURRENCY) {
    const slice = batches.slice(i, i + CLASSIFY_CONCURRENCY)
    const counts = await Promise.all(
      slice.map((b) => processBatch(b, options, result))
    )
    for (const c of counts) processed += c
    options.onProgress?.(processed, total)
  }
  return result
}
