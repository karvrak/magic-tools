-- AlterTable
ALTER TABLE "Deck" ADD COLUMN "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Deck_shareToken_key" ON "Deck"("shareToken");

-- CreateIndex
CREATE INDEX "Deck_shareToken_idx" ON "Deck"("shareToken");

-- CreateTable
CREATE TABLE "CollectionSnapshot" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "date" DATE NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCards" INTEGER NOT NULL DEFAULT 0,
    "rarityBreakdown" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionSnapshot_date_idx" ON "CollectionSnapshot"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionSnapshot_ownerId_date_key" ON "CollectionSnapshot"("ownerId", "date");

-- AddForeignKey
ALTER TABLE "CollectionSnapshot" ADD CONSTRAINT "CollectionSnapshot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
