'use client'

import { motion } from 'framer-motion'
import { EMOTES } from '@/lib/game-room/constants'

interface ChatEmotesProps {
  onSendEmote: (emoteId: string) => void
}

export function ChatEmotes({ onSendEmote }: ChatEmotesProps) {
  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2 border-t border-dungeon-700">
      {EMOTES.map(emote => (
        <motion.button
          key={emote.id}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => onSendEmote(emote.id)}
          className="px-2.5 py-1 text-xs text-parchment-300 bg-dungeon-800 hover:bg-dungeon-700 hover:text-parchment-100 border border-dungeon-600 rounded-full transition-colors"
        >
          {emote.label}
        </motion.button>
      ))}
    </div>
  )
}
