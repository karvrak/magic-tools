'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RematchState } from '@/components/game-room/systems/game-over-overlay'

const REMATCH_TIMEOUT_SECONDS = 20

interface UseRematchOptions {
  code: string
  playerId: string
  onRematchAccepted?: () => void
  onRematchDeclined?: () => void
}

interface RematchEventData {
  requesterId?: string
  requesterName?: string
  responderId?: string
  responderName?: string
  accepted?: boolean
  cancellerId?: string
  cancellerName?: string
  session?: unknown
}

export function useRematch({ code, playerId, onRematchAccepted, onRematchDeclined }: UseRematchOptions) {
  const [rematchState, setRematchState] = useState<RematchState>({ status: 'idle' })
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const queryClient = useQueryClient()

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [])

  // Reset state
  const resetState = useCallback(() => {
    clearTimers()
    setRematchState({ status: 'idle' })
  }, [clearTimers])

  // Request rematch mutation
  const requestRematchMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/sessions/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rematch', playerId }),
      })
      if (!response.ok) throw new Error('Failed to request rematch')
      return response.json()
    },
    onSuccess: () => {
      // Start waiting with countdown
      setRematchState({ status: 'waiting_response', timeLeft: REMATCH_TIMEOUT_SECONDS })

      // Start countdown timer
      countdownRef.current = setInterval(() => {
        setRematchState(prev => {
          if (prev.status === 'waiting_response' && prev.timeLeft > 1) {
            return { status: 'waiting_response', timeLeft: prev.timeLeft - 1 }
          }
          return prev
        })
      }, 1000)

      // Auto-cancel after timeout
      timerRef.current = setTimeout(() => {
        cancelRematchMutation.mutate()
        setRematchState({ status: 'idle' })
        clearTimers()
      }, REMATCH_TIMEOUT_SECONDS * 1000)
    },
  })

  // Cancel rematch mutation
  const cancelRematchMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/sessions/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rematchCancel', playerId }),
      })
      if (!response.ok) throw new Error('Failed to cancel rematch')
      return response.json()
    },
    onSuccess: () => {
      resetState()
    },
  })

  // Accept rematch mutation
  const acceptRematchMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/sessions/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rematchResponse', playerId, accepted: true }),
      })
      if (!response.ok) throw new Error('Failed to accept rematch')
      return response.json()
    },
    onSuccess: () => {
      resetState()
      queryClient.invalidateQueries({ queryKey: ['session', code] })
      onRematchAccepted?.()
    },
  })

  // Decline rematch mutation
  const declineRematchMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/sessions/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rematchResponse', playerId, accepted: false }),
      })
      if (!response.ok) throw new Error('Failed to decline rematch')
      return response.json()
    },
    onSuccess: () => {
      resetState()
      onRematchDeclined?.()
    },
  })

  // Handle incoming rematch events
  const handleRematchEvent = useCallback((event: { type: string; data: RematchEventData }) => {
    const { type, data } = event

    if (type === 'rematch_request') {
      // Someone requested a rematch
      if (data.requesterId && data.requesterName && data.requesterId !== playerId) {
        // We received a request from another player
        setRematchState({
          status: 'requesting',
          requesterId: data.requesterId,
          requesterName: data.requesterName,
        })
      }
    } else if (type === 'rematch_response') {
      clearTimers()
      if (data.accepted) {
        // Rematch accepted - session will be reset
        setRematchState({ status: 'idle' })
        queryClient.invalidateQueries({ queryKey: ['session', code] })
        onRematchAccepted?.()
      } else {
        // Rematch declined
        if (data.responderId !== playerId) {
          // We are the requester, show declined message
          setRematchState({ status: 'declined', responderName: data.responderName || 'Opponent' })
          // Reset after 3 seconds
          setTimeout(() => {
            setRematchState({ status: 'idle' })
          }, 3000)
        } else {
          // We declined, just reset
          setRematchState({ status: 'idle' })
        }
        onRematchDeclined?.()
      }
    } else if (type === 'rematch_cancelled') {
      // Requester cancelled
      if (data.cancellerId !== playerId) {
        setRematchState({ status: 'cancelled' })
        // Reset after 2 seconds
        setTimeout(() => {
          setRematchState({ status: 'idle' })
        }, 2000)
      } else {
        resetState()
      }
    }
  }, [playerId, clearTimers, resetState, queryClient, code, onRematchAccepted, onRematchDeclined])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  return {
    rematchState,
    requestRematch: () => requestRematchMutation.mutate(),
    cancelRematch: () => cancelRematchMutation.mutate(),
    acceptRematch: () => acceptRematchMutation.mutate(),
    declineRematch: () => declineRematchMutation.mutate(),
    handleRematchEvent,
    resetState,
    isLoading: requestRematchMutation.isPending || acceptRematchMutation.isPending || declineRematchMutation.isPending,
  }
}
