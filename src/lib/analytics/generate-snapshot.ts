import prisma from '@/lib/prisma'

/**
 * Generate a collection snapshot for a specific owner (or global if null).
 * Calculates total value, total cards, and rarity breakdown from the collection.
 */
export async function generateSnapshot(ownerId: string | null) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get all collection items for this owner
  const collectionItems = await prisma.collectionItem.findMany({
    where: ownerId ? { ownerId } : {},
    include: {
      card: {
        select: {
          rarity: true,
          priceEur: true,
          priceUsd: true,
        },
      },
    },
  })

  let totalValue = 0
  let totalCards = 0
  const rarityCount: Record<string, number> = {
    common: 0,
    uncommon: 0,
    rare: 0,
    mythic: 0,
  }

  for (const item of collectionItems) {
    totalCards += item.quantity
    const rarity = item.card.rarity.toLowerCase()
    rarityCount[rarity] = (rarityCount[rarity] || 0) + item.quantity

    // Calculate price from card-specific prices
    let price = 0
    if (item.card.priceEur != null) {
      price = item.card.priceEur
    } else if (item.card.priceUsd != null) {
      price = item.card.priceUsd * 0.92
    }

    totalValue += price * item.quantity
  }

  const snapshotData = {
    totalValue,
    totalCards,
    rarityBreakdown: rarityCount,
  }

  // For null ownerId (global), we can't use the composite unique constraint
  // because PostgreSQL treats NULLs as distinct in unique indexes
  if (ownerId) {
    return prisma.collectionSnapshot.upsert({
      where: {
        ownerId_date: { ownerId, date: today },
      },
      update: snapshotData,
      create: {
        ownerId,
        date: today,
        ...snapshotData,
      },
    })
  }

  // Global snapshot: find existing or create
  const existing = await prisma.collectionSnapshot.findFirst({
    where: { ownerId: null, date: today },
  })

  if (existing) {
    return prisma.collectionSnapshot.update({
      where: { id: existing.id },
      data: snapshotData,
    })
  }

  return prisma.collectionSnapshot.create({
    data: {
      ownerId: null,
      date: today,
      ...snapshotData,
    },
  })
}

/**
 * Generate snapshots for all owners + a global one.
 */
export async function generateAllSnapshots() {
  const owners = await prisma.owner.findMany({ select: { id: true } })

  const results = []

  // Global snapshot (all owners combined)
  results.push(await generateSnapshot(null))

  // Per-owner snapshots
  for (const owner of owners) {
    results.push(await generateSnapshot(owner.id))
  }

  return results
}
