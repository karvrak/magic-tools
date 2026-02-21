import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { importDecklistSchema } from '@/lib/validations'

interface ParsedLine {
  quantity: number
  name: string
  category: string
}

interface ImportResult {
  found: { name: string; quantity: number; cardId: string }[]
  notFound: string[]
  duplicates: string[]
}

// Parse decklist text into structured data
// Supports formats:
// - "4 Lightning Bolt"
// - "4x Lightning Bolt"
// - "Lightning Bolt" (quantity = 1)
// - Sections: "// Sideboard" or "SB:" prefix
function parseDecklist(text: string): ParsedLine[] {
  const lines = text.split('\n')
  const result: ParsedLine[] = []
  let currentCategory = 'mainboard'

  for (const line of lines) {
    const trimmed = line.trim()
    
    // Skip empty lines
    if (!trimmed) continue

    // Check for category markers
    if (trimmed.toLowerCase().startsWith('// sideboard') || 
        trimmed.toLowerCase().startsWith('//sideboard') ||
        trimmed.toLowerCase() === 'sideboard' ||
        trimmed.toLowerCase() === 'sideboard:') {
      currentCategory = 'sideboard'
      continue
    }
    if (trimmed.toLowerCase().startsWith('// mainboard') || 
        trimmed.toLowerCase().startsWith('//mainboard') ||
        trimmed.toLowerCase() === 'mainboard' ||
        trimmed.toLowerCase() === 'mainboard:') {
      currentCategory = 'mainboard'
      continue
    }
    if (trimmed.toLowerCase().startsWith('// commander') ||
        trimmed.toLowerCase() === 'commander' ||
        trimmed.toLowerCase() === 'commander:') {
      currentCategory = 'commander'
      continue
    }
    if (trimmed.toLowerCase().startsWith('// maybeboard') ||
        trimmed.toLowerCase() === 'maybeboard' ||
        trimmed.toLowerCase() === 'maybeboard:') {
      currentCategory = 'maybeboard'
      continue
    }

    // Skip comment lines
    if (trimmed.startsWith('//') || trimmed.startsWith('#')) continue

    // Handle "SB: 4 Card Name" format
    let category = currentCategory
    let lineContent = trimmed
    if (trimmed.toLowerCase().startsWith('sb:')) {
      category = 'sideboard'
      lineContent = trimmed.slice(3).trim()
    }

    // Parse quantity and name
    // Match "4 Card Name" or "4x Card Name" or just "Card Name"
    const match = lineContent.match(/^(\d+)x?\s+(.+)$/i)
    
    if (match) {
      const quantity = parseInt(match[1], 10)
      const name = match[2].trim()
      if (name && quantity > 0) {
        result.push({ quantity, name, category })
      }
    } else if (lineContent && !lineContent.match(/^\d+$/)) {
      // Just a card name without quantity
      result.push({ quantity: 1, name: lineContent, category })
    }
  }

  return result
}

// POST /api/decks/[id]/import - Import a decklist
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deckId } = await params
    const body = await request.json()
    const parsed = importDecklistSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { decklist } = parsed.data

    // Check if deck exists
    const deck = await prisma.deck.findUnique({ where: { id: deckId } })
    if (!deck) {
      return NextResponse.json(
        { error: 'Deck not found' },
        { status: 404 }
      )
    }

    // Parse the decklist
    const parsedLines = parseDecklist(decklist)
    
    if (parsedLines.length === 0) {
      return NextResponse.json(
        { error: 'No valid cards found in decklist' },
        { status: 400 }
      )
    }

    // Get unique card names
    const uniqueNames = [...new Set(parsedLines.map(l => l.name.toLowerCase()))]

    // Search for cards by name (case-insensitive)
    // Prefer French cards, fallback to English
    const cards = await prisma.card.findMany({
      where: {
        OR: uniqueNames.map(name => ({
          OR: [
            { name: { equals: name, mode: 'insensitive' as const } },
            { printedName: { equals: name, mode: 'insensitive' as const } },
            { nameNormalized: { contains: name, mode: 'insensitive' as const } },
          ]
        }))
      },
      orderBy: [
        { lang: 'asc' }, // 'fr' comes before other languages alphabetically
        { releasedAt: 'desc' }, // Most recent first
      ],
    })

    // Create a map of card name -> best matching card
    const cardMap = new Map<string, typeof cards[0]>()
    
    for (const card of cards) {
      const nameLower = card.name.toLowerCase()
      const printedNameLower = card.printedName?.toLowerCase() || ''
      
      // Check all our parsed card names
      for (const parsed of parsedLines) {
        const searchName = parsed.name.toLowerCase()
        
        // Exact match on name, printedName, or normalized name
        if (nameLower === searchName || 
            printedNameLower === searchName ||
            card.nameNormalized?.toLowerCase() === searchName) {
          const existing = cardMap.get(searchName)
          if (!existing || (card.lang === 'fr' && existing.lang !== 'fr')) {
            cardMap.set(searchName, card)
          }
        }
      }
    }

    // Process results
    const result: ImportResult = {
      found: [],
      notFound: [],
      duplicates: [],
    }

    const addedCards = new Set<string>()

    for (const parsed of parsedLines) {
      const searchName = parsed.name.toLowerCase()
      const card = cardMap.get(searchName)

      if (card) {
        const key = `${card.id}-${parsed.category}`
        if (addedCards.has(key)) {
          result.duplicates.push(parsed.name)
          continue
        }
        addedCards.add(key)

        result.found.push({
          name: card.printedName || card.name,
          quantity: parsed.quantity,
          cardId: card.id,
        })

        // Add to deck
        await prisma.deckCard.upsert({
          where: {
            deckId_cardId_category: {
              deckId,
              cardId: card.id,
              category: parsed.category,
            },
          },
          create: {
            deckId,
            cardId: card.id,
            quantity: parsed.quantity,
            category: parsed.category,
          },
          update: {
            quantity: {
              increment: parsed.quantity,
            },
          },
        })
      } else {
        if (!result.notFound.includes(parsed.name)) {
          result.notFound.push(parsed.name)
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported: result.found.length,
      notFound: result.notFound.length,
      details: result,
    })
  } catch (error) {
    console.error('Error importing decklist:', error)
    return NextResponse.json(
      { error: 'Failed to import decklist' },
      { status: 500 }
    )
  }
}
