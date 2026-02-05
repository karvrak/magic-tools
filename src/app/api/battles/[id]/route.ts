import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/battles/[id] - Get a battle
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const battle = await prisma.battle.findUnique({
      where: { id },
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

    if (!battle) {
      return NextResponse.json(
        { error: 'Battle not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ battle })
  } catch (error) {
    console.error('Error fetching battle:', error)
    return NextResponse.json(
      { error: 'Failed to fetch battle' },
      { status: 500 }
    )
  }
}

// DELETE /api/battles/[id] - Delete a battle
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.battle.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting battle:', error)
    return NextResponse.json(
      { error: 'Failed to delete battle' },
      { status: 500 }
    )
  }
}
