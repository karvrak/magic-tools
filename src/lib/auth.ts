import { cookies } from 'next/headers'

const AUTH_COOKIE_NAME = 'magictools_auth'
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export function getAuthPassword(): string {
  return process.env.AUTH_PASSWORD || 'changeme'
}

export async function verifyPassword(password: string): Promise<boolean> {
  return password === getAuthPassword()
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME)
  return authCookie?.value === 'authenticated'
}

export async function setAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(AUTH_COOKIE_NAME, 'authenticated', {
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
