#!/usr/bin/env node
/**
 * Create the database named in DATABASE_URL if it doesn't exist yet
 * (connects to the server's `postgres` maintenance database to do so).
 */
import pg from 'pg';

const dbUrl = new URL(process.env.DATABASE_URL ?? '');
const dbName = decodeURIComponent(dbUrl.pathname.replace(/^\//, ''));
if (!dbName) {
  console.error('[ensure-db] DATABASE_URL has no database name');
  process.exit(1);
}

const adminUrl = new URL(dbUrl.toString());
adminUrl.pathname = '/postgres';
adminUrl.search = '';

const client = new pg.Client({ connectionString: adminUrl.toString() });
await client.connect();
try {
  const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (rows.length === 0) {
    console.log(`[ensure-db] Creating database ${dbName}`);
    await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
  } else {
    console.log(`[ensure-db] Database ${dbName} already exists`);
  }
} finally {
  await client.end();
}
