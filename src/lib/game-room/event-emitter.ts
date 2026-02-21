import { EventEmitter } from 'events'

// Module-level singleton — shared across all API routes in the same Node.js process
const gameEventEmitter = new EventEmitter()
gameEventEmitter.setMaxListeners(100) // Allow many concurrent game sessions

export type GameEvent = {
  type:
    | 'state_update'
    | 'player_update'
    | 'phase_change'
    | 'game_start'
    | 'game_end'
    | 'response_alert'
    | 'emote'
    | 'log_entry'
  sessionCode: string
  data: unknown
  timestamp: number
}

/**
 * Broadcast a game event to all SSE subscribers of a session.
 * Called from API routes after mutating game state.
 */
export function broadcastGameEvent(
  sessionCode: string,
  event: Omit<GameEvent, 'sessionCode' | 'timestamp'>
) {
  const fullEvent: GameEvent = {
    ...event,
    sessionCode,
    timestamp: Date.now(),
  }
  gameEventEmitter.emit(`session:${sessionCode}`, fullEvent)
}

/**
 * Subscribe to all game events for a specific session.
 * Returns an unsubscribe function for cleanup.
 */
export function subscribeToSession(
  sessionCode: string,
  listener: (event: GameEvent) => void
) {
  gameEventEmitter.on(`session:${sessionCode}`, listener)
  return () => {
    gameEventEmitter.off(`session:${sessionCode}`, listener)
  }
}
