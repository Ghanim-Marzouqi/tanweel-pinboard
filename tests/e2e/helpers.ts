import { expect, type Browser, type Page } from '@playwright/test';

/** Navigate and wait until the page is hydrated, so typed input isn't lost. */
export async function open(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
}

export async function signIn(page: Page, username: string, password: string, { expectSuccess = true } = {}) {
  await open(page, '/login');
  await page.getByLabel('Username or email').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  if (expectSuccess) await page.waitForURL((url) => url.pathname !== '/login');
}

/** Home is "My tasks" at "/". */
export async function expectHome(page: Page) {
  await expect.poll(() => new URL(page.url()).pathname).toBe('/');
}

export async function newPage(browser: Browser) {
  const context = await browser.newContext();
  return context.newPage();
}

export async function createProject(page: Page, name: string): Promise<string> {
  await open(page, '/projects/new');
  await page.getByLabel('Project name').fill(name);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  return new URL(page.url()).pathname;
}
