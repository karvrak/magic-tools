import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaShutdownRegistered: boolean | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

// Always cache on globalThis — prevents duplicate clients in both dev (HMR) and production (module re-evaluation)
globalForPrisma.prisma = prisma

// Register shutdown handlers exactly once via globalThis flag
if (typeof process !== 'undefined' && !globalForPrisma.prismaShutdownRegistered) {
  globalForPrisma.prismaShutdownRegistered = true

  const shutdown = async () => {
    await prisma.$disconnect()
  }

  process.once('beforeExit', shutdown)
  process.once('SIGINT', () => {
    shutdown().then(() => process.exit(0))
  })
  process.once('SIGTERM', () => {
    shutdown().then(() => process.exit(0))
  })
}

export default prisma
