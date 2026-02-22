import { EventEmitter } from 'events'

// Module-level singleton — shared across all API routes in the same Node.js process
const gameEventEmitter = new EventEmitter()
gameEventEmitter.setMaxListeners(100) // Allow many concurrent game sessions

// Track active listeners per session for cleanup
const sessionListenerCounts = new Map<string, number>()

// Cleanup interval - runs every 5 minutes to remove orphaned session events
const CLEANUP_INTERVAL = 5 * 60 * 1000

const cleanupInterval = setInterval(() => {
  // Remove sessions with no listeners
  for (const [sessionCode, count] of sessionListenerCounts.entries()) {
    if (count <= 0) {
      gameEventEmitter.removeAllListeners(`session:${sessionCode}`)
      sessionListenerCounts.delete(sessionCode)
    }
  }
}, CLEANUP_INTERVAL)

// Allow Node.js to exit cleanly even if the interval is still active
if (typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref()
}

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
    | 'rematch_request'
    | 'rematch_response'
    | 'rematch_cancelled'
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

  // Track listener count for cleanup
  const currentCount = sessionListenerCounts.get(sessionCode) || 0
  sessionListenerCounts.set(sessionCode, currentCount + 1)

  return () => {
    gameEventEmitter.off(`session:${sessionCode}`, listener)

    // Decrement listener count
    const count = sessionListenerCounts.get(sessionCode) || 0
    if (count <= 1) {
      sessionListenerCounts.delete(sessionCode)
    } else {
      sessionListenerCounts.set(sessionCode, count - 1)
    }
  }
}

/**
 * Get the number of active listeners across all sessions.
 * Useful for monitoring/debugging memory usage.
 */
export function getActiveSessionCount(): number {
  return sessionListenerCounts.size
}

/**
 * Get the total number of listeners across all sessions.
 */
export function getTotalListenerCount(): number {
  let total = 0
  for (const count of sessionListenerCounts.values()) {
    total += count
  }
  return total
}
