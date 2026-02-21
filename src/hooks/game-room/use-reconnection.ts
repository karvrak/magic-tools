'use client'

import { useEffect, useCallback } from 'react'
import { CardWithPrice } from '@/types/scryfall'

/**
 * Periodically saves hand/library to the server for reconnection recovery.
 * Returns a restore function that fetches saved state from the server.
 */
export function useReconnection(
  code: string,
  playerId: string,
  hand: CardWithPrice[],
  library: CardWithPrice[],
  gameInitialized: boolean
) {
  // Save hand and library to server periodically (every 5s when they change)
  useEffect(() => {
    if (!gameInitialized || !playerId) return

    const saveState = async () => {
      try {
        await fetch(`/api/sessions/${code}/player`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId,
            handCards: hand.map(c => ({ id: c.id, name: c.name })),
            libraryCards: library.map(c => ({ id: c.id, name: c.name })),
          }),
        })
      } catch {
        // Silently ignore save failures
      }
    }

    const timer = setTimeout(saveState, 5000)
    return () => clearTimeout(timer)
  }, [code, playerId, hand, library, gameInitialized])

  // Returns saved private state from the server for reconnection
  const restoreState = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/sessions/${code}/player?playerId=${playerId}&includePrivate=true`
      )
      const data = await res.json()
      return {
        handCards: data.player?.handCards || null,
        libraryCards: data.player?.libraryCards || null,
      }
    } catch {
      return { handCards: null, libraryCards: null }
    }
  }, [code, playerId])

  return { restoreState }
}
