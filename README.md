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
| `/api/wantlist` | GET, POST, PATCH, DELETE | Wantlist CRUD |
| `/api/sync/cards` | GET, POST | Card sync status/trigger |
| `/api/sync/prices` | GET, POST | Price sync status/trigger |
| `/api/stats` | GET | Database statistics |

## Credits

- Card data provided by [Scryfall](https://scryfall.com)
- Built with [Next.js](https://nextjs.org), [Prisma](https://prisma.io), and [shadcn/ui](https://ui.shadcn.com)

## License

MIT
