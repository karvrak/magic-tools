import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { importMatchesSchema, deleteMatchesParamsSchema } from '@/lib/validations'

// GET /api/matches - List all matches with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deckName = searchParams.get('deckName')?.trim()
    const source = searchParams.get('source')?.trim()
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (deckName) {
      where.OR = [
        { deck1Name: { contains: deckName, mode: 'insensitive' as const } },
        { deck2Name: { contains: deckName, mode: 'insensitive' as const } },
      ]
    }

    if (source) {
      where.source = source
    }

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        orderBy: { playedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          deck1: { select: { id: true, name: true, coverImage: true } },
          deck2: { select: { id: true, name: true, coverImage: true } },
        },
      }),
      prisma.match.count({ where }),
    ])

    return NextResponse.json({ matches, total })
  } catch (error) {
    console.error('Error fetching matches:', error)
    return NextResponse.json(
      { error: 'Failed to fetch matches' },
      { status: 500 }
    )
  }
}

// POST /api/matches - Import matches from Excel data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = importMatchesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { matches: matchesData } = parsed.data

    // Generate a batch ID for this import
    const importBatchId = `import_${Date.now()}`

    // Get all existing decks for name matching
    const existingDecks = await prisma.deck.findMany({
      select: { id: true, name: true },
    })

    // Create a case-insensitive name lookup map
    const deckNameMap = new Map<string, string>()
    for (const deck of existingDecks) {
      deckNameMap.set(deck.name.toLowerCase(), deck.id)
    }

    // Validate and prepare match data
    const validMatches: {
      playedAt: Date
      deck1Name: string
      deck1Id: string | null
      score1: number
      deck2Name: string
      deck2Id: string | null
      score2: number
      notes: string | null
      importBatchId: string
    }[] = []

    const errors: { row: number; error: string }[] = []

    for (let i = 0; i < matchesData.length; i++) {
      const row = matchesData[i]
      const rowNum = i + 1

      // Parse date (support multiple formats)
      let playedAt: Date | null = null
      if (row.date) {
        // Try parsing as Excel serial number first
        if (typeof row.date === 'number') {
          // Excel dates are days since 1899-12-30
          playedAt = new Date((row.date - 25569) * 86400 * 1000)
        } else {
          const dateStr = String(row.date).trim()
          // Try different formats
          const parsed = new Date(dateStr)
          if (!isNaN(parsed.getTime())) {
            playedAt = parsed
          } else {
            // Try DD/MM/YYYY format
            const parts = dateStr.split(/[/\-.]/)
            if (parts.length === 3) {
              const [day, month, year] = parts.map(Number)
              playedAt = new Date(year < 100 ? 2000 + year : year, month - 1, day)
            }
          }
        }
      }

      if (!playedAt || isNaN(playedAt.getTime())) {
        errors.push({ row: rowNum, error: `Invalid date: ${row.date}` })
        continue
      }

      // Parse deck names (required)
      const deck1Name = row.deck1?.toString().trim() || row['deck 1']?.toString().trim()
      const deck2Name = row.deck2?.toString().trim() || row['deck 2']?.toString().trim()

      if (!deck1Name || !deck2Name) {
        errors.push({ row: rowNum, error: 'Missing deck name(s)' })
        continue
      }

      // Parse scores (0-2)
      const score1 = parseInt(String(row.score1 ?? row['score 1'] ?? '0'))
      const score2 = parseInt(String(row.score2 ?? row['score 2'] ?? '0'))

      if (isNaN(score1) || isNaN(score2) || score1 < 0 || score2 < 0) {
        errors.push({ row: rowNum, error: `Invalid scores: ${row.score1}, ${row.score2}` })
        continue
      }

      // Try to match deck names with existing decks
      const deck1Id = deckNameMap.get(deck1Name.toLowerCase()) || null
      const deck2Id = deckNameMap.get(deck2Name.toLowerCase()) || null

      validMatches.push({
        playedAt,
        deck1Name,
        deck1Id,
        score1,
        deck2Name,
        deck2Id,
        score2,
        notes: row.notes?.toString().trim() || null,
        importBatchId,
      })
    }

    // Insert matches in batches
    if (validMatches.length > 0) {
      await prisma.match.createMany({
        data: validMatches,
      })
    }

    return NextResponse.json({
      success: true,
      imported: validMatches.length,
      errors: errors.length,
      errorDetails: errors.slice(0, 10), // Return first 10 errors
      batchId: importBatchId,
    })
  } catch (error) {
    console.error('Error importing matches:', error)
    return NextResponse.json(
      { error: 'Failed to import matches' },
      { status: 500 }
    )
  }
}

// DELETE /api/matches - Delete matches by batch ID or all
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = deleteMatchesParamsSchema.safeParse({
      batchId: searchParams.get('batchId'),
      all: searchParams.get('all'),
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().formErrors },
        { status: 400 }
      )
    }
    const batchId = parsed.data.batchId
    const deleteAll = parsed.data.all === 'true'

    const where = batchId ? { importBatchId: batchId } : {}
    const result = await prisma.match.deleteMany({ where })

    return NextResponse.json({ deleted: result.count })
  } catch (error) {
    console.error('Error deleting matches:', error)
    return NextResponse.json(
      { error: 'Failed to delete matches' },
      { status: 500 }
    )
  }
}
