-- AI Layer migration: pgvector extension + embedding/classification columns + deck analysis
-- Non-destructive: uses IF NOT EXISTS everywhere, no DROP / no data rewrites.

-- 1. pgvector extension (requires extension to be available on the Postgres host)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Card: embedding columns
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "embeddingModel" TEXT;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "embeddingVersion" TEXT;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "embeddingTextHash" TEXT;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "embeddedAt" TIMESTAMPTZ;

-- 3. Card: classification columns
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "primaryRole" TEXT;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "secondaryRoles" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "archetypeTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "interactionType" TEXT;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "cardTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "producedMana" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "classificationVersion" TEXT;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "classifiedAt" TIMESTAMPTZ;

-- 4. Card: indexes
-- HNSW for cosine similarity (default m=16, ef_construction=64; tune later if needed)
CREATE INDEX IF NOT EXISTS "Card_embedding_hnsw_idx"
  ON "Card" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "Card_primaryRole_idx" ON "Card" ("primaryRole");
CREATE INDEX IF NOT EXISTS "Card_archetypeTags_gin_idx" ON "Card" USING gin ("archetypeTags");
CREATE INDEX IF NOT EXISTS "Card_cardTypes_gin_idx" ON "Card" USING gin ("cardTypes");

-- 5. Deck: analysis columns
ALTER TABLE "Deck" ADD COLUMN IF NOT EXISTS "centroid" vector(1536);
ALTER TABLE "Deck" ADD COLUMN IF NOT EXISTS "clusterCentroids" JSONB;
ALTER TABLE "Deck" ADD COLUMN IF NOT EXISTS "detectedArchetype" TEXT;
ALTER TABLE "Deck" ADD COLUMN IF NOT EXISTS "archetypeConfidence" DOUBLE PRECISION;
ALTER TABLE "Deck" ADD COLUMN IF NOT EXISTS "roleDistribution" JSONB;
ALTER TABLE "Deck" ADD COLUMN IF NOT EXISTS "curveDistribution" JSONB;
ALTER TABLE "Deck" ADD COLUMN IF NOT EXISTS "analyzedAt" TIMESTAMPTZ;
