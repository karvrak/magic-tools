import { headers } from 'next/headers'
import prisma from '@/lib/prisma'

interface RequestUser {
  userId: string
  role: 'admin' | 'user'
}

/**
 * Reads user info injected by middleware into request headers.
 */
export async function getRequestUser(): Promise<RequestUser> {
  const h = await headers()
  const userId = h.get('x-user-id')
  const role = h.get('x-user-role') as 'admin' | 'user'

  if (!userId || !role) {
    throw new Error('Unauthorized: missing user headers')
  }

  return { userId, role }
}

/**
 * Returns the owner IDs belonging to a user.
 * Admin returns null (meaning: no filter, see all data).
 * Regular user returns their owner IDs.
 */
export async function getUserOwnerIds(userId: string, role: string): Promise<string[] | null> {
  if (role === 'admin') {
    return null // Admin sees everything
  }

  const owners = await prisma.owner.findMany({
    where: { userId },
    select: { id: true },
  })

  return owners.map((o) => o.id)
}

/**
 * Build a Prisma where clause for owner-scoped data.
 * Returns {} for admin (no filter), or { ownerId: { in: ownerIds } } for users.
 */
export function buildOwnerFilter(ownerIds: string[] | null): Record<string, unknown> {
  if (ownerIds === null) return {} // Admin — no filter
  return { ownerId: { in: ownerIds } }
}

/**
 * Check if a specific owner belongs to the current user.
 * Admin always returns true.
 */
export async function verifyOwnerAccess(ownerId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true

  const owner = await prisma.owner.findFirst({
    where: { id: ownerId, userId },
  })

  return owner !== null
}
