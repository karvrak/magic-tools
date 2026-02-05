// ============================================
// BATTLE TYPES
// ============================================

export type GameMode = 'CLASSIC_1V1' | 'FREE_FOR_ALL_3' | 'TWO_HEADED_GIANT' | 'COMMANDER'

export interface GameModeConfig {
  mode: GameMode
  name: string
  description: string
  players: number
  startingLife: number
  hasTeams: boolean
  hasVictoryPoints: boolean
  hasCommanderDamage: boolean
  commanderDamageThreshold?: number
}

export const GAME_MODES: Record<GameMode, GameModeConfig> = {
  CLASSIC_1V1: {
    mode: 'CLASSIC_1V1',
    name: '1v1 Classic',
    description: 'Classic duel, first to 0 LP loses',
    players: 2,
    startingLife: 20,
    hasTeams: false,
    hasVictoryPoints: false,
    hasCommanderDamage: false,
  },
  FREE_FOR_ALL_3: {
    mode: 'FREE_FOR_ALL_3',
    name: '1v1v1 Victory Points',
    description: '+1 VP per combat damage. Final score = LP + VP',
    players: 3,
    startingLife: 20,
    hasTeams: false,
    hasVictoryPoints: true,
    hasCommanderDamage: false,
  },
  TWO_HEADED_GIANT: {
    mode: 'TWO_HEADED_GIANT',
    name: '2v2 Team Battle',
    description: 'At 0 LP, drain 1 LP from ally. First team to 0 total loses',
    players: 4,
    startingLife: 20,
    hasTeams: true,
    hasVictoryPoints: false,
    hasCommanderDamage: false,
  },
  COMMANDER: {
    mode: 'COMMANDER',
    name: 'Commander',
    description: '40 LP, 21 damage from same commander = elimination',
    players: 4,
    startingLife: 40,
    hasTeams: false,
    hasVictoryPoints: false,
    hasCommanderDamage: true,
    commanderDamageThreshold: 21,
  },
}

// Player state during the game (client-side)
export interface PlayerState {
  id: string
  deckId: string | null
  deckName: string
  deckImageUrl?: string | null // Deck image URL (commander or artwork)
  playerOrder: number
  team: number | null
  currentLife: number
  startingLife: number
  victoryPoints: number
  isEliminated: boolean
  commanderDamage: Record<string, number> // { "1": 5, "2": 12 } = received 5 from player 1, 12 from player 2
  diceRoll?: number // Initial dice roll result
}

// Data for creating a battle
export interface CreateBattleInput {
  mode: GameMode
  players: {
    deckId: string | null
    deckName: string
    team?: number
  }[]
}

// Battle result
export interface BattleResult {
  winnerId?: string
  winnerTeam?: number
  winnerName?: string
  players: {
    id: string
    deckName: string
    finalLife: number
    victoryPoints: number
    isEliminated: boolean
    team?: number
    score?: number // LP + VP for FFA mode
  }[]
}

// Complete battle from DB
export interface Battle {
  id: string
  mode: GameMode
  status: 'active' | 'finished'
  winnerId: string | null
  winnerTeam: number | null
  players: BattlePlayer[]
  startedAt: string
  finishedAt: string | null
}

export interface BattlePlayer {
  id: string
  battleId: string
  deckId: string | null
  deckName: string
  playerOrder: number
  team: number | null
  startingLife: number
  finalLife: number
  victoryPoints: number
  isEliminated: boolean
  commanderDamage: Record<string, number>
}
