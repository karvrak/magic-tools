import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface DeckStats {
  name: string
  deckId: string | null
  totalMatches: number
  wins: number
  losses: number
  draws: number
  winRate: number
  gamesWon: number
  gamesLost: number
  gameWinRate: number
  // Streaks
  currentStreak: number
  bestWinStreak: number
  worstLoseStreak: number
  // Recent form (last 10)
  recentForm: ('W' | 'L' | 'D')[]
  recentWinRate: number
  // Matchups
  bestMatchup: { opponent: string; winRate: number; matches: number } | null
  worstMatchup: { opponent: string; winRate: number; matches: number } | null
}

interface MatchupStats {
  deck1: string
  deck2: string
  deck1Wins: number
  deck2Wins: number
  draws: number
  totalMatches: number
  deck1WinRate: number
}

// GET /api/matches/stats - Get comprehensive match statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deckFilter = searchParams.get('deck')?.trim()

    // Fetch all matches
    const allMatches = await prisma.match.findMany({
      orderBy: { playedAt: 'asc' },
      select: {
        id: true,
        playedAt: true,
        deck1Name: true,
        deck1Id: true,
        score1: true,
        deck2Name: true,
        deck2Id: true,
        score2: true,
      },
    })

    if (allMatches.length === 0) {
      return NextResponse.json({
        totalMatches: 0,
        totalGames: 0,
        deckStats: [],
        matchups: [],
        timeline: [],
        globalStats: {
          avgGamesPerMatch: 0,
          sweepRate: 0,
          comebackRate: 0,
        },
      })
    }

    // Build deck statistics
    const deckStatsMap = new Map<string, {
      name: string
      deckId: string | null
      matches: { won: boolean; drew: boolean; gamesWon: number; gamesLost: number; date: Date; opponent: string }[]
    }>()

    // Build matchup statistics
    const matchupMap = new Map<string, {
      deck1: string
      deck2: string
      deck1Wins: number
      deck2Wins: number
      draws: number
    }>()

    for (const match of allMatches) {
      const deck1Won = match.score1 > match.score2
      const deck2Won = match.score2 > match.score1
      const isDraw = match.score1 === match.score2

      // Update deck1 stats
      if (!deckStatsMap.has(match.deck1Name)) {
        deckStatsMap.set(match.deck1Name, {
          name: match.deck1Name,
          deckId: match.deck1Id,
          matches: [],
        })
      }
      deckStatsMap.get(match.deck1Name)!.matches.push({
        won: deck1Won,
        drew: isDraw,
        gamesWon: match.score1,
        gamesLost: match.score2,
        date: match.playedAt,
        opponent: match.deck2Name,
      })

      // Update deck2 stats
      if (!deckStatsMap.has(match.deck2Name)) {
        deckStatsMap.set(match.deck2Name, {
          name: match.deck2Name,
          deckId: match.deck2Id,
          matches: [],
        })
      }
      deckStatsMap.get(match.deck2Name)!.matches.push({
        won: deck2Won,
        drew: isDraw,
        gamesWon: match.score2,
        gamesLost: match.score1,
        date: match.playedAt,
        opponent: match.deck1Name,
      })

      // Update matchup (sort names to create consistent key)
      const [deckA, deckB] = [match.deck1Name, match.deck2Name].sort()
      const matchupKey = `${deckA}|||${deckB}`

      if (!matchupMap.has(matchupKey)) {
        matchupMap.set(matchupKey, {
          deck1: deckA,
          deck2: deckB,
          deck1Wins: 0,
          deck2Wins: 0,
          draws: 0,
        })
      }

      const matchup = matchupMap.get(matchupKey)!
      if (isDraw) {
        matchup.draws++
      } else if (deck1Won) {
        if (match.deck1Name === deckA) matchup.deck1Wins++
        else matchup.deck2Wins++
      } else {
        if (match.deck2Name === deckA) matchup.deck1Wins++
        else matchup.deck2Wins++
      }
    }

    // Calculate deck statistics
    const deckStats: DeckStats[] = []

    for (const [, data] of deckStatsMap) {
      const matches = data.matches.sort((a, b) => a.date.getTime() - b.date.getTime())
      const wins = matches.filter(m => m.won).length
      const losses = matches.filter(m => !m.won && !m.drew).length
      const draws = matches.filter(m => m.drew).length
      const totalMatches = matches.length

      const gamesWon = matches.reduce((sum, m) => sum + m.gamesWon, 0)
      const gamesLost = matches.reduce((sum, m) => sum + m.gamesLost, 0)
      const totalGames = gamesWon + gamesLost

      // Calculate streaks
      let currentStreak = 0
      let bestWinStreak = 0
      let worstLoseStreak = 0
      let tempWinStreak = 0
      let tempLoseStreak = 0

      for (const match of matches) {
        if (match.won) {
          tempWinStreak++
          tempLoseStreak = 0
          if (tempWinStreak > bestWinStreak) bestWinStreak = tempWinStreak
        } else if (!match.drew) {
          tempLoseStreak++
          tempWinStreak = 0
          if (tempLoseStreak > worstLoseStreak) worstLoseStreak = tempLoseStreak
        } else {
          tempWinStreak = 0
          tempLoseStreak = 0
        }
      }

      // Current streak (from most recent)
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i]
        if (m.drew) break
        if (m.won) {
          if (currentStreak >= 0) currentStreak++
          else break
        } else {
          if (currentStreak <= 0) currentStreak--
          else break
        }
      }

      // Recent form (last 10)
      const recentMatches = matches.slice(-10)
      const recentForm: ('W' | 'L' | 'D')[] = recentMatches.map(m =>
        m.won ? 'W' : m.drew ? 'D' : 'L'
      )
      const recentWins = recentMatches.filter(m => m.won).length
      const recentWinRate = recentMatches.length > 0 ? (recentWins / recentMatches.length) * 100 : 0

      // Calculate matchups per opponent
      const opponentStats = new Map<string, { wins: number; total: number }>()
      for (const match of matches) {
        if (!opponentStats.has(match.opponent)) {
          opponentStats.set(match.opponent, { wins: 0, total: 0 })
        }
        const opp = opponentStats.get(match.opponent)!
        opp.total++
        if (match.won) opp.wins++
      }

      // Find best and worst matchups (min 3 matches)
      let bestMatchup: { opponent: string; winRate: number; matches: number } | null = null
      let worstMatchup: { opponent: string; winRate: number; matches: number } | null = null

      for (const [opponent, stats] of opponentStats) {
        if (stats.total >= 3) {
          const winRate = (stats.wins / stats.total) * 100
          if (!bestMatchup || winRate > bestMatchup.winRate) {
            bestMatchup = { opponent, winRate, matches: stats.total }
          }
          if (!worstMatchup || winRate < worstMatchup.winRate) {
            worstMatchup = { opponent, winRate, matches: stats.total }
          }
        }
      }

      deckStats.push({
        name: data.name,
        deckId: data.deckId,
        totalMatches,
        wins,
        losses,
        draws,
        winRate: totalMatches > 0 ? (wins / (totalMatches - draws)) * 100 : 0,
        gamesWon,
        gamesLost,
        gameWinRate: totalGames > 0 ? (gamesWon / totalGames) * 100 : 0,
        currentStreak,
        bestWinStreak,
        worstLoseStreak,
        recentForm,
        recentWinRate,
        bestMatchup,
        worstMatchup,
      })
    }

    // Sort by total matches and filter if needed
    let sortedDeckStats = deckStats.sort((a, b) => b.totalMatches - a.totalMatches)

    if (deckFilter) {
      sortedDeckStats = sortedDeckStats.filter(d =>
        d.name.toLowerCase().includes(deckFilter.toLowerCase())
      )
    }

    // Format matchups
    const matchups: MatchupStats[] = Array.from(matchupMap.values())
      .map(m => ({
        ...m,
        totalMatches: m.deck1Wins + m.deck2Wins + m.draws,
        deck1WinRate: (m.deck1Wins + m.deck2Wins) > 0
          ? (m.deck1Wins / (m.deck1Wins + m.deck2Wins)) * 100
          : 50,
      }))
      .filter(m => m.totalMatches >= 3) // Only show matchups with 3+ games
      .sort((a, b) => b.totalMatches - a.totalMatches)

    // Calculate timeline (matches per month)
    const timelineMap = new Map<string, { matches: number; wins: number; games: number }>()
    for (const match of allMatches) {
      const month = `${match.playedAt.getFullYear()}-${String(match.playedAt.getMonth() + 1).padStart(2, '0')}`
      if (!timelineMap.has(month)) {
        timelineMap.set(month, { matches: 0, wins: 0, games: 0 })
      }
      const entry = timelineMap.get(month)!
      entry.matches++
      entry.games += match.score1 + match.score2
      // Count wins for deck1 (assuming it's "my" deck)
      if (match.score1 > match.score2) entry.wins++
    }

    const timeline = Array.from(timelineMap.entries())
      .map(([month, data]) => ({
        month,
        matches: data.matches,
        wins: data.wins,
        winRate: data.matches > 0 ? (data.wins / data.matches) * 100 : 0,
        avgGames: data.matches > 0 ? data.games / data.matches : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // Global stats
    const totalGames = allMatches.reduce((sum, m) => sum + m.score1 + m.score2, 0)
    const sweeps = allMatches.filter(m => (m.score1 === 2 && m.score2 === 0) || (m.score2 === 2 && m.score1 === 0)).length
    const comebacks = allMatches.filter(m =>
      (m.score1 === 2 && m.score2 === 1) || (m.score2 === 2 && m.score1 === 1)
    ).length
    const deck1Wins = allMatches.filter(m => m.score1 > m.score2).length

    // Most played day of week
    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]
    for (const match of allMatches) {
      dayOfWeekCounts[match.playedAt.getDay()]++
    }
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
    const mostPlayedDay = dayNames[dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts))]

    // Longest session (most matches in a single day)
    const matchesByDate = new Map<string, number>()
    for (const match of allMatches) {
      const dateKey = match.playedAt.toISOString().split('T')[0]
      matchesByDate.set(dateKey, (matchesByDate.get(dateKey) || 0) + 1)
    }
    const longestSession = Math.max(...matchesByDate.values())
    const longestSessionDate = Array.from(matchesByDate.entries())
      .find(([, count]) => count === longestSession)?.[0]

    // Most common opponent
    const opponentCounts = new Map<string, number>()
    for (const match of allMatches) {
      opponentCounts.set(match.deck2Name, (opponentCounts.get(match.deck2Name) || 0) + 1)
    }
    const mostCommonOpponent = Array.from(opponentCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]

    // Rivalry (most played matchup)
    const topRivalry = matchups[0]

    return NextResponse.json({
      totalMatches: allMatches.length,
      totalGames,
      uniqueDecks: deckStatsMap.size,
      deckStats: sortedDeckStats,
      matchups: matchups.slice(0, 50), // Top 50 matchups
      timeline,
      globalStats: {
        avgGamesPerMatch: allMatches.length > 0 ? totalGames / allMatches.length : 0,
        sweepRate: allMatches.length > 0 ? (sweeps / allMatches.length) * 100 : 0,
        comebackRate: allMatches.length > 0 ? (comebacks / allMatches.length) * 100 : 0,
        deck1WinRate: allMatches.length > 0 ? (deck1Wins / allMatches.length) * 100 : 0,
        mostPlayedDay,
        longestSession,
        longestSessionDate,
        mostCommonOpponent: mostCommonOpponent ? {
          name: mostCommonOpponent[0],
          matches: mostCommonOpponent[1],
        } : null,
        topRivalry: topRivalry ? {
          deck1: topRivalry.deck1,
          deck2: topRivalry.deck2,
          matches: topRivalry.totalMatches,
        } : null,
      },
    })
  } catch (error) {
    console.error('Error fetching match stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch match stats' },
      { status: 500 }
    )
  }
}
