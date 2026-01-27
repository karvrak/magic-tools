// Types for Scryfall API responses

export interface ScryfallCard {
  id: string
  oracle_id: string
  illustration_id?: string  // Unique per artwork
  name: string
  printed_name?: string     // Translated name
  lang: string
  layout: string
  
  // Mana
  mana_cost?: string
  cmc: number
  
  // Types
  type_line: string
  printed_type_line?: string  // Translated type line
  
  // Text
  oracle_text?: string
  printed_text?: string       // Translated text
  flavor_text?: string
  
  // Colors
  colors?: string[]
  color_identity: string[]
  
  // Keywords
  keywords: string[]
  
  // Set info
  set: string
  set_name: string
  collector_number: string
  rarity: string
  
  // Images
  image_uris?: {
    small?: string
    normal?: string
    large?: string
    art_crop?: string
    border_crop?: string
  }
  card_faces?: Array<{
    name: string
    printed_name?: string    // Translated face name
    mana_cost?: string
    type_line?: string
    printed_type_line?: string  // Translated face type
    oracle_text?: string
    printed_text?: string    // Translated face text
    image_uris?: {
      small?: string
      normal?: string
      large?: string
      art_crop?: string
      border_crop?: string
    }
  }>
  
  // Stats
  power?: string
  toughness?: string
  loyalty?: string
  
  // Legalities
  legalities: Record<string, string>
  
  // Games
  games: string[]
  
  // Prices
  prices: {
    eur?: string | null
    eur_foil?: string | null
    usd?: string | null
    usd_foil?: string | null
    tix?: string | null
  }
  
  // Art variant detection fields
  promo?: boolean           // Is this a promo card?
  booster?: boolean         // Does this appear in boosters?
  frame_effects?: string[]  // ["showcase", "extendedart", "borderless", "inverted", ...]
  full_art?: boolean        // Full art card?
  textless?: boolean        // No text on card?
  variation?: boolean       // Is this a variation of another card?
  
  // Dates
  released_at?: string
}

export interface ScryfallBulkData {
  object: string
  has_more: boolean
  data: Array<{
    id: string
    type: string
    updated_at: string
    uri: string
    name: string
    description: string
    size: number
    download_uri: string
    content_type: string
    content_encoding: string
  }>
}

export interface CardSearchFilters {
  name?: string
  text?: string
  type?: string
  colors?: string[]
  colorIdentity?: string[]
  colorMode?: 'exact' | 'include' | 'atMost'
  cmcMin?: number
  cmcMax?: number
  cmcExact?: number
  rarity?: string[]
  set?: string
  format?: string
  priceMinEur?: number
  priceMaxEur?: number
  priceMinUsd?: number
  priceMaxUsd?: number
  keywords?: string[]
}

export interface SearchResult {
  cards: CardWithPrice[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// Type for cards with price info - uses Prisma's optional field types
export interface CardWithPrice {
  id: string
  oracleId: string
  illustrationId?: string | null
  name: string
  printedName?: string | null
  lang: string
  layout: string
  manaCost?: string | null
  cmc: number
  typeLine: string
  printedTypeLine?: string | null
  oracleText?: string | null
  printedText?: string | null
  flavorText?: string | null
  colors: string[]
  colorIdentity: string[]
  keywords: string[]
  setCode: string
  setName: string
  collectorNumber: string
  rarity: string
  imageSmall?: string | null
  imageNormal?: string | null
  imageLarge?: string | null
  imageArtCrop?: string | null
  imageBorderCrop?: string | null
  // Back face images for double-faced cards
  imageNormalBack?: string | null
  imageLargeBack?: string | null
  power?: string | null
  toughness?: string | null
  loyalty?: string | null
  legalities: Record<string, string>
  games: string[]
  // Art variant fields
  isPromo?: boolean
  isBooster?: boolean
  frameEffects?: string[]
  isFullArt?: boolean
  isTextless?: boolean
  isVariation?: boolean
  // Card-specific prices (for alt arts)
  priceEur?: number | null
  priceEurFoil?: number | null
  priceUsd?: number | null
  priceUsdFoil?: number | null
  releasedAt?: Date | null
  syncedAt: Date
  // Price from CardPrice table (fallback for oracle-level price)
  price?: {
    eur: number | null
    eurFoil: number | null
    usd: number | null
    usdFoil: number | null
    tix: number | null
  } | null
  // Search result metadata
  versionCount?: number           // Number of versions available for this card
  isReferencePrice?: boolean      // True if price comes from another version (not this specific card)
  // Minimum price across all versions (for deck optimization)
  minPriceEur?: number | null
}
