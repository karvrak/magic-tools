import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { getJwtSecret } from '@/lib/auth'

// Paths that don't require authentication
const publicPaths = ['/login', '/register', '/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/cron', '/shared', '/api/shared']

// Admin-only page paths
const adminOnlyPages = ['/sealed', '/play', '/battle', '/matches', '/proxy', '/analytics']

// Admin-only API paths
const adminOnlyApis = ['/api/sealed', '/api/sessions', '/api/battles', '/api/matches', '/api/proxy', '/api/analytics', '/api/sync', '/api/scanner', '/api/collection/migrate-from-decks']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Strip any client-sent x-user-* headers to prevent forgery
  const cleanHeaders = new Headers(request.headers)
  cleanHeaders.delete('x-user-id')
  cleanHeaders.delete('x-user-role')

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    // Redirect already-authenticated users away from login/register pages
    if (pathname === '/login' || pathname === '/register') {
      const authCookie = request.cookies.get('magictools_auth')
      if (authCookie?.value) {
        try {
          await jwtVerify(authCookie.value, getJwtSecret())
          return NextResponse.redirect(new URL('/', request.url))
        } catch {
          // Token invalid — let them access login/register
        }
      }
    }
    return NextResponse.next({ request: { headers: cleanHeaders } })
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check for auth cookie (JWT)
  const authCookie = request.cookies.get('magictools_auth')

  if (!authCookie?.value) {
    if (!pathname.startsWith('/api')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify JWT
  let userId: string
  let role: string
  try {
    const { payload } = await jwtVerify(authCookie.value, getJwtSecret())
    userId = payload.userId as string
    role = payload.role as string
  } catch {
    // Invalid/expired token — clear it and redirect
    if (!pathname.startsWith('/api')) {
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('magictools_auth')
      return response
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin-only routes for non-admin users
  if (role !== 'admin') {
    // Check admin-only pages
    if (adminOnlyPages.some((path) => pathname.startsWith(path))) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    // Check admin-only APIs
    if (adminOnlyApis.some((path) => pathname.startsWith(path))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // Block deck suggestions API (AI feature) for non-admin
    if (pathname.match(/^\/api\/decks\/[^/]+\/suggestions/)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Inject user info into request headers
  cleanHeaders.set('x-user-id', userId)
  cleanHeaders.set('x-user-role', role)

  return NextResponse.next({
    request: {
      headers: cleanHeaders,
    },
  })
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
