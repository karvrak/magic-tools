'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlaytestView } from '@/components/deck/playtest-view'
import { CardWithPrice } from '@/types/scryfall'

interface DeckCard {
  id: string
  cardId: string
  quantity: number
  category: string
  card: CardWithPrice
}

interface DeckDetail {
  id: string
  name: string
  description: string | null
  format: string | null
  coverImage: string | null
  cards: DeckCard[]
}

export default function PlaytestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const { data, isLoading, error } = useQuery<{ deck: DeckDetail }>({
    queryKey: ['deck', id],
    queryFn: async () => {
      const response = await fetch(`/api/decks/${id}`)
      if (!response.ok) throw new Error('Failed to fetch deck')
      return response.json()
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-96 rounded-lg" />
      </div>
    )
  }

  if (error || !data?.deck) {
    return (
      <div className="card-frame p-12 text-center">
        <p className="text-dragon-400">Impossible de charger le deck</p>
        <Link href="/decks">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux decks
          </Button>
        </Link>
      </div>
    )
  }

  const deck = data.deck

  // Filter out sideboard for playtest (only main deck)
  const mainDeckCards = deck.cards.filter(c => c.category !== 'sideboard')
  const mainDeckSize = mainDeckCards.reduce((sum, c) => sum + c.quantity, 0)

  if (mainDeckSize === 0) {
    return (
      <div className="space-y-6">
        <Link
          href={`/decks/${id}`}
          className="inline-flex items-center text-sm text-parchment-400 hover:text-parchment-200"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour au deck
        </Link>

        <div className="card-frame p-12 text-center">
          <Layers className="w-12 h-12 text-dungeon-600 mx-auto mb-4" />
          <p className="text-parchment-400">
            Ce deck est vide. Ajoutez des cartes pour pouvoir le tester.
          </p>
          <Link href={`/decks/${id}`}>
            <Button className="mt-4">
              Retour au deck
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/decks/${id}`}
            className="inline-flex items-center text-sm text-parchment-400 hover:text-parchment-200 mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour au deck
          </Link>
          <h1 className="font-medieval text-2xl text-gold-400">{deck.name}</h1>
          <p className="text-sm text-parchment-500">Mode Goldfish • {mainDeckSize} cartes</p>
        </div>
      </div>

      {/* Playtest area */}
      <div className="card-frame p-4 sm:p-6">
        <PlaytestView deckName={deck.name} cards={mainDeckCards} format={deck.format} />
      </div>
    </div>
  )
}
