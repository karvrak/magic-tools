import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getRequestUser } from '@/lib/api-auth'
import { updateCardTagSchema } from '@/lib/validations'

// Vérifie que le tag appartient bien à l'utilisateur (ou que c'est un admin).
async function loadTagOwned(tagId: string, userId: string, role: string) {
  const tag = await prisma.cardTag.findUnique({ where: { id: tagId } })
  if (!tag) return { error: 'not_found' as const }
  if (role !== 'admin' && tag.userId !== userId) return { error: 'forbidden' as const }
  return { tag }
}

// PATCH /api/card-tags/[id] — renommer ou recolorer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getRequestUser()
    const { id } = await params
    const loaded = await loadTagOwned(id, userId, role)
    if ('error' in loaded) {
      return NextResponse.json(
        { error: loaded.error === 'not_found' ? 'Tag not found' : 'Forbidden' },
        { status: loaded.error === 'not_found' ? 404 : 403 }
      )
    }

    const body = await request.json()
    const parsed = updateCardTagSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { name, color } = parsed.data

    // Si on change le nom, vérifier qu'il n'y a pas de doublon dans le même scope.
    if (name && name !== loaded.tag.name) {
      const dup = await prisma.cardTag.findFirst({
        where: { userId: loaded.tag.userId, deckId: loaded.tag.deckId, name },
      })
      if (dup) {
        return NextResponse.json({ error: 'Tag with that name already exists' }, { status: 409 })
      }
    }

    const tag = await prisma.cardTag.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
      },
    })

    return NextResponse.json({
      tag: {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        deckId: tag.deckId,
        scope: tag.deckId ? 'deck' : 'global',
      },
    })
  } catch (error) {
    console.error('Error updating card tag:', error)
    return NextResponse.json({ error: 'Failed to update card tag' }, { status: 500 })
  }
}

// DELETE /api/card-tags/[id] — supprime le tag (cascade vers DeckCardTag)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getRequestUser()
    const { id } = await params
    const loaded = await loadTagOwned(id, userId, role)
    if ('error' in loaded) {
      return NextResponse.json(
        { error: loaded.error === 'not_found' ? 'Tag not found' : 'Forbidden' },
        { status: loaded.error === 'not_found' ? 404 : 403 }
      )
    }

    await prisma.cardTag.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting card tag:', error)
    return NextResponse.json({ error: 'Failed to delete card tag' }, { status: 500 })
  }
}
