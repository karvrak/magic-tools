'use client'

import { use, useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ArrowLeft,
  Users,
  Crown,
  Copy,
  Check,
  Play,
  Loader2,
  LogOut,
  Flag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { GameRoom } from '@/components/game-room/game-room'
import { GameOverOverlay } from '@/components/game-room/systems/game-over-overlay'
import { useGameSync, ConnectionStatus } from '@/hooks/game-room/use-game-sync'
import { CardWithPrice } from '@/types/scryfall'

interface DeckCard {
  id: string
  cardId: string
  quantity: number
  category: string
  card: CardWithPrice
}

interface BattlefieldCardInfo {
  id: string
  name: string
  image: string | null
  type: string
  tapped: boolean
}

interface GamePlayer {
  id: string
  name: string
  color: string
  isHost: boolean
  life: number
  manaPool: number
  poisonCounters: number
  handCount: number
  libraryCount: number
  graveyardCount: number
  battlefieldCount: number
  battlefieldCards: BattlefieldCardInfo[]
  isEliminated: boolean
  isConnected: boolean
  isReady: boolean
  playerOrder: number
  deckId?: string
  deckName?: string
  lastSeenAt: string
}

interface GameSession {
  id: string
  code: string
  name: string
  status: 'waiting' | 'playing' | 'finished'
  maxPlayers: number
  startingLife: number
  currentTurn: number
  activePlayerId: string | null
  players: GamePlayer[]
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

interface DeckDetail {
  id: string
  name: string
  cards: DeckCard[]
}

/** Small colored dot indicating the real-time connection method. */
function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const config: Record<ConnectionStatus, { color: string; label: string }> = {
    sse: { color: 'bg-emerald-500', label: 'Live' },
    polling: { color: 'bg-amber-500', label: 'Polling' },
    disconnected: { color: 'bg-dragon-500', label: 'Disconnected' },
  }
  const { color, label } = config[status]
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      <span className={cn('w-2 h-2 rounded-full', color)} />
      <span className="text-xs">{label}</span>
    </span>
  )
}

// Inner component that uses useSearchParams
function GameSessionContent({ code }: { code: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  
  const playerId = searchParams.get('playerId')
  const [copied, setCopied] = useState(false)

  // SSE-based real-time sync with automatic polling fallback
  const { connectionStatus } = useGameSync(code)

  // Fetch session data — SSE triggers invalidation, no polling needed
  const { data: sessionData, isLoading: sessionLoading, error: sessionError } = useQuery<{ session: GameSession }>({
    queryKey: ['session', code],
    queryFn: async () => {
      const response = await fetch(`/api/sessions/${code}`)
      if (!response.ok) throw new Error('Session not found')
      return response.json()
    },
  })

  const session = sessionData?.session
  const currentPlayer = session?.players.find(p => p.id === playerId)
  const isHost = currentPlayer?.isHost
  const isMyTurn = session?.activePlayerId === playerId

  // Fetch my deck if I have one
  const { data: deckData } = useQuery<{ deck: DeckDetail }>({
    queryKey: ['deck', currentPlayer?.deckId],
    queryFn: async () => {
      const response = await fetch(`/api/decks/${currentPlayer?.deckId}`)
      if (!response.ok) throw new Error('Deck not found')
      return response.json()
    },
    enabled: !!currentPlayer?.deckId,
  })

  // Update player mutation
  const updatePlayerMutation = useMutation({
    mutationFn: async (updates: Partial<GamePlayer>) => {
      const response = await fetch(`/api/sessions/${code}/player`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, ...updates }),
      })
      if (!response.ok) throw new Error('Failed to update')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', code] })
    },
  })

  // Session action mutation
  const sessionActionMutation = useMutation({
    mutationFn: async (action: string) => {
      const response = await fetch(`/api/sessions/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, playerId }),
      })
      if (!response.ok) throw new Error('Failed to perform action')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', code] })
    },
  })

  // Leave session mutation
  const leaveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/sessions/${code}/player?playerId=${playerId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to leave')
      return response.json()
    },
    onSuccess: () => {
      router.push('/play')
    },
  })

  // Abandon game mutation
  const abandonMutation = useMutation({
    mutationFn: async () => {
      // Mark player as eliminated
      await fetch(`/api/sessions/${code}/player`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, isEliminated: true, life: 0 }),
      })
      // Check if game should end
      const response = await fetch(`/api/sessions/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'nextTurn', playerId }),
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', code] })
    },
  })

  // Copy invite link
  const copyInviteLink = useCallback(() => {
    const url = `${window.location.origin}/play/${code}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: '📋 Link copied!', description: url })
  }, [code, toast])

  // Handle stats update from playtest
  const handleUpdateStats = useCallback((stats: Partial<GamePlayer>) => {
    updatePlayerMutation.mutate(stats)
  }, [updatePlayerMutation])

  // Handle next turn
  const handleNextTurn = useCallback(() => {
    sessionActionMutation.mutate('nextTurn')
  }, [sessionActionMutation])

  // Handle set ready
  const handleSetReady = useCallback((ready: boolean) => {
    updatePlayerMutation.mutate({ isReady: ready })
  }, [updatePlayerMutation])

  // Auto-start game when all players ready (with small delay for countdown sync)
  const allPlayersReady = session?.players && session.players.length >= 2 && session.players.every(p => p.isReady)
  
  useEffect(() => {
    if (allPlayersReady && session?.status === 'waiting' && isHost) {
      // Host triggers the game start after 3.5 seconds (to account for countdown)
      const timer = setTimeout(() => {
        sessionActionMutation.mutate('start')
      }, 3500)
      return () => clearTimeout(timer)
    }
  }, [allPlayersReady, session?.status, isHost, sessionActionMutation])

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gold-400" />
      </div>
    )
  }

  if (sessionError || !session) {
    return (
      <div className="card-frame p-12 text-center">
        <p className="text-dragon-400 mb-4">Session not found</p>
        <Link href="/play">
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>
    )
  }

  // Waiting room (before enough players)
  if (session.status === 'waiting' && session.players.length < 2) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          href="/play"
          className="inline-flex items-center text-sm text-parchment-400 hover:text-parchment-200"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Link>

        <div className="card-frame p-6 text-center">
          <h1 className="font-medieval text-2xl text-gold-400 mb-2">{session.name}</h1>
          <p className="text-parchment-400 mb-4">
            Waiting for players ({session.players.length}/{session.maxPlayers})
          </p>

          {/* Invite code */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-dungeon-800 rounded-lg border border-dungeon-600 mb-6">
            <span className="text-parchment-400">Code :</span>
            <code className="text-2xl font-mono font-bold text-gold-400 tracking-wider">
              {session.code}
            </code>
            <button
              onClick={copyInviteLink}
              className="p-1.5 rounded hover:bg-dungeon-700 transition-colors"
              title="Copier le lien"
            >
              {copied ? (
                <Check className="w-5 h-5 text-emerald-400" />
              ) : (
                <Copy className="w-5 h-5 text-parchment-400" />
              )}
            </button>
          </div>

          {/* Players */}
          <div className="space-y-3 mb-6">
            {session.players.map((player) => (
              <div
                key={player.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  player.id === playerId
                    ? "bg-arcane-500/10 border-arcane-500/30"
                    : "bg-dungeon-800 border-dungeon-600"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: player.color }}
                  >
                    {player.name[0].toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-parchment-200 flex items-center gap-2">
                      {player.name}
                      {player.isHost && <Crown className="w-4 h-4 text-gold-400" />}
                      {player.id === playerId && (
                        <span className="text-xs text-arcane-400">(you)</span>
                      )}
                    </p>
                    {player.deckName && (
                      <p className="text-xs text-parchment-500">{player.deckName}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: session.maxPlayers - session.players.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center justify-center p-3 rounded-lg border border-dashed border-dungeon-600 text-parchment-500"
              >
                <Users className="w-4 h-4 mr-2" />
                Waiting...
              </div>
            ))}
          </div>

          {/* Leave button */}
          <Button
            variant="outline"
            onClick={() => leaveMutation.mutate()}
            disabled={leaveMutation.isPending}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Leave
          </Button>
        </div>
      </div>
    )
  }

  // Determine game phase for the MultiplayerPlaytest component
  const gamePhase: 'lobby' | 'playing' | 'finished' = 
    session.status === 'finished' ? 'finished' :
    session.status === 'playing' ? 'playing' : 'lobby'

  // Game in progress or lobby (ready check) - Use MultiplayerPlaytest
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-medieval text-xl text-gold-400">{session.name}</h1>
          <p className="text-sm text-parchment-500 flex items-center gap-1.5">
            {session.startingLife} HP • {session.players.length} players
            <ConnectionIndicator status={connectionStatus} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyInviteLink}
            className="px-2 py-1 bg-dungeon-800 rounded text-sm font-mono text-parchment-400 hover:bg-dungeon-700 flex items-center gap-1"
          >
            {session.code}
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
          {session.status === 'playing' && !currentPlayer?.isEliminated && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => abandonMutation.mutate()}
              disabled={abandonMutation.isPending}
              className="text-dragon-400 border-dragon-500/30 hover:bg-dragon-500/10"
            >
              <Flag className="w-4 h-4 mr-1" />
              Abandon
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => leaveMutation.mutate()}
            className="text-dragon-400"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Multiplayer Playtest */}
      {playerId && (
        <GameRoom
          playerId={playerId}
          players={session.players}
          startingLife={session.startingLife}
          currentTurn={session.currentTurn}
          activePlayerId={session.activePlayerId}
          isMyTurn={isMyTurn}
          cards={deckData?.deck?.cards || null}
          onUpdateStats={handleUpdateStats}
          onNextTurn={handleNextTurn}
          onSetReady={handleSetReady}
          gamePhase={gamePhase}
        />
      )}

      {/* Game Over Overlay - shown for finished games OR when any player is eliminated */}
      <GameOverOverlay
        isVisible={session.status === 'finished' || session.players.filter(p => !p.isEliminated).length <= 1}
        winner={session.players.find(p => !p.isEliminated) || null}
        currentPlayerId={playerId || ''}
        players={session.players}
        onNewGame={() => router.push('/play')}
        onLeave={() => leaveMutation.mutate()}
      />
    </div>
  )
}

// Main page component with Suspense boundary
export default function GameSessionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gold-400" />
      </div>
    }>
      <GameSessionContent code={code} />
    </Suspense>
  )
}
