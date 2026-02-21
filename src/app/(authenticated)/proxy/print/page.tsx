'use client'

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Printer, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DiceLoader } from '@/components/ui/dice-loader'
import { FadeIn } from '@/components/layout/page-transition'
import { useActiveOwner } from '@/contexts/active-owner'

interface ProxyCard {
  id: string
  name: string
  printedName: string | null
  setCode: string
  imageNormal: string | null
}

interface ProxyItem {
  id: string
  cardId: string
  quantity: number
  card: ProxyCard
}

interface ProxyResponse {
  items: ProxyItem[]
  total: number
}

export default function ProxyPrintPage() {
  const { activeOwner } = useActiveOwner()
  const [imagesLoaded, setImagesLoaded] = useState(0)

  const { data, isLoading } = useQuery<ProxyResponse>({
    queryKey: ['proxy', activeOwner?.id],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (activeOwner?.id) params.set('ownerId', activeOwner.id)
      const response = await fetch(`/api/proxy?${params}`)
      if (!response.ok) throw new Error('Failed to fetch proxy list')
      return response.json()
    },
  })

  // Expand items by quantity
  const expandedCards = (data?.items || []).flatMap((item) =>
    Array.from({ length: item.quantity }, (_, i) => ({
      key: `${item.id}-${i}`,
      card: item.card,
    }))
  )

  // Chunk into pages of 9 (3x3)
  const pages: typeof expandedCards[] = []
  for (let i = 0; i < expandedCards.length; i += 9) {
    pages.push(expandedCards.slice(i, i + 9))
  }

  const totalImages = expandedCards.filter((c) => c.card.imageNormal).length
  const allLoaded = imagesLoaded >= totalImages

  const handleImageLoad = useCallback(() => {
    setImagesLoaded((prev) => prev + 1)
  }, [])

  const handlePrint = () => {
    window.print()
  }

  if (isLoading) {
    return (
      <FadeIn>
        <div className="container mx-auto px-4 py-8">
          <DiceLoader message="Loading proxy cards..." />
        </div>
      </FadeIn>
    )
  }

  if (expandedCards.length === 0) {
    return (
      <FadeIn>
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-parchment-500 mb-4">No cards in your proxy list.</p>
          <Link href="/proxy">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Proxy List
            </Button>
          </Link>
        </div>
      </FadeIn>
    )
  }

  return (
    <FadeIn>
      {/* Controls - hidden when printing */}
      <div className="no-print container mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <Link href="/proxy">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-parchment-500">
              {expandedCards.length} card{expandedCards.length !== 1 ? 's' : ''} / {pages.length} page{pages.length !== 1 ? 's' : ''}
            </span>
            <Button
              onClick={handlePrint}
              disabled={!allLoaded}
              className="bg-gold-600 hover:bg-gold-500 text-dungeon-900"
            >
              {!allLoaded ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading ({imagesLoaded}/{totalImages})
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </>
              )}
            </Button>
          </div>
        </div>

        <p className="text-xs text-parchment-600 mb-6">
          Preview of your proxy sheets. Each page contains up to 9 cards (3x3). Use your browser&apos;s print dialog for best results (set margins to &quot;None&quot; or &quot;Minimum&quot;).
        </p>
      </div>

      {/* Print pages */}
      <div className="proxy-print-container">
        {pages.map((page, pageIndex) => (
          <div key={pageIndex} className="proxy-print-page">
            <div className="proxy-print-grid">
              {page.map((entry) => (
                <div key={entry.key} className="proxy-print-card">
                  {entry.card.imageNormal ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.card.imageNormal}
                      alt={entry.card.printedName || entry.card.name}
                      className="proxy-print-card-img"
                      onLoad={handleImageLoad}
                    />
                  ) : (
                    <div className="proxy-print-card-placeholder">
                      <span>{entry.card.printedName || entry.card.name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </FadeIn>
  )
}
