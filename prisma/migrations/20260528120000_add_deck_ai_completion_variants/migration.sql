-- Cache des variantes de l'analyse IA pour le pipeline /api/decks/[id]/complete.
-- Une variante = analyse avec un userPrompt et/ou des filtres custom (rarites,
-- prix max). Indexee par hash deterministe des inputs:
--   { [hash]: { result: CompleteDeckResult, computedAt: ISOString,
--               inputs: { userPrompt, rarities, priceMaxEur } } }
-- Le hit-rate est conserve pour les requetes par defaut (sans filtre) qui
-- continuent d'utiliser `aiCompletion`.
ALTER TABLE "Deck" ADD COLUMN IF NOT EXISTS "aiCompletionVariants" JSONB NOT NULL DEFAULT '{}'::jsonb;
