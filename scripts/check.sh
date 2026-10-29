#!/bin/sh
# Everything CI checks, run locally: lint, types, unit tests, production build
# and the Playwright browser tests. Used by the git pre-push hook and by
# `npm run check`. Needs the database running: docker compose up -d db
set -e

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

step "Database reachable?"
if ! node -e '
  const { Client } = require("pg");
  require("dotenv").config({ path: ".env", quiet: true });
  const url = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL is not set (see .env.example)"); process.exit(1); }
  const c = new Client({ connectionString: url.replace(/\/[^/?]+(\?|$)/, "/postgres$1") });
  c.connect().then(() => c.end()).catch((e) => { console.error(e.message); process.exit(1); });
'; then
  echo "Start it first: docker compose up -d db" >&2
  exit 1
fi

step "Lint";        npm run lint --silent
step "Typecheck";   npm run typecheck --silent
step "Unit tests";  npm test --silent
step "Build";       npm run build --silent
step "Browser tests"; npm run test:e2e --silent

printf '\n\033[1;32m✓ All checks passed\033[0m\n'
