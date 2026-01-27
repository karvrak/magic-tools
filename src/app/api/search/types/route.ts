import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/search/types - Get type suggestions for autocomplete
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.toLowerCase().trim() || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '15'), 50)

    if (query.length < 1) {
      // Return top types if no query
      const results = await prisma.$queryRaw<{ word: string; count: bigint }[]>`
        SELECT word, count 
        FROM card_type_words 
        ORDER BY count DESC 
        LIMIT ${limit}
      `
      return NextResponse.json({
        suggestions: results.map(r => ({ word: r.word, count: Number(r.count) }))
      })
    }

    // Search for matching types
    const results = await prisma.$queryRaw<{ word: string; count: bigint }[]>`
      SELECT word, count 
      FROM card_type_words 
      WHERE word LIKE ${query + '%'}
      ORDER BY 
        CASE WHEN word = ${query} THEN 0 ELSE 1 END,
        count DESC 
      LIMIT ${limit}
    `

    return NextResponse.json({
      suggestions: results.map(r => ({ word: r.word, count: Number(r.count) }))
    })
  } catch (error) {
    console.error('Error fetching type suggestions:', error)
    
    // Si la vue n'existe pas, retourner une liste vide
    // Cela arrive si la migration n'a pas encore été exécutée
    if (error instanceof Error && error.message.includes('card_type_words')) {
      return NextResponse.json({ suggestions: [], error: 'View not initialized' })
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch type suggestions' },
      { status: 500 }
    )
  }
}
