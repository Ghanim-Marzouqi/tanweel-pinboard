#!/usr/bin/env node
// Input contains ONLY username, name, email, status and language. Never export
// old password hashes or project/task data. Dry-run by default; --apply writes.
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import pg from 'pg';

const apply = process.argv.includes('--apply');
const file = process.argv.find((arg, i) => i > 1 && !arg.startsWith('--'));
if (!file || !process.env.DATABASE_URL) throw new Error('Usage: import-vikunja-users.mjs users.json [--apply]; DATABASE_URL required');
const source = JSON.parse(await readFile(file, 'utf8'));
if (!Array.isArray(source) || !source.length) throw new Error('Expected a non-empty users array');
const usernames = new Set();
const emails = new Set();
const users = source.map((u) => {
  if (Object.keys(u).some((key) => !['username', 'name', 'email', 'status', 'language'].includes(key))) {
    throw new Error('Unexpected exported fields; only account identity fields are accepted');
  }
  const username = u.username.trim().toLowerCase();
  const email = u.email.trim().toLowerCase();
  const name = u.name.trim() || username;
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length > 120) {
    throw new Error('Invalid account identity; resolve before importing');
  }
  if (usernames.has(username) || emails.has(email)) throw new Error('Duplicate username or email');
  if (u.status !== 0) throw new Error('Non-active source account requires explicit review');
  usernames.add(username); emails.add(email);
  return { username, email, name, locale: u.language?.startsWith('ar') ? 'ar' : 'en' };
});
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  let created = 0, existing = 0;
  for (const u of users) {
    const { rows } = await client.query('SELECT username,email FROM users WHERE username=$1 OR email=$2', [u.username, u.email]);
    if (rows.length) {
      if (rows.length !== 1 || rows[0].username !== u.username || rows[0].email !== u.email) throw new Error('Existing identity conflict');
      existing++;
      continue;
    }
    // Random secret is discarded: users must use Forgot password to gain access.
    if (apply) await client.query(
      `INSERT INTO users (id,username,email,name,"passwordHash",role,"isActive","mustChangePassword",locale,"createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,'member',true,true,$6,now(),now())`,
      [randomUUID(), u.username, u.email, u.name, await hash(randomBytes(32).toString('base64url')), u.locale],
    );
    created++;
  }
  await client.query(apply ? 'COMMIT' : 'ROLLBACK');
  console.log(JSON.stringify({ apply, source: users.length, created, existing, passwords: 'Forgot password required for imported users', importedProjects: 0, importedTasks: 0 }));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
