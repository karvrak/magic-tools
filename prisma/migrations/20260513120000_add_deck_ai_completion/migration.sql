-- Persistance du resultat IA complete (pipeline rerank Sonnet 4.6)
-- Stocke le CompleteDeckResult complet (suggestions par role + miscSuggestions
-- + deckEvaluation = scoring de chaque carte du deck). Invalide manuellement
-- via le bouton Re-run de l'UI.
ALTER TABLE "Deck" ADD COLUMN IF NOT EXISTS "aiCompletion" JSONB;
ALTER TABLE "Deck" ADD COLUMN IF NOT EXISTS "aiCompletedAt" TIMESTAMPTZ;
