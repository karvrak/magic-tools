/**
 * In-memory sync status tracker.
 * Stores the current progress of card/price synchronization
 * so that clients can poll for updates via /api/sync/status.
 *
 * Note: This state lives in the Node.js process memory.
 * It resets on server restart, which is acceptable for progress tracking.
 */

export type SyncPhase =
  | 'idle'
  | 'downloading'
  | 'processing'
  | 'deduplicating'
  | 'finalizing'
  | 'done'
  | 'error'

export interface SyncStatus {
  type: 'cards' | 'prices' | null
  phase: SyncPhase
  progress: number // 0-100
  message: string
  recordsProcessed: number
  startedAt: number | null
}

const DEFAULT_STATUS: SyncStatus = {
  type: null,
  phase: 'idle',
  progress: 0,
  message: '',
  recordsProcessed: 0,
  startedAt: null,
}

/** Global mutable state - shared across all requests in the same process. */
let currentStatus: SyncStatus = { ...DEFAULT_STATUS }

/** Track the auto-reset timeout to prevent accumulation */
let resetTimeout: ReturnType<typeof setTimeout> | null = null

export function getSyncStatus(): SyncStatus {
  return { ...currentStatus }
}

export function updateSyncStatus(update: Partial<SyncStatus>): void {
  currentStatus = { ...currentStatus, ...update }
}

export function resetSyncStatus(): void {
  currentStatus = { ...DEFAULT_STATUS }
}

export function startSync(type: 'cards' | 'prices'): void {
  currentStatus = {
    type,
    phase: 'downloading',
    progress: 0,
    message: `Starting ${type} sync...`,
    recordsProcessed: 0,
    startedAt: Date.now(),
  }
}

export function finishSync(success: boolean, message: string): void {
  currentStatus = {
    ...currentStatus,
    phase: success ? 'done' : 'error',
    progress: success ? 100 : currentStatus.progress,
    message,
  }

  // Clear any existing timeout to prevent accumulation
  if (resetTimeout) {
    clearTimeout(resetTimeout)
    resetTimeout = null
  }

  // Auto-reset to idle after 10 seconds so stale state doesn't persist
  resetTimeout = setTimeout(() => {
    if (
      currentStatus.phase === 'done' ||
      currentStatus.phase === 'error'
    ) {
      resetSyncStatus()
    }
    resetTimeout = null
  }, 10_000)
}
