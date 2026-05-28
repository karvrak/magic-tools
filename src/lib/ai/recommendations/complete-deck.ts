import { getLLMClient } from '../clients'
import { RERANK_MAX_TOKENS, RERANK_MODEL } from '../config'
import { computeDeckAnalysis, persistDeckAnalysis } from '../deck-analysis/analyze-deck'
import { buildRerankUserPrompt, RERANK_SYSTEM_PROMPT } from '../prompts/rerank'
import { RerankResponseSchema, type RerankResponse } from '../schemas'
import { isSupportedFormat, type SupportedFormat } from '../types'
import { detectRoleGaps, type RoleGap } from './gap-detection'
import {
  extractDeckVectors,
  querySynergies,
  type SynergyCandidate,
} from './synergies'
import type { DeterministicFilterContext } from './filters'
import {
  detectDeckMechanics,
  type DetectedTheme,
} from './mechanic-detection'
import {
  analyzeSynergyChains,
  countChainMatches,
  curveFitMultiplier,
  SYNERGY_CHAINS,
  type ChainStats,
} from './synergy-graph'
import { Prisma } from '@prisma/client'
import { buildDeterministicWhere } from './filters'
import { toVectorLiteral } from '../embeddings/embed-cards'

/**
 * Orchestration complete: deck-analysis -> gap-detection -> per-role candidate
 * search -> LLM rerank -> grouped output.
 *
 * L'API recoit le deck.id, on detecte le format/owner, on calcule l'analyse,
 * on detecte les gaps, on lance des vector searches par role, on aggrege les
 * top candidats, on les envoie au re-ranker (Sonnet 4.6) avec le deck en
 * contexte, et on retourne une reponse groupee par role avec explication FR.
 */

export interface CompleteDeckArgs {
  deckId: string
  /** Limite par groupe role apres rerank. */
  perRoleLimit?: number
  /** Total candidats envoyes au LLM (cap pour controler latence/coût). */
  maxCandidates?: number
  /** N'inclure que les cartes possedees par l'owner. */
  ownedOnly?: boolean
  /** Override du modele de rerank (slug OpenRouter). Default: RERANK_MODEL */
  rerankModel?: string
  /**
   * Instruction utilisateur en langage naturel ("trouve des kill", "equilibre
   * la mana base", "plus de ramp"…). Injectee dans le prompt rerank comme
   * signal prioritaire au-dessus du scoring "engine fit" par defaut.
   */
  userPrompt?: string | null
  /**
   * Liste blanche de raretes (common/uncommon/rare/mythic). Si fournie, filtre
   * applique en SQL avant le vector search.
   */
  rarities?: readonly string[] | null
  /** Prix max EUR (TCG/Scryfall) — filtre en SQL. */
  priceMaxEur?: number | null
}

export interface CompleteDeckResult {
  deckId: string
  format: SupportedFormat
  detectedArchetype: string | null
  archetypeConfidence: number
  archetypeNote: string | null
  /** Date de calcul de cette analyse (ISO string). Null si pas encore calcule. */
  computedAt?: string
  groups: Array<{
    role: RoleGap['role']
    severity: RoleGap['severity']
    needed: number
    current: number
    target: { min: number; ideal: number; max: number }
    suggestions: Array<{
      cardId: string
      oracleId: string
      name: string
      manaCost: string | null
      typeLine: string
      imageNormal: string | null
      priceEur: number | null
      score: number
      similarity: number
      explanation: string
    }>
  }>
  /** Suggestions globales (pas liees a un gap specifique) — fallback. */
  miscSuggestions: Array<{
    cardId: string
    oracleId: string
    name: string
    manaCost: string | null
    typeLine: string
    imageNormal: string | null
    priceEur: number | null
    score: number
    similarity: number
    explanation: string
  }>
  /**
   * Evaluation de CHAQUE carte du deck (best/worst). Trie par score decroissant.
   * Permet a l'utilisateur d'identifier les piliers et les maillons faibles.
   */
  deckEvaluation: Array<{
    cardId: string
    oracleId: string
    name: string
    manaCost: string | null
    typeLine: string
    imageNormal: string | null
    priceEur: number | null
    category: string
    quantity: number
    score: number
    explanation: string
  }>
}

interface DeckMeta {
  id: string
  format: SupportedFormat
  ownerId: string | null
  name: string
  excludedCardIds: string[]
  excludedOracleIds: string[]
  colorIdentity: string[]
  commanders: Array<{ name: string; typeLine: string; oracleText: string | null }>
}

import prisma from '@/lib/prisma'

/**
 * Query SQL qui scanne les cartes matchant AU MOINS UNE chaine active
 * et les ordonne par NOMBRE de chaines matchees (DESC). Trouve les cartes
 * "signature multi-pilier" comme Voice of Victory que l'embedding rate.
 *
 * Filtre additionnel optionnel: archetypeTags overlap avec les tags dominants
 * du deck — combine la connaissance "ce que la carte fait" (chains) avec
 * "ce a quoi elle sert" (tags). Voice of Victory tag=tokens + chain=token+attack
 * → fortement priorisee dans un deck aggro/tokens.
 */
/**
 * Query SQL ciblee pour combler un GAP de chaine specifique. Si le deck a
 * besoin de sources (need_source), on cherche les cartes matchant le source
 * pattern. Tri par curve fit (favorise les CMC proche du deck), filtre par
 * tag overlap pour cibler les vraies signatures de l'archetype.
 *
 * Exemple: deck Axonil aggro/tokens, chain token_etb need_source → cherche
 * %create%token% avec tags=[aggro,tokens] et CMC bas. Voice of Victory
 * (cmc=2, tag=tokens, "create two tokens") doit remonter en top 5.
 */
async function queryChainGapCandidates(args: {
  filter: DeterministicFilterContext
  pattern: string
  centroid: number[] | null
  dominantTags?: string[]
  deckAvgCmc: number
  limit: number
}): Promise<SynergyCandidate[]> {
  const where = buildDeterministicWhere(args.filter)
  const tagsClause =
    args.dominantTags && args.dominantTags.length > 0
      ? Prisma.sql`AND c."archetypeTags" && ${args.dominantTags}::text[]`
      : Prisma.empty
  const centroidLit = args.centroid ? toVectorLiteral(args.centroid) : null
  // Score = curve_fit (CMC proche du deck) + tie-break par centroid sim si dispo.
  const orderBy = centroidLit
    ? Prisma.sql`ORDER BY (1.0 / (1.0 + 0.18 * abs(COALESCE(rep.cmc, 0) - ${args.deckAvgCmc}::float8))) DESC,
                 (rep."embedding" <=> ${centroidLit}::vector(1536)) ASC`
    : Prisma.sql`ORDER BY (1.0 / (1.0 + 0.18 * abs(COALESCE(rep.cmc, 0) - ${args.deckAvgCmc}::float8))) DESC`

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
      simC: number
    }>
  >(Prisma.sql`
    WITH oracle_reps AS (
      SELECT DISTINCT ON (c."oracleId")
        c.id, c."oracleId", c.name, c."manaCost", c."typeLine", c."oracleText",
        c."primaryRole", c."secondaryRoles", c."archetypeTags", c."cmc",
        c."imageNormal", c."priceEur", c."embedding"
      FROM "Card" c
      WHERE ${where}
        AND c."oracleText" ILIKE ${args.pattern}
        ${tagsClause}
      ORDER BY c."oracleId", c."releasedAt" ASC NULLS LAST, c.id ASC
    )
    SELECT
      rep.id AS "cardId",
      rep."oracleId",
      rep.name,
      rep."manaCost",
      rep."typeLine",
      rep."oracleText",
      rep."primaryRole",
      rep."secondaryRoles",
      rep."archetypeTags",
      rep.cmc,
      rep."imageNormal",
      rep."priceEur",
      ${
        centroidLit
          ? Prisma.sql`(1 - (rep."embedding" <=> ${centroidLit}::vector(1536)))::float8`
          : Prisma.sql`0::float8`
      } AS "simC"
    FROM oracle_reps rep
    ${orderBy}
    LIMIT ${args.limit}
  `)
  return rows.map((r) => ({
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
    similarityCentroid: Number(r.simC) || 0,
    similarityMaxToDeck: 0,
    similarityHybrid: Number(r.simC) || 0,
  }))
}

async function queryMultiChainCandidates(args: {
  filter: DeterministicFilterContext
  activeChains: ChainStats[]
  centroid: number[] | null
  /** Tags dominants du deck — si fournis, on filtre les candidats par overlap. */
  dominantTags?: string[]
  /** CMC moyenne du deck — utilise pour penaliser les cartes hors-courbe. */
  deckAvgCmc?: number
  limit: number
}): Promise<SynergyCandidate[]> {
  if (args.activeChains.length === 0) return []
  const where = buildDeterministicWhere(args.filter)
  const tagsClause =
    args.dominantTags && args.dominantTags.length > 0
      ? Prisma.sql`AND c."archetypeTags" && ${args.dominantTags}::text[]`
      : Prisma.empty

  // Pour chaque chaine active, on compte 1 si au moins un de ses 2 patterns
  // (source OR payoff) matche. Cela evite le biais des cartes qui matchent
  // les 2 patterns d'une meme chaine mais ne touchent qu'une chaine.
  const chainPairs: Array<{ source: string; payoff: string }> = []
  const allPatterns: string[] = []
  for (const chainStat of args.activeChains) {
    const def = SYNERGY_CHAINS.find((c) => c.family === chainStat.family)
    if (!def) continue
    chainPairs.push({ source: def.sourceFTS, payoff: def.payoffFTS })
    allPatterns.push(def.sourceFTS, def.payoffFTS)
  }
  if (chainPairs.length === 0) return []
  // chain_count = nombre de chaines uniques touchees (source OU payoff).
  const countSql = chainPairs
    .map(
      (p) =>
        Prisma.sql`(CASE WHEN c."oracleText" ILIKE ${p.source} OR c."oracleText" ILIKE ${p.payoff} THEN 1 ELSE 0 END)`
    )
    .reduce((acc, x, i) => (i === 0 ? x : Prisma.sql`${acc} + ${x}`))
  // OR clause pour filtrer: au moins une chaine touchee.
  const orClause = allPatterns
    .map((p) => Prisma.sql`c."oracleText" ILIKE ${p}`)
    .reduce((acc, x, i) => (i === 0 ? x : Prisma.sql`${acc} OR ${x}`))

  const centroidLit = args.centroid ? toVectorLiteral(args.centroid) : null
  // Score composite: chain_count * curve_fit avec penalty plus douce (0.08 au
  // lieu de 0.18) pour ne pas evincer les cmc=2 dans les decks ultra-aggro
  // (deckAvg=1.5). Voice of Victory cmc=2 chain_count=2 doit pouvoir cohabiter
  // avec les cmc=1 chain_count=2 dans un deck a courbe basse.
  const deckAvg = args.deckAvgCmc ?? 2.5
  const compositeScoreSql = Prisma.sql`(${countSql})::float8 / (1.0 + 0.08 * abs(COALESCE(c.cmc, 0) - ${deckAvg}::float8))`
  const orderBy = centroidLit
    ? Prisma.sql`ORDER BY composite_score DESC, (rep."embedding" <=> ${centroidLit}::vector(1536)) ASC`
    : Prisma.sql`ORDER BY composite_score DESC, rep."oracleId" ASC`

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
      simC: number
      chainCount: number
    }>
  >(Prisma.sql`
    WITH oracle_reps AS (
      SELECT DISTINCT ON (c."oracleId")
        c.id, c."oracleId", c.name, c."manaCost", c."typeLine", c."oracleText",
        c."primaryRole", c."secondaryRoles", c."archetypeTags", c."cmc",
        c."imageNormal", c."priceEur", c."embedding",
        ${countSql} AS chain_count,
        ${compositeScoreSql} AS composite_score
      FROM "Card" c
      WHERE ${where}
        AND (${orClause})
        ${tagsClause}
      ORDER BY c."oracleId", c."releasedAt" ASC NULLS LAST, c.id ASC
    )
    SELECT
      rep.id AS "cardId",
      rep."oracleId",
      rep.name,
      rep."manaCost",
      rep."typeLine",
      rep."oracleText",
      rep."primaryRole",
      rep."secondaryRoles",
      rep."archetypeTags",
      rep.cmc,
      rep."imageNormal",
      rep."priceEur",
      ${
        centroidLit
          ? Prisma.sql`(1 - (rep."embedding" <=> ${centroidLit}::vector(1536)))::float8`
          : Prisma.sql`0::float8`
      } AS "simC",
      rep.chain_count AS "chainCount"
    FROM oracle_reps rep
    ${orderBy}
    LIMIT ${args.limit}
  `)
  return rows
    .filter((r) => r.chainCount >= 2) // au moins 2 chaines distinctes touchees
    .map((r) => ({
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
      similarityCentroid: Number(r.simC) || 0,
      similarityMaxToDeck: 0,
      similarityHybrid: Number(r.simC) || 0,
    }))
}

async function loadDeckMeta(deckId: string): Promise<DeckMeta | null> {
  const d = await prisma.deck.findUnique({
    where: { id: deckId },
    select: {
      id: true,
      name: true,
      format: true,
      ownerId: true,
      cards: {
        include: {
          card: {
            select: {
              id: true,
              oracleId: true,
              name: true,
              typeLine: true,
              oracleText: true,
              colorIdentity: true,
            },
          },
        },
      },
    },
  })
  if (!d) return null
  if (!isSupportedFormat(d.format)) return null

  const excludedCardIds = d.cards.map((dc) => dc.card.id)
  const excludedOracleIds = [...new Set(d.cards.map((dc) => dc.card.oracleId))]
  const commanders = d.cards
    .filter((dc) => dc.category === 'commander')
    .map((dc) => ({
      name: dc.card.name,
      typeLine: dc.card.typeLine,
      oracleText: dc.card.oracleText,
    }))

  // Color identity:
  //  - EDH: union stricte des CI des commandants (ou de tout le deck en
  //    fallback si pas de commandant identifie).
  //  - Vintage: pas de regle CI, mais il faut quand meme un filtre car un
  //    deck mono-rouge ne peut pas caster une carte blanche. On prend l'union
  //    des CI de toutes les cartes du deck → mono-R reste mono-R, RUG reste
  //    RUG, etc.
  let colorIdentity: string[]
  if (d.format?.toLowerCase() === 'commander') {
    if (commanders.length > 0) {
      const set = new Set<string>()
      for (const dc of d.cards) {
        if (dc.category !== 'commander') continue
        for (const c of dc.card.colorIdentity ?? []) set.add(c)
      }
      colorIdentity = [...set]
    } else {
      const set = new Set<string>()
      for (const dc of d.cards) {
        for (const c of dc.card.colorIdentity ?? []) set.add(c)
      }
      colorIdentity = [...set]
    }
  } else {
    // Vintage: union des CI des cartes du deck.
    const set = new Set<string>()
    for (const dc of d.cards) {
      for (const c of dc.card.colorIdentity ?? []) set.add(c)
    }
    colorIdentity = [...set]
  }

  return {
    id: d.id,
    format: d.format!.toLowerCase() as SupportedFormat,
    ownerId: d.ownerId,
    name: d.name,
    excludedCardIds,
    excludedOracleIds,
    colorIdentity,
    commanders,
  }
}

/**
 * Appelle Sonnet 4.6 pour ranker les candidats. Retry x1 si parse failure.
 */
async function rerankWithLLM(args: {
  meta: DeckMeta
  detectedArchetype: string | null
  mechanicalThemes: DetectedTheme[]
  deckCards: Array<{
    id: string
    name: string
    quantity: number
    typeLine: string
    oracleText: string | null
    primaryRole: string | null
  }>
  roleGaps: RoleGap[]
  candidates: SynergyCandidate[]
  model?: string
  userPrompt?: string | null
  hardFilters?: {
    rarities?: readonly string[]
    priceMaxEur?: number | null
  }
}): Promise<RerankResponse> {
  const userPrompt = buildRerankUserPrompt({
    deckName: args.meta.name,
    format: args.meta.format,
    detectedArchetype: args.detectedArchetype,
    mechanicalThemes: args.mechanicalThemes.map((t) => ({
      label: t.label,
      count: t.count,
    })),
    commanders: args.meta.commanders,
    deckCards: args.deckCards,
    roleGaps: args.roleGaps.map((g) => ({
      role: g.role,
      needed: g.needed,
      reason:
        g.severity === 'critical'
          ? `current=${g.current} < min=${g.target.min}`
          : g.severity === 'low'
            ? `current=${g.current} < ideal=${g.target.ideal}`
            : undefined,
    })),
    candidates: args.candidates.map((c) => ({
      id: c.cardId,
      name: c.name,
      manaCost: c.manaCost,
      typeLine: c.typeLine,
      oracleText: c.oracleText,
      primaryRole: c.primaryRole,
      archetypeTags: c.archetypeTags,
      similarityScore: c.similarityHybrid,
    })),
    userPrompt: args.userPrompt ?? null,
    hardFilters: args.hardFilters,
  })

  const expectedDeckIds = new Set(args.deckCards.map((c) => c.id))
  const expectedDeckN = args.deckCards.length

  const llm = getLLMClient()
  const modelToUse = args.model ?? RERANK_MODEL
  const callOnce = async (): Promise<string> => {
    const resp = await llm.chat.completions.create({
      model: modelToUse,
      max_tokens: RERANK_MAX_TOKENS,
      // Pas de response_format json sur Claude via OpenRouter — on parse manuellement.
      messages: [
        { role: 'system', content: RERANK_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    })
    const text = resp.choices[0]?.message?.content
    if (!text) throw new Error('Rerank: empty response')
    return text.trim()
  }

  const cleanJson = (raw: string): string => {
    // 1) Enleve fences markdown.
    let s = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()
    // 2) Extrait le 1er objet JSON top-level via comptage de braces. Le LLM
    //    rajoute parfois du commentaire libre apres la cloture (`}\n\n— note: ...`)
    //    ou un 2e JSON, ce qui casse JSON.parse. On respecte les chaines pour
    //    ne pas confondre `{` litteral dans une string avec une ouverture.
    const start = s.indexOf('{')
    if (start === -1) return s
    let depth = 0
    let end = -1
    let inString = false
    let escape = false
    for (let i = start; i < s.length; i++) {
      const ch = s[i]
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (inString) continue
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    if (end === -1) return s.slice(start) // brace mal fermee → laisse JSON.parse remonter l'erreur
    return s.slice(start, end + 1)
  }

  // Parse robuste: gere SyntaxError (JSON tronque), schema invalide,
  // ET completude (le LLM doit scorer chaque candidat ET chaque carte du deck).
  const expectedIds = new Set(args.candidates.map((c) => c.cardId))
  const expectedN = args.candidates.length

  const tryParse = (
    raw: string
  ):
    | { ok: true; data: RerankResponse }
    | {
        ok: false
        reason: string
        missingIds?: string[]
        missingDeckIds?: string[]
        partial?: RerankResponse
      } => {
    try {
      const obj = JSON.parse(cleanJson(raw))
      const parsed = RerankResponseSchema.safeParse(obj)
      if (!parsed.success) return { ok: false, reason: `schema: ${parsed.error.message}` }
      const got = new Set(parsed.data.suggestions.map((s) => s.card_id))
      const missing = [...expectedIds].filter((id) => !got.has(id))
      const gotDeck = new Set(
        (parsed.data.deck_evaluations ?? []).map((d) => d.card_id)
      )
      const missingDeck = [...expectedDeckIds].filter((id) => !gotDeck.has(id))
      if (missing.length === 0 && missingDeck.length === 0) {
        return { ok: true, data: parsed.data }
      }
      const reasonParts: string[] = []
      if (missing.length > 0)
        reasonParts.push(`${missing.length}/${expectedN} candidates missing`)
      if (missingDeck.length > 0)
        reasonParts.push(
          `${missingDeck.length}/${expectedDeckN} deck cards missing`
        )
      return {
        ok: false,
        reason: `incomplete: ${reasonParts.join(', ')}`,
        missingIds: missing,
        missingDeckIds: missingDeck,
        partial: parsed.data,
      }
    } catch (err) {
      return { ok: false, reason: `syntax: ${(err as Error).message}` }
    }
  }

  let text = await callOnce()
  let attempt = tryParse(text)

  // Retry seulement si le LLM a renvoye un JSON casse OU s'il a omis BEAUCOUP
  // de cartes (>10% des candidats OU >10% des deck cards). Si quelques cartes
  // manquent, on considere ca comme acceptable et on complete avec un fallback.
  const PARTIAL_TOLERANCE = 0.1
  const isAcceptablePartial = (a: typeof attempt) => {
    if (a.ok) return false
    if (!a.partial) return false
    const candRatio = (a.missingIds?.length ?? 0) / Math.max(1, expectedN)
    const deckRatio = (a.missingDeckIds?.length ?? 0) / Math.max(1, expectedDeckN)
    return candRatio <= PARTIAL_TOLERANCE && deckRatio <= PARTIAL_TOLERANCE
  }
  let retries = 0
  while (!attempt.ok && !isAcceptablePartial(attempt) && retries < 2) {
    retries++
    console.warn(
      `[ai/rerank] parse issue (${attempt.reason}), retry ${retries}...`
    )
    text = await callOnce()
    attempt = tryParse(text)
  }

  // Cas partiel acceptable OU partiel apres retries: on garde le resultat
  // LLM et on complete eventuellement les manquants avec fallback.
  if (!attempt.ok) {
    if (attempt.partial && (attempt.missingIds || attempt.missingDeckIds)) {
      const candRatio = (attempt.missingIds?.length ?? 0) / Math.max(1, expectedN)
      const deckRatio =
        (attempt.missingDeckIds?.length ?? 0) / Math.max(1, expectedDeckN)
      console.warn(
        `[ai/rerank] accepting partial result (cands ${attempt.missingIds?.length ?? 0}/${expectedN} = ${(candRatio * 100).toFixed(1)}% / deck ${attempt.missingDeckIds?.length ?? 0}/${expectedDeckN} = ${(deckRatio * 100).toFixed(1)}% missing) — filling with fallback scoring`
      )
      const candById = new Map(args.candidates.map((c) => [c.cardId, c]))
      const filledMissing = (attempt.missingIds ?? []).map((id) => {
        const c = candById.get(id)!
        return {
          card_id: id,
          score: c.similarityHybrid * 0.6,
          role_filled: c.primaryRole ?? null,
          explanation: `[Non analysé par le LLM — score basé sur la similarité ${c.similarityHybrid.toFixed(2)}]`,
        }
      })
      const filledDeckMissing = (attempt.missingDeckIds ?? []).map((id) => ({
        card_id: id,
        score: 0.5,
        explanation: `[Non analysé par le LLM — score neutre par défaut]`,
      }))
      return {
        suggestions: [...attempt.partial.suggestions, ...filledMissing],
        deck_evaluations: [
          ...(attempt.partial.deck_evaluations ?? []),
          ...filledDeckMissing,
        ],
        archetype_note: attempt.partial.archetype_note,
      }
    }
    console.error(
      `[ai/rerank] all retries failed (${attempt.reason}). raw head: ${text.slice(0, 500)}`
    )
    throw new Error(`Rerank parse failed: ${attempt.reason}`)
  }
  return attempt.data
}

/**
 * Pipeline principal de complétion de deck.
 */
export async function completeDeck(
  args: CompleteDeckArgs
): Promise<CompleteDeckResult> {
  const perRoleLimit = args.perRoleLimit ?? 5
  const maxCandidates = args.maxCandidates ?? 100

  const meta = await loadDeckMeta(args.deckId)
  if (!meta) {
    throw new Error(
      `Deck ${args.deckId} not found or format not supported (vintage/commander only)`
    )
  }

  // 1) Analyse du deck (centroide, archetype, distributions).
  const analysis = await computeDeckAnalysis(args.deckId)
  if (!analysis) {
    throw new Error(`Deck analysis failed for ${args.deckId}`)
  }
  await persistDeckAnalysis(analysis)

  // 2) Gap detection
  const gaps = detectRoleGaps({
    format: meta.format,
    archetype: analysis.archetype.detected,
    roleDistribution: analysis.roles,
  })
  // On garde uniquement les gaps reels (severity != optimal/overflow).
  const realGaps = gaps.filter(
    (g) => g.severity === 'critical' || g.severity === 'low'
  )

  // 2.5) Detection des themes mecaniques (cycling, embalm, discard, ...).
  // Sert a a la fois orienter le LLM ET enrichir le pool de candidats par FTS.
  const themes = detectDeckMechanics(
    analysis.cards.map((c) => ({
      oracleText: c.oracleText,
      quantity: c.quantity,
    }))
  )

  // 2.6) Analyse des chaines source/payoff: identifie les "besoins" du deck
  // (manque de sources alors qu'il a beaucoup de payoffs, ou inverse).
  const synergyChains = analyzeSynergyChains(
    analysis.cards.map((c) => ({
      oracleText: c.oracleText,
      quantity: c.quantity,
    }))
  )

  // 3) Vector search par gap, agregation
  const filterCtx: DeterministicFilterContext = {
    format: meta.format,
    colorIdentity: meta.colorIdentity,
    excludedCardIds: meta.excludedCardIds,
    excludedOracleIds: meta.excludedOracleIds,
    ownedOnly: !!args.ownedOnly,
    ownerId: meta.ownerId,
    rarities: args.rarities && args.rarities.length > 0 ? args.rarities : undefined,
    priceMaxEur:
      typeof args.priceMaxEur === 'number' && args.priceMaxEur >= 0
        ? args.priceMaxEur
        : undefined,
  }
  const deckVectors = extractDeckVectors(analysis.cards)

  const candidatesByRole = new Map<string, SynergyCandidate[]>()
  const perRoleSearchLimit = 8
  for (const gap of realGaps) {
    const cands = await querySynergies({
      centroid: analysis.centroid,
      deckVectors,
      filter: filterCtx,
      primaryRoles: [gap.role],
      limit: perRoleSearchLimit,
    })
    candidatesByRole.set(gap.role, cands)
  }
  // Pool global (sans filtre role).
  const globalCandidates = await querySynergies({
    centroid: analysis.centroid,
    deckVectors,
    filter: filterCtx,
    limit: Math.max(10, maxCandidates - realGaps.length * perRoleSearchLimit),
  })

  // Pool MECANIQUE: pour chaque theme detecte, vector search restreint aux
  // cartes dont l'oracle text matche le pattern.
  // LIMIT=15 pour pecher les cartes signature qui sont a 0.68 sim au lieu du
  // 0.69 du top — typ. Purphoros est rank 9 du pool etb_damage Axonil.
  const candidatesByMechanic = new Map<string, SynergyCandidate[]>()
  for (const theme of themes) {
    const cands = await querySynergies({
      centroid: analysis.centroid,
      deckVectors,
      filter: filterCtx,
      oracleTextLike: theme.searchPattern,
      // Pertinence acquise via FTS → pure centroid pour signature cards.
      alphaOverride: 1.0,
      limit: 15,
    })
    candidatesByMechanic.set(theme.keyword, cands)
  }

  // Calcule les top tags d'archetype du deck — utilises par les pools chain,
  // multi-chain, et archetype tags.
  const dominantTags = analysis.archetype.topTags
    .filter((t) => t.weight >= 2) // au moins 2 cartes du deck partagent ce tag
    .slice(0, 4) // top 4 tags
    .map((t) => t.tag)
  const deckAvgCmcForChain = analysis.curve.averageCmc || 2.5

  // Pool SYNERGY-CHAIN (centroid-based): pour chaque chaine active, vector
  // search restreint aux cartes matchant le pattern source/payoff approprie.
  // Capture les cartes lexicalement proches du deck (Goblin Instigator, etc.).
  const candidatesByChain = new Map<string, SynergyCandidate[]>()
  // Pool CHAIN-GAP (curve-based): meme cible mais TRI par CMC fit (pas par
  // centroid sim). Capture les cartes signatures comme Voice of Victory dont
  // l'embedding est atypique mais dont le rôle (low-cost source de tokens
  // pour deck aggro) est evident. Filtre tag-overlap requis pour eviter le
  // bruit (pas la peine de surfacer un payoff lifegain dans un deck aggro).
  const candidatesByChainGap = new Map<string, SynergyCandidate[]>()
  for (const chainStat of synergyChains) {
    const chainDef = SYNERGY_CHAINS.find((c) => c.family === chainStat.family)
    if (!chainDef) continue
    let pattern: string | null = null
    if (
      chainStat.recommendation === 'need_source' ||
      chainStat.recommendation === 'absent'
    ) {
      pattern = chainDef.sourceFTS
    } else if (chainStat.recommendation === 'need_payoff') {
      pattern = chainDef.payoffFTS
    } else {
      pattern = chainDef.sourceFTS
    }
    if (!pattern) continue
    const cands = await querySynergies({
      centroid: analysis.centroid,
      deckVectors,
      filter: filterCtx,
      oracleTextLike: pattern,
      alphaOverride: 1.0,
      limit: 20,
    })
    candidatesByChain.set(`chain:${chainStat.family}`, cands)

    // Pool gap-fill: queries ciblees BOTH directions de la chaine (sources +
    // payoffs), tri par curve fit + tag overlap obligatoire. Le ratio des deux
    // depend de la recommandation, mais on ne s'enferme pas: meme un deck avec
    // need_payoff beneficie de sources low-cost (Voice of Victory dans Axonil
    // amplifie les payoffs Impact Tremors deja presents).
    if (dominantTags.length > 0) {
      const sourceLimit = chainStat.recommendation === 'need_source' ? 6 : 4
      const payoffLimit = chainStat.recommendation === 'need_payoff' ? 6 : 4
      const [sourceGap, payoffGap] = await Promise.all([
        queryChainGapCandidates({
          filter: filterCtx,
          pattern: chainDef.sourceFTS,
          centroid: analysis.centroid,
          dominantTags,
          deckAvgCmc: deckAvgCmcForChain,
          limit: sourceLimit,
        }),
        queryChainGapCandidates({
          filter: filterCtx,
          pattern: chainDef.payoffFTS,
          centroid: analysis.centroid,
          dominantTags,
          deckAvgCmc: deckAvgCmcForChain,
          limit: payoffLimit,
        }),
      ])
      candidatesByChainGap.set(`chainGap:${chainStat.family}:src`, sourceGap)
      candidatesByChainGap.set(`chainGap:${chainStat.family}:pay`, payoffGap)
    }
  }

  // Pool MULTI-CHAIN: SQL OR sur tous les FTS patterns des chaines actives,
  // SCANNE LARGEMENT et identifie les cartes qui matchent PLUSIEURS chaines.
  // Ces cartes "multi-fit" sont les vraies signatures: leur embedding peut
  // etre eloigne du centroide (vocabulaire atypique), mais elles touchent
  // plusieurs piliers du deck. Voice of Victory = source token + source attack
  // = 2 chaines → forcement remontee.
  let multiChainCandidates: SynergyCandidate[] = []
  if (synergyChains.length > 0) {
    multiChainCandidates = await queryMultiChainCandidates({
      filter: filterCtx,
      activeChains: synergyChains,
      centroid: analysis.centroid,
      dominantTags, // filtre par tags du deck pour cibler les vraies signatures
      deckAvgCmc: deckAvgCmcForChain,
      limit: 60,
    })
  }

  // Pool ARCHETYPE TAGS: cartes qui partagent au moins un des top tags du deck
  // (vote pondere par detectArchetype). Cible les "signature cards" de
  // l'archetype (ex: Purphoros pour aggro/burn, Blood Artist pour aristocrats)
  // qui n'apparaissent pas forcement dans le centroide moyen.
  let candidatesByTags: SynergyCandidate[] = []
  if (dominantTags.length > 0) {
    candidatesByTags = await querySynergies({
      centroid: analysis.centroid,
      deckVectors,
      filter: filterCtx,
      archetypeTagsAny: dominantTags,
      // Pertinence acquise via le tag → scoring pur centroid pour ne pas
      // biaiser vers les "copies" et permettre aux signatures uniques
      // (Purphoros, Blood Artist) de remonter.
      alphaOverride: 1.0,
      limit: 20,
    })
  }

  // Aggrege via SCORING MULTI-POOL: une carte qui apparait dans plusieurs
  // pools (mecanique + tag + role) est une "signature card" — elle gagne un
  // boost proportionnel au nombre de pools ou elle apparait. Cela permet a
  // une carte comme Purphoros (qui matche etb_damage + creature_enter +
  // damage_each_opponent + tag aggro) de remonter au-dessus des cartes plus
  // proches du centroide moyen mais moins signature.
  const POOL_BOOST = 0.04
  const poolEntries = new Map<
    string,
    { card: SynergyCandidate; pools: Set<string>; baseSim: number }
  >()
  const ingest = (cards: SynergyCandidate[], poolKey: string) => {
    for (const c of cards) {
      const e = poolEntries.get(c.cardId)
      if (e) {
        e.pools.add(poolKey)
      } else {
        poolEntries.set(c.cardId, {
          card: c,
          pools: new Set([poolKey]),
          baseSim: c.similarityHybrid,
        })
      }
    }
  }
  ingest(candidatesByTags, 'tags')
  for (const [k, list] of candidatesByMechanic) ingest(list, `mech:${k}`)
  for (const [k, list] of candidatesByChain) ingest(list, k)
  for (const [k, list] of candidatesByChainGap) ingest(list, k)
  for (const [k, list] of candidatesByRole) ingest(list, `role:${k}`)
  ingest(multiChainCandidates, 'multichain')
  ingest(globalCandidates, 'global')

  // Penalite courbe de mana: cards trop loin de l'avgCmc du deck sont
  // penalisees. Une carte 5cmc dans un deck avgCmc=2 prend ~0.65× malus.
  const deckAvgCmc = analysis.curve.averageCmc || 2.5
  const ranked = [...poolEntries.values()]
    .map((e) => {
      const poolBoost = POOL_BOOST * (e.pools.size - 1)
      const curveMul = curveFitMultiplier(e.card.cmc, deckAvgCmc)
      const finalScore = (e.baseSim + poolBoost) * curveMul
      return {
        card: e.card,
        pools: [...e.pools],
        baseSim: e.baseSim,
        poolBoost,
        curveMul,
        finalScore,
      }
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, maxCandidates)

  const allCandidates: SynergyCandidate[] = ranked.map((r) => ({
    ...r.card,
    similarityHybrid: r.finalScore, // base + pool boost + curve mul
  }))

  if (allCandidates.length === 0) {
    return {
      deckId: meta.id,
      format: meta.format,
      detectedArchetype: analysis.archetype.detected,
      archetypeConfidence: analysis.archetype.confidence,
      archetypeNote: null,
      computedAt: new Date().toISOString(),
      groups: realGaps.map((g) => ({
        role: g.role,
        severity: g.severity,
        needed: g.needed,
        current: g.current,
        target: g.target,
        suggestions: [],
      })),
      miscSuggestions: [],
      deckEvaluation: [],
    }
  }

  // 4) Re-ranking LLM avec oracle text des cartes du deck + mecaniques detectees.
  // On inclut maintenant l'id pour pouvoir recuperer le score par carte du deck
  // (sortie `deck_evaluations`). On EXCLUT les Basic Lands : evaluer "Forest"
  // n'a pas de sens, et ils representent 30+ entries inutiles dans le LLM.
  const deckCardsForLLM = analysis.cards
    .filter((c) => !/\bBasic\b/i.test(c.typeLine))
    .map((c) => ({
      id: c.cardId,
      name: c.name,
      quantity: c.quantity,
      typeLine: c.typeLine,
      oracleText: c.oracleText,
      primaryRole: c.primaryRole,
    }))

  let rerank: RerankResponse
  try {
    rerank = await rerankWithLLM({
      meta,
      detectedArchetype: analysis.archetype.detected,
      mechanicalThemes: themes,
      deckCards: deckCardsForLLM,
      roleGaps: realGaps,
      candidates: allCandidates,
      model: args.rerankModel,
      userPrompt: args.userPrompt ?? null,
      hardFilters: {
        rarities: filterCtx.rarities,
        priceMaxEur: filterCtx.priceMaxEur ?? null,
      },
    })
  } catch (err) {
    console.error('[ai/rerank] failed, falling back to similarity ordering:', err)
    rerank = {
      suggestions: allCandidates.map((c) => ({
        card_id: c.cardId,
        score: c.similarityHybrid,
        role_filled: c.primaryRole ?? null,
        explanation: `Synergie similarite (${c.similarityHybrid.toFixed(2)}) — fallback sans LLM.`,
      })),
      deck_evaluations: deckCardsForLLM.map((c) => ({
        card_id: c.id,
        score: 0.5,
        explanation: `Score neutre — analyse LLM indisponible.`,
      })),
      archetype_note: undefined,
    }
  }

  // 5) Group by role + format response
  const candById = new Map(allCandidates.map((c) => [c.cardId, c]))
  const buildSuggestion = (
    s: RerankResponse['suggestions'][number]
  ) => {
    const c = candById.get(s.card_id)
    if (!c) return null
    return {
      cardId: c.cardId,
      oracleId: c.oracleId,
      name: c.name,
      manaCost: c.manaCost,
      typeLine: c.typeLine,
      imageNormal: c.imageNormal,
      priceEur: c.priceEur,
      score: s.score,
      similarity: c.similarityHybrid,
      explanation: s.explanation,
    }
  }

  // Toutes les suggestions construites avec leur role_filled brut.
  // Une carte va dans "groups[role]" si role_filled match exactement un gap role.
  // Tout le reste (role_filled = null, "burn", "wincon", "tokens", etc.) va en misc.
  const gapRoles = new Set(realGaps.map((g) => g.role as string))
  const groupedByRole = new Map<string, NonNullable<ReturnType<typeof buildSuggestion>>[]>()
  const miscBuckets: NonNullable<ReturnType<typeof buildSuggestion>>[] = []

  for (const s of rerank.suggestions) {
    const built = buildSuggestion(s)
    if (!built) continue
    const role = s.role_filled
    if (role && gapRoles.has(role)) {
      const arr = groupedByRole.get(role) ?? []
      arr.push(built)
      groupedByRole.set(role, arr)
    } else {
      // Pas un gap role canonique → misc (incluant null, "burn", "tokens", etc.)
      miscBuckets.push(built)
    }
  }

  const groups = realGaps.map((g) => {
    const list = groupedByRole.get(g.role) ?? []
    list.sort((a, b) => b.score - a.score)
    return {
      role: g.role,
      severity: g.severity,
      needed: g.needed,
      current: g.current,
      target: g.target,
      suggestions: list.slice(0, perRoleLimit),
    }
  })

  // Misc = tout ce qui n'est pas dans un gap role, trie par score, sans limite.
  // (le user veut TOUT voir, surtout depuis l'option C "score every candidate")
  const misc = miscBuckets.sort((a, b) => b.score - a.score)

  // 6) Construit le tableau deckEvaluation a partir du LLM (best/worst cards).
  // On enrichit avec les champs UI (image, prix, manaCost) via un seul query Prisma.
  const deckEvaluation = await buildDeckEvaluation({
    deckCardsContext: analysis.cards,
    llmEvaluations: rerank.deck_evaluations ?? [],
  })

  return {
    deckId: meta.id,
    format: meta.format,
    detectedArchetype: analysis.archetype.detected,
    archetypeConfidence: analysis.archetype.confidence,
    archetypeNote: rerank.archetype_note ?? null,
    computedAt: new Date().toISOString(),
    groups,
    miscSuggestions: misc,
    deckEvaluation,
  }
}

/**
 * Combine les evaluations LLM avec les champs UI manquants des cartes du deck
 * (image, manaCost, priceEur). Trie par score decroissant.
 */
async function buildDeckEvaluation(args: {
  deckCardsContext: Array<{
    cardId: string
    oracleId: string
    name: string
    typeLine: string
    category: string
    quantity: number
  }>
  llmEvaluations: Array<{ card_id: string; score: number; explanation: string }>
}): Promise<CompleteDeckResult['deckEvaluation']> {
  const evaluatedCardIds = args.llmEvaluations.map((e) => e.card_id)
  if (evaluatedCardIds.length === 0) return []

  const cardDetails = await prisma.card.findMany({
    where: { id: { in: evaluatedCardIds } },
    select: {
      id: true,
      manaCost: true,
      imageNormal: true,
      priceEur: true,
    },
  })
  const detailMap = new Map(cardDetails.map((c) => [c.id, c]))
  const ctxMap = new Map(args.deckCardsContext.map((c) => [c.cardId, c]))

  const out: CompleteDeckResult['deckEvaluation'] = []
  for (const evalEntry of args.llmEvaluations) {
    const ctx = ctxMap.get(evalEntry.card_id)
    const detail = detailMap.get(evalEntry.card_id)
    if (!ctx || !detail) continue
    out.push({
      cardId: ctx.cardId,
      oracleId: ctx.oracleId,
      name: ctx.name,
      manaCost: detail.manaCost,
      typeLine: ctx.typeLine,
      imageNormal: detail.imageNormal,
      priceEur: detail.priceEur,
      category: ctx.category,
      quantity: ctx.quantity,
      score: evalEntry.score,
      explanation: evalEntry.explanation,
    })
  }
  out.sort((a, b) => b.score - a.score)
  return out
}
