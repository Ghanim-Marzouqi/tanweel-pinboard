#!/bin/sh
# Pinboard container entrypoint.
# Ensures the target Postgres database exists, applies pending Prisma
# migrations, creates the first admin if needed, then hands off to the
# Next.js standalone server.

set -e

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[pinboard] DATABASE_URL is not set — refusing to start." >&2
  exit 1
fi

echo "[pinboard] Ensuring database exists…"
node ./scripts/ensure-db.mjs

echo "[pinboard] Applying migrations…"
node ./node_modules/prisma/build/index.js migrate deploy

echo "[pinboard] Checking for a first admin…"
node ./scripts/create-user.mjs --bootstrap

echo "[pinboard] Starting Next.js server on port ${PORT:-3000}…"
exec node server.js
