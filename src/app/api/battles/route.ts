import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { GAME_MODES, type GameMode, type CreateBattleInput } from '@/types/battle'

// GET /api/battles - Liste des batailles (historique)
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

// POST /api/battles - Créer une nouvelle bataille
export async function POST(request: NextRequest) {
  try {
    const body: CreateBattleInput = await request.json()
    const { mode, players } = body

    // Validation du mode
    const modeConfig = GAME_MODES[mode]
    if (!modeConfig) {
      return NextResponse.json(
        { error: 'Invalid game mode' },
        { status: 400 }
      )
    }

    // Validation du nombre de joueurs
    if (players.length !== modeConfig.players) {
      return NextResponse.json(
        { error: `Mode ${mode} requires exactly ${modeConfig.players} players` },
        { status: 400 }
      )
    }

    // Validation des noms de deck
    for (const player of players) {
      if (!player.deckName || player.deckName.trim().length === 0) {
        return NextResponse.json(
          { error: 'All players must have a deck name' },
          { status: 400 }
        )
      }
    }

    // Créer les decks "à la volée" si nécessaire
    const playerData = await Promise.all(
      players.map(async (player, index) => {
        let deckId = player.deckId

        // Si pas de deckId mais un nom, créer le deck
        if (!deckId && player.deckName) {
          // Vérifier si un deck avec ce nom existe déjà
          const existingDeck = await prisma.deck.findFirst({
            where: { name: player.deckName.trim() },
          })

          if (existingDeck) {
            deckId = existingDeck.id
          } else {
            // Créer un nouveau deck sans cartes
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

    // Créer la bataille avec les joueurs
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
