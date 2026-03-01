import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const AUTH_COOKIE_NAME = 'magictools_auth'
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return new TextEncoder().encode(secret)
}

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// JWT tokens
export async function createSessionToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getJwtSecret())
}

export async function verifySessionToken(token: string): Promise<{ userId: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return {
      userId: payload.userId as string,
      role: payload.role as string,
    }
  } catch {
    return null
  }
}

// Cookie management
export async function setAuthCookie(userId: string, role: string): Promise<void> {
  const token = await createSessionToken(userId, role)
  const cookieStore = await cookies()
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: '/',
  })
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(AUTH_COOKIE_NAME)
}

export async function getCurrentUser(): Promise<{ userId: string; role: string } | null> {
  const cookieStore = await cookies()
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME)
  if (!authCookie?.value) return null
  return verifySessionToken(authCookie.value)
}

export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null
}
