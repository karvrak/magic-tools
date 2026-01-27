import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// DELETE /api/owners/[id] - Delete an owner (keeps associated decks)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if owner exists
    const owner = await prisma.owner.findUnique({
      where: { id },
      include: {
        _count: {
          select: { decks: true },
        },
      },
    })

    if (!owner) {
      return NextResponse.json(
        { error: 'Owner not found' },
        { status: 404 }
      )
    }

    // Delete the owner (decks will have ownerId set to null due to onDelete: SetNull)
    await prisma.owner.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: `Owner "${owner.name}" deleted. ${owner._count.decks} deck(s) are now unassigned.`,
    })
  } catch (error) {
    console.error('Error deleting owner:', error)
    return NextResponse.json(
      { error: 'Failed to delete owner' },
      { status: 500 }
    )
  }
}

// PATCH /api/owners/[id] - Update owner (for future use: edit color, name, set as default)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, color, isDefault } = body

    // If setting as default, unset other defaults first
    if (isDefault === true) {
      await prisma.owner.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const owner = await prisma.owner.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(color !== undefined && { color }),
        ...(isDefault !== undefined && { isDefault }),
      },
    })

    return NextResponse.json({ owner })
  } catch (error) {
    console.error('Error updating owner:', error)
    return NextResponse.json(
      { error: 'Failed to update owner' },
      { status: 500 }
    )
  }
}
