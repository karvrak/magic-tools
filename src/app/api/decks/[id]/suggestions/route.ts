import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const XAI_API_KEY = process.env.XAI_API_KEY

interface GrokResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

async function askGrok(prompt: string): Promise<string> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-3-fast',
      messages: [
        {
          role: 'system',
          content: `Tu es un expert Magic: The Gathering. Tu analyses des decks et suggères des cartes qui créent des synergies puissantes.
Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans explication.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    throw new Error(`Grok API error: ${response.status}`)
  }

  const data = await response.json() as GrokResponse
  return data.choices[0]?.message?.content || ''
}

// GET /api/decks/[id]/suggestions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!XAI_API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    // Get deck with cards
    const deck = await prisma.deck.findUnique({
      where: { id },
      include: {
        cards: {
          include: {
            card: {
              select: {
                name: true,
                typeLine: true,
                oracleText: true,
                colorIdentity: true,
                manaCost: true,
              },
            },
          },
        },
      },
    })

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    if (deck.cards.length < 5) {
      return NextResponse.json({
        suggestions: [],
        analysis: { archetype: '', synergies: [] }
      })
    }

    // Build deck summary for Grok
    const cardList = deck.cards.map(dc => {
      const c = dc.card
      return `${dc.quantity}x ${c.name} (${c.typeLine})`
    }).join('\n')

    // Calculate deck colors
    const colors = [...new Set(deck.cards.flatMap(dc => dc.card.colorIdentity || []))]
    const colorStr = colors.length > 0 ? colors.join('') : 'colorless'

    const prompt = `Analyse ce deck Magic: The Gathering et suggère 10 cartes qui créeraient des synergies puissantes.

Format du deck: ${deck.format || 'casual'}
Couleurs: ${colorStr}

Cartes du deck:
${cardList}

Réponds avec ce JSON exact:
{
  "archetype": "nom de l'archétype détecté",
  "synergies": ["synergie 1", "synergie 2"],
  "suggestions": [
    {"name": "Nom Exact De La Carte EN ANGLAIS", "reason": "raison courte"}
  ]
}

IMPORTANT:
- Utilise les NOMS ANGLAIS EXACTS des cartes Magic
- Suggère des cartes de QUALITÉ (pas de communes nulles)
- Les cartes doivent être jouables dans les couleurs ${colorStr}
- Privilégie les cartes qui créent des combos ou amplifient les synergies existantes`

    const grokResponse = await askGrok(prompt)

    // Parse Grok response
    let parsed: { archetype: string; synergies: string[]; suggestions: Array<{ name: string; reason: string }> }
    try {
      // Clean response (remove markdown if present)
      const cleaned = grokResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse Grok response:', grokResponse)
      return NextResponse.json({ suggestions: [], analysis: { archetype: '', synergies: [] } })
    }

    // Search for suggested cards in database
    const suggestedNames = parsed.suggestions.map(s => s.name)
    const reasonMap = new Map(parsed.suggestions.map(s => [s.name.toLowerCase(), s.reason]))

    const foundCards = await prisma.card.findMany({
      where: {
        name: { in: suggestedNames, mode: 'insensitive' },
        priceEur: { not: null },
      },
      select: {
        id: true,
        oracleId: true,
        name: true,
        typeLine: true,
        manaCost: true,
        colorIdentity: true,
        rarity: true,
        setCode: true,
        imageSmall: true,
        imageNormal: true,
        priceEur: true,
        priceUsd: true,
      },
      take: 100,
    })

    // Deduplicate by oracleId and add reasons
    const seen = new Set<string>()
    const deckCardNames = new Set(deck.cards.map(dc => dc.card.name.toLowerCase()))

    const suggestions = foundCards
      .filter(card => {
        if (seen.has(card.oracleId)) return false
        if (deckCardNames.has(card.name.toLowerCase())) return false
        seen.add(card.oracleId)
        return true
      })
      .map(card => ({
        ...card,
        score: card.rarity === 'mythic' ? 30 : card.rarity === 'rare' ? 20 : 10,
        reasons: [reasonMap.get(card.name.toLowerCase()) || 'Synergie avec le deck'],
      }))
      .slice(0, 12)

    return NextResponse.json({
      suggestions,
      analysis: {
        archetype: parsed.archetype,
        synergies: parsed.synergies,
        deckColors: colors,
      },
    })
  } catch (error) {
    console.error('Error getting suggestions:', error)
    return NextResponse.json({
      suggestions: [],
      analysis: { archetype: '', synergies: [] },
      error: 'Failed to get suggestions'
    })
  }
}
