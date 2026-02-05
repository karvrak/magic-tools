import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PATCH /api/sessions/[code]/player - Update a player's state
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const body = await request.json()
    const { 
      playerId,
      life,
      manaPool,
      poisonCounters,
      commanderDamage,
      handCount,
      libraryCount,
      graveyardCount,
      exileCount,
      battlefieldCount,
      battlefieldCards,
      isEliminated,
      isReady,
    } = body

    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID is required' },
        { status: 400 }
      )
    }

    // Verify that the session exists
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

    // Verify that the player belongs to this session
    const player = session.players.find(p => p.id === playerId)
    if (!player) {
      return NextResponse.json(
        { error: 'Player not found in this session' },
        { status: 404 }
      )
    }

    // Build the updates
    const updates: Record<string, unknown> = {
      lastSeenAt: new Date(),
    }

    if (life !== undefined) updates.life = life
    if (manaPool !== undefined) updates.manaPool = manaPool
    if (poisonCounters !== undefined) updates.poisonCounters = poisonCounters
    if (commanderDamage !== undefined) updates.commanderDamage = commanderDamage
    if (handCount !== undefined) updates.handCount = handCount
    if (libraryCount !== undefined) updates.libraryCount = libraryCount
    if (graveyardCount !== undefined) updates.graveyardCount = graveyardCount
    if (exileCount !== undefined) updates.exileCount = exileCount
    if (battlefieldCount !== undefined) updates.battlefieldCount = battlefieldCount
    if (battlefieldCards !== undefined) updates.battlefieldCards = battlefieldCards
    if (isEliminated !== undefined) updates.isEliminated = isEliminated
    if (isReady !== undefined) updates.isReady = isReady

    // Update the player
    const updatedPlayer = await prisma.gamePlayer.update({
      where: { id: playerId },
      data: updates,
    })

    // Retrieve the updated session
    const updatedSession = await prisma.gameSession.findUnique({
      where: { id: session.id },
      include: { players: { orderBy: { playerOrder: 'asc' } } },
    })

    return NextResponse.json({ 
      session: updatedSession,
      player: updatedPlayer,
    })
  } catch (error) {
    console.error('Failed to update player:', error)
    return NextResponse.json(
      { error: 'Failed to update player' },
      { status: 500 }
    )
  }
}

// DELETE /api/sessions/[code]/player - Leave the session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get('playerId')

    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID is required' },
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

    const player = session.players.find(p => p.id === playerId)
    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      )
    }

    // If the game has not started, delete the player
    if (session.status === 'waiting') {
      await prisma.gamePlayer.delete({
        where: { id: playerId },
      })

      // If it was the host and there are remaining players, transfer host status
      if (player.isHost && session.players.length > 1) {
        const nextHost = session.players.find(p => p.id !== playerId)
        if (nextHost) {
          await prisma.gamePlayer.update({
            where: { id: nextHost.id },
            data: { isHost: true },
          })
        }
      }

      // If no one left, delete the session
      if (session.players.length <= 1) {
        await prisma.gameSession.delete({
          where: { id: session.id },
        })
        return NextResponse.json({ deleted: true })
      }
    } else {
      // Game in progress: mark as disconnected
      await prisma.gamePlayer.update({
        where: { id: playerId },
        data: { isConnected: false },
      })
    }

    const updatedSession = await prisma.gameSession.findUnique({
      where: { id: session.id },
      include: { players: { orderBy: { playerOrder: 'asc' } } },
    })

    return NextResponse.json({ session: updatedSession })
  } catch (error) {
    console.error('Failed to leave session:', error)
    return NextResponse.json(
      { error: 'Failed to leave session' },
      { status: 500 }
    )
  }
}
