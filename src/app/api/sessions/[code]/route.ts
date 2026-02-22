import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { joinSessionSchema, updateSessionSchema } from '@/lib/validations'
import { broadcastGameEvent } from '@/lib/game-room/event-emitter'

// GET /api/sessions/[code] - Get the session state
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params

    const session = await prisma.gameSession.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        players: {
          orderBy: { playerOrder: 'asc' },
        },
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Failed to fetch session:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    )
  }
}

// POST /api/sessions/[code] - Join the session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const body = await request.json()
    const parsed = joinSessionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { playerName, playerColor, deckId, deckName } = parsed.data

    const session = await prisma.gameSession.findUnique({
      where: { code: code.toUpperCase() },
      include: { players: true },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    if (session.status !== 'waiting') {
      return NextResponse.json(
        { error: 'Game has already started' },
        { status: 400 }
      )
    }

    if (session.players.length >= session.maxPlayers) {
      return NextResponse.json(
        { error: 'Session is full' },
        { status: 400 }
      )
    }

    // Check if a player with this name already exists
    const existingPlayer = session.players.find(
      p => p.name.toLowerCase() === playerName.toLowerCase()
    )
    if (existingPlayer) {
      // Reconnect the existing player
      const updatedPlayer = await prisma.gamePlayer.update({
        where: { id: existingPlayer.id },
        data: { 
          isConnected: true,
          lastSeenAt: new Date(),
        },
      })
      
      const updatedSession = await prisma.gameSession.findUnique({
        where: { id: session.id },
        include: { players: { orderBy: { playerOrder: 'asc' } } },
      })

      return NextResponse.json({ 
        session: updatedSession,
        player: updatedPlayer,
        reconnected: true,
      })
    }

    // Add a new player
    const nextOrder = Math.max(...session.players.map(p => p.playerOrder), 0) + 1

    const player = await prisma.gamePlayer.create({
      data: {
        sessionId: session.id,
        name: playerName,
        color: playerColor,
        life: session.startingLife,
        playerOrder: nextOrder,
        deckId,
        deckName,
      },
    })

    const updatedSession = await prisma.gameSession.findUnique({
      where: { id: session.id },
      include: { players: { orderBy: { playerOrder: 'asc' } } },
    })

    broadcastGameEvent(code.toUpperCase(), {
      type: 'player_update',
      data: { playerId: player.id, action: 'joined' },
    })

    return NextResponse.json({
      session: updatedSession,
      player,
      reconnected: false,
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to join session:', error)
    return NextResponse.json(
      { error: 'Failed to join session' },
      { status: 500 }
    )
  }
}

// PATCH /api/sessions/[code] - Update the session (start, finish, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const body = await request.json()
    const parsed = updateSessionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { action, playerId, ...updates } = parsed.data

    const session = await prisma.gameSession.findUnique({
      where: { code: code.toUpperCase() },
      include: { players: { orderBy: { playerOrder: 'asc' } } },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Special actions
    if (action === 'start') {
      if (session.players.length < 2) {
        return NextResponse.json(
          { error: 'Need at least 2 players to start' },
          { status: 400 }
        )
      }

      // Randomly select the starting player
      const randomIndex = Math.floor(Math.random() * session.players.length)
      const startingPlayerId = session.players[randomIndex].id

      const updatedSession = await prisma.gameSession.update({
        where: { id: session.id },
        data: {
          status: 'playing',
          currentTurn: 1,
          activePlayerId: startingPlayerId,
          startedAt: new Date(),
        },
        include: { players: { orderBy: { playerOrder: 'asc' } } },
      })

      broadcastGameEvent(code.toUpperCase(), {
        type: 'game_start',
        data: { session: updatedSession },
      })

      return NextResponse.json({ session: updatedSession })
    }

    if (action === 'nextTurn') {
      const currentIndex = session.players.findIndex(p => p.id === session.activePlayerId)
      const activePlayers = session.players.filter(p => !p.isEliminated)
      
      if (activePlayers.length <= 1) {
        // Game finished
        const winner = activePlayers[0]
        const updatedSession = await prisma.gameSession.update({
          where: { id: session.id },
          data: {
            status: 'finished',
            finishedAt: new Date(),
          },
          include: { players: { orderBy: { playerOrder: 'asc' } } },
        })
        broadcastGameEvent(code.toUpperCase(), {
          type: 'game_end',
          data: { session: updatedSession, winner },
        })
        return NextResponse.json({ session: updatedSession, winner })
      }

      // Find the next active player
      let nextIndex = (currentIndex + 1) % session.players.length
      while (session.players[nextIndex].isEliminated) {
        nextIndex = (nextIndex + 1) % session.players.length
      }

      const isNewRound = nextIndex <= currentIndex
      const updatedSession = await prisma.gameSession.update({
        where: { id: session.id },
        data: {
          currentTurn: isNewRound ? session.currentTurn + 1 : session.currentTurn,
          activePlayerId: session.players[nextIndex].id,
        },
        include: { players: { orderBy: { playerOrder: 'asc' } } },
      })

      broadcastGameEvent(code.toUpperCase(), {
        type: 'state_update',
        data: { action: 'nextTurn' },
      })

      return NextResponse.json({ session: updatedSession })
    }

    if (action === 'advancePhase') {
      const { phase } = parsed.data as { phase?: string }
      if (!phase) {
        return NextResponse.json(
          { error: 'Phase is required for advancePhase action' },
          { status: 400 }
        )
      }

      const updatedSession = await prisma.gameSession.update({
        where: { id: session.id },
        data: { currentPhase: phase },
        include: { players: { orderBy: { playerOrder: 'asc' } } },
      })

      broadcastGameEvent(code.toUpperCase(), {
        type: 'state_update',
        data: { action: 'advancePhase', phase },
      })

      return NextResponse.json({ session: updatedSession })
    }

    if (action === 'respond') {
      broadcastGameEvent(code.toUpperCase(), {
        type: 'response_alert',
        data: {
          playerId,
          responds: parsed.data.responds ?? false,
          playerName: parsed.data.playerName,
          playerColor: parsed.data.playerColor,
        },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'emote') {
      broadcastGameEvent(code.toUpperCase(), {
        type: 'emote',
        data: {
          playerId,
          emoteId: parsed.data.emoteId,
          playerName: parsed.data.playerName,
          playerColor: parsed.data.playerColor,
        },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'finish') {
      const updatedSession = await prisma.gameSession.update({
        where: { id: session.id },
        data: {
          status: 'finished',
          finishedAt: new Date(),
        },
        include: { players: { orderBy: { playerOrder: 'asc' } } },
      })

      broadcastGameEvent(code.toUpperCase(), {
        type: 'game_end',
        data: { session: updatedSession },
      })

      // Auto-create Match record from session data
      try {
        const players = updatedSession.players
        if (players.length === 2) {
          // 1v1 session: create a single Match
          const p1 = players[0]
          const p2 = players[1]

          // Determine scores: survivor wins 2-0, or compare life totals
          let score1 = 0
          let score2 = 0
          if (p1.isEliminated && !p2.isEliminated) {
            score1 = 0
            score2 = 2
          } else if (p2.isEliminated && !p1.isEliminated) {
            score1 = 2
            score2 = 0
          } else if (p1.life > p2.life) {
            score1 = 2
            score2 = 1
          } else if (p2.life > p1.life) {
            score1 = 1
            score2 = 2
          } else {
            score1 = 1
            score2 = 1
          }

          await prisma.match.create({
            data: {
              playedAt: updatedSession.startedAt ?? new Date(),
              deck1Name: p1.deckName ?? p1.name,
              deck1Id: p1.deckId ?? null,
              score1,
              deck2Name: p2.deckName ?? p2.name,
              deck2Id: p2.deckId ?? null,
              score2,
              format: updatedSession.format ?? null,
              source: 'online',
              sessionId: updatedSession.id,
            },
          })
        } else if (players.length >= 3) {
          // Multiplayer: create a match for each unique pair
          for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
              const pA = players[i]
              const pB = players[j]

              let scoreA = 0
              let scoreB = 0
              if (pA.isEliminated && !pB.isEliminated) {
                scoreA = 0
                scoreB = 2
              } else if (pB.isEliminated && !pA.isEliminated) {
                scoreA = 2
                scoreB = 0
              } else if (pA.life > pB.life) {
                scoreA = 2
                scoreB = 1
              } else if (pB.life > pA.life) {
                scoreA = 1
                scoreB = 2
              } else {
                scoreA = 1
                scoreB = 1
              }

              await prisma.match.create({
                data: {
                  playedAt: updatedSession.startedAt ?? new Date(),
                  deck1Name: pA.deckName ?? pA.name,
                  deck1Id: pA.deckId ?? null,
                  score1: scoreA,
                  deck2Name: pB.deckName ?? pB.name,
                  deck2Id: pB.deckId ?? null,
                  score2: scoreB,
                  format: updatedSession.format ?? null,
                  source: 'online',
                  sessionId: updatedSession.id,
                },
              })
            }
          }
        }
      } catch (matchError) {
        // Match creation failure should not block session finish
        console.error('Failed to auto-create match from session:', matchError)
      }

      return NextResponse.json({ session: updatedSession })
    }

    // General update
    const updatedSession = await prisma.gameSession.update({
      where: { id: session.id },
      data: updates,
      include: { players: { orderBy: { playerOrder: 'asc' } } },
    })

    broadcastGameEvent(code.toUpperCase(), {
      type: 'state_update',
      data: { session: updatedSession },
    })

    return NextResponse.json({ session: updatedSession })
  } catch (error) {
    console.error('Failed to update session:', error)
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    )
  }
}

// DELETE /api/sessions/[code] - Delete the session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params

    await prisma.gameSession.delete({
      where: { code: code.toUpperCase() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete session:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}
