import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@magictools.local'
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.AUTH_PASSWORD || 'changeme'

  console.log(`Seeding admin user: ${adminEmail}`)

  const hashedPassword = await bcrypt.hash(adminPassword, 12)

  // Upsert admin user
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: hashedPassword,
      role: 'admin',
    },
    create: {
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
    },
  })

  console.log(`Admin user created/updated: ${admin.id}`)

  // Link all existing orphan owners (userId=null) to admin
  const orphanOwners = await prisma.owner.findMany({
    where: { userId: null },
  })

  if (orphanOwners.length > 0) {
    // Check for name conflicts before linking
    const adminOwners = await prisma.owner.findMany({
      where: { userId: admin.id },
      select: { name: true },
    })
    const adminOwnerNames = new Set(adminOwners.map((o) => o.name))

    for (const owner of orphanOwners) {
      if (adminOwnerNames.has(owner.name)) {
        console.log(`  Skipping owner "${owner.name}" — name already exists for admin`)
        continue
      }
      await prisma.owner.update({
        where: { id: owner.id },
        data: { userId: admin.id },
      })
      console.log(`  Linked owner "${owner.name}" to admin`)
    }
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
