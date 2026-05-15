-- Assignations globales utilisateur <-> oracleId pour les tags globaux.
-- Voir prisma/schema.prisma:UserCardTag pour le modèle Prisma.

CREATE TABLE "UserCardTag" (
    "userId" TEXT NOT NULL,
    "oracleId" TEXT NOT NULL,
    "cardTagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCardTag_pkey" PRIMARY KEY ("userId", "oracleId", "cardTagId")
);

CREATE INDEX "UserCardTag_userId_oracleId_idx" ON "UserCardTag"("userId", "oracleId");
CREATE INDEX "UserCardTag_cardTagId_idx" ON "UserCardTag"("cardTagId");
CREATE INDEX "UserCardTag_oracleId_idx" ON "UserCardTag"("oracleId");

ALTER TABLE "UserCardTag" ADD CONSTRAINT "UserCardTag_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserCardTag" ADD CONSTRAINT "UserCardTag_cardTagId_fkey"
    FOREIGN KEY ("cardTagId") REFERENCES "CardTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: les anciennes assignations de tags globaux sont stockées dans
-- DeckCardTag (granularité DeckCard). On les recopie vers UserCardTag à la
-- granularité oracleId puis on les retire de DeckCardTag (qui ne stocke
-- désormais que les tags scope='deck').
INSERT INTO "UserCardTag" ("userId", "oracleId", "cardTagId", "createdAt")
SELECT DISTINCT ct."userId", c."oracleId", dct."cardTagId", dct."createdAt"
FROM "DeckCardTag" dct
JOIN "CardTag" ct ON ct."id" = dct."cardTagId"
JOIN "DeckCard" dc ON dc."id" = dct."deckCardId"
JOIN "Card" c ON c."id" = dc."cardId"
WHERE ct."deckId" IS NULL
ON CONFLICT DO NOTHING;

DELETE FROM "DeckCardTag" dct
USING "CardTag" ct
WHERE dct."cardTagId" = ct."id" AND ct."deckId" IS NULL;
