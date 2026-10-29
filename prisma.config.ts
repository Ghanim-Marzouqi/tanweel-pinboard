import { defineConfig } from 'prisma/config';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Match Next.js env precedence: .env.local > .env.development > .env
for (const file of ['.env', '.env.development', '.env.local']) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) loadEnv({ path, override: true });
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
