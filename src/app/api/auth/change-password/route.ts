import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyPassword, hashPassword } from '@/lib/auth'
import { getRequestUser } from '@/lib/api-auth'
import { changePasswordSchema } from '@/lib/validations'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getRequestUser()

    // Rate limit: 5 attempts per 15 minutes
    const { allowed } = checkRateLimit(`change-pwd:${userId}`, { max: 5, windowSeconds: 15 * 60 })
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = changePasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = parsed.data

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isValid = await verifyPassword(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    const hashedPassword = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
