import { ScryfallBulkData, ScryfallCard } from '@/types/scryfall'
import { createWriteStream, createReadStream, unlinkSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { parser } from 'stream-json'
import { streamArray } from 'stream-json/streamers/StreamArray'

const SCRYFALL_BULK_API = 'https://api.scryfall.com/bulk-data'
const TEMP_DIR = './temp'

export type BulkDataType = 'all_cards' | 'oracle_cards' | 'default_cards'

export interface BulkDataInfo {
  type: string
  downloadUri: string
  updatedAt: string
  size: number
}

/**
 * Fetches the bulk data metadata from Scryfall
 */
export async function getBulkDataInfo(type: BulkDataType): Promise<BulkDataInfo | null> {
  try {
    const response = await fetch(SCRYFALL_BULK_API, {
      headers: {
        'User-Agent': 'magicTools/1.0',
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch bulk data info: ${response.status}`)
    }

    const data: ScryfallBulkData = await response.json()
    const bulkFile = data.data.find((d) => d.type === type)

    if (!bulkFile) {
      return null
    }

    return {
      type: bulkFile.type,
      downloadUri: bulkFile.download_uri,
      updatedAt: bulkFile.updated_at,
      size: bulkFile.size,
    }
  } catch (error) {
    console.error('Error fetching bulk data info:', error)
    throw error
  }
}

/**
 * Download file to local disk with progress
 */
async function downloadToFile(url: string, filePath: string, totalSize: number): Promise<void> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'magicTools/1.0' },
  })

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download: ${response.status}`)
  }

  // Ensure temp directory exists
  const dir = path.dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const fileStream = createWriteStream(filePath)
  const reader = response.body.getReader()
  
  let downloaded = 0
  let lastLog = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      fileStream.write(Buffer.from(value))
      downloaded += value.length

      // Log progress every 5%
      const percent = Math.floor((downloaded / totalSize) * 100)
      if (percent >= lastLog + 5) {
        console.log(`[BULK] Download progress: ${percent}% (${Math.round(downloaded / 1024 / 1024)}MB / ${Math.round(totalSize / 1024 / 1024)}MB)`)
        lastLog = percent
      }
    }
  } finally {
    fileStream.end()
  }
  
  // Wait for file to be fully written
  await new Promise<void>((resolve, reject) => {
    fileStream.on('finish', resolve)
    fileStream.on('error', reject)
  })
  
  console.log(`[BULK] Download complete: ${filePath}`)
}

/**
 * Cleanup temp file
 */
export function cleanupTempFile(type: BulkDataType): void {
  const filePath = path.join(TEMP_DIR, `${type}.json`)
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath)
      console.log(`[BULK] Cleaned up temp file: ${filePath}`)
    }
  } catch (e) {
    console.warn(`[BULK] Failed to cleanup temp file: ${e}`)
  }
}

/**
 * Downloads bulk data and returns path to temp file
 * If skipIfExists is true and file exists, skips download
 */
export async function downloadBulkData(type: BulkDataType, skipIfExists: boolean = false): Promise<string> {
  const filePath = path.join(TEMP_DIR, `${type}.json`)
  
  // Check if file already exists and skip download if requested
  if (skipIfExists && existsSync(filePath)) {
    console.log(`[BULK] File already exists, skipping download: ${filePath}`)
    return filePath
  }
  
  console.log(`[BULK] Starting download of ${type}...`)
  
  const info = await getBulkDataInfo(type)
  if (!info) {
    throw new Error(`Bulk data type ${type} not found`)
  }

  console.log(`[BULK] Downloading from ${info.downloadUri} (${Math.round(info.size / 1024 / 1024)}MB)`)

  await downloadToFile(info.downloadUri, filePath, info.size)
  
  return filePath
}

/**
 * Stream parse JSON file, yielding batches
 */
export async function* streamJsonFile(
  filePath: string,
  batchSize: number = 1000
): AsyncGenerator<ScryfallCard[], void, unknown> {
  console.log(`[BULK] Opening file for streaming: ${filePath}`)
  
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const fileStream = createReadStream(filePath)
  const jsonStream = fileStream.pipe(parser()).pipe(streamArray())

  console.log(`[BULK] Starting JSON stream parsing...`)

  let batch: ScryfallCard[] = []
  let count = 0
  let yieldCount = 0

  try {
    for await (const { value } of jsonStream) {
      batch.push(value as ScryfallCard)
      count++

      if (batch.length >= batchSize) {
        yieldCount++
        yield batch
        batch = []
        
        if (count % 100000 === 0) {
          console.log(`[BULK] Parsed ${count} items, yielded ${yieldCount} batches...`)
        }
      }
    }

    if (batch.length > 0) {
      yieldCount++
      yield batch
    }

    console.log(`[BULK] Finished parsing: ${count} items total in ${yieldCount} batches`)
  } catch (error) {
    console.error(`[BULK] Error during JSON parsing:`, error)
    throw error
  } finally {
    // Make sure file stream is closed
    fileStream.destroy()
  }
}

/**
 * Normalize a string for search: lowercase + remove diacritics (accents)
 * "Séance" -> "seance", "Éléphant" -> "elephant"
 */
export function normalizeForSearch(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
}

/**
 * Type for transformed card data ready for database insertion
 */
export interface TransformedCard {
  id: string
  oracleId: string
  illustrationId: string | null
  name: string
  printedName: string | null
  nameNormalized: string | null
  lang: string
  layout: string
  manaCost: string | null
  cmc: number
  typeLine: string
  printedTypeLine: string | null
  oracleText: string | null
  printedText: string | null
  flavorText: string | null
  colors: string[]
  colorIdentity: string[]
  keywords: string[]
  setCode: string
  setName: string
  collectorNumber: string
  rarity: string
  imageSmall: string | null
  imageNormal: string | null
  imageLarge: string | null
  imageArtCrop: string | null
  imageBorderCrop: string | null
  imageNormalBack: string | null
  imageLargeBack: string | null
  power: string | null
  toughness: string | null
  loyalty: string | null
  legalities: Record<string, string>
  games: string[]
  isPromo: boolean
  isBooster: boolean
  frameEffects: string[]
  isFullArt: boolean
  isTextless: boolean
  isVariation: boolean
  priceEur: number | null
  priceEurFoil: number | null
  priceUsd: number | null
  priceUsdFoil: number | null
  releasedAt: Date | null
  syncedAt: Date
}

/**
 * Transform Scryfall card to our database format
 */
export function transformCard(card: ScryfallCard): TransformedCard {
  // Handle double-faced cards - get images from card_faces if not on main card
  let imageSmall = card.image_uris?.small
  let imageNormal = card.image_uris?.normal
  let imageLarge = card.image_uris?.large
  let imageArtCrop = card.image_uris?.art_crop
  let imageBorderCrop = card.image_uris?.border_crop
  
  // Back face images for double-faced cards
  let imageNormalBack: string | null = null
  let imageLargeBack: string | null = null

  // For double-faced cards, get front face images if not on main card
  if (!imageSmall && card.card_faces?.[0]?.image_uris) {
    imageSmall = card.card_faces[0].image_uris.small
    imageNormal = card.card_faces[0].image_uris.normal
    imageLarge = card.card_faces[0].image_uris.large
    imageArtCrop = card.card_faces[0].image_uris.art_crop
    imageBorderCrop = card.card_faces[0].image_uris.border_crop
  }
  
  // Get back face images if available (for transform, modal_dfc, etc.)
  if (card.card_faces?.[1]?.image_uris) {
    imageNormalBack = card.card_faces[1].image_uris.normal || null
    imageLargeBack = card.card_faces[1].image_uris.large || null
  }

  // Parse prices from Scryfall (stored per card, not per oracle)
  const priceEur = card.prices?.eur ? parseFloat(card.prices.eur) : null
  const priceEurFoil = card.prices?.eur_foil ? parseFloat(card.prices.eur_foil) : null
  const priceUsd = card.prices?.usd ? parseFloat(card.prices.usd) : null
  const priceUsdFoil = card.prices?.usd_foil ? parseFloat(card.prices.usd_foil) : null

  // Build normalized name for fast search
  // Include: main printed_name, main name, AND all face names (for double-faced cards)
  const nameParts: string[] = []
  
  // Add main card names
  if (card.printed_name) nameParts.push(card.printed_name)
  if (card.name) nameParts.push(card.name)
  
  // Add individual face names for double-faced cards (important for FR search!)
  // E.g., "Moine des cimes // Clairière de la crête" - we want to find "Moine des cimes"
  if (card.card_faces) {
    for (const face of card.card_faces) {
      if (face.printed_name) nameParts.push(face.printed_name)
      if (face.name && face.name !== card.name) nameParts.push(face.name)
    }
  }
  
  const nameNormalized = nameParts.map(n => normalizeForSearch(n)).join(' ')

  return {
    id: card.id,
    oracleId: card.oracle_id,
    illustrationId: card.illustration_id || null,
    name: card.name,
    printedName: card.printed_name || null,
    nameNormalized,
    lang: card.lang,
    layout: card.layout,
    manaCost: card.mana_cost || null,
    cmc: card.cmc || 0,
    typeLine: card.type_line,
    printedTypeLine: card.printed_type_line || null,
    oracleText: card.oracle_text || null,
    printedText: card.printed_text || null,
    flavorText: card.flavor_text || null,
    colors: card.colors || [],
    colorIdentity: card.color_identity || [],
    keywords: card.keywords || [],
    setCode: card.set,
    setName: card.set_name,
    collectorNumber: card.collector_number,
    rarity: card.rarity,
    imageSmall: imageSmall || null,
    imageNormal: imageNormal || null,
    imageLarge: imageLarge || null,
    imageArtCrop: imageArtCrop || null,
    imageBorderCrop: imageBorderCrop || null,
    imageNormalBack,
    imageLargeBack,
    power: card.power || null,
    toughness: card.toughness || null,
    loyalty: card.loyalty || null,
    legalities: card.legalities || {},
    games: card.games || [],
    // Art variant detection fields
    isPromo: card.promo ?? false,
    isBooster: card.booster ?? true,
    frameEffects: card.frame_effects || [],
    isFullArt: card.full_art ?? false,
    isTextless: card.textless ?? false,
    isVariation: card.variation ?? false,
    // Card-specific prices (important for alt art pricing!)
    priceEur,
    priceEurFoil,
    priceUsd,
    priceUsdFoil,
    releasedAt: card.released_at ? new Date(card.released_at) : null,
    syncedAt: new Date(),
  }
}

/**
 * Transform Scryfall card to price format
 */
export function transformPrice(card: ScryfallCard) {
  return {
    oracleId: card.oracle_id,
    eur: card.prices?.eur ? parseFloat(card.prices.eur) : null,
    eurFoil: card.prices?.eur_foil ? parseFloat(card.prices.eur_foil) : null,
    usd: card.prices?.usd ? parseFloat(card.prices.usd) : null,
    usdFoil: card.prices?.usd_foil ? parseFloat(card.prices.usd_foil) : null,
    tix: card.prices?.tix ? parseFloat(card.prices.tix) : null,
    updatedAt: new Date(),
  }
}
