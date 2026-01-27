'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { 
  Users, 
  Plus, 
  LogIn, 
  Swords, 
  Crown,
  Loader2,
  Copy,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { cn, formatDate } from '@/lib/utils'

interface Deck {
  id: string
  name: string
  format: string | null
}

interface GamePlayer {
  id: string
  name: string
  color: string
  isHost: boolean
}

interface GameSession {
  id: string
  code: string
  name: string
  status: 'waiting' | 'playing' | 'finished'
  maxPlayers: number
  startingLife: number
  players: GamePlayer[]
  createdAt: string
}

const PLAYER_COLORS = [
  { value: '#D4AF37', label: 'Or', class: 'bg-yellow-500' },
  { value: '#3B82F6', label: 'Bleu', class: 'bg-blue-500' },
  { value: '#EF4444', label: 'Rouge', class: 'bg-red-500' },
  { value: '#22C55E', label: 'Vert', class: 'bg-green-500' },
  { value: '#A855F7', label: 'Violet', class: 'bg-purple-500' },
  { value: '#EC4899', label: 'Rose', class: 'bg-pink-500' },
]

export default function PlayPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  // Create session form
  const [playerName, setPlayerName] = useState('')
  const [playerColor, setPlayerColor] = useState('#D4AF37')
  const [maxPlayers, setMaxPlayers] = useState('2')
  const [startingLife, setStartingLife] = useState('20')
  const [selectedDeckId, setSelectedDeckId] = useState<string>('none')
  
  // Join session form
  const [joinCode, setJoinCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [joinColor, setJoinColor] = useState('#3B82F6')
  const [joinDeckId, setJoinDeckId] = useState<string>('none')

  // Fetch decks
  const { data: decksData } = useQuery<{ decks: Deck[] }>({
    queryKey: ['decks'],
    queryFn: async () => {
      const response = await fetch('/api/decks')
      if (!response.ok) throw new Error('Failed to fetch decks')
      return response.json()
    },
  })

  // Fetch recent sessions
  const { data: sessionsData, refetch: refetchSessions } = useQuery<{ sessions: GameSession[] }>({
    queryKey: ['sessions'],
    queryFn: async () => {
      const response = await fetch('/api/sessions?status=waiting')
      if (!response.ok) throw new Error('Failed to fetch sessions')
      return response.json()
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  })

  // Create session mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const hasDeck = selectedDeckId && selectedDeckId !== 'none'
      const deck = hasDeck ? decksData?.decks.find(d => d.id === selectedDeckId) : null
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName,
          playerColor,
          maxPlayers: parseInt(maxPlayers),
          startingLife: parseInt(startingLife),
          deckId: hasDeck ? selectedDeckId : undefined,
          deckName: deck?.name,
        }),
      })
      if (!response.ok) throw new Error('Failed to create session')
      return response.json()
    },
    onSuccess: (data) => {
      toast({
        title: '🎮 Session créée !',
        description: `Code: ${data.session.code}`,
      })
      router.push(`/play/${data.session.code}?playerId=${data.session.players[0].id}`)
    },
    onError: () => {
      toast({
        title: 'Erreur',
        description: 'Impossible de créer la session',
        variant: 'destructive',
      })
    },
  })

  // Join session mutation
  const joinMutation = useMutation({
    mutationFn: async () => {
      const hasJoinDeck = joinDeckId && joinDeckId !== 'none'
      const joinDeck = hasJoinDeck ? decksData?.decks.find(d => d.id === joinDeckId) : null
      const response = await fetch(`/api/sessions/${joinCode.toUpperCase()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: joinName,
          playerColor: joinColor,
          deckId: hasJoinDeck ? joinDeckId : undefined,
          deckName: joinDeck?.name,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to join session')
      }
      return response.json()
    },
    onSuccess: (data) => {
      toast({
        title: '🎮 Rejoint !',
        description: `Partie de ${data.session.name}`,
      })
      router.push(`/play/${data.session.code}?playerId=${data.player.id}`)
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleCreate = () => {
    if (!playerName.trim()) {
      toast({ title: 'Erreur', description: 'Entrez votre nom', variant: 'destructive' })
      return
    }
    createMutation.mutate()
  }

  const handleJoin = () => {
    if (!joinCode.trim() || !joinName.trim()) {
      toast({ title: 'Erreur', description: 'Code et nom requis', variant: 'destructive' })
      return
    }
    joinMutation.mutate()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="font-medieval text-3xl text-gold-400 mb-2 flex items-center justify-center gap-3">
          <Swords className="w-8 h-8" />
          Mode Multijoueur
        </h1>
        <p className="text-parchment-400">
          Créez une session et invitez vos amis à jouer
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Create Session */}
        <div className="card-frame p-6">
          <h2 className="font-medieval text-xl text-gold-400 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Créer une partie
          </h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="playerName">Votre nom</Label>
              <Input
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Entrez votre nom..."
                className="mt-1"
              />
            </div>

            <div>
              <Label>Votre couleur</Label>
              <div className="flex gap-2 mt-1">
                {PLAYER_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setPlayerColor(color.value)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      color.class,
                      playerColor === color.value 
                        ? "ring-2 ring-white ring-offset-2 ring-offset-dungeon-800" 
                        : "opacity-60 hover:opacity-100"
                    )}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Joueurs max</Label>
                <Select value={maxPlayers} onValueChange={setMaxPlayers}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 joueurs</SelectItem>
                    <SelectItem value="3">3 joueurs</SelectItem>
                    <SelectItem value="4">4 joueurs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Points de vie</Label>
                <Select value={startingLife} onValueChange={setStartingLife}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20 PV</SelectItem>
                    <SelectItem value="40">40 PV (Commander)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Deck (optionnel)</Label>
              <Select value={selectedDeckId} onValueChange={setSelectedDeckId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sélectionner un deck..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun deck</SelectItem>
                  {decksData?.decks.map((deck) => (
                    <SelectItem key={deck.id} value={deck.id}>
                      {deck.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleCreate} 
              disabled={createMutation.isPending}
              className="w-full"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Créer la partie
            </Button>
          </div>
        </div>

        {/* Join Session */}
        <div className="card-frame p-6">
          <h2 className="font-medieval text-xl text-gold-400 mb-4 flex items-center gap-2">
            <LogIn className="w-5 h-5" />
            Rejoindre une partie
          </h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="joinCode">Code de la partie</Label>
              <Input
                id="joinCode"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="mt-1 font-mono text-lg tracking-wider"
                maxLength={6}
              />
            </div>

            <div>
              <Label htmlFor="joinName">Votre nom</Label>
              <Input
                id="joinName"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Entrez votre nom..."
                className="mt-1"
              />
            </div>

            <div>
              <Label>Votre couleur</Label>
              <div className="flex gap-2 mt-1">
                {PLAYER_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setJoinColor(color.value)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      color.class,
                      joinColor === color.value 
                        ? "ring-2 ring-white ring-offset-2 ring-offset-dungeon-800" 
                        : "opacity-60 hover:opacity-100"
                    )}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>Deck (optionnel)</Label>
              <Select value={joinDeckId} onValueChange={setJoinDeckId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sélectionner un deck..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun deck</SelectItem>
                  {decksData?.decks.map((deck) => (
                    <SelectItem key={deck.id} value={deck.id}>
                      {deck.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleJoin} 
              disabled={joinMutation.isPending || !joinCode || !joinName}
              className="w-full"
            >
              {joinMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4 mr-2" />
              )}
              Rejoindre
            </Button>
          </div>
        </div>
      </div>

      {/* Recent/Waiting Sessions */}
      {sessionsData?.sessions && sessionsData.sessions.length > 0 && (
        <div className="card-frame p-6">
          <h2 className="font-medieval text-xl text-gold-400 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Parties en attente
          </h2>

          <div className="space-y-3">
            {sessionsData.sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 rounded-lg bg-dungeon-800 border border-dungeon-600"
              >
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {session.players.map((player) => (
                      <div
                        key={player.id}
                        className="w-8 h-8 rounded-full border-2 border-dungeon-800 flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: player.color }}
                        title={player.name}
                      >
                        {player.name[0].toUpperCase()}
                        {player.isHost && (
                          <Crown className="absolute -top-1 -right-1 w-3 h-3 text-gold-400" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="font-medium text-parchment-200">{session.name}</p>
                    <p className="text-xs text-parchment-500">
                      {session.players.length}/{session.maxPlayers} joueurs • {session.startingLife} PV
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <code className="px-2 py-1 bg-dungeon-700 rounded text-sm font-mono text-gold-400">
                    {session.code}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setJoinCode(session.code)
                    }}
                  >
                    Rejoindre
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
