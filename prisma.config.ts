import { defineConfig } from 'prisma/config';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Match Next.js env precedence: real environment > .env.local > .env.development
// > .env (dotenv never overwrites a variable that is already set).
for (const file of ['.env.local', '.env.development', '.env']) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) loadEnv({ path, quiet: true });
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
