// Types for the card scanner feature

/**
 * Minimal card data for scanner matches
 */
export interface ScannerCard {
  id: string
  oracleId: string
  name: string
  printedName: string | null
  lang: string
  layout: string
  manaCost: string | null
  cmc: number
  typeLine: string
  printedTypeLine: string | null
  colors: string[]
  colorIdentity: string[]
  setCode: string
  setName: string
  collectorNumber: string
  rarity: string
  imageSmall: string | null
  imageNormal: string | null
  imageLarge: string | null
  priceEur: number | null
  priceEurFoil: number | null
}

/**
 * Represents a scanned card before it's added to the collection
 */
export interface ScannedCard {
  id: string                         // Temporary UUID for tracking
  cardId: string | null              // Scryfall ID if match found
  card: ScannerCard | null           // Card data
  extractedText: string              // Raw OCR text
  confidence: number                 // Match confidence score 0-1
  quantity: number                   // Quantity to add (default: 1)
  status: 'pending' | 'matched' | 'ambiguous' | 'not_found' | 'manual'
  candidates?: CardMatch[]           // Alternative matches if ambiguous
  imageDataUrl?: string              // Captured image preview
}

/**
 * A card match from the fuzzy search
 */
export interface CardMatch {
  card: ScannerCard
  score: number                      // Match score 0-1, 1 = perfect match
  matchedName: string                // The name that was matched
}

/**
 * Scanner state for the modal
 */
export interface ScannerState {
  mode: 'scanning' | 'reviewing' | 'submitting'
  scannedCards: ScannedCard[]
  isProcessing: boolean
  cameraReady: boolean
  error: string | null
}

/**
 * Request body for /api/scanner/match
 */
export interface ScannerMatchRequest {
  texts: string[]
}

/**
 * Response from /api/scanner/match
 */
export interface ScannerMatchResponse {
  matches: Array<{
    text: string
    results: CardMatch[]
  }>
}

/**
 * Request body for /api/collection/bulk
 */
export interface CollectionBulkRequest {
  items: Array<{
    cardId: string
    quantity: number
    condition?: string
    isFoil?: boolean
    ownerId?: string | null
  }>
}

/**
 * Response from /api/collection/bulk
 */
export interface CollectionBulkResponse {
  added: number
  updated: number
  errors: string[]
}

/**
 * Camera constraints for mobile scanning
 */
export interface CameraConfig {
  facingMode: 'environment' | 'user'
  width: { ideal: number }
  height: { ideal: number }
}

/**
 * OCR result from Tesseract.js
 */
export interface OCRResult {
  text: string
  confidence: number
  words: Array<{
    text: string
    confidence: number
    bbox: {
      x0: number
      y0: number
      x1: number
      y1: number
    }
  }>
}
