import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface CardSuggestion {
  name: string
  oracle_id: string
  display_name: string
  color_identity: string[]
  deck_count: bigint
}

// GET /api/decks/cards/suggestions - Get card name suggestions for deck filtering
// Utilise la vue matérialisée deck_card_names pour les performances
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.toLowerCase().trim() || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '15'), 50)

    if (query.length < 1) {
      // Return most common cards if no query (cards in most decks)
      const results = await prisma.$queryRaw<CardSuggestion[]>`
        SELECT name, oracle_id, display_name, color_identity, deck_count 
        FROM deck_card_names
        ORDER BY deck_count DESC
        LIMIT ${limit}
      `
      return NextResponse.json({
        suggestions: results.map(r => ({ 
          name: r.name,
          oracleId: r.oracle_id,
          displayName: r.display_name,
          colorIdentity: r.color_identity || [],
          deckCount: Number(r.deck_count)
        }))
      })
    }

    // Search for matching cards by name (english or localized)
    const results = await prisma.$queryRaw<CardSuggestion[]>`
      SELECT name, oracle_id, display_name, color_identity, deck_count 
      FROM deck_card_names
      WHERE 
        LOWER(name) LIKE ${`%${query}%`}
        OR LOWER(display_name) LIKE ${`%${query}%`}
        OR name_normalized LIKE ${`%${query}%`}
      ORDER BY 
        CASE 
          WHEN LOWER(name) = ${query} THEN 0
          WHEN LOWER(name) LIKE ${`${query}%`} THEN 1
          WHEN LOWER(display_name) LIKE ${`${query}%`} THEN 2
          ELSE 3 
        END,
        deck_count DESC
      LIMIT ${limit}
    `

    return NextResponse.json({
      suggestions: results.map(r => ({ 
        name: r.name,
        oracleId: r.oracle_id,
        displayName: r.display_name,
        colorIdentity: r.color_identity || [],
        deckCount: Number(r.deck_count)
      }))
    })
  } catch (error) {
    console.error('Error fetching card suggestions:', error)
    
    // Si la vue n'existe pas, fallback sur une requête directe (moins performante)
    if (error instanceof Error && error.message.includes('deck_card_names')) {
      try {
        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q')?.toLowerCase().trim() || ''
        const limit = Math.min(parseInt(searchParams.get('limit') || '15'), 50)
        
        // Fallback query sans la vue
        const results = await prisma.$queryRaw<{
          name: string
          oracleId: string
          printedName: string | null
          colorIdentity: string[]
          deckCount: bigint
        }[]>`
          SELECT 
            c.name,
            c."oracleId" as "oracleId",
            c."printedName" as "printedName",
            c."colorIdentity" as "colorIdentity",
            COUNT(DISTINCT dc."deckId") as "deckCount"
          FROM "DeckCard" dc
          JOIN "Card" c ON dc."cardId" = c.id
          WHERE 
            ${query === '' ? prisma.$queryRaw`TRUE` : prisma.$queryRaw`
              LOWER(c.name) LIKE ${`%${query}%`}
              OR LOWER(c."printedName") LIKE ${`%${query}%`}
            `}
          GROUP BY c.name, c."oracleId", c."printedName", c."colorIdentity"
          ORDER BY COUNT(DISTINCT dc."deckId") DESC
          LIMIT ${limit}
        `
        
        return NextResponse.json({
          suggestions: results.map(r => ({ 
            name: r.name,
            oracleId: r.oracleId,
            displayName: r.printedName || r.name,
            colorIdentity: r.colorIdentity || [],
            deckCount: Number(r.deckCount)
          })),
          fallback: true
        })
      } catch {
        return NextResponse.json({ suggestions: [], error: 'View not initialized' })
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch card suggestions' },
      { status: 500 }
    )
  }
}
