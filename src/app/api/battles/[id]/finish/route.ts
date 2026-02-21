import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { GAME_MODES, type BattleResult } from '@/types/battle'
import { finishBattleSchema } from '@/lib/validations'

// POST /api/battles/[id]/finish - Finish a battle and record the results
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = finishBattleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Retrieve the battle
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

    // Update each player
    for (const playerUpdate of parsed.data.players) {
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

    // Calculate the winner based on the mode
    let winnerId: string | null = null
    let winnerTeam: number | null = null

    const updatedPlayers = parsed.data.players.map((p) => {
      const original = battle.players.find((bp) => bp.id === p.id)!
      return {
        ...original,
        finalLife: p.finalLife,
        victoryPoints: p.victoryPoints,
        isEliminated: p.isEliminated,
      }
    })

    if (modeConfig.hasTeams) {
      // 2v2 mode: team with the fewest eliminated players wins
      const team1Eliminated = updatedPlayers.filter((p) => p.team === 1 && p.isEliminated).length
      const team2Eliminated = updatedPlayers.filter((p) => p.team === 2 && p.isEliminated).length

      if (team1Eliminated >= 2) {
        winnerTeam = 2
      } else if (team2Eliminated >= 2) {
        winnerTeam = 1
      } else {
        // Tie based on total life points
        const team1Life = updatedPlayers.filter((p) => p.team === 1).reduce((sum, p) => sum + p.finalLife, 0)
        const team2Life = updatedPlayers.filter((p) => p.team === 2).reduce((sum, p) => sum + p.finalLife, 0)
        winnerTeam = team1Life >= team2Life ? 1 : 2
      }
    } else if (modeConfig.hasVictoryPoints) {
      // 1v1v1 mode: score = life points + victory points
      const scores = updatedPlayers.map((p) => ({
        id: p.id,
        score: p.finalLife + p.victoryPoints,
        isEliminated: p.isEliminated,
      }))

      // Survivors first, then by score
      const sorted = scores.sort((a, b) => {
        if (a.isEliminated !== b.isEliminated) {
          return a.isEliminated ? 1 : -1
        }
        return b.score - a.score
      })

      winnerId = sorted[0].id
    } else {
      // Classic modes: last survivor or highest life points
      const survivors = updatedPlayers.filter((p) => !p.isEliminated)

      if (survivors.length === 1) {
        winnerId = survivors[0].id
      } else if (survivors.length > 1) {
        // Highest life points wins
        const sorted = survivors.sort((a, b) => b.finalLife - a.finalLife)
        winnerId = sorted[0].id
      } else {
        // All eliminated - last one to be eliminated (based on highest final life points)
        const sorted = updatedPlayers.sort((a, b) => b.finalLife - a.finalLife)
        winnerId = sorted[0].id
      }
    }

    // Update the battle
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

    // Auto-create Match record from battle data
    try {
      const battlePlayers = finishedBattle.players
      if (battlePlayers.length === 2 && !modeConfig.hasTeams) {
        // Classic 1v1: create a single Match
        const p1 = battlePlayers[0]
        const p2 = battlePlayers[1]

        let score1 = 0
        let score2 = 0
        if (winnerId === p1.id) {
          score1 = 2
          score2 = 0
        } else if (winnerId === p2.id) {
          score1 = 0
          score2 = 2
        } else {
          // Tie or no clear winner — compare life
          score1 = p1.finalLife >= p2.finalLife ? 1 : 0
          score2 = p2.finalLife >= p1.finalLife ? 1 : 0
        }

        await prisma.match.create({
          data: {
            playedAt: finishedBattle.startedAt ?? new Date(),
            deck1Name: p1.deckName,
            deck1Id: p1.deckId ?? null,
            score1,
            deck2Name: p2.deckName,
            deck2Id: p2.deckId ?? null,
            score2,
            source: 'battle',
            battleId: finishedBattle.id,
          },
        })
      } else if (battlePlayers.length >= 3 && !modeConfig.hasTeams) {
        // Multiplayer (FFA/Commander): create a match per unique pair
        for (let i = 0; i < battlePlayers.length; i++) {
          for (let j = i + 1; j < battlePlayers.length; j++) {
            const pA = battlePlayers[i]
            const pB = battlePlayers[j]

            let scoreA = 0
            let scoreB = 0
            if (pA.isEliminated && !pB.isEliminated) {
              scoreA = 0
              scoreB = 2
            } else if (pB.isEliminated && !pA.isEliminated) {
              scoreA = 2
              scoreB = 0
            } else if (pA.finalLife > pB.finalLife) {
              scoreA = 2
              scoreB = 1
            } else if (pB.finalLife > pA.finalLife) {
              scoreA = 1
              scoreB = 2
            } else {
              scoreA = 1
              scoreB = 1
            }

            await prisma.match.create({
              data: {
                playedAt: finishedBattle.startedAt ?? new Date(),
                deck1Name: pA.deckName,
                deck1Id: pA.deckId ?? null,
                score1: scoreA,
                deck2Name: pB.deckName,
                deck2Id: pB.deckId ?? null,
                score2: scoreB,
                source: 'battle',
                battleId: finishedBattle.id,
              },
            })
          }
        }
      }
      // Team battles (2HG) are skipped for now — no clean 1v1 mapping
    } catch (matchError) {
      // Match creation failure should not block battle finish
      console.error('Failed to auto-create match from battle:', matchError)
    }

    // Build the result
    const result: BattleResult = {
      winnerId: winnerId || undefined,
      winnerTeam: winnerTeam || undefined,
      winnerName: winnerId
        ? finishedBattle.players.find((p) => p.id === winnerId)?.deckName
        : winnerTeam
        ? `Team ${winnerTeam}`
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
