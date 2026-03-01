import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword, setAuthCookie } from '@/lib/auth'
import { registerSchema } from '@/lib/validations'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 registrations per IP per hour
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed } = checkRateLimit(`register:${ip}`, { max: 5, windowSeconds: 60 * 60 })
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { email, password } = parsed.data

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    // Create user + default owner (atomic via Prisma nested create)
    const hashedPassword = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'user',
        owners: {
          create: {
            name: email.split('@')[0],
            isDefault: true,
          },
        },
      },
    })

    // Set JWT cookie
    await setAuthCookie(user.id, user.role)

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
