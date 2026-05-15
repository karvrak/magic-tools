import { CARD_ROLES, INTERACTION_TYPES, KNOWN_ARCHETYPES } from '../types'

/**
 * Version courante du prompt de classification.
 * BUMP cette version dans config.ts (CLASSIFICATION_VERSION) si on modifie
 * le prompt ou le schema de sortie — les cartes seront re-classifiees.
 */

const ROLES_LIST = CARD_ROLES.join(', ')
const INTERACTION_LIST = INTERACTION_TYPES.join(', ')
const ARCHETYPES_HINT = KNOWN_ARCHETYPES.slice(0, 30).join(', ')

export const CLASSIFICATION_SYSTEM_PROMPT = `You are a Magic: The Gathering expert classifier.
For each card given, you must extract structured data following the schema strictly.

Allowed values:
- primary_role: ONE of [${ROLES_LIST}]
- secondary_roles: subset (0-5) of the same enum, can be empty
- archetype_tags: free strings but prefer known tags such as: ${ARCHETYPES_HINT}. Up to 8 tags. Use snake_case. Lowercase.
- interaction_type: ONE of [${INTERACTION_LIST}]

Rules:
- primary_role is the SINGLE most defining function the card serves in a deck.
- "land" is reserved for cards whose only function is mana production via the lands type. Prefer "ramp" / "mana_fixing" for nonland mana sources.
- "removal" = single-target. Use "sweeper" for board wipes (Wrath effects).
- "finisher" = wins games when alive (Voidwinnower, Atraxa, large bombs). "threat" = pressure but not necessarily lethal alone. "lock_piece" = denies opponent's resources structurally (Blood Moon, Stasis). "hate_piece" = punishes specific strategies (Rest in Peace, Stony Silence).
- "tutor" only if the card searches the library for another card.
- archetype_tags: include strategies the card enables or strongly benefits (e.g. Doomsday → ["doomsday", "combo"]; Lightning Bolt → ["aggro", "tempo"]; Wasteland → ["stax", "lands"]).
- Output ONLY valid JSON matching the schema. No prose. No markdown fences. No comments.`

/**
 * Construit le prompt utilisateur pour un batch de cartes.
 * Le LLM doit retourner { classifications: { c0, c1, ... } }.
 *
 * On utilise des indices courts (c0, c1...) plutot que les Scryfall IDs (36
 * chars) pour reduire le bruit et le risque que le modele en oublie.
 * Le caller mappe l'index vers card.id apres parsing.
 */
export function buildClassificationUserPrompt(
  cards: Array<{
    id: string
    name: string
    typeLine: string
    manaCost: string | null
    oracleText: string | null
    keywords: string[]
  }>
): string {
  const lines = cards.map((c, i) => {
    const text = (c.oracleText ?? '').replace(/\s+/g, ' ').trim()
    const kw = c.keywords.length ? ` [keywords: ${c.keywords.join(', ')}]` : ''
    const mc = c.manaCost ? ` ${c.manaCost}` : ''
    return `c${i}: ${c.name}${mc} | ${c.typeLine}${kw}\n  ${text}`
  })

  return `Classify ALL ${cards.length} Magic cards below. You MUST include every key c0..c${cards.length - 1} in the output, no exceptions. Return strictly:
{
  "classifications": {
    "c0": { "primary_role": "...", "secondary_roles": ["..."], "archetype_tags": ["..."], "interaction_type": "..." },
    "c1": { ... },
    ...
    "c${cards.length - 1}": { ... }
  }
}

Cards:
${lines.join('\n')}`
}
