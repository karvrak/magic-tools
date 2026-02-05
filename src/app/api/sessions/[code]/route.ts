import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
    const { 
      playerName, 
      playerColor = '#3B82F6',
      deckId,
      deckName,
    } = body

    if (!playerName || typeof playerName !== 'string') {
      return NextResponse.json(
        { error: 'Player name is required' },
        { status: 400 }
      )
    }

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
    const { action, playerId, ...updates } = body

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

      const updatedSession = await prisma.gameSession.update({
        where: { id: session.id },
        data: {
          status: 'playing',
          currentTurn: 1,
          activePlayerId: session.players[0].id,
          startedAt: new Date(),
        },
        include: { players: { orderBy: { playerOrder: 'asc' } } },
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

      return NextResponse.json({ session: updatedSession })
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

      return NextResponse.json({ session: updatedSession })
    }

    // General update
    const updatedSession = await prisma.gameSession.update({
      where: { id: session.id },
      data: updates,
      include: { players: { orderBy: { playerOrder: 'asc' } } },
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
