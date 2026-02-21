'use client'

import { Heart, Skull } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GamePlayer } from '@/lib/game-room/types'
import { OpponentBattlefieldCard } from './opponent-card'

interface OpponentBoardProps {
  opponents: GamePlayer[]
  activePlayerId: string | null
  onPreviewCard: (card: { name: string; image: string | null; type: string }) => void
  onViewOpponentGraveyard: (opponentId: string) => void
  onViewOpponentExile: (opponentId: string) => void
}

export function OpponentBoard({
  opponents,
  activePlayerId,
  onPreviewCard,
  onViewOpponentGraveyard,
  onViewOpponentExile,
}: OpponentBoardProps) {
  return (
    <div className="flex-shrink-0 pb-1">
      {opponents.map((opponent) => {
        const oppCards = opponent.battlefieldCards || []
        const opponentLands = oppCards.filter(c => c.type.toLowerCase().includes('land'))
        const opponentCreatures = oppCards.filter(c => c.type.toLowerCase().includes('creature') && !c.type.toLowerCase().includes('land'))
        const opponentOther = oppCards.filter(c => !c.type.toLowerCase().includes('land') && !c.type.toLowerCase().includes('creature'))

        return (
          <div key={opponent.id} className={cn(
            "rounded-lg overflow-hidden",
            opponent.isEliminated && "opacity-40"
          )}>
            {/* Opponent info bar */}
            <div className={cn(
              "flex items-center justify-between px-3 py-1.5",
              opponent.id === activePlayerId ? "bg-gold-500/20 border-b-2 border-gold-500/40 shadow-[0_2px_8px_rgba(234,179,8,0.15)]" : "bg-dungeon-800/60 border-b border-dungeon-700"
            )}>
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md"
                  style={{ backgroundColor: opponent.color }}
                >
                  {opponent.name[0].toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-parchment-200 font-medium leading-tight flex items-center gap-1.5">
                    {opponent.name}
                    {opponent.id === activePlayerId && (
                      <span className="text-[10px] bg-gold-500/30 text-gold-400 px-2 py-0.5 rounded-full font-bold animate-pulse">&#9876;&#65039; TURN</span>
                    )}
                    {opponent.isEliminated && <Skull className="w-3.5 h-3.5 text-dragon-400" />}
                  </span>
                  {opponent.deckName && (
                    <span className="text-[10px] text-parchment-500 leading-tight">{opponent.deckName}</span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-bold",
                  opponent.life <= 5 ? "bg-dragon-500/20 text-dragon-400" : "bg-dungeon-700/80 text-parchment-200"
                )}>
                  <Heart className="w-3.5 h-3.5 text-dragon-400" />
                  {opponent.life}
                </div>
                {opponent.poisonCounters > 0 && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-bold bg-emerald-500/20 text-emerald-400">
                    &#9760; {opponent.poisonCounters}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-[11px] text-parchment-500">
                  <span title="Hand">&#9995;{opponent.handCount}</span>
                  <span className="text-dungeon-600">|</span>
                  <span title="Library">&#128218;{opponent.libraryCount}</span>
                  <span className="text-dungeon-600">|</span>
                  <button
                    onClick={() => opponent.graveyardCount > 0 && onViewOpponentGraveyard(opponent.id)}
                    className={cn("hover:text-gold-400 transition-colors", opponent.graveyardCount > 0 && "cursor-pointer underline decoration-dotted")}
                    title="View graveyard"
                  >
                    &#129702;{opponent.graveyardCount}
                  </button>
                  {(opponent.exileCount ?? 0) > 0 && (
                    <>
                      <span className="text-dungeon-600">|</span>
                      <button
                        onClick={() => onViewOpponentExile(opponent.id)}
                        className="hover:text-gold-400 transition-colors cursor-pointer underline decoration-dotted"
                        title="View exile"
                      >
                        &#9939;{opponent.exileCount}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Opponent battlefield */}
            <div className={cn(
              "min-h-[60px] px-2 py-1",
              opponent.id === activePlayerId ? "bg-gold-500/5" : "bg-dungeon-900/30"
            )}>
              {oppCards.length === 0 ? (
                <div className="flex items-center justify-center py-3 text-parchment-700 text-xs italic">
                  No permanents
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Row 1: Lands */}
                  {opponentLands.length > 0 && (
                    <div>
                      <div className="text-[8px] text-parchment-700 uppercase tracking-wider mb-0.5 text-center">Lands</div>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {opponentLands.map((card) => (
                          <OpponentBattlefieldCard key={card.id} card={card} small={true} onSelect={() => onPreviewCard({ name: card.name, image: card.image, type: card.type })} />
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Row 2: Enchantments/Artifacts + Creatures */}
                  {(opponentOther.length > 0 || opponentCreatures.length > 0) && (
                    <div className="flex gap-2">
                      {opponentOther.length > 0 && (
                        <div className="flex-shrink-0 border-r border-dungeon-700/50 pr-2">
                          <div className="text-[8px] text-parchment-700 uppercase tracking-wider mb-0.5">Enchant / Artifacts</div>
                          <div className="flex flex-col gap-1">
                            {opponentOther.map((card) => (
                              <OpponentBattlefieldCard key={card.id} card={card} small={false} onSelect={() => onPreviewCard({ name: card.name, image: card.image, type: card.type })} />
                            ))}
                          </div>
                        </div>
                      )}
                      {opponentCreatures.length > 0 && (
                        <div className="flex-1">
                          <div className="text-[8px] text-parchment-700 uppercase tracking-wider mb-0.5 text-center">Creatures</div>
                          <div className="flex flex-wrap gap-1.5 justify-center">
                            {opponentCreatures.map((card) => (
                              <OpponentBattlefieldCard key={card.id} card={card} small={false} onSelect={() => onPreviewCard({ name: card.name, image: card.image, type: card.type })} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
