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
node -e '
const { Client } = require("pg");
(async () => {
  const dbUrl = new URL(process.env.DATABASE_URL);
  const dbName = decodeURIComponent(dbUrl.pathname.replace(/^\//, "").split("?")[0]);
  if (!dbName) throw new Error("DATABASE_URL has no database name");
  const adminUrl = new URL(dbUrl.toString());
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  const { rows } = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbName],
  );
  if (rows.length === 0) {
    console.log(`[pinboard] Creating database ${dbName}`);
    await client.query(`CREATE DATABASE "${dbName.replace(/"/g, "\"\"")}"`);
  } else {
    console.log(`[pinboard] Database ${dbName} already exists`);
  }
  await client.end();
})().catch((e) => { console.error(e); process.exit(1); });
'

echo "[pinboard] Applying migrations…"
node ./node_modules/prisma/build/index.js migrate deploy

echo "[pinboard] Checking for a first admin…"
node ./scripts/create-user.mjs --bootstrap

echo "[pinboard] Starting Next.js server on port ${PORT:-3000}…"
exec node server.js
