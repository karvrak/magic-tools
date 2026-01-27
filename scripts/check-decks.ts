import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const decks = await prisma.deck.findMany({
    select: {
      id: true,
      name: true,
      ownerId: true,
      owner: {
        select: { name: true }
      }
    }
  })
  
  console.log('Decks in database:')
  console.log(JSON.stringify(decks, null, 2))
  
  const owners = await prisma.owner.findMany()
  console.log('\nOwners in database:')
  console.log(JSON.stringify(owners, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
