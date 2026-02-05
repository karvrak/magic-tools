import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/tags - List all tags with deck count
export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      include: {
        _count: {
          select: { decks: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({
      tags: tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        deckCount: tag._count.decks,
        createdAt: tag.createdAt,
      }))
    })
  } catch (error) {
    console.error('Failed to fetch tags:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    )
  }
}

// POST /api/tags - Create a new tag
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, color } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Tag name is required' },
        { status: 400 }
      )
    }

    // Normalize the name (lowercase, trim)
    const normalizedName = name.toLowerCase().trim()

    if (normalizedName.length === 0) {
      return NextResponse.json(
        { error: 'Tag name cannot be empty' },
        { status: 400 }
      )
    }

    if (normalizedName.length > 30) {
      return NextResponse.json(
        { error: 'Tag name must be 30 characters or less' },
        { status: 400 }
      )
    }

    // Check if the tag already exists
    const existing = await prisma.tag.findUnique({
      where: { name: normalizedName }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Tag already exists', tag: existing },
        { status: 409 }
      )
    }

    // Create the tag
    const tag = await prisma.tag.create({
      data: {
        name: normalizedName,
        color: color || '#8B5CF6',
      }
    })

    return NextResponse.json({ tag }, { status: 201 })
  } catch (error) {
    console.error('Failed to create tag:', error)
    return NextResponse.json(
      { error: 'Failed to create tag' },
      { status: 500 }
    )
  }
}

// DELETE /api/tags - Delete a tag (via query param ?id=xxx)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tagId = searchParams.get('id')

    if (!tagId) {
      return NextResponse.json(
        { error: 'Tag ID is required' },
        { status: 400 }
      )
    }

    await prisma.tag.delete({
      where: { id: tagId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete tag:', error)
    return NextResponse.json(
      { error: 'Failed to delete tag' },
      { status: 500 }
    )
  }
}
