import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getRequestUser } from '@/lib/api-auth'

export async function GET() {
  try {
    const { userId } = await getRequestUser()

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        owners: {
          select: {
            id: true,
            name: true,
            color: true,
            isDefault: true,
          },
          orderBy: [
            { isDefault: 'desc' },
            { name: 'asc' },
          ],
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error fetching current user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
