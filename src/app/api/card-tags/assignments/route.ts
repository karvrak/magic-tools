import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getRequestUser } from '@/lib/api-auth'
import { syncOracleCardTagsSchema } from '@/lib/validations'

// GET /api/card-tags/assignments?oracleIds=a,b,c
// Renvoie, pour chaque oracleId demandé (ou tous si omis), la liste des
// tags globaux assignés par l'utilisateur courant.
// Réponse: { assignments: { [oracleId]: { id, name, color }[] } }
export async function GET(request: NextRequest) {
  try {
    const { userId } = await getRequestUser()
    const oracleIdsParam = request.nextUrl.searchParams.get('oracleIds')
    const oracleIds = oracleIdsParam
      ? oracleIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : null

    const rows = await prisma.userCardTag.findMany({
      where: {
        userId,
        ...(oracleIds && oracleIds.length > 0 ? { oracleId: { in: oracleIds } } : {}),
      },
      include: { cardTag: true },
    })

    const assignments: Record<string, { id: string; name: string; color: string; scope: 'global' }[]> = {}
    for (const row of rows) {
      if (!assignments[row.oracleId]) assignments[row.oracleId] = []
      assignments[row.oracleId].push({
        id: row.cardTag.id,
        name: row.cardTag.name,
        color: row.cardTag.color,
        scope: 'global',
      })
    }

    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('Error listing user card tag assignments:', error)
    return NextResponse.json({ error: 'Failed to list assignments' }, { status: 500 })
  }
}

// PATCH /api/card-tags/assignments
// Body: { oracleId, cardTagIds: string[] }
// Remplace l'ensemble des tags globaux assignés à cet oracleId pour l'utilisateur.
// Tous les tags doivent être globaux (deckId = null) et appartenir à l'utilisateur.
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await getRequestUser()
    const body = await request.json()
    const parsed = syncOracleCardTagsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { oracleId, cardTagIds } = parsed.data

    if (cardTagIds.length > 0) {
      const tags = await prisma.cardTag.findMany({
        where: { id: { in: cardTagIds }, userId, deckId: null },
        select: { id: true },
      })
      if (tags.length !== new Set(cardTagIds).size) {
        return NextResponse.json(
          { error: 'One or more tags are invalid (must be global and owned by user)' },
          { status: 400 }
        )
      }
    }

    await prisma.$transaction([
      prisma.userCardTag.deleteMany({
        where: {
          userId,
          oracleId,
          ...(cardTagIds.length > 0 && { cardTagId: { notIn: cardTagIds } }),
        },
      }),
      ...cardTagIds.map((cardTagId) =>
        prisma.userCardTag.upsert({
          where: { userId_oracleId_cardTagId: { userId, oracleId, cardTagId } },
          create: { userId, oracleId, cardTagId },
          update: {},
        })
      ),
    ])

    const updated = await prisma.userCardTag.findMany({
      where: { userId, oracleId },
      include: { cardTag: true },
    })

    return NextResponse.json({
      oracleId,
      tags: updated.map((row) => ({
        id: row.cardTag.id,
        name: row.cardTag.name,
        color: row.cardTag.color,
        scope: 'global' as const,
      })),
    })
  } catch (error) {
    console.error('Error syncing user card tag assignments:', error)
    return NextResponse.json({ error: 'Failed to sync assignments' }, { status: 500 })
  }
}
