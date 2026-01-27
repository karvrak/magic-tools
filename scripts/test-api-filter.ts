import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const fhOwnerId = 'cmjwxyiat000112c8k80zcznn'
  
  console.log('Testing filter with ownerId:', fhOwnerId)
  
  // Test the exact query from the API
  const decks = await prisma.deck.findMany({
    where: fhOwnerId ? { ownerId: fhOwnerId } : undefined,
    orderBy: { updatedAt: 'desc' },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
    },
  })
  
  console.log('\nFiltered decks:')
  console.log(JSON.stringify(decks.map(d => ({ id: d.id, name: d.name, owner: d.owner?.name })), null, 2))
  console.log(`\nTotal: ${decks.length} deck(s)`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
