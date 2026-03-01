import { z } from 'zod'

// ============================================
// SHARED PRIMITIVES
// ============================================

const VALID_CONDITIONS = ['nm', 'lp', 'mp', 'hp', 'dmg'] as const
const VALID_DECK_STATUSES = ['building', 'active', 'locked'] as const
const VALID_PRIORITIES = ['low', 'medium', 'high'] as const
const VALID_GAME_MODES = ['CLASSIC_1V1', 'FREE_FOR_ALL_3', 'TWO_HEADED_GIANT', 'COMMANDER'] as const

// ============================================
// DECKS
// ============================================

/** POST /api/decks */
export const createDeckSchema = z.object({
  name: z.string().min(1, 'Deck name is required').transform(s => s.trim()),
  description: z.string().optional().nullable(),
  format: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  status: z.enum(VALID_DECK_STATUSES).optional(),
})

/** PATCH /api/decks/[id] */
export const updateDeckSchema = z.object({
  name: z.string().min(1).transform(s => s.trim()).optional(),
  description: z.string().optional().nullable(),
  format: z.string().optional().nullable(),
  coverImage: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  status: z.enum(VALID_DECK_STATUSES).optional(),
  tagIds: z.array(z.string()).optional(),
  addTagId: z.string().optional(),
  removeTagId: z.string().optional(),
})

// ============================================
// DECK CARDS
// ============================================

/** POST /api/decks/[id]/cards */
export const addDeckCardSchema = z.object({
  cardId: z.string().min(1, 'Card ID is required'),
  quantity: z.number().int().min(1).default(1),
  category: z.string().default('mainboard'),
})

/** PATCH /api/decks/[id]/cards */
export const updateDeckCardSchema = z.object({
  cardId: z.string().min(1, 'Card ID is required'),
  quantity: z.number().int(),
  category: z.string().optional(),
})

/** DELETE /api/decks/[id]/cards (query params) */
export const deleteDeckCardParamsSchema = z.object({
  cardId: z.string().min(1, 'Card ID is required'),
  category: z.string().optional().nullable(),
})

/** PATCH /api/decks/[id]/cards/edition */
export const changeCardEditionSchema = z.object({
  currentCardId: z.string().min(1, 'Current card ID is required'),
  newCardId: z.string().min(1, 'New card ID is required'),
  category: z.string().default('mainboard'),
})

// ============================================
// DECK IMPORT
// ============================================

/** POST /api/decks/[id]/import */
export const importDecklistSchema = z.object({
  decklist: z.string().min(1, 'Decklist text is required'),
})

// ============================================
// DECK SIMULATE
// ============================================

/** POST /api/decks/[id]/simulate */
export const simulateDeckSchema = z.object({
  advanced: z.boolean().default(false),
})

// ============================================
// COLLECTION
// ============================================

/** POST /api/collection */
export const addCollectionItemSchema = z.object({
  cardId: z.string().min(1, 'Card ID is required'),
  quantity: z.number().int().min(1).default(1),
  condition: z.enum(VALID_CONDITIONS).default('nm'),
  isFoil: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
})

/** PATCH /api/collection */
export const updateCollectionItemSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
  quantity: z.number().int().optional(),
  condition: z.enum(VALID_CONDITIONS).optional(),
  isFoil: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
})

/** DELETE /api/collection (query params) */
export const deleteCollectionItemParamsSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
})

// ============================================
// COLLECTION BULK
// ============================================

/** POST /api/collection/bulk */
export const bulkCollectionSchema = z.object({
  items: z.array(
    z.object({
      cardId: z.string().min(1),
      quantity: z.number().int().min(1).default(1),
      condition: z.enum(VALID_CONDITIONS).default('nm'),
      isFoil: z.boolean().default(false),
      ownerId: z.string().optional().nullable(),
    })
  ).min(1, 'items array is required'),
})

// ============================================
// WANTLIST
// ============================================

/** POST /api/wantlist */
export const addWantlistItemSchema = z.object({
  cardId: z.string().min(1, 'Card ID is required'),
  quantity: z.number().int().min(1).default(1),
  priority: z.enum(VALID_PRIORITIES).default('medium'),
  notes: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
})

/** PATCH /api/wantlist */
export const updateWantlistItemSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
  quantity: z.number().int().optional(),
  priority: z.enum(VALID_PRIORITIES).optional(),
  notes: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  isOrdered: z.boolean().optional(),
  isReceived: z.boolean().optional(),
})

/** DELETE /api/wantlist (query params) */
export const deleteWantlistItemParamsSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
})

// ============================================
// PROXY
// ============================================

/** POST /api/proxy */
export const addProxyItemSchema = z.object({
  cardId: z.string().min(1, 'Card ID is required'),
  quantity: z.number().int().min(1).default(1),
  ownerId: z.string().optional().nullable(),
})

/** PATCH /api/proxy */
export const updateProxyItemSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
  quantity: z.number().int(),
})

/** DELETE /api/proxy (query params) */
export const deleteProxyItemParamsSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
})

// ============================================
// SCANNER
// ============================================

/** POST /api/scanner/ocr */
export const scannerOcrSchema = z.object({
  image: z.string().min(1, 'image is required (base64 data URL)'),
})

/** POST /api/scanner/match */
export const scannerMatchSchema = z.object({
  texts: z.array(z.string()).min(1, 'texts array is required'),
})

// ============================================
// MATCHES
// ============================================

const VALID_MATCH_SOURCES = ['import', 'online', 'battle'] as const

const matchRowSchema = z.object({
  date: z.union([z.string(), z.number()]),
  deck1: z.string().optional(),
  'deck 1': z.string().optional(),
  deck2: z.string().optional(),
  'deck 2': z.string().optional(),
  score1: z.union([z.string(), z.number()]).optional(),
  'score 1': z.union([z.string(), z.number()]).optional(),
  score2: z.union([z.string(), z.number()]).optional(),
  'score 2': z.union([z.string(), z.number()]).optional(),
  notes: z.union([z.string(), z.number()]).optional().nullable(),
  source: z.enum(VALID_MATCH_SOURCES).default('import'),
})

/** POST /api/matches */
export const importMatchesSchema = z.object({
  matches: z.array(matchRowSchema).min(1, 'matches array is required'),
})

/** DELETE /api/matches (query params) */
export const deleteMatchesParamsSchema = z.object({
  batchId: z.string().optional().nullable(),
  all: z.string().optional().nullable(),
}).refine(
  (data) => data.batchId || data.all === 'true',
  { message: 'Either batchId or all=true is required' }
)

// ============================================
// OWNERS
// ============================================

/** POST /api/owners */
export const createOwnerSchema = z.object({
  name: z.string().min(1, 'Owner name is required').transform(s => s.trim()),
  color: z.string().optional(),
})

/** PATCH /api/owners/[id] */
export const updateOwnerSchema = z.object({
  name: z.string().min(1).transform(s => s.trim()).optional(),
  color: z.string().optional(),
  isDefault: z.boolean().optional(),
})

// ============================================
// TAGS
// ============================================

/** POST /api/tags */
export const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(30, 'Tag name must be 30 characters or less'),
  color: z.string().optional(),
})

// ============================================
// BATTLES
// ============================================

const battlePlayerInputSchema = z.object({
  deckId: z.string().nullable().optional(),
  deckName: z.string().min(1, 'Deck name is required'),
  team: z.number().int().optional(),
})

/** POST /api/battles */
export const createBattleSchema = z.object({
  mode: z.enum(VALID_GAME_MODES),
  players: z.array(battlePlayerInputSchema).min(2),
})

/** POST /api/battles/[id]/finish */
export const finishBattleSchema = z.object({
  players: z.array(
    z.object({
      id: z.string().min(1),
      finalLife: z.number().int(),
      victoryPoints: z.number().int().default(0),
      isEliminated: z.boolean(),
      commanderDamage: z.record(z.string(), z.number()).default({}),
    })
  ).min(1),
})

// ============================================
// SESSIONS
// ============================================

/** POST /api/sessions */
export const createSessionSchema = z.object({
  name: z.string().optional(),
  playerName: z.string().min(1, 'Player name is required'),
  playerColor: z.string().default('#D4AF37'),
  maxPlayers: z.number().int().min(2).max(4).default(2),
  startingLife: z.number().int().min(1).default(20),
  format: z.string().optional().nullable(),
  deckId: z.string().optional().nullable(),
  deckName: z.string().optional().nullable(),
})

/** POST /api/sessions/[code] (join) */
export const joinSessionSchema = z.object({
  playerName: z.string().min(1, 'Player name is required'),
  playerColor: z.string().default('#3B82F6'),
  deckId: z.string().optional().nullable(),
  deckName: z.string().optional().nullable(),
})

/** PATCH /api/sessions/[code] */
export const updateSessionSchema = z.object({
  action: z.enum(['start', 'nextTurn', 'finish', 'advancePhase', 'respond', 'emote', 'rematch', 'rematchResponse', 'rematchCancel']).optional(),
  playerId: z.string().optional(),
  phase: z.string().optional(),
  responds: z.boolean().optional(),
  emoteId: z.string().optional(),
  playerName: z.string().optional(),
  playerColor: z.string().optional(),
  accepted: z.boolean().optional(),
}).passthrough()

/** PATCH /api/sessions/[code]/player */
export const updatePlayerSchema = z.object({
  playerId: z.string().min(1, 'Player ID is required'),
  life: z.number().int().optional(),
  manaPool: z.number().int().optional().nullable(),
  poisonCounters: z.number().int().optional(),
  commanderDamage: z.record(z.string(), z.number()).optional().nullable(),
  handCount: z.number().int().optional(),
  libraryCount: z.number().int().optional(),
  graveyardCount: z.number().int().optional(),
  exileCount: z.number().int().optional(),
  battlefieldCount: z.number().int().optional(),
  battlefieldCards: z.any().optional(),
  graveyardCards: z.any().optional(),
  exileCards: z.any().optional(),
  isEliminated: z.boolean().optional(),
  isReady: z.boolean().optional(),
  manaPoolColors: z.any().optional(),
  handCards: z.any().optional(),
  libraryCards: z.any().optional(),
  deckId: z.string().optional().nullable(),
  deckName: z.string().optional().nullable(),
})

/** DELETE /api/sessions/[code]/player (query params) */
export const deletePlayerParamsSchema = z.object({
  playerId: z.string().min(1, 'Player ID is required'),
})

// ============================================
// CUSTOM SETS
// ============================================

/** POST /api/custom-sets/upload (form data validation) */
export const uploadCustomSetSchema = z.object({
  setName: z.string().min(1, 'Set name is required').max(100).transform(s => s.trim()),
  setCode: z.string()
    .max(30)
    .regex(/^[a-z0-9_]*$/, 'Set code can only contain lowercase letters, numbers, and underscores')
    .transform(s => {
      if (!s) return ''
      return s.startsWith('cus_') ? s : `cus_${s}`
    })
    .optional()
    .nullable()
    .transform(v => v || ''),
})

// ============================================
// AUTH
// ============================================

/** POST /api/auth/login */
export const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
})

/** POST /api/auth/register */
export const registerSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Confirm password required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

/** POST /api/auth/change-password */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmNewPassword: z.string().min(1, 'Confirm new password required'),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'Passwords do not match',
  path: ['confirmNewPassword'],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
})
