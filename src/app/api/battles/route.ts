import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { GAME_MODES, type GameMode } from '@/types/battle'
import { createBattleSchema } from '@/lib/validations'

// GET /api/battles - List of battles (history)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'active' | 'finished' | null (all)
    const limit = parseInt(searchParams.get('limit') || '20')

    const battles = await prisma.battle.findMany({
      where: status ? { status } : undefined,
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        players: {
          orderBy: { playerOrder: 'asc' },
          include: {
            deck: {
              select: {
                id: true,
                name: true,
                coverImage: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ battles })
  } catch (error) {
    console.error('Error fetching battles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch battles' },
      { status: 500 }
    )
  }
}

// POST /api/battles - Create a new battle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createBattleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { mode, players } = parsed.data

    // Mode validation
    const modeConfig = GAME_MODES[mode as GameMode]
    if (!modeConfig) {
      return NextResponse.json(
        { error: 'Invalid game mode' },
        { status: 400 }
      )
    }

    // Player count validation
    if (players.length !== modeConfig.players) {
      return NextResponse.json(
        { error: `Mode ${mode} requires exactly ${modeConfig.players} players` },
        { status: 400 }
      )
    }

    // Create decks "on the fly" if needed
    const playerData = await Promise.all(
      players.map(async (player, index) => {
        let deckId = player.deckId

        // If no deckId but a name, create the deck
        if (!deckId && player.deckName) {
          // Check if a deck with this name already exists
          const existingDeck = await prisma.deck.findFirst({
            where: { name: player.deckName.trim() },
          })

          if (existingDeck) {
            deckId = existingDeck.id
          } else {
            // Create a new deck without cards
            const newDeck = await prisma.deck.create({
              data: {
                name: player.deckName.trim(),
                format: mode === 'COMMANDER' ? 'commander' : null,
              },
            })
            deckId = newDeck.id
          }
        }

        return {
          deckId,
          deckName: player.deckName.trim(),
          playerOrder: index + 1,
          team: modeConfig.hasTeams ? player.team || (index < 2 ? 1 : 2) : null,
          startingLife: modeConfig.startingLife,
          finalLife: modeConfig.startingLife,
          victoryPoints: 0,
          isEliminated: false,
          commanderDamage: {},
        }
      })
    )

    // Create the battle with the players
    const battle = await prisma.battle.create({
      data: {
        mode,
        status: 'active',
        players: {
          create: playerData,
        },
      },
      include: {
        players: {
          orderBy: { playerOrder: 'asc' },
          include: {
            deck: {
              select: {
                id: true,
                name: true,
                coverImage: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ battle }, { status: 201 })
  } catch (error) {
    console.error('Error creating battle:', error)
    return NextResponse.json(
      { error: 'Failed to create battle' },
      { status: 500 }
    )
  }
}
