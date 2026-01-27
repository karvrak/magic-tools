import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/decks/[id]/export - Export deck as TXT decklist
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'arena' // arena, mtgo, simple

    const deck = await prisma.deck.findUnique({
      where: { id },
      include: {
        cards: {
          include: {
            card: {
              select: {
                name: true,
                setCode: true,
                collectorNumber: true,
              },
            },
          },
          orderBy: [{ category: 'asc' }, { card: { name: 'asc' } }],
        },
      },
    })

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    // Group cards by category
    const categories: Record<string, Array<{ name: string; quantity: number; setCode: string; collectorNumber: string }>> = {
      commander: [],
      mainboard: [],
      sideboard: [],
      maybeboard: [],
    }

    for (const dc of deck.cards) {
      const cat = dc.category || 'mainboard'
      if (!categories[cat]) categories[cat] = []
      categories[cat].push({
        name: dc.card.name,
        quantity: dc.quantity,
        setCode: dc.card.setCode.toUpperCase(),
        collectorNumber: dc.card.collectorNumber,
      })
    }

    // Generate decklist text based on format
    let decklistText = ''

    const formatCard = (card: { name: string; quantity: number; setCode: string; collectorNumber: string }) => {
      switch (format) {
        case 'arena':
          // Arena format: "4 Lightning Bolt (2XM) 141"
          return `${card.quantity} ${card.name} (${card.setCode}) ${card.collectorNumber}`
        case 'mtgo':
          // MTGO format: "4 Lightning Bolt"
          return `${card.quantity} ${card.name}`
        case 'simple':
        default:
          // Simple format: "4x Lightning Bolt"
          return `${card.quantity}x ${card.name}`
      }
    }

    // Add deck name as comment
    decklistText += `// ${deck.name}\n`
    if (deck.format) {
      decklistText += `// Format: ${deck.format}\n`
    }
    decklistText += '\n'

    // Commander section (if any)
    if (categories.commander.length > 0) {
      decklistText += '// Commander\n'
      for (const card of categories.commander) {
        decklistText += formatCard(card) + '\n'
      }
      decklistText += '\n'
    }

    // Mainboard (Deck in Arena)
    if (categories.mainboard.length > 0) {
      if (format === 'arena') {
        decklistText += 'Deck\n'
      } else {
        decklistText += '// Mainboard\n'
      }
      for (const card of categories.mainboard) {
        decklistText += formatCard(card) + '\n'
      }
      decklistText += '\n'
    }

    // Sideboard
    if (categories.sideboard.length > 0) {
      if (format === 'arena') {
        decklistText += 'Sideboard\n'
      } else {
        decklistText += '// Sideboard\n'
      }
      for (const card of categories.sideboard) {
        decklistText += formatCard(card) + '\n'
      }
      decklistText += '\n'
    }

    // Maybeboard (as comment)
    if (categories.maybeboard.length > 0) {
      decklistText += '// Maybeboard\n'
      for (const card of categories.maybeboard) {
        decklistText += '// ' + formatCard(card) + '\n'
      }
    }

    // Clean filename
    const filename = deck.name
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase()

    // Return as downloadable text file
    return new NextResponse(decklistText.trim(), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}_decklist.txt"`,
      },
    })
  } catch (error) {
    console.error('Error exporting deck:', error)
    return NextResponse.json(
      { error: 'Failed to export deck' },
      { status: 500 }
    )
  }
}
