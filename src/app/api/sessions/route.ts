import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSessionSchema } from '@/lib/validations'

// Generate a unique short code (6 characters)
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Without I, O, 0, 1 to avoid confusion
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// GET /api/sessions - List my recent sessions (by cookie or other)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }

    // Recent sessions (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    where.createdAt = { gte: oneDayAgo }

    const sessions = await prisma.gameSession.findMany({
      where,
      include: {
        players: {
          orderBy: { playerOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Failed to fetch sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}

// POST /api/sessions - Create a new session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createSessionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const {
      name,
      playerName,
      playerColor,
      maxPlayers,
      startingLife,
      format,
      deckId,
      deckName,
    } = parsed.data

    // Generate a unique code
    let code = generateCode()
    let attempts = 0
    while (attempts < 10) {
      const existing = await prisma.gameSession.findUnique({ where: { code } })
      if (!existing) break
      code = generateCode()
      attempts++
    }

    if (attempts >= 10) {
      return NextResponse.json(
        { error: 'Could not generate unique code' },
        { status: 500 }
      )
    }

    // Create the session with the host player
    const session = await prisma.gameSession.create({
      data: {
        code,
        name: name || `${playerName}'s game`,
        maxPlayers: Math.min(Math.max(maxPlayers, 2), 4),
        startingLife,
        format,
        players: {
          create: {
            name: playerName,
            color: playerColor,
            isHost: true,
            life: startingLife,
            playerOrder: 1,
            deckId,
            deckName,
          },
        },
      },
      include: {
        players: true,
      },
    })

    return NextResponse.json({ 
      session,
      inviteUrl: `/play/${code}`,
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to create session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
