import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updateOwnerSchema } from '@/lib/validations'
import { getRequestUser, verifyOwnerAccess } from '@/lib/api-auth'

// DELETE /api/owners/[id] - Delete an owner (keeps associated decks)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId, role } = await getRequestUser()

    // Verify the requesting user owns this owner record
    const hasAccess = await verifyOwnerAccess(id, userId, role)
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden: you do not have access to this owner' },
        { status: 403 }
      )
    }

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
    const { userId, role } = await getRequestUser()

    // Verify the requesting user owns this owner record
    const hasAccess = await verifyOwnerAccess(id, userId, role)
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden: you do not have access to this owner' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = updateOwnerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { name, color, isDefault } = parsed.data

    // If setting as default, unset other defaults scoped to this user only
    if (isDefault === true) {
      await prisma.owner.updateMany({
        where: { isDefault: true, userId },
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
