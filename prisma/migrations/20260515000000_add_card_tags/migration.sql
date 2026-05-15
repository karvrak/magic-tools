-- Système de tags utilisateur sur les cartes d'un deck.
-- Scope d'un tag:
--   * global utilisateur si "deckId" est NULL (réutilisable sur tous les decks)
--   * spécifique au deck si "deckId" est renseigné (visible uniquement dans ce deck)
-- Assignation tag <-> carte au niveau DeckCard (la même carte peut être taguée
-- différemment selon le deck dans lequel elle est jouée).

-- CreateTable
CREATE TABLE "CardTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8B5CF6',
    "userId" TEXT NOT NULL,
    "deckId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckCardTag" (
    "deckCardId" TEXT NOT NULL,
    "cardTagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckCardTag_pkey" PRIMARY KEY ("deckCardId","cardTagId")
);

-- CreateIndex
CREATE INDEX "CardTag_userId_idx" ON "CardTag"("userId");

-- CreateIndex
CREATE INDEX "CardTag_deckId_idx" ON "CardTag"("deckId");

-- CreateIndex
-- Unicité par scope: (user, NULL deckId, name) pour les tags globaux,
-- (user, deckId, name) pour les tags spécifiques à un deck.
CREATE UNIQUE INDEX "CardTag_userId_deckId_name_key" ON "CardTag"("userId", "deckId", "name");

-- CreateIndex
CREATE INDEX "DeckCardTag_cardTagId_idx" ON "DeckCardTag"("cardTagId");

-- AddForeignKey
ALTER TABLE "CardTag" ADD CONSTRAINT "CardTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTag" ADD CONSTRAINT "CardTag_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckCardTag" ADD CONSTRAINT "DeckCardTag_deckCardId_fkey" FOREIGN KEY ("deckCardId") REFERENCES "DeckCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckCardTag" ADD CONSTRAINT "DeckCardTag_cardTagId_fkey" FOREIGN KEY ("cardTagId") REFERENCES "CardTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
