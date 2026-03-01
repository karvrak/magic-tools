import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import prisma from '@/lib/prisma'

// GET /api/custom-sets/[setCode]/share - Get existing share token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ setCode: string }> }
) {
  try {
    const { setCode } = await params

    const shared = await prisma.sharedCustomSet.findUnique({
      where: { setCode },
      select: { shareToken: true },
    })

    return NextResponse.json({ shareToken: shared?.shareToken || null })
  } catch (error) {
    console.error('Error getting share token:', error)
    return NextResponse.json(
      { error: 'Failed to get share token' },
      { status: 500 }
    )
  }
}

// POST /api/custom-sets/[setCode]/share - Generate share token
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ setCode: string }> }
) {
  try {
    const { setCode } = await params

    // Verify set exists
    const cardCount = await prisma.card.count({ where: { setCode } })
    if (cardCount === 0) {
      return NextResponse.json({ error: 'Custom set not found' }, { status: 404 })
    }

    // Return existing token if already shared
    const existing = await prisma.sharedCustomSet.findUnique({
      where: { setCode },
      select: { shareToken: true },
    })

    if (existing) {
      return NextResponse.json({ shareToken: existing.shareToken })
    }

    // Generate a unique 12-char token
    const shareToken = randomBytes(9).toString('base64url').slice(0, 12)

    await prisma.sharedCustomSet.create({
      data: { setCode, shareToken },
    })

    return NextResponse.json({ shareToken })
  } catch (error) {
    console.error('Error generating share token:', error)
    return NextResponse.json(
      { error: 'Failed to generate share link' },
      { status: 500 }
    )
  }
}

// DELETE /api/custom-sets/[setCode]/share - Revoke share token
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ setCode: string }> }
) {
  try {
    const { setCode } = await params

    await prisma.sharedCustomSet.deleteMany({
      where: { setCode },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error revoking share token:', error)
    return NextResponse.json(
      { error: 'Failed to revoke share link' },
      { status: 500 }
    )
  }
}
