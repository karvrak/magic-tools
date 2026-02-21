'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Printer, Plus, Minus, Trash2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { DiceLoader } from '@/components/ui/dice-loader'
import { FadeIn } from '@/components/layout/page-transition'
import { useActiveOwner } from '@/contexts/active-owner'

interface ProxyCard {
  id: string
  name: string
  printedName: string | null
  setCode: string
  setName: string
  rarity: string
  imageNormal: string | null
  imageSmall: string | null
  collectorNumber: string
}

interface ProxyItem {
  id: string
  cardId: string
  ownerId: string | null
  quantity: number
  createdAt: string
  card: ProxyCard
}

interface ProxyResponse {
  items: ProxyItem[]
  total: number
}

export default function ProxyPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { activeOwner } = useActiveOwner()

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

  const updateMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const response = await fetch('/api/proxy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, quantity }),
      })
      if (!response.ok) throw new Error('Failed to update')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/proxy?id=${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy'] })
    },
  })

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({ id: 'all' })
      if (activeOwner?.id) params.set('ownerId', activeOwner.id)
      const response = await fetch(`/api/proxy?${params}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to clear')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy'] })
      toast({ title: 'Proxy list cleared', variant: 'default' })
    },
  })

  const items = data?.items || []
  const totalCards = data?.total || 0

  if (isLoading) {
    return (
      <FadeIn>
        <div className="container mx-auto px-4 py-8">
          <DiceLoader message="Loading proxy list..." />
        </div>
      </FadeIn>
    )
  }

  return (
    <FadeIn>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center">
              <Printer className="w-5 h-5 text-dungeon-900" />
            </div>
            <div>
              <h1 className="text-2xl font-display text-gold-400">Proxy Print</h1>
              <p className="text-sm text-parchment-500">
                {totalCards} card{totalCards !== 1 ? 's' : ''} to print
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => clearAllMutation.mutate()}
                  disabled={clearAllMutation.isPending}
                  className="text-dragon-400 border-dragon-600/40 hover:bg-dragon-600/10"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
                <Link href="/proxy/print">
                  <Button size="sm" className="bg-gold-600 hover:bg-gold-500 text-dungeon-900">
                    <FileText className="w-4 h-4 mr-1" />
                    Print Sheet
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        {items.length === 0 ? (
          <EmptyState
            variant="collection"
            title="No proxy cards yet"
            description="Add cards to your proxy list from any card detail modal, then come back here to print them."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="card-frame p-2 group"
              >
                {/* Card Image */}
                <div className="relative aspect-[5/7] rounded-md overflow-hidden mb-2">
                  {item.card.imageSmall ? (
                    <Image
                      src={item.card.imageSmall}
                      alt={item.card.printedName || item.card.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                    />
                  ) : (
                    <div className="w-full h-full bg-dungeon-700 flex items-center justify-center">
                      <Printer className="w-8 h-8 text-dungeon-500" />
                    </div>
                  )}
                  {/* Quantity badge */}
                  {item.quantity > 1 && (
                    <div className="absolute top-1 right-1 bg-dungeon-900/90 text-gold-400 text-xs font-bold px-1.5 py-0.5 rounded">
                      x{item.quantity}
                    </div>
                  )}
                </div>

                {/* Card Info */}
                <div className="px-1">
                  <p className="text-xs text-parchment-200 font-medium truncate">
                    {item.card.printedName || item.card.name}
                  </p>
                  <p className="text-xs text-parchment-500 truncate">
                    {item.card.setCode.toUpperCase()} #{item.card.collectorNumber}
                  </p>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center justify-between mt-2 px-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-parchment-400 hover:text-dragon-400"
                    onClick={() => {
                      if (item.quantity <= 1) {
                        deleteMutation.mutate(item.id)
                      } else {
                        updateMutation.mutate({ id: item.id, quantity: item.quantity - 1 })
                      }
                    }}
                    disabled={updateMutation.isPending || deleteMutation.isPending}
                  >
                    {item.quantity <= 1 ? <Trash2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                  </Button>
                  <span className="text-sm text-parchment-300 font-medium">{item.quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-parchment-400 hover:text-gold-400"
                    onClick={() => updateMutation.mutate({ id: item.id, quantity: item.quantity + 1 })}
                    disabled={updateMutation.isPending}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </FadeIn>
  )
}
