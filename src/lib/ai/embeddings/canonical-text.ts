import { createHash } from 'node:crypto'

/**
 * Construit le texte canonique a embedder pour une carte.
 * On embarque les champs qui portent du signal semantique pour la recherche
 * de synergies. Les sets, prix, illustrations sont volontairement exclus.
 *
 * Le texte est canonicalise (whitespace normalise) pour que le hash soit
 * stable face a des differences cosmetiques.
 */
export interface CanonicalCardInput {
  name: string
  typeLine: string
  oracleText: string | null
  manaCost: string | null
  keywords: string[]
  cardTypes?: string[]
}

export function buildCanonicalText(card: CanonicalCardInput): string {
  const parts: string[] = []
  parts.push(`Name: ${card.name}`)
  if (card.manaCost) parts.push(`Mana: ${card.manaCost}`)
  parts.push(`Type: ${card.typeLine}`)
  if (card.keywords.length) {
    parts.push(`Keywords: ${[...card.keywords].sort().join(', ')}`)
  }
  if (card.oracleText) {
    parts.push(`Text: ${card.oracleText}`)
  }
  return parts
    .join('\n')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Hash SHA-256 (hex) du texte canonique. Utilise pour detecter les errata
 * et eviter les re-embeddings inutiles.
 */
export function hashCanonicalText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}
