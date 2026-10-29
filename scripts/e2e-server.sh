#!/bin/sh
# Start a throwaway Pinboard for the Playwright tests (run by playwright.config.ts).
#
# Creates/migrates E2E_DATABASE_URL, creates the test admin on first run, then
# serves the existing production build (`npm run build` first) on E2E_PORT.
# The database is not wiped between runs; each test run uses unique names.
set -e

: "${E2E_DATABASE_URL:?E2E_DATABASE_URL is required}"

# Safety net: never point the tests at a database that isn't clearly for tests.
db_name=$(node -e 'console.log(decodeURIComponent(new URL(process.env.E2E_DATABASE_URL).pathname.slice(1)))')
case "$db_name" in
  *_e2e | *_test) ;;
  *)
    echo "[e2e] Refusing to use database '$db_name': its name must end in _e2e or _test" >&2
    exit 1
    ;;
esac

export DATABASE_URL="$E2E_DATABASE_URL"
export ADMIN_USERNAME="$E2E_ADMIN_USERNAME"
export ADMIN_PASSWORD="$E2E_ADMIN_PASSWORD"
export ADMIN_NAME="E2E Admin"

node scripts/ensure-db.mjs
npx prisma migrate deploy
node scripts/create-user.mjs --bootstrap
exec npx next start -p "${E2E_PORT:-3100}"
