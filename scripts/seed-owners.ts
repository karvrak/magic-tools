import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INITIAL_OWNERS = [
  { name: 'Leo', color: '#D4AF37', isDefault: true },      // Gold - Propriétaire par défaut
  { name: 'FH', color: '#8B5CF6', isDefault: false },      // Purple/Arcane
  { name: 'Tancrede', color: '#22C55E', isDefault: false }, // Green/Nature
]

async function main() {
  console.log('🧙 Seeding owners...')

  for (const owner of INITIAL_OWNERS) {
    const existing = await prisma.owner.findUnique({
      where: { name: owner.name },
    })

    if (existing) {
      console.log(`  ⏭️  Owner "${owner.name}" already exists`)
    } else {
      await prisma.owner.create({ data: owner })
      console.log(`  ✅ Created owner "${owner.name}"`)
    }
  }

  console.log('✨ Done!')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
