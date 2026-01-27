import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/search/sets - Get set suggestions for autocomplete
// Utilise la vue matérialisée card_sets pour les performances
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.toLowerCase().trim() || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    if (query.length < 1) {
      // Return most recent sets if no query
      const results = await prisma.$queryRaw<{ code: string; name: string; card_count: bigint }[]>`
        SELECT code, name, card_count 
        FROM card_sets
        ORDER BY released_at DESC NULLS LAST
        LIMIT ${limit}
      `
      return NextResponse.json({
        suggestions: results.map(r => ({ 
          code: r.code, 
          name: r.name, 
          count: Number(r.card_count) 
        }))
      })
    }

    // Search for matching sets by name or code
    const results = await prisma.$queryRaw<{ code: string; name: string; card_count: bigint }[]>`
      SELECT code, name, card_count 
      FROM card_sets
      WHERE 
        LOWER(name) LIKE ${`%${query}%`}
        OR LOWER(code) LIKE ${`%${query}%`}
      ORDER BY 
        CASE 
          WHEN LOWER(code) = ${query} THEN 0
          WHEN LOWER(name) LIKE ${`${query}%`} THEN 1
          WHEN LOWER(code) LIKE ${`${query}%`} THEN 2
          ELSE 3 
        END,
        released_at DESC NULLS LAST
      LIMIT ${limit}
    `

    return NextResponse.json({
      suggestions: results.map(r => ({ 
        code: r.code, 
        name: r.name, 
        count: Number(r.card_count) 
      }))
    })
  } catch (error) {
    console.error('Error fetching set suggestions:', error)
    
    // Si la vue n'existe pas, retourner une liste vide
    if (error instanceof Error && error.message.includes('card_sets')) {
      return NextResponse.json({ suggestions: [], error: 'View not initialized' })
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch set suggestions' },
      { status: 500 }
    )
  }
}
