'use client'

import { motion } from 'framer-motion'
import { CardWithPrice } from '@/types/scryfall'
import { CardItem } from './card-item'

interface CardGridProps {
  cards: CardWithPrice[]
  onCardClick: (card: CardWithPrice) => void
}

export function CardGrid({ cards, onCardClick }: CardGridProps) {
  return (
    <motion.div 
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.03,
          },
        },
      }}
    >
      {cards.map((card, index) => (
        <CardItem 
          key={card.id} 
          card={card} 
          onClick={() => onCardClick(card)}
          index={index}
        />
      ))}
    </motion.div>
  )
}
