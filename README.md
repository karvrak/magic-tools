# magicTools

A Magic: The Gathering card search and deck building application with D&D-inspired aesthetics.

## Features

- **Advanced Card Search**: Search cards with multiple filters (colors, CMC, type, rarity, format legality, price, etc.)
- **Deck Management**: Create and manage your MTG decks with mainboard, sideboard, and maybeboard categories
- **Wantlist**: Track cards you want to acquire with priority levels
- **Price Tracking**: View card prices from Scryfall (EUR & USD)
- **Offline-First**: Card data is stored locally in PostgreSQL for fast searches

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Data Source**: Scryfall Bulk Data API

## Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

## Setup

1. **Clone and install dependencies**

```bash
npm install
```

2. **Configure environment**

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/magictools?schema=public"
AUTH_PASSWORD="your-secret-password"
```

3. **Setup database**

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

4. **Initial data sync**

Run the initial card sync (this will download ~1.5GB of data and may take 10-30 minutes):

```bash
npm run sync:cards
```

Then sync prices:

```bash
npm run sync:prices
```

5. **Start the development server**

```bash
npm run dev
```

6. **Initialize cron jobs**

Visit `http://localhost:3000/api/cron/init` to start the automatic sync jobs.

## Data Synchronization

The app syncs data from Scryfall automatically:

- **Prices**: Daily at 10:00 AM (Europe/Paris timezone)
- **Cards**: Weekly on Sunday at 3:00 AM

You can also trigger manual syncs:

```bash
# Sync all cards (~1.5GB, takes 10-30 min)
npm run sync:cards

# Sync prices only (~80MB, takes 2-5 min)
npm run sync:prices
```

Or via API:
- POST `/api/sync/cards` - Trigger card sync
- POST `/api/sync/prices` - Trigger price sync

## Authentication

The app uses a simple shared password authentication. Set your password in the `AUTH_PASSWORD` environment variable.

## Development

```bash
# Run dev server
npm run dev

# Open Prisma Studio (database GUI)
npm run db:studio

# Run linting
npm run lint
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/search` | GET | Search cards with filters |
| `/api/decks` | GET, POST | List/create decks |
| `/api/decks/[id]` | GET, PATCH, DELETE | Deck CRUD |
| `/api/decks/[id]/cards` | POST, PATCH, DELETE | Manage deck cards |
| `/api/decks/[id]/synergies` | GET | AI: vector search synergies (no LLM) |
| `/api/decks/[id]/complete` | GET | AI: full pipeline + Sonnet rerank, grouped by role |
| `/api/decks/[id]/suggestions` | GET | Legacy AI endpoint (uses new pipeline) |
| `/api/wantlist` | GET, POST, PATCH, DELETE | Wantlist CRUD |
| `/api/sync/cards` | GET, POST | Card sync status/trigger |
| `/api/sync/prices` | GET, POST | Price sync status/trigger |
| `/api/stats` | GET | Database statistics |

## AI Layer (Vintage / Commander)

System de recommandation IA en 4 couches : filtres deterministes (legalite, color identity, owned-only) → embeddings semantiques (pgvector) → classification structuree (roles, archetypes) → re-ranking LLM final (Claude Sonnet 4.6).

### Initial setup

1. **Variables d'environnement** : ajouter dans `.env` (au choix)
   ```
   # Recommande — un seul gateway pour tous les modeles
   OPENROUTER_API_KEY=sk-or-v1-...

   # OU bien les cles natives (fallback si OPENROUTER_API_KEY absent)
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   La logique de selection: si `OPENROUTER_API_KEY` est present il est utilise pour les 3 couches (embeddings, classification, rerank). Sinon fallback sur OpenAI natif (les ID de modele dans `config.ts` integrent le prefixe `openai/` qu'OpenAI natif ignore).

2. **Postgres `pgvector`** : la migration cree l'extension via `CREATE EXTENSION IF NOT EXISTS vector`. Si Postgres n'a pas le binaire installe :
   - Debian/Ubuntu : `apt-get install postgresql-16-pgvector`
   - Docker : utiliser l'image `pgvector/pgvector:pg16` au lieu de `postgres:16`
   - Le SQL echouera avec un message clair sinon.

3. **Appliquer la migration** :
   ```bash
   npx prisma migrate deploy   # production
   # ou
   npx prisma migrate dev      # dev (cree shadow DB)
   ```

4. **Generer les embeddings** (one-shot, ~5-15 min, ~$3-5 pour 30k cartes) :
   ```bash
   npm run ai:embed
   ```

5. **Classifier les cartes** (one-shot, ~10-15 min, ~$3-5) :
   ```bash
   npm run ai:classify
   ```

6. **Analyser un deck** (optionnel, fait automatiquement a la demande) :
   ```bash
   npm run ai:analyze-deck -- --id=<deckId>
   npm run ai:analyze-deck -- --all
   ```

### Modèles utilises

| Couche | Modele (slug OpenRouter) | Notes |
|--------|--------|-------|
| Embeddings | `openai/text-embedding-3-large` (1536 dim, Matryoshka) | Verrouille via `EMBEDDING_VERSION` |
| Classification | `openai/gpt-4o-mini` (JSON mode + zod) | Verrouille via `CLASSIFICATION_VERSION` |
| Re-ranking | `anthropic/claude-sonnet-4.6` | Appele uniquement sur top 30 candidats |

Une modification de prompt ou de modele necessite un bump de la version correspondante dans `src/lib/ai/config.ts` — les cartes seront automatiquement re-traitees au prochain run.

### Cron incremental

Configures dans `src/lib/cron.ts` (initialises automatiquement au demarrage du serveur) :

- Dimanche 4h : `runEmbeddingsPipeline` — re-embed les nouvelles cartes et les errata (detecte par hash du texte canonique).
- Dimanche 5h : `runClassificationPipeline` — classifie les nouvelles cartes uniquement.

### Idempotence

- Embeddings : skip si `embeddingTextHash` existe deja avec le meme `embeddingModel` + `embeddingVersion`. Les errata Scryfall (changements d'oracle text) sont detectes par hash et declenchent un re-embedding automatique.
- Classification : skip si `classificationVersion` correspond.

### Endpoints

```http
GET /api/decks/{id}/synergies?limit=30&owned_only=true
```
Retourne les top N cartes les plus synergiques avec le deck (score hybride : 0.6 × similarity_centroid + 0.4 × similarity_max_to_deck). Pas d'appel LLM, latence ~100-300 ms.

```http
GET /api/decks/{id}/complete?per_role_limit=5&max_candidates=30&owned_only=true
```
Pipeline complete : analyse du deck → detection des gaps de roles selon archetype → vector search par role → re-rank Sonnet 4.6 → reponse groupee par role avec explications FR. Latence ~3-8 s (LLM bound).

### Architecture interne

```
src/lib/ai/
  config.ts              # constantes modeles + versions
  clients.ts             # singletons OpenAI / Anthropic
  types.ts               # CARD_ROLES, KNOWN_ARCHETYPES, formats
  schemas.ts             # zod schemas pour les sorties LLM
  prompts/
    classification.ts    # prompt one-shot (versionne)
    rerank.ts            # prompt re-ranking (versionne)
  embeddings/
    canonical-text.ts    # builder + hash SHA-256 pour l'invalidation
    embed-cards.ts       # ETL idempotent
  classification/
    classify-cards.ts    # batch sync avec retry zod
  deck-analysis/
    centroid.ts          # centroide pondere (commander x3)
    distributions.ts     # role / curve distributions
    archetype.ts         # vote pondere sur archetype_tags
    analyze-deck.ts      # orchestration + persist
  recommendations/
    archetype-profiles.ts # heuristiques de gap par archetype (TS config)
    gap-detection.ts      # role gaps vs target
    filters.ts            # filtres deterministes SQL
    synergies.ts          # vector search hybride
    complete-deck.ts      # pipeline complete avec rerank
```

Tests unitaires : `src/lib/ai/__tests__/` (36 tests).

## Credits

- Card data provided by [Scryfall](https://scryfall.com)
- Built with [Next.js](https://nextjs.org), [Prisma](https://prisma.io), and [shadcn/ui](https://ui.shadcn.com)

## License

MIT
