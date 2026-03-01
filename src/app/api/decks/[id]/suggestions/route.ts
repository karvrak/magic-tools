import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getRequestUser, verifyOwnerAccess } from '@/lib/api-auth'

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
          content: `You are a Magic: The Gathering expert. You analyze decks and suggest cards that create powerful synergies.
Respond ONLY with valid JSON, no markdown, no explanation.`
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
    const { userId, role } = await getRequestUser()

    if (!XAI_API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    // Verify ownership before fetching full deck data
    const deckForAuth = await prisma.deck.findUnique({ where: { id }, select: { ownerId: true } })
    if (!deckForAuth) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }
    if (deckForAuth.ownerId) {
      const hasAccess = await verifyOwnerAccess(deckForAuth.ownerId, userId, role)
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

    const prompt = `Analyze this Magic: The Gathering deck and suggest 10 cards that would create powerful synergies.

Deck format: ${deck.format || 'casual'}
Colors: ${colorStr}

Deck cards:
${cardList}

Respond with this exact JSON:
{
  "archetype": "detected archetype name",
  "synergies": ["synergy 1", "synergy 2"],
  "suggestions": [
    {"name": "Exact Card Name IN ENGLISH", "reason": "short reason"}
  ]
}

IMPORTANT:
- Use the EXACT ENGLISH NAMES of Magic cards
- Suggest QUALITY cards (no bad commons)
- Cards must be playable in ${colorStr} colors
- Prioritize cards that create combos or amplify existing synergies`

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
        reasons: [reasonMap.get(card.name.toLowerCase()) || 'Synergy with the deck'],
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
