#!/bin/sh
set -e

echo "==> [1/3] Checking environment..."
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set."
  exit 1
fi

echo "==> [2/3] Syncing database schema..."
# Prefer direct Neon URL for schema sync; runtime app uses pooled DATABASE_URL.
if [ -n "$DATABASE_URL_UNPOOLED" ]; then
  echo "    Using DATABASE_URL_UNPOOLED for prisma db push"
  DATABASE_URL="$DATABASE_URL_UNPOOLED" prisma db push --skip-generate
else
  prisma db push --skip-generate
fi

echo "==> [3/3] Starting AI Sale Dashboard..."
exec node server.js
