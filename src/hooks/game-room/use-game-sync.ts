'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export type ConnectionStatus = 'sse' | 'polling' | 'disconnected'

const POLLING_INTERVAL_MS = 1500
const SSE_RETRY_DELAY_MS = 5000

/**
 * Manages real-time game state synchronization via SSE with automatic
 * fallback to polling. Returns the current connection status and a
 * manual refresh function.
 */
export function useGameSync(code: string) {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('disconnected')
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const refreshSession = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['session', code] })
  }, [queryClient, code])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    if (pollingRef.current) return
    setConnectionStatus('polling')
    pollingRef.current = setInterval(() => {
      refreshSession()
    }, POLLING_INTERVAL_MS)
  }, [refreshSession])

  const connectSSE = useCallback(() => {
    // Close any existing connection before opening a new one
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    try {
      const es = new EventSource(`/api/sessions/${code}/events`)
      eventSourceRef.current = es

      es.onopen = () => {
        setConnectionStatus('sse')
        stopPolling()
        // Clear any pending retry timeout
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current)
          retryTimeoutRef.current = null
        }
      }

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          // Ignore the initial connection confirmation
          if (data.type === 'connected') return
          // On any game event, refresh session data from the server
          refreshSession()
        } catch {
          // Ignore malformed messages
        }
      }

      es.onerror = () => {
        es.close()
        eventSourceRef.current = null
        // Fall back to polling immediately
        startPolling()
        // Schedule an SSE reconnection attempt
        retryTimeoutRef.current = setTimeout(() => {
          connectSSE()
        }, SSE_RETRY_DELAY_MS)
      }
    } catch {
      // EventSource constructor failed — fall back to polling
      startPolling()
    }
  }, [code, refreshSession, startPolling, stopPolling])

  useEffect(() => {
    connectSSE()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      stopPolling()
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }
  }, [connectSSE, stopPolling])

  return { connectionStatus, refreshSession }
}
