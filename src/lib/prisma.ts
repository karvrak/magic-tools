import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma Client singleton with connection pool configuration.
 *
 * Connection pool settings are configured via DATABASE_URL query params:
 * - connection_limit: Max connections in pool (default: 10)
 * - pool_timeout: Seconds to wait for available connection (default: 10)
 * - connect_timeout: Seconds for initial connection (default: 5)
 *
 * Example DATABASE_URL:
 * postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=10&connect_timeout=5
 *
 * For production with memory constraints, consider:
 * - connection_limit=5 (fewer idle connections)
 * - pool_timeout=10 (fail fast if pool exhausted)
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

// Only cache client in development to avoid HMR connection leaks
// In production, the singleton is maintained by the module system
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Graceful shutdown - close connections on process exit
// This prevents connection leaks on server restarts
if (typeof process !== 'undefined') {
  const shutdown = async () => {
    await prisma.$disconnect()
  }

  process.on('beforeExit', shutdown)
  process.on('SIGINT', () => {
    shutdown().then(() => process.exit(0))
  })
  process.on('SIGTERM', () => {
    shutdown().then(() => process.exit(0))
  })
}

export default prisma
