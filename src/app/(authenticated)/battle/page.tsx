'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Swords, History } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BattleSetup } from '@/components/battle/battle-setup'
import { useToast } from '@/hooks/use-toast'
import { FadeIn } from '@/components/layout/page-transition'
import type { GameMode } from '@/types/battle'

export default function BattlePage() {
  const router = useRouter()
  const { toast } = useToast()

  const createBattleMutation = useMutation({
    mutationFn: async (data: {
      mode: GameMode
      players: { deckId: string | null; deckName: string; team?: number }[]
    }) => {
      const response = await fetch('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create battle')
      }
      return response.json()
    },
    onSuccess: (data) => {
      toast({
        title: '⚔️ Battle Created!',
        description: 'Entering the arena...',
      })
      router.push(`/battle/${data.battle.id}`)
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create battle',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleStart = (
    mode: GameMode,
    players: { deckId: string | null; deckName: string; team?: number }[]
  ) => {
    createBattleMutation.mutate({ mode, players })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Swords className="w-6 h-6 text-dragon-500" />
              <h1 className="font-display text-2xl text-gold-400">Arena of Fate</h1>
            </div>
            <p className="text-parchment-500 text-sm">
              Track life totals, victory points, and commander damage
            </p>
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link href="/battle/history">
              <Button variant="outline">
                <History className="w-4 h-4 mr-2" />
                Battle History
              </Button>
            </Link>
          </motion.div>
        </div>
      </FadeIn>

      {/* Battle Setup */}
      <FadeIn delay={0.1}>
        <div className="card-frame p-6">
          <BattleSetup
            onStart={handleStart}
            isLoading={createBattleMutation.isPending}
          />
        </div>
      </FadeIn>
    </div>
  )
}
