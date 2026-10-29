import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { E2E_ADMIN } from './tests/e2e/credentials';

// Same precedence as the app: real environment > .env.local > .env
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) loadEnv({ path: file, quiet: true });
}

const port = Number(process.env.E2E_PORT ?? 3100);

/** Default: the dev database server, but a separate `pinboard_e2e` database. */
function e2eDatabaseUrl(): string {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  if (!process.env.DATABASE_URL) throw new Error('Set E2E_DATABASE_URL or DATABASE_URL');
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = '/pinboard_e2e';
  return url.toString();
}

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    locale: 'en-GB',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // Locally, use the installed Google Chrome instead of downloading a browser.
      use: { ...devices['Desktop Chrome'], ...(process.env.CI ? {} : { channel: 'chrome' }) },
    },
  ],
  webServer: {
    command: 'sh scripts/e2e-server.sh',
    url: `http://localhost:${port}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    env: {
      E2E_PORT: String(port),
      E2E_DATABASE_URL: e2eDatabaseUrl(),
      E2E_ADMIN_USERNAME: E2E_ADMIN.username,
      E2E_ADMIN_PASSWORD: E2E_ADMIN.password,
      AUTH_URL: `http://localhost:${port}`,
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'e2e-only-auth-secret-0123456789abcdef',
      UPLOADS_DIR: '.e2e-storage',
    },
  },
});
