'use client'

import { Swords, Sparkles, Mountain } from 'lucide-react'
import { BattlefieldCard } from '@/lib/game-room/types'
import { isLand, isCreature } from '@/hooks/game-room/use-game-actions'
import { BattlefieldCardMini } from './battlefield-card'

interface MyBoardProps {
  battlefield: BattlefieldCard[]
  fullDeckLength: number
  onToggleTap: (uniqueId: string) => void
  onSendToGraveyard: (uniqueId: string) => void
  onBounceToHand: (uniqueId: string) => void
  onExileFromBattlefield: (uniqueId: string) => void
  onAdjustCounter: (uniqueId: string, type: 'plusOne' | 'minusOne', delta: number) => void
  onOpenGenericCounterPopup: (uniqueId: string) => void
  onAdjustGenericCounter: (uniqueId: string, label: string, delta: number) => void
  onRemoveGenericCounter: (uniqueId: string, label: string) => void
  onPreviewCard: (card: { name: string; image: string | null; type: string }) => void
}

export function MyBoard({
  battlefield,
  fullDeckLength,
  onToggleTap,
  onSendToGraveyard,
  onBounceToHand,
  onExileFromBattlefield,
  onAdjustCounter,
  onOpenGenericCounterPopup,
  onAdjustGenericCounter,
  onRemoveGenericCounter,
  onPreviewCard,
}: MyBoardProps) {
  // Categorize battlefield cards
  const battlefieldLands = battlefield.filter(c => isLand(c))
  const battlefieldCreatures = battlefield.filter(c => isCreature(c) && !isLand(c))
  const battlefieldEnchantments = battlefield.filter(c => {
    const type = (c.typeLine || '').toLowerCase()
    return (type.includes('enchantment') || type.includes('artifact') || type.includes('planeswalker'))
           && !type.includes('creature') && !type.includes('land')
  })
  const battlefieldOther = battlefield.filter(c => {
    const type = (c.typeLine || '').toLowerCase()
    return !type.includes('land') && !type.includes('creature') &&
           !type.includes('enchantment') && !type.includes('artifact') && !type.includes('planeswalker')
  })

  const renderCard = (card: BattlefieldCard, larger: boolean = false) => (
    <BattlefieldCardMini
      key={card.uniqueId}
      card={card}
      onTap={() => onToggleTap(card.uniqueId)}
      onGraveyard={() => onSendToGraveyard(card.uniqueId)}
      onBounce={() => onBounceToHand(card.uniqueId)}
      onExile={() => onExileFromBattlefield(card.uniqueId)}
      onAdjustCounter={(type, delta) => onAdjustCounter(card.uniqueId, type, delta)}
      onAddGenericCounter={() => onOpenGenericCounterPopup(card.uniqueId)}
      onAdjustGenericCounter={(label, delta) => onAdjustGenericCounter(card.uniqueId, label, delta)}
      onRemoveGenericCounter={(label) => onRemoveGenericCounter(card.uniqueId, label)}
      onSelect={() => onPreviewCard({ name: card.printedName || card.name, image: card.imageNormal ?? null, type: card.typeLine })}
      larger={larger}
    />
  )

  return (
    <div className="flex-1 space-y-1">
      {fullDeckLength > 0 && battlefield.length > 0 && (
        <div className="p-2 space-y-1">
          {/* Top area: Creatures + Enchantments/Artifacts */}
          {(battlefieldCreatures.length > 0 || battlefieldEnchantments.length > 0 || battlefieldOther.length > 0) && (
            <div className="flex gap-2">
              {/* Creatures zone */}
              <div className="flex-1 min-h-[40px]">
                {battlefieldCreatures.length > 0 && (
                  <div>
                    <div className="text-[9px] text-parchment-600 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                      <Swords className="w-2.5 h-2.5" />
                      Creatures
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {battlefieldCreatures.map((card) => renderCard(card, true))}
                    </div>
                  </div>
                )}
                {battlefieldOther.length > 0 && (
                  <div className={battlefieldCreatures.length > 0 ? "mt-1" : ""}>
                    <div className="text-[9px] text-parchment-600 uppercase tracking-wider mb-0.5">Other</div>
                    <div className="flex flex-wrap gap-1.5">
                      {battlefieldOther.map((card) => renderCard(card, true))}
                    </div>
                  </div>
                )}
              </div>

              {/* Enchantments/Artifacts zone */}
              {battlefieldEnchantments.length > 0 && (
                <div className="flex-shrink-0 border-l border-dungeon-700/50 pl-2">
                  <div className="text-[9px] text-parchment-600 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Enchant / Artifacts
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {battlefieldEnchantments.map((card) => renderCard(card, true))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Lands zone */}
          {battlefieldLands.length > 0 && (
            <div>
              <div className="text-[9px] text-parchment-600 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <Mountain className="w-2.5 h-2.5" />
                Lands
              </div>
              <div className="flex flex-wrap gap-1">
                {battlefieldLands.map((card) => renderCard(card, false))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
