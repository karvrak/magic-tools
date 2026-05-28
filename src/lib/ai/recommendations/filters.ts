import { Prisma } from '@prisma/client'
import type { SupportedFormat } from '../types'

/**
 * Filtres deterministes appliques en SQL avant le vector search.
 *
 * Tout ce qui peut etre filtre proprement par les colonnes Postgres
 * (legalite, color identity, exclusion deck, possession) doit l'etre ici.
 * Le vector search ne se charge QUE de la similarite semantique.
 */

export interface DeterministicFilterContext {
  format: SupportedFormat
  /** Color identity du deck (commander color identity en EDH; toutes en Vintage). */
  colorIdentity: readonly string[]
  /** card.id (Scryfall ID per-printing) deja dans le deck — exclus. */
  excludedCardIds: readonly string[]
  /** oracleId deja dans le deck — exclus (car singleton EDH + dedup printings). */
  excludedOracleIds: readonly string[]
  /** Si true, ne retourner que les cartes possedees par l'owner du deck. */
  ownedOnly: boolean
  /** Owner ID du deck (si ownedOnly). */
  ownerId: string | null
  /**
   * Filtre rarete: si non vide, la carte doit appartenir a une de ces raretes
   * (common, uncommon, rare, mythic). Choix utilisateur depuis l'UI.
   */
  rarities?: readonly string[]
  /**
   * Prix max en EUR (TCG/Scryfall). Si defini, exclut les cartes sans prix
   * connu OU dont priceEur > priceMaxEur. Utile pour les budget builds.
   */
  priceMaxEur?: number | null
}

/**
 * Construit la clause WHERE applicable a "Card" pour les filtres deterministes.
 * Renvoie un fragment SQL Prisma assemblable dans une requete plus large.
 */
export function buildDeterministicWhere(
  ctx: DeterministicFilterContext
): Prisma.Sql {
  const conditions: Prisma.Sql[] = []

  // 1. Legalite format (champ Scryfall: legalities JSON).
  if (ctx.format === 'commander') {
    // En Commander, la carte doit etre "legal" (ou "restricted" qui n'existe pas
    // pour Commander mais on accepte tout sauf banned/not_legal).
    conditions.push(
      Prisma.sql`(c."legalities"->>'commander') IN ('legal', 'restricted')`
    )
  } else {
    // Vintage: legal OR restricted (restricted = 1 copie autorisee).
    conditions.push(
      Prisma.sql`(c."legalities"->>'vintage') IN ('legal', 'restricted')`
    )
  }

  // 2. Color identity stricte en Commander (subset de la color identity du deck).
  if (ctx.format === 'commander') {
    if (ctx.colorIdentity.length === 0) {
      // Deck colorless: la color identity de la carte doit etre vide.
      conditions.push(
        Prisma.sql`array_length(c."colorIdentity", 1) IS NULL`
      )
    } else {
      const colors = ctx.colorIdentity as readonly string[]
      // Toutes les couleurs de la carte doivent etre dans la color identity du deck.
      // Postgres: c.colorIdentity <@ ARRAY['W','U']
      conditions.push(
        Prisma.sql`c."colorIdentity" <@ ${colors}::text[]`
      )
    }
  }
  // Vintage: pas de color identity stricte.

  // 3. Exclusion des cartes deja dans le deck (par oracleId — couvre toutes printings).
  if (ctx.excludedOracleIds.length > 0) {
    conditions.push(
      Prisma.sql`c."oracleId" NOT IN (${Prisma.join(ctx.excludedOracleIds)})`
    )
  }

  // 4. Doit avoir un embedding (pour le vector search).
  conditions.push(Prisma.sql`c."embedding" IS NOT NULL`)

  // 5. Pas de cartes "isVariation" / textless / promo speciale (bruit visuel
  // sur les recommandations: on prefere la version standard d'une carte).
  conditions.push(Prisma.sql`c."isTextless" = false`)
  conditions.push(Prisma.sql`c."isVariation" = false`)

  // 6. Ownership: filtrer sur la collection de l'owner du deck.
  if (ctx.ownedOnly && ctx.ownerId) {
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1
        FROM "CollectionItem" ci
        JOIN "Card" c2 ON c2."id" = ci."cardId"
        WHERE ci."ownerId" = ${ctx.ownerId}
          AND c2."oracleId" = c."oracleId"
      )`
    )
  }

  // 7. Rarete: liste blanche optionnelle (common/uncommon/rare/mythic).
  if (ctx.rarities && ctx.rarities.length > 0) {
    const rarities = ctx.rarities as readonly string[]
    conditions.push(Prisma.sql`c."rarity" IN (${Prisma.join(rarities)})`)
  }

  // 8. Prix max EUR: une carte sans priceEur est exclue (on ne peut pas garantir
  //    qu'elle respecte le budget). Pour les budget builds, c'est l'effet voulu.
  if (typeof ctx.priceMaxEur === 'number' && ctx.priceMaxEur >= 0) {
    conditions.push(
      Prisma.sql`c."priceEur" IS NOT NULL AND c."priceEur" <= ${ctx.priceMaxEur}`
    )
  }

  return conditions.length > 0
    ? Prisma.sql`${Prisma.join(conditions, ' AND ')}`
    : Prisma.sql`TRUE`
}
