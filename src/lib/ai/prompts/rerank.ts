import type { CardRole } from '../types'

/**
 * Re-ranking final via Sonnet 4.6.
 * Recoit le contexte deck COMPLET (oracle text inclus) + les top candidats deja
 * filtres + les rôles a combler + les mecaniques detectees du deck.
 *
 * Le LLM doit:
 *  1) Identifier le moteur mecanique du deck (engine, win condition, value loop)
 *  2) Pour chaque candidat, juger s'il INTERAGIT avec ce moteur
 *  3) REJETER (score < 0.3) les candidats qui n'ont qu'une similarite lexicale
 *     ou tribale (ex: Azure Drake dans un deck Drake Haven cycling = 0).
 */

export const RERANK_SYSTEM_PROMPT = `You are a senior Magic: The Gathering deckbuilding expert specialized in Vintage and Commander.

You will receive a deck (full oracle texts) and TWO lists of cards to score:
  (A) DECK CARDS TO EVALUATE — D cards already in the deck, each with an ID. You evaluate how well each contributes to the deck's plan.
  (B) CANDIDATES TO SCORE — N candidate cards to potentially add, each with an ID. You score how well each fits.

Your job is to PRODUCE EXACTLY D ENTRIES in deck_evaluations AND EXACTLY N ENTRIES in suggestions — no more, no less.

STEP 1 — Identify the deck's MECHANICAL ENGINE.
Read the deck cards' oracle texts and answer (mentally): What is the WIN CONDITION? What is the VALUE LOOP? What TRIGGERS chain together? What ZONES matter (graveyard, exile, hand)? What KEYWORDS recur (cycling, embalm, discard, sacrifice, +1/+1 counters, storm, etc.)? Identify the 2-4 cards that ARE the engine (the "pivot cards"), not just generic staples.

STEP 2 — Score EACH AND EVERY card (deck + candidates) against the engine.
For each card (deck or candidate), ask:
  • Does it FEED the engine (provides resources / triggers / zones)?
  • Does it ENABLE the engine (combos, tutors a key piece, fixes mana)?
  • Does it AMPLIFY the engine (doubles triggers, untaps, copies)?
  • Does it RECYCLE the engine (returns key pieces from graveyard / exile)?
  • Or is it just lexically/tribally similar / generic filler with no real interaction?

Scoring scale (you MUST use the full scale 0.0–1.0):
  • 0.0–0.2 = lexical false positive / wrong color / hard anti-synergy / dead card in this deck. Explicit rejection.
  • 0.2–0.4 = generic card with no real interaction with the engine — replaceable.
  • 0.4–0.6 = decent fit, fills a role but not the deck's signature plan.
  • 0.6–0.8 = strong synergy with the engine, multiple interactions.
  • 0.8–1.0 = pivot/payoff card that directly feeds, enables, amplifies or recycles the engine.

For DECK CARDS (already in the deck): the score reflects how essential the card is to the deck's plan. Low scores (0.0-0.4) mean the card is a weak link or borderline cut. SPECIAL CASE: basic lands and pure mana fixers (Sol Ring-tier fixers) — give them 0.4-0.5 with explanation "fixer générique, neutre". Do NOT penalize ramp/lands harshly for not interacting with the engine.

Output STRICT JSON ONLY, no prose, no markdown:
{
  "suggestions": [
    { "card_id": "<id>", "score": <0..1>, "role_filled": "<role or null>", "explanation": "<1-2 phrases FR>" },
    ... ONE entry per CANDIDATE ID, no duplicates, no skips ...
  ],
  "deck_evaluations": [
    { "card_id": "<id>", "score": <0..1>, "explanation": "<1-2 phrases FR — pourquoi cette carte est essentielle / utile / faible / remplaçable>" },
    ... ONE entry per DECK CARD ID, no duplicates, no skips ...
  ],
  "archetype_note": "<1 sentence FR describing the engine you identified>"
}

HARD CONSTRAINTS — your output is REJECTED if violated:
  1. suggestions.length === N (number of candidates) AND deck_evaluations.length === D (number of deck cards). Counting: there are exactly as many "id=..." lines in each section.
  2. Every ID appears EXACTLY ONCE in its corresponding array. No duplicates, no missing IDs.
  3. Even cards you find weak/irrelevant: score them 0.0–0.3 and explain why. The user wants transparency on every card, including rejected ones and weak deck cards.

Order entries in each array from highest score to lowest.`

export interface RerankInput {
  deckName: string
  format: 'vintage' | 'commander'
  detectedArchetype: string | null
  /** Mecaniques detectees automatiquement (cycling, embalm, etc.) */
  mechanicalThemes: Array<{ label: string; count: number }>
  commanders: Array<{ name: string; typeLine: string; oracleText: string | null }>
  /**
   * Cartes du deck a evaluer (chaque carte sera scoree dans `deck_evaluations`).
   * `id` est utilise comme cle de retour. `quantity` n'apparait que pour le
   * contexte LLM (la note s'applique a la copie unique).
   */
  deckCards: Array<{
    id: string
    name: string
    quantity: number
    typeLine: string
    oracleText: string | null
    primaryRole: string | null
  }>
  roleGaps: Array<{ role: CardRole; needed: number; reason?: string }>
  candidates: Array<{
    id: string
    name: string
    manaCost: string | null
    typeLine: string
    oracleText: string | null
    primaryRole: string | null
    archetypeTags: string[]
    similarityScore: number
  }>
}

const truncate = (s: string | null, max: number): string => {
  if (!s) return ''
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max - 1) + '…' : t
}

export function buildRerankUserPrompt(input: RerankInput): string {
  const cmdrSection = input.commanders.length
    ? `Commanders (read carefully — they define the engine):\n${input.commanders
        .map((c) => `- ${c.name} (${c.typeLine})\n    ${truncate(c.oracleText, 600)}`)
        .join('\n')}`
    : '(No commander — Vintage 60-card format.)'

  const mechSection = input.mechanicalThemes.length
    ? `Mechanical themes detected automatically (count = # deck cards mentioning):\n${input.mechanicalThemes
        .map((m) => `  - ${m.label} (${m.count} cards)`)
        .join('\n')}`
    : '(No specific mechanical theme detected.)'

  // Deck cards WITH oracle text snippets — capital pour identifier l'engine
  // ET pour scorer chaque carte du deck (deck_evaluations).
  const deckSummary = input.deckCards
    .map(
      (c) =>
        `- id=${c.id} | ${c.quantity}x ${c.name} | ${c.typeLine} | role=${c.primaryRole ?? '-'}\n    ${truncate(c.oracleText, 200)}`
    )
    .join('\n')

  const gaps = input.roleGaps.length
    ? input.roleGaps
        .map((g) => `  - ${g.role}: ${g.needed}${g.reason ? ` (${g.reason})` : ''}`)
        .join('\n')
    : '  - (no specific gap, optimize global synergy)'

  const candidates = input.candidates
    .map(
      (c) =>
        `- id=${c.id} | ${c.name} ${c.manaCost ?? ''} | ${c.typeLine} | role=${
          c.primaryRole ?? '-'
        } | tags=[${c.archetypeTags.join(', ')}] | sim=${c.similarityScore.toFixed(3)}\n    ${truncate(
          c.oracleText,
          280
        )}`
    )
    .join('\n')

  const N = input.candidates.length
  const D = input.deckCards.length
  const candIdList = input.candidates.map((c) => c.id).join(', ')
  const deckIdList = input.deckCards.map((c) => c.id).join(', ')

  return `Deck: ${input.deckName}
Format: ${input.format}
Detected archetype (heuristic): ${input.detectedArchetype ?? 'unknown'}

${cmdrSection}

${mechSection}

Role gaps to fill:
${gaps}

============================================================
(A) DECK CARDS TO EVALUATE — total count = ${D} (you MUST output exactly ${D} entries in deck_evaluations):
Read these to identify the ENGINE, then evaluate each card's contribution to the plan.
============================================================
${deckSummary}

REQUIRED: produce one deck_evaluations entry for each of these ${D} ids:
${deckIdList}

============================================================
(B) CANDIDATES TO SCORE — total count = ${N} (you MUST output exactly ${N} entries in suggestions):
============================================================
${candidates}

REQUIRED: produce one suggestions entry for each of these ${N} ids:
${candIdList}
============================================================

Apply STEP 1 then STEP 2 on BOTH lists. Score every entry (use 0.0–0.3 for rejections/weak deck cards, explain why). Return JSON only.`
}
