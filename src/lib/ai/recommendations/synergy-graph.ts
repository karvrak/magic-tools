/**
 * Systeme de relations SOURCE ↔ PAYOFF.
 *
 * Une carte "source" produit un effet (creates tokens, gains life, dies, etc.).
 * Une carte "payoff" capitalise sur cet effet (deals damage on ETB, scales on
 * lifegain, triggers on death, etc.).
 *
 * Pour chaque famille de synergie on definit:
 *   - sourcePattern: regex pour detecter les sources dans le deck (et candidats)
 *   - payoffPattern: regex pour detecter les payoffs dans le deck (et candidats)
 *   - sourceFTS: pattern ILIKE pour pecher les sources dans la BDD
 *   - payoffFTS: pattern ILIKE pour pecher les payoffs dans la BDD
 *
 * Logique de boost (dans le retrieval):
 *  - Si le deck a beaucoup de payoffs et peu de sources → on suggere des
 *    sources fortes (le deck a des payoffs sous-utilises).
 *  - Si le deck a beaucoup de sources et peu de payoffs → on suggere des
 *    payoffs.
 *  - Si les deux sont presents → on boost les candidats qui sont AU CENTRE
 *    de la chaine (source ET payoff combinees, ex: Voice of Victory qui cree
 *    des tokens = source ETB ET token-spawn-on-attack).
 *  - Score multiplier: pour un candidat qui est SOURCE alors que le deck
 *    a 5+ payoffs de la meme famille → boost x1.5 sur sa similarite.
 */

export interface SynergyChain {
  family: string
  label: string
  sourcePattern: RegExp
  payoffPattern: RegExp
  /** ILIKE pour pool: cherche les SOURCES (pour combler manque de sources). */
  sourceFTS: string
  /** ILIKE pour pool: cherche les PAYOFFS (pour combler manque de payoffs). */
  payoffFTS: string
}

export const SYNERGY_CHAINS: SynergyChain[] = [
  {
    family: 'token_etb',
    label: 'token creation → ETB damage / +1 effects',
    sourcePattern:
      /\bcreate (a|an|x|two|three|four|five|six|that many|\d+).{0,30}\btokens?\b/i,
    payoffPattern:
      /\bwhenever\s+(?:\w+\s+)?(?:another\s+)?(creature|permanent|token).{0,40}\benters?\b/i,
    sourceFTS: '%create%token%',
    payoffFTS: '%whenever%creature%enters%',
  },
  {
    family: 'lifegain',
    label: 'gain life → +1/+1 / damage',
    sourcePattern: /\b(you\s+gain\s+\w+\s+lif(e|ves)|\blifelink\b)/i,
    payoffPattern: /\bwhenever\s+you\s+gain\s+life\b/i,
    sourceFTS: '%you gain%life%',
    payoffFTS: '%whenever you gain life%',
  },
  {
    family: 'creature_death',
    label: 'creature dies → death triggers (Blood Artist style)',
    sourcePattern:
      /\b(sacrifice (a|an|another|target)?\s*(creature|permanent)|creatures? (you control )?dies?)\b/i,
    payoffPattern:
      /\bwhenever\s+(a |another )?creature\b.{0,15}\bdies\b/i,
    sourceFTS: '%sacrifice%creature%',
    payoffFTS: '%whenever%creature%dies%',
  },
  {
    family: 'attack',
    label: 'attack triggers (Hellrider / Mobilize)',
    sourcePattern: /\battacks? (with|alone|each)?\b/i,
    payoffPattern: /\bwhenever\s+(?:\w+\s+)?(creature|\w+)\s+attacks?\b/i,
    sourceFTS: '%attacks%',
    payoffFTS: '%whenever%attacks%',
  },
  {
    family: 'discard',
    label: 'discard → discard payoffs (Drake Haven)',
    sourcePattern: /\b(cycling|discard\s+(a|your))/i,
    payoffPattern: /\bwhenever\s+(?:you\s+)?(discard|cycle)/i,
    sourceFTS: '%cycling%',
    payoffFTS: '%whenever you discard%',
  },
  {
    family: 'graveyard',
    label: 'mill / dies → graveyard payoffs (Reanimator)',
    sourcePattern:
      /\b(mill|put.{0,20}graveyard|enters? (a |the )?graveyard)\b/i,
    payoffPattern:
      /\b(return|cast|play).{0,40}from\b.{0,15}graveyard\b/i,
    sourceFTS: '%into%graveyard%',
    payoffFTS: '%from%graveyard%battlefield%',
  },
  {
    family: 'damage_each_opp',
    label: 'damage to each opponent (Punisher payoff with Axonil)',
    sourcePattern:
      /\b(deals?|inflict).{0,20}\bdamage\s+to\s+each\s+opponent\b/i,
    payoffPattern:
      /\b(damage you would deal|damage\s+\w+\s+would\s+deal).{0,30}\b(more|equal)\b/i,
    sourceFTS: '%damage to each opponent%',
    payoffFTS: '%instead deals%damage%',
  },
  {
    family: 'plus_counter',
    label: '+1/+1 counters → counter payoffs',
    sourcePattern: /\+1\/\+1\s*counter/i,
    payoffPattern:
      /\bwhenever\s+(?:a |another )?\w+\s+(creature|permanent).{0,40}\+1\/\+1/i,
    sourceFTS: '%+1/+1 counter%',
    payoffFTS: '%whenever%+1/+1%',
  },
]

export interface ChainStats {
  family: string
  label: string
  sourceCount: number
  payoffCount: number
  /** Indique si le deck a "besoin" de sources ou payoffs. */
  recommendation: 'need_source' | 'need_payoff' | 'balanced' | 'absent'
}

/**
 * Analyse la presence de chaque chaine source/payoff dans le deck.
 * Renvoie les chaines actives avec leurs counts pour orienter le retrieval.
 */
export function analyzeSynergyChains(
  deckCards: Array<{ oracleText: string | null; quantity: number }>
): ChainStats[] {
  const out: ChainStats[] = []
  for (const chain of SYNERGY_CHAINS) {
    let sourceCount = 0
    let payoffCount = 0
    for (const c of deckCards) {
      const txt = c.oracleText ?? ''
      if (!txt) continue
      if (chain.sourcePattern.test(txt)) sourceCount += c.quantity
      if (chain.payoffPattern.test(txt)) payoffCount += c.quantity
    }
    if (sourceCount === 0 && payoffCount === 0) continue
    let recommendation: ChainStats['recommendation']
    if (sourceCount === 0) recommendation = 'absent'
    else if (payoffCount === 0) recommendation = 'need_payoff'
    else if (sourceCount >= payoffCount * 2) recommendation = 'need_payoff'
    else if (payoffCount >= sourceCount * 2) recommendation = 'need_source'
    else recommendation = 'balanced'
    out.push({
      family: chain.family,
      label: chain.label,
      sourceCount,
      payoffCount,
      recommendation,
    })
  }
  return out
}

/**
 * Retourne le score multiplier d'une carte par rapport a la courbe de mana du
 * deck. Une carte CMC 5 dans un deck avgCmc 2 prend penalty x0.6.
 *
 * Formule: 1 / (1 + 0.18 * abs(cardCmc - deckAvg))
 *  - cardCmc = deckAvg → multiplier = 1.0 (parfait)
 *  - diff 1 → 0.85
 *  - diff 2 → 0.74
 *  - diff 3 → 0.65 (5cmc dans deck avgCmc 2)
 *  - diff 5 → 0.53
 *  - les terres (cmc 0) ont un multiplier identique aux autres — la pipeline
 *    les exclut deja du scoring courbe.
 */
export function curveFitMultiplier(cardCmc: number, deckAvgCmc: number): number {
  const diff = Math.abs((cardCmc || 0) - (deckAvgCmc || 0))
  return 1 / (1 + 0.18 * diff)
}

/**
 * Test une carte contre toutes les chaines actives du deck et retourne le
 * nombre de chaines matchees (en source OU payoff). Utilise pour identifier
 * les cartes "multi-chaine" qui sont des signatures fortes meme si leur
 * embedding est lexicalement eloigne du centroide.
 */
export function countChainMatches(
  oracleText: string | null,
  activeChains: ChainStats[]
): { sourceMatches: string[]; payoffMatches: string[] } {
  const out = { sourceMatches: [] as string[], payoffMatches: [] as string[] }
  if (!oracleText) return out
  for (const stat of activeChains) {
    const def = SYNERGY_CHAINS.find((c) => c.family === stat.family)
    if (!def) continue
    if (def.sourcePattern.test(oracleText)) out.sourceMatches.push(stat.family)
    if (def.payoffPattern.test(oracleText)) out.payoffMatches.push(stat.family)
  }
  return out
}
