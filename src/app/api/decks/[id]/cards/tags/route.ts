import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getRequestUser, verifyOwnerAccess } from '@/lib/api-auth'
import { syncDeckCardTagsSchema } from '@/lib/validations'

// PATCH /api/decks/[id]/cards/tags
// Body: { deckCardId, cardTagIds: string[] }
// Remplace l'ensemble des tags assignés à un DeckCard donné. Les tags doivent:
//   * appartenir à l'utilisateur courant
//   * être soit globaux (deckId null), soit appartenir au même deck
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getRequestUser()
    const { id: deckId } = await params

    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      select: { ownerId: true },
    })
    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }
    if (deck.ownerId === null) {
      if (role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      const allowed = await verifyOwnerAccess(deck.ownerId, userId, role)
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const body = await request.json()
    const parsed = syncDeckCardTagsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { deckCardId, cardTagIds } = parsed.data

    const deckCard = await prisma.deckCard.findUnique({
      where: { id: deckCardId },
      select: { id: true, deckId: true, card: { select: { oracleId: true } } },
    })
    if (!deckCard || deckCard.deckId !== deckId) {
      return NextResponse.json({ error: 'DeckCard not found in this deck' }, { status: 404 })
    }
    const oracleId = deckCard.card.oracleId

    // Identifie le propriétaire des tags : l'owner réel du deck (qui peut
    // différer de l'utilisateur en cours si admin). C'est lui qui détient
    // les tags globaux (UserCardTag).
    const deckOwner = deck.ownerId
      ? await prisma.owner.findUnique({ where: { id: deck.ownerId }, select: { userId: true } })
      : null
    const tagOwnerUserId = deckOwner?.userId ?? userId

    // Charge les tags pour les classer global vs deck.
    let deckTagIds: string[] = []
    let globalTagIds: string[] = []
    if (cardTagIds.length > 0) {
      const tags = await prisma.cardTag.findMany({
        where: {
          id: { in: cardTagIds },
          userId: role === 'admin' ? undefined : tagOwnerUserId,
          OR: [{ deckId: null }, { deckId }],
        },
        select: { id: true, deckId: true, userId: true },
      })
      if (tags.length !== new Set(cardTagIds).size) {
        return NextResponse.json(
          { error: 'One or more tags are invalid or not accessible in this deck' },
          { status: 400 }
        )
      }
      deckTagIds = tags.filter((t) => t.deckId !== null).map((t) => t.id)
      globalTagIds = tags.filter((t) => t.deckId === null).map((t) => t.id)
    }

    // Sync DeckCardTag (deck-scope uniquement) et UserCardTag (global, par oracleId).
    // Pour les globaux on ne touche QUE les tags de ce oracleId présents dans la
    // requête : si l'utilisateur retire un tag déjà absent on n'affecte rien.
    // Pour différencier "ce tag a été retiré" vs "ce tag n'a jamais été coché",
    // on prend la position de référence: l'union des tags actuellement assignés
    // sur cet oracleId pour cet utilisateur. Si un tag global est absent du payload
    // mais présent en base, on le retire.
    const currentGlobals = await prisma.userCardTag.findMany({
      where: { userId: tagOwnerUserId, oracleId },
      select: { cardTagId: true },
    })
    const currentGlobalIds = currentGlobals.map((g) => g.cardTagId)
    const toRemoveGlobals = currentGlobalIds.filter((id) => !globalTagIds.includes(id))

    await prisma.$transaction([
      // DeckCardTag : ne supprime QUE les tags deck-scope (les globaux y sont
      // par convention déjà absents post-migration, mais on garde la sécurité).
      prisma.deckCardTag.deleteMany({
        where: {
          deckCardId,
          cardTag: { deckId: { not: null } },
          ...(deckTagIds.length > 0 && { cardTagId: { notIn: deckTagIds } }),
        },
      }),
      ...deckTagIds.map((cardTagId) =>
        prisma.deckCardTag.upsert({
          where: { deckCardId_cardTagId: { deckCardId, cardTagId } },
          create: { deckCardId, cardTagId },
          update: {},
        })
      ),
      // UserCardTag : ajoute les globaux nouveaux, retire ceux décochés.
      ...(toRemoveGlobals.length > 0
        ? [
            prisma.userCardTag.deleteMany({
              where: { userId: tagOwnerUserId, oracleId, cardTagId: { in: toRemoveGlobals } },
            }),
          ]
        : []),
      ...globalTagIds.map((cardTagId) =>
        prisma.userCardTag.upsert({
          where: { userId_oracleId_cardTagId: { userId: tagOwnerUserId, oracleId, cardTagId } },
          create: { userId: tagOwnerUserId, oracleId, cardTagId },
          update: {},
        })
      ),
    ])

    // Renvoie l'état final fusionné (deck-scope + global pour cet oracleId).
    const [updatedDeckTags, updatedGlobals] = await Promise.all([
      prisma.deckCardTag.findMany({
        where: { deckCardId },
        include: { cardTag: true },
      }),
      prisma.userCardTag.findMany({
        where: { userId: tagOwnerUserId, oracleId },
        include: { cardTag: true },
      }),
    ])

    const seen = new Set<string>()
    const mergedTags: { id: string; name: string; color: string; scope: 'deck' | 'global' }[] = []
    for (const row of updatedDeckTags) {
      if (seen.has(row.cardTag.id)) continue
      seen.add(row.cardTag.id)
      mergedTags.push({
        id: row.cardTag.id,
        name: row.cardTag.name,
        color: row.cardTag.color,
        scope: row.cardTag.deckId ? 'deck' : 'global',
      })
    }
    for (const row of updatedGlobals) {
      if (seen.has(row.cardTag.id)) continue
      seen.add(row.cardTag.id)
      mergedTags.push({
        id: row.cardTag.id,
        name: row.cardTag.name,
        color: row.cardTag.color,
        scope: 'global',
      })
    }

    return NextResponse.json({ deckCardId, tags: mergedTags })
  } catch (error) {
    console.error('Error syncing deck card tags:', error)
    return NextResponse.json({ error: 'Failed to sync deck card tags' }, { status: 500 })
  }
}
