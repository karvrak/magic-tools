import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { GAME_MODES, type BattleResult } from '@/types/battle'

interface FinishBattleInput {
  players: {
    id: string
    finalLife: number
    victoryPoints: number
    isEliminated: boolean
    commanderDamage: Record<string, number>
  }[]
}

// POST /api/battles/[id]/finish - Terminer une bataille et enregistrer les résultats
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body: FinishBattleInput = await request.json()

    // Récupérer la bataille
    const battle = await prisma.battle.findUnique({
      where: { id },
      include: {
        players: {
          orderBy: { playerOrder: 'asc' },
        },
      },
    })

    if (!battle) {
      return NextResponse.json(
        { error: 'Battle not found' },
        { status: 404 }
      )
    }

    if (battle.status === 'finished') {
      return NextResponse.json(
        { error: 'Battle is already finished' },
        { status: 400 }
      )
    }

    const modeConfig = GAME_MODES[battle.mode]

    // Mettre à jour chaque joueur
    for (const playerUpdate of body.players) {
      await prisma.battlePlayer.update({
        where: { id: playerUpdate.id },
        data: {
          finalLife: playerUpdate.finalLife,
          victoryPoints: playerUpdate.victoryPoints,
          isEliminated: playerUpdate.isEliminated,
          commanderDamage: playerUpdate.commanderDamage,
        },
      })
    }

    // Calculer le gagnant selon le mode
    let winnerId: string | null = null
    let winnerTeam: number | null = null

    const updatedPlayers = body.players.map((p) => {
      const original = battle.players.find((bp) => bp.id === p.id)!
      return {
        ...original,
        finalLife: p.finalLife,
        victoryPoints: p.victoryPoints,
        isEliminated: p.isEliminated,
      }
    })

    if (modeConfig.hasTeams) {
      // Mode 2v2 : équipe avec le moins d'éliminés gagne
      const team1Eliminated = updatedPlayers.filter((p) => p.team === 1 && p.isEliminated).length
      const team2Eliminated = updatedPlayers.filter((p) => p.team === 2 && p.isEliminated).length

      if (team1Eliminated >= 2) {
        winnerTeam = 2
      } else if (team2Eliminated >= 2) {
        winnerTeam = 1
      } else {
        // Égalité basée sur les PV totaux
        const team1Life = updatedPlayers.filter((p) => p.team === 1).reduce((sum, p) => sum + p.finalLife, 0)
        const team2Life = updatedPlayers.filter((p) => p.team === 2).reduce((sum, p) => sum + p.finalLife, 0)
        winnerTeam = team1Life >= team2Life ? 1 : 2
      }
    } else if (modeConfig.hasVictoryPoints) {
      // Mode 1v1v1 : score = PV + VP
      const scores = updatedPlayers.map((p) => ({
        id: p.id,
        score: p.finalLife + p.victoryPoints,
        isEliminated: p.isEliminated,
      }))

      // Survivants d'abord, puis par score
      const sorted = scores.sort((a, b) => {
        if (a.isEliminated !== b.isEliminated) {
          return a.isEliminated ? 1 : -1
        }
        return b.score - a.score
      })

      winnerId = sorted[0].id
    } else {
      // Modes classiques : dernier survivant ou plus de PV
      const survivors = updatedPlayers.filter((p) => !p.isEliminated)

      if (survivors.length === 1) {
        winnerId = survivors[0].id
      } else if (survivors.length > 1) {
        // Plus de PV gagne
        const sorted = survivors.sort((a, b) => b.finalLife - a.finalLife)
        winnerId = sorted[0].id
      } else {
        // Tous éliminés - dernier à être éliminé (basé sur les PV finaux les plus hauts)
        const sorted = updatedPlayers.sort((a, b) => b.finalLife - a.finalLife)
        winnerId = sorted[0].id
      }
    }

    // Mettre à jour la bataille
    const finishedBattle = await prisma.battle.update({
      where: { id },
      data: {
        status: 'finished',
        winnerId,
        winnerTeam,
        finishedAt: new Date(),
      },
      include: {
        players: {
          orderBy: { playerOrder: 'asc' },
          include: {
            deck: {
              select: {
                id: true,
                name: true,
                coverImage: true,
              },
            },
          },
        },
      },
    })

    // Construire le résultat
    const result: BattleResult = {
      winnerId: winnerId || undefined,
      winnerTeam: winnerTeam || undefined,
      winnerName: winnerId
        ? finishedBattle.players.find((p) => p.id === winnerId)?.deckName
        : winnerTeam
        ? `Équipe ${winnerTeam}`
        : undefined,
      players: finishedBattle.players.map((p) => ({
        id: p.id,
        deckName: p.deckName,
        finalLife: p.finalLife,
        victoryPoints: p.victoryPoints,
        isEliminated: p.isEliminated,
        team: p.team || undefined,
        score: modeConfig.hasVictoryPoints ? p.finalLife + p.victoryPoints : undefined,
      })),
    }

    return NextResponse.json({ battle: finishedBattle, result })
  } catch (error) {
    console.error('Error finishing battle:', error)
    return NextResponse.json(
      { error: 'Failed to finish battle' },
      { status: 500 }
    )
  }
}
