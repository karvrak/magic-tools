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
    description: 'Duel classique, premier à 0 PV perd',
    players: 2,
    startingLife: 20,
    hasTeams: false,
    hasVictoryPoints: false,
    hasCommanderDamage: false,
  },
  FREE_FOR_ALL_3: {
    mode: 'FREE_FOR_ALL_3',
    name: '1v1v1 Victory Points',
    description: '+1 VP par dégât de combat. Score final = PV + VP',
    players: 3,
    startingLife: 20,
    hasTeams: false,
    hasVictoryPoints: true,
    hasCommanderDamage: false,
  },
  TWO_HEADED_GIANT: {
    mode: 'TWO_HEADED_GIANT',
    name: '2v2 Team Battle',
    description: 'À 0 PV, drain 1 PV de l\'allié. Première équipe à 0 total perd',
    players: 4,
    startingLife: 20,
    hasTeams: true,
    hasVictoryPoints: false,
    hasCommanderDamage: false,
  },
  COMMANDER: {
    mode: 'COMMANDER',
    name: 'Commander',
    description: '40 PV, 21 dégâts d\'un même commandant = élimination',
    players: 4,
    startingLife: 40,
    hasTeams: false,
    hasVictoryPoints: false,
    hasCommanderDamage: true,
    commanderDamageThreshold: 21,
  },
}

// État d'un joueur pendant la partie (client-side)
export interface PlayerState {
  id: string
  deckId: string | null
  deckName: string
  deckImageUrl?: string | null // URL de l'image du deck (commander ou artwork)
  playerOrder: number
  team: number | null
  currentLife: number
  startingLife: number
  victoryPoints: number
  isEliminated: boolean
  commanderDamage: Record<string, number> // { "1": 5, "2": 12 } = reçu 5 du joueur 1, 12 du joueur 2
  diceRoll?: number // Résultat du lancer de dé initial
}

// Données pour créer une bataille
export interface CreateBattleInput {
  mode: GameMode
  players: {
    deckId: string | null
    deckName: string
    team?: number
  }[]
}

// Résultat de la bataille
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
    score?: number // PV + VP pour le mode FFA
  }[]
}

// Battle complet depuis la DB
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
