export const GAME_PHASES = [
  'untap',
  'upkeep',
  'draw',
  'main1',
  'combat_begin',
  'combat_attackers',
  'combat_blockers',
  'combat_damage',
  'combat_end',
  'main2',
  'end',
  'cleanup',
] as const

export type GamePhase = typeof GAME_PHASES[number]

export const PHASE_DISPLAY_NAMES: Record<GamePhase, string> = {
  untap: 'Untap',
  upkeep: 'Upkeep',
  draw: 'Draw',
  main1: 'Main Phase 1',
  combat_begin: 'Beginning of Combat',
  combat_attackers: 'Declare Attackers',
  combat_blockers: 'Declare Blockers',
  combat_damage: 'Combat Damage',
  combat_end: 'End of Combat',
  main2: 'Main Phase 2',
  end: 'End Step',
  cleanup: 'Cleanup',
}

export const COMBAT_SUB_PHASES: GamePhase[] = [
  'combat_begin',
  'combat_attackers',
  'combat_blockers',
  'combat_damage',
  'combat_end',
]

export const EMOTES = [
  { id: 'gg', label: 'GG' },
  { id: 'nice', label: 'Nice!' },
  { id: 'oops', label: 'Oops' },
  { id: 'thinking', label: 'Thinking...' },
  { id: 'letsgo', label: "Let's go!" },
] as const

export const KEYBOARD_SHORTCUTS: Record<string, string> = {
  d: 'Draw a card',
  u: 'Untap all',
  'Space': 'Advance phase',
  'Enter': 'End turn',
  s: 'Shuffle library',
  t: 'Create token',
  g: 'Open graveyard',
  'Ctrl+Z': 'Undo last action',
  'Escape': 'Close overlays',
  '?': 'Show keyboard help',
}

export const MANA_COLORS = ['W', 'U', 'B', 'R', 'G', 'C'] as const
export type ManaColor = typeof MANA_COLORS[number]

export const MANA_COLOR_STYLES: Record<ManaColor, string> = {
  W: 'bg-amber-200 text-amber-900 border-amber-300',
  U: 'bg-blue-500 text-white border-blue-400',
  B: 'bg-gray-900 text-gray-100 border-gray-700',
  R: 'bg-red-500 text-white border-red-400',
  G: 'bg-green-500 text-white border-green-400',
  C: 'bg-gray-400 text-gray-900 border-gray-300',
}

export const MANA_COLOR_LABELS: Record<ManaColor, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  C: 'Colorless',
}

export const PRESET_TOKENS = [
  { name: 'Soldier', power: '1', toughness: '1', type: 'Creature — Soldier', color: 'W' },
  { name: 'Zombie', power: '2', toughness: '2', type: 'Creature — Zombie', color: 'B' },
  { name: 'Goblin', power: '1', toughness: '1', type: 'Creature — Goblin', color: 'R' },
  { name: 'Saproling', power: '1', toughness: '1', type: 'Creature — Saproling', color: 'G' },
  { name: 'Wolf', power: '2', toughness: '2', type: 'Creature — Wolf', color: 'G' },
  { name: 'Spirit', power: '1', toughness: '1', type: 'Creature — Spirit', color: 'W' },
  { name: 'Angel', power: '4', toughness: '4', type: 'Creature — Angel', color: 'W' },
  { name: 'Beast', power: '3', toughness: '3', type: 'Creature — Beast', color: 'G' },
] as const
