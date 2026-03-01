import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyPassword, clearAuthCookie } from '@/lib/auth'
import { getRequestUser } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  try {
    const { userId, role } = await getRequestUser()

    // Prevent admin from deleting their own account
    if (role === 'admin') {
      return NextResponse.json(
        { error: 'Admin accounts cannot be deleted via this route' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password confirmation required' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isValid = await verifyPassword(password, user.password)
    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
    }

    // Delete user and cascade (owners set to null via onDelete: SetNull)
    // First, delete orphaned data that would remain
    const ownerIds = await prisma.owner.findMany({
      where: { userId },
      select: { id: true },
    })
    const ids = ownerIds.map((o) => o.id)

    if (ids.length > 0) {
      await prisma.$transaction([
        prisma.collectionItem.deleteMany({ where: { ownerId: { in: ids } } }),
        prisma.wantlistItem.deleteMany({ where: { ownerId: { in: ids } } }),
        prisma.proxyItem.deleteMany({ where: { ownerId: { in: ids } } }),
        prisma.collectionSnapshot.deleteMany({ where: { ownerId: { in: ids } } }),
        prisma.deck.deleteMany({ where: { ownerId: { in: ids } } }),
        prisma.owner.deleteMany({ where: { id: { in: ids } } }),
        prisma.user.delete({ where: { id: userId } }),
      ])
    } else {
      await prisma.user.delete({ where: { id: userId } })
    }

    await clearAuthCookie()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete account error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
