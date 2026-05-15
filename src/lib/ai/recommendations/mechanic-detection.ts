/**
 * Detection des "themes mecaniques" d'un deck via analyse des oracle texts.
 *
 * On cherche des keywords / patterns recurrents qui revelent le moteur du deck:
 * cycling, embalm, eternalize, discard, graveyard recursion, sacrifice, etc.
 *
 * Resultat utilise pour:
 *   1) injecter dans le prompt rerank ("voici le moteur du deck")
 *   2) elargir le pool de candidats par recherche FTS sur ces mots-cles
 */

export interface MechanicalTheme {
  /** Cle interne (utilisee pour la recherche FTS, lowercase, simple). */
  keyword: string
  /** Label francais affiche dans le prompt LLM. */
  label: string
  /** Pattern pour detecter dans l'oracle text d'une carte du deck. */
  detectPattern: RegExp
  /** Pattern pour la recherche FTS Postgres (oracleText ILIKE '%...%'). */
  searchPattern: string
}

const ALL_MECHANICS: MechanicalTheme[] = [
  // Mecaniques de keyword explicites (Scryfall keyword)
  {
    keyword: 'cycling',
    label: 'cycling (defausser pour piocher)',
    detectPattern: /\bcycling\b/i,
    searchPattern: '%cycling%',
  },
  {
    keyword: 'embalm',
    label: 'embalm (creer une copie blanche depuis le cimetiere)',
    detectPattern: /\bembalm\b/i,
    searchPattern: '%embalm%',
  },
  {
    keyword: 'eternalize',
    label: 'eternalize (creer une copie 4/4 noire depuis le cimetiere)',
    detectPattern: /\beternalize\b/i,
    searchPattern: '%eternalize%',
  },
  {
    keyword: 'flashback',
    label: 'flashback (rejouer depuis le cimetiere)',
    detectPattern: /\bflashback\b/i,
    searchPattern: '%flashback%',
  },
  {
    keyword: 'dredge',
    label: 'dredge (rendre des cartes en cimetiere)',
    detectPattern: /\bdredge\b/i,
    searchPattern: '%dredge%',
  },
  {
    keyword: 'storm',
    label: 'storm (copier par sort precedent)',
    detectPattern: /\bstorm\b/i,
    searchPattern: '%storm%',
  },
  {
    keyword: 'madness',
    label: 'madness (jouer depuis la defausse)',
    detectPattern: /\bmadness\b/i,
    searchPattern: '%madness%',
  },
  {
    keyword: 'unearth',
    label: 'unearth (rejouer depuis le cimetiere)',
    detectPattern: /\bunearth\b/i,
    searchPattern: '%unearth%',
  },
  {
    keyword: 'escape',
    label: 'escape (echapper du cimetiere)',
    detectPattern: /\bescape\b/i,
    searchPattern: '%escape%',
  },
  {
    keyword: 'cascade',
    label: 'cascade (lancer un sort gratuit)',
    detectPattern: /\bcascade\b/i,
    searchPattern: '%cascade%',
  },
  {
    keyword: 'affinity',
    label: 'affinity (cout reduit)',
    detectPattern: /\baffinity\b/i,
    searchPattern: '%affinity%',
  },

  // Themes par triggers/effets (pas un keyword formel)
  {
    keyword: 'discard_matters',
    label: 'discard matters (triggers a la defausse)',
    detectPattern:
      /\b(whenever|when|if).{0,30}\b(discard|cycl(es?|ing))/i,
    searchPattern: '%discard%',
  },
  {
    keyword: 'graveyard_play',
    label: 'graveyard play (jouer depuis le cimetiere)',
    detectPattern:
      /\b(may )?(play|cast).{0,30}\bfrom\b.{0,15}graveyard\b/i,
    searchPattern: '%from your graveyard%',
  },
  {
    keyword: 'reanimate',
    label: 'reanimator (retour direct des creatures)',
    detectPattern:
      /\breturn\b.{0,40}\bcreature\b.{0,40}\bgraveyard\b.{0,40}\b(battlefield|play)\b/i,
    searchPattern: '%return%creature%graveyard%battlefield%',
  },
  {
    keyword: 'sacrifice',
    label: 'sacrifice outlets (sacrifice des creatures)',
    detectPattern: /\bsacrifice (a|another|target)?\s*(creature|permanent|artifact|token)\b/i,
    searchPattern: '%sacrifice%creature%',
  },
  {
    keyword: 'tokens',
    label: 'tokens (creer des jetons)',
    detectPattern: /\bcreate (a|an|x|two|three|that many|\d+).{0,30}\btoken\b/i,
    searchPattern: '%create%token%',
  },
  {
    keyword: 'plus_counters',
    label: '+1/+1 counters matters',
    detectPattern: /\+1\/\+1\s*counter/i,
    searchPattern: '%+1/+1 counter%',
  },
  {
    keyword: 'minus_counters',
    label: '-1/-1 counters matters',
    detectPattern: /-1\/-1\s*counter/i,
    searchPattern: '%-1/-1 counter%',
  },
  {
    keyword: 'land_recursion',
    label: 'play lands from graveyard (Ramunap-style)',
    detectPattern: /\bplay\s+lands?\s+from\s+(your\s+)?graveyard\b/i,
    searchPattern: '%play%lands%from%graveyard%',
  },
  {
    keyword: 'mill',
    label: 'mill / self-mill',
    detectPattern:
      /\b(mill|put.{0,30}top.{0,15}library.{0,15}graveyard)\b/i,
    searchPattern: '%mill%',
  },
  {
    keyword: 'tutor',
    label: 'tutor (chercher dans la bibliotheque)',
    detectPattern: /\bsearch\s+your\s+library\s+for\b/i,
    searchPattern: '%search your library%',
  },
  {
    keyword: 'counterspell',
    label: 'counterspells',
    detectPattern: /\bcounter\s+target\s+(spell|noncreature)/i,
    searchPattern: '%counter target%',
  },
  {
    keyword: 'no_max_hand',
    label: 'no maximum hand size',
    detectPattern: /\bno\s+maximum\s+hand\s+size\b/i,
    searchPattern: '%no maximum hand size%',
  },
  {
    keyword: 'extra_draws',
    label: 'extra card draws per turn (Anvil-style)',
    detectPattern: /\bdraws?\b.{0,30}\b(an additional|two additional|extra)\b.{0,40}\bcards?\b/i,
    searchPattern: '%draws an additional card%',
  },
  {
    keyword: 'cards_in_hand_matter',
    label: 'cards in hand matter (Triskaidekaphile-style)',
    detectPattern:
      /(\bif\s+you\s+have\s+\w+\s+or\s+more\s+cards?\s+in\s+(your\s+)?hand|\bnumber\s+of\s+cards?\s+in\s+(your\s+)?hand|\bexactly\s+\w+\s+cards?\s+in\s+(your\s+)?hand)\b/i,
    searchPattern: '%cards in your hand%',
  },
  {
    keyword: 'wheel',
    label: 'wheel effects (discard + redraw)',
    detectPattern:
      /\b(each\s+player\s+draws|discard\s+your\s+hand,\s+then\s+draws?\s+\w+\s+cards)\b/i,
    searchPattern: '%discard your hand%',
  },
  {
    keyword: 'etb_damage',
    label: 'creature ETB → direct damage (Impact Tremors / Purphoros style)',
    // Tolere les articles ("a creature", "another creature", "the creature").
    detectPattern:
      /\bwhenever\s+(?:\w+\s+)?(creature|permanent).{0,30}\benters?\b.{0,80}\b(deals?\s+\d|damage)\b/i,
    searchPattern: '%creature%enters%deals%damage%',
  },
  {
    keyword: 'creature_enter_trigger',
    label: 'creature ETB triggers (Impact Tremors style)',
    detectPattern:
      /\bwhenever\s+(?:\w+\s+)?(creature|permanent).{0,15}\benters?\b/i,
    searchPattern: '%whenever%creature%enters%',
  },
  {
    keyword: 'attack_trigger',
    label: 'attack triggers (Hellrider style)',
    detectPattern:
      /\bwhenever\s+(?:\w+\s+)?(creature|\w+)\s+attacks?\b/i,
    searchPattern: '%whenever%attacks%',
  },
  {
    keyword: 'lifegain_matters',
    label: 'lifegain payoffs (Soul Sisters style)',
    detectPattern: /\bwhenever\s+you\s+gain\s+life\b/i,
    searchPattern: '%whenever you gain life%',
  },
  {
    keyword: 'lifegain_source',
    // Detection des SOURCES de gain de vie (Warleader's Call, Soul Warden,
    // tout ce qui dit "you gain X life" ou a lifelink).
    // searchPattern = INVERSE: on cherche les PAYOFFS pour ces sources
    // (Voice of the Blessed, Ajani's Pridemate, Vito, Karlov, etc.)
    label: 'lifegain sources (deck makes life → suggest payoffs)',
    detectPattern: /\b(you\s+gain\s+\w+\s+lif(e|ves)|\blifelink\b)/i,
    searchPattern: '%whenever you gain life%',
  },
  {
    keyword: 'opponent_damage_each_turn',
    label: 'damage each opponent (Punisher style)',
    detectPattern: /\b(deals?|inflict).{0,20}\bdamage\s+to\s+each\s+opponent\b/i,
    searchPattern: '%damage to each opponent%',
  },
]

export interface DetectedTheme {
  keyword: string
  label: string
  count: number
  searchPattern: string
}

/**
 * Analyse les cartes d'un deck et retourne les themes mecaniques significatifs
 * (>= MIN_DECK_OCCURRENCES cartes du deck les exposent).
 */
export function detectDeckMechanics(
  deckCards: Array<{ oracleText: string | null; quantity: number }>,
  options: { minOccurrences?: number; topN?: number } = {}
): DetectedTheme[] {
  // 2 = sensible aux pivots singletons (Triskaidekaphile x2, Reliquary Tower x1
  // + Anvil x1, etc.) qui sont des marqueurs forts d'archetype.
  const minOccurrences = options.minOccurrences ?? 2
  const topN = options.topN ?? 8
  const counts = new Map<string, number>()

  for (const m of ALL_MECHANICS) counts.set(m.keyword, 0)
  for (const c of deckCards) {
    const text = c.oracleText ?? ''
    if (!text) continue
    for (const m of ALL_MECHANICS) {
      if (m.detectPattern.test(text)) {
        counts.set(m.keyword, (counts.get(m.keyword) ?? 0) + c.quantity)
      }
    }
  }
  const themes: DetectedTheme[] = []
  for (const m of ALL_MECHANICS) {
    const count = counts.get(m.keyword) ?? 0
    if (count >= minOccurrences) {
      themes.push({
        keyword: m.keyword,
        label: m.label,
        count,
        searchPattern: m.searchPattern,
      })
    }
  }
  themes.sort((a, b) => b.count - a.count)
  return themes.slice(0, topN)
}
