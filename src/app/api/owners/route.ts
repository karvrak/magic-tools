import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createOwnerSchema } from '@/lib/validations'

// GET /api/owners - List all owners
export async function GET() {
  try {
    const owners = await prisma.owner.findMany({
      orderBy: [
        { isDefault: 'desc' }, // Default owner first
        { name: 'asc' },
      ],
      include: {
        _count: {
          select: { decks: true },
        },
      },
    })

    const formattedOwners = owners.map((owner) => ({
      id: owner.id,
      name: owner.name,
      color: owner.color,
      isDefault: owner.isDefault,
      deckCount: owner._count.decks,
    }))

    return NextResponse.json({ owners: formattedOwners })
  } catch (error) {
    console.error('Error fetching owners:', error)
    return NextResponse.json(
      { error: 'Failed to fetch owners' },
      { status: 500 }
    )
  }
}

// POST /api/owners - Create a new owner
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createOwnerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { name, color } = parsed.data

    // Check if owner already exists
    const existing = await prisma.owner.findUnique({
      where: { name: name.trim() },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'An owner with this name already exists' },
        { status: 409 }
      )
    }

    const owner = await prisma.owner.create({
      data: {
        name: name.trim(),
        color: color || '#D4AF37',
      },
    })

    return NextResponse.json({ owner }, { status: 201 })
  } catch (error) {
    console.error('Error creating owner:', error)
    return NextResponse.json(
      { error: 'Failed to create owner' },
      { status: 500 }
    )
  }
}
