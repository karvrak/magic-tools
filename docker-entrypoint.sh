#!/bin/sh
set -e

echo "🔄 Syncing database schema..."
node /app/node_modules/prisma/build/index.js db push --schema=/app/prisma/schema.prisma --skip-generate

echo "✅ Database sync complete. Starting application..."
exec node server.js
