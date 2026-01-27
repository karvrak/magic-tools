import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ScannerMatchRequest, ScannerMatchResponse, ScannerCard } from '@/types/scanner'

/**
 * Normalize text for fuzzy matching
 * - lowercase
 * - remove accents
 * - remove special characters
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '')     // Keep only alphanumeric and spaces
    .trim()
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Calculate similarity score (0-1) based on Levenshtein distance
 */
function calculateSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b)
  const maxLength = Math.max(a.length, b.length)
  if (maxLength === 0) return 1
  return 1 - distance / maxLength
}

const cardSelect = {
  id: true,
  oracleId: true,
  name: true,
  printedName: true,
  nameNormalized: true,
  lang: true,
  layout: true,
  manaCost: true,
  cmc: true,
  typeLine: true,
  printedTypeLine: true,
  colors: true,
  colorIdentity: true,
  setCode: true,
  setName: true,
  collectorNumber: true,
  rarity: true,
  imageSmall: true,
  imageNormal: true,
  imageLarge: true,
  priceEur: true,
  priceEurFoil: true,
}

/**
 * POST /api/scanner/match
 * Match OCR texts to cards in the database
 * Searches both French and English cards
 */
export async function POST(request: NextRequest) {
  try {
    const body: ScannerMatchRequest = await request.json()
    const { texts } = body

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: 'texts array is required' },
        { status: 400 }
      )
    }

    // Limit to 50 texts per request
    const limitedTexts = texts.slice(0, 50)

    const matches: ScannerMatchResponse['matches'] = []

    for (const text of limitedTexts) {
      const normalizedText = normalizeText(text)

      if (normalizedText.length < 2) {
        matches.push({ text, results: [] })
        continue
      }

      // Search in both French (printedName/nameNormalized) and English (name)
      // Try exact match first
      let exactMatches = await prisma.card.findMany({
        where: {
          OR: [
            // French exact match
            { nameNormalized: normalizedText, lang: 'fr' },
            // English exact match (normalize the English name)
            { name: { equals: text, mode: 'insensitive' } },
          ],
        },
        select: cardSelect,
        take: 10,
        orderBy: [
          { lang: 'asc' }, // 'fr' comes before 'en'
          { isBooster: 'desc' },
          { priceEur: 'asc' },
        ],
      })

      // If we found English cards, try to get French versions
      if (exactMatches.length > 0) {
        const oracleIds = [...new Set(exactMatches.map(c => c.oracleId))]

        // Get French versions of these cards
        const frenchVersions = await prisma.card.findMany({
          where: {
            oracleId: { in: oracleIds },
            lang: 'fr',
          },
          select: cardSelect,
          orderBy: [
            { isBooster: 'desc' },
            { priceEur: 'asc' },
          ],
        })

        // Create a map of oracleId -> best French card
        const frenchMap = new Map<string, typeof frenchVersions[0]>()
        for (const card of frenchVersions) {
          if (!frenchMap.has(card.oracleId)) {
            frenchMap.set(card.oracleId, card)
          }
        }

        // Replace English cards with French versions where available
        const results = oracleIds.map(oracleId => {
          const frenchCard = frenchMap.get(oracleId)
          if (frenchCard) return frenchCard
          return exactMatches.find(c => c.oracleId === oracleId)!
        }).filter(Boolean)

        matches.push({
          text,
          results: results.slice(0, 5).map(card => ({
            card: card as ScannerCard,
            score: 1.0,
            matchedName: card.printedName || card.name,
          })),
        })
        continue
      }

      // Fuzzy search - search in both languages
      const words = normalizedText.split(/\s+/).filter(w => w.length >= 3)

      let fuzzyMatches: typeof exactMatches = []

      if (words.length > 0) {
        const mainWord = words[0]

        fuzzyMatches = await prisma.card.findMany({
          where: {
            OR: [
              // French fuzzy match
              { nameNormalized: { contains: mainWord }, lang: 'fr' },
              // English fuzzy match (on the English name field)
              { name: { contains: mainWord, mode: 'insensitive' } },
            ],
          },
          select: cardSelect,
          take: 100,
        })
      }

      // Score and sort results
      const scoredResults = fuzzyMatches
        .map(card => {
          // Compare against both French and English names
          const frenchNormalized = card.nameNormalized || normalizeText(card.printedName || '')
          const englishNormalized = normalizeText(card.name)

          const frenchSimilarity = frenchNormalized ? calculateSimilarity(normalizedText, frenchNormalized) : 0
          const englishSimilarity = calculateSimilarity(normalizedText, englishNormalized)

          // Take the best match
          const similarity = Math.max(frenchSimilarity, englishSimilarity)

          // Bonus for starts-with match
          const startsWithBonus =
            (frenchNormalized && frenchNormalized.startsWith(normalizedText)) ||
            englishNormalized.startsWith(normalizedText) ? 0.1 : 0

          // Bonus for same word count
          const cardWords = (frenchNormalized || englishNormalized).split(/\s+/).length
          const textWords = normalizedText.split(/\s+/).length
          const wordCountBonus = cardWords === textWords ? 0.05 : 0

          // Small bonus for French cards
          const langBonus = card.lang === 'fr' ? 0.02 : 0

          const finalScore = Math.min(1, similarity + startsWithBonus + wordCountBonus + langBonus)

          return {
            card: card as ScannerCard,
            score: finalScore,
            matchedName: card.printedName || card.name,
          }
        })
        .filter(r => r.score >= 0.5)
        .sort((a, b) => b.score - a.score)

      // Deduplicate by oracleId, preferring French cards
      const seenOracleIds = new Map<string, typeof scoredResults[0]>()
      for (const result of scoredResults) {
        const existing = seenOracleIds.get(result.card.oracleId)
        if (!existing) {
          seenOracleIds.set(result.card.oracleId, result)
        } else if (result.card.lang === 'fr' && existing.card.lang !== 'fr') {
          // Replace with French version
          seenOracleIds.set(result.card.oracleId, result)
        }
      }

      const dedupedResults = Array.from(seenOracleIds.values()).slice(0, 5)

      // If we found English cards, try to get French versions
      if (dedupedResults.length > 0 && dedupedResults.some(r => r.card.lang !== 'fr')) {
        const oracleIds = dedupedResults.map(r => r.card.oracleId)

        const frenchVersions = await prisma.card.findMany({
          where: {
            oracleId: { in: oracleIds },
            lang: 'fr',
          },
          select: cardSelect,
          orderBy: [
            { isBooster: 'desc' },
            { priceEur: 'asc' },
          ],
        })

        const frenchMap = new Map<string, typeof frenchVersions[0]>()
        for (const card of frenchVersions) {
          if (!frenchMap.has(card.oracleId)) {
            frenchMap.set(card.oracleId, card)
          }
        }

        // Replace with French versions
        for (const result of dedupedResults) {
          const frenchCard = frenchMap.get(result.card.oracleId)
          if (frenchCard) {
            result.card = frenchCard as ScannerCard
            result.matchedName = frenchCard.printedName || frenchCard.name
          }
        }
      }

      matches.push({ text, results: dedupedResults })
    }

    return NextResponse.json({ matches } satisfies ScannerMatchResponse)
  } catch (error) {
    console.error('Scanner match error:', error)
    return NextResponse.json(
      { error: 'Failed to match cards' },
      { status: 500 }
    )
  }
}
