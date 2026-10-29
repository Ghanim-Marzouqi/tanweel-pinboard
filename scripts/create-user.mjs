#!/usr/bin/env node
/**
 * Create a local user account.
 *
 *   npm run user:create -- --username ali --name "Ali Al-Harthy" --role admin [--email ali@tanweel.om]
 *
 * The password is prompted for (hidden), or read from the USER_PASSWORD env var.
 *
 *   node scripts/create-user.mjs --bootstrap
 *
 * Bootstrap mode is run by the Docker entrypoint: when the users table is
 * empty it creates an admin from ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_NAME /
 * ADMIN_EMAIL, and does nothing otherwise.
 *
 * Talks to Postgres with `pg` directly (no Prisma client) so it runs in the
 * slim production image without the TypeScript toolchain.
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { hash } from '@node-rs/argon2';

for (const file of ['.env', '.env.development', '.env.local']) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) loadEnv({ path, override: true, quiet: true });
}

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function fail(message) {
  console.error(`[create-user] ${message}`);
  process.exit(1);
}

function promptHidden(question) {
  if (!process.stdin.isTTY) {
    fail('no terminal to prompt for a password — set USER_PASSWORD instead');
  }
  return new Promise((resolvePrompt) => {
    let answered = false;
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
    };
    rl.on('close', () => {
      if (!answered) fail('password prompt cancelled');
    });
    rl.question(question, (answer) => {
      answered = true;
      rl.close();
      process.stdout.write('\n');
      resolvePrompt(answer);
    });
  });
}

function validate({ username, name, email, role, password }) {
  if (!USERNAME_RE.test(username)) {
    fail('username must be 3-64 chars: lowercase letters, digits, dot, dash or underscore');
  }
  if (!name || name.length > 120) fail('name is required (max 120 chars)');
  if (email && !EMAIL_RE.test(email)) fail('email is not valid');
  if (!['admin', 'member'].includes(role)) fail('role must be admin or member');
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    fail(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
}

async function insertUser(client, user) {
  const now = new Date();
  await client.query(
    `INSERT INTO users (id, username, email, name, "passwordHash", role, "isActive", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6::"UserRole", true, $7, $7)`,
    [randomUUID(), user.username, user.email, user.name, await hash(user.password), user.role, now],
  );
}

async function main() {
  const { values } = parseArgs({
    options: {
      bootstrap: { type: 'boolean', default: false },
      username: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string' },
      role: { type: 'string', default: 'member' },
    },
  });

  if (!process.env.DATABASE_URL) fail('DATABASE_URL is not set');

  // Collect and validate everything before touching the database.
  let user;
  if (!values.bootstrap) {
    user = {
      username: values.username?.trim().toLowerCase() ?? '',
      name: values.name?.trim() ?? '',
      email: values.email?.trim().toLowerCase() || null,
      role: values.role,
      password: '',
    };
    validate({ ...user, password: 'x'.repeat(MIN_PASSWORD_LENGTH) });
    user.password = process.env.USER_PASSWORD ?? (await promptHidden('Password: '));
    validate(user);
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    if (values.bootstrap) {
      const { rows } = await client.query('SELECT count(*)::int AS n FROM users');
      if (rows[0].n > 0) return;
      if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
        console.warn(
          '[create-user] No users exist yet. Set ADMIN_USERNAME and ADMIN_PASSWORD to create the first admin.',
        );
        return;
      }
      const admin = {
        username: process.env.ADMIN_USERNAME.trim().toLowerCase(),
        name: (process.env.ADMIN_NAME ?? 'Administrator').trim(),
        email: process.env.ADMIN_EMAIL?.trim().toLowerCase() || null,
        role: 'admin',
        password: process.env.ADMIN_PASSWORD,
      };
      validate(admin);
      await insertUser(client, admin);
      console.log(`[create-user] Created first admin "${admin.username}"`);
      return;
    }

    await insertUser(client, user);
    console.log(`[create-user] Created ${user.role} "${user.username}"`);
  } catch (err) {
    if (err?.code === '23505') fail('a user with that username or email already exists');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
