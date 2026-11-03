import { expect, test } from '@playwright/test';
import { signIn, open } from './helpers';
import { E2E_ADMIN } from './credentials';
import ar from '../../messages/ar.json';

const publicPaths = ['/offline.html', '/pwa/icon-192.png', '/pwa/icon-512.png'];

test('PWA metadata, official icons and worker are public without exposing project data', async ({
  request,
  page,
}) => {
  const response = await request.get('/manifest.webmanifest', { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('manifest+json');
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    id: '/',
    scope: '/',
    start_url: '/requests',
    display: 'standalone',
    short_name: 'Pinboard',
  });
  for (const size of [192, 512]) {
    const icon = await request.get(`/pwa/icon-${size}.png`, { maxRedirects: 0 });
    expect(icon.status()).toBe(200);
    expect(icon.headers()['content-type']).toContain('image/png');
    const bytes = await icon.body();
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  }
  const sw = await request.get('/sw.js', { maxRedirects: 0 });
  expect(sw.status()).toBe(200);
  expect(sw.headers()['content-type']).toContain('javascript');
  expect(sw.headers()['cache-control']).toContain('no-store');
  expect(sw.headers()['service-worker-allowed']).toBe('/');
  expect((await request.get('/api/projects')).status()).toBe(401);
  await open(page, '/login');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /apple-icon/);
});

test('real service worker shows a neutral offline screen and never caches private pages or API data', async ({
  page,
  context,
}) => {
  await signIn(page, E2E_ADMIN.username, E2E_ADMIN.password);
  await open(page, '/requests');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  // Exercise a real authenticated response before checking the cache contents.
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/projects');
    return { status: response.status, cache: response.headers.get('cache-control') };
  });
  expect(result.status).toBe(200);
  expect(result.cache).toContain('no-store');
  const cachedPaths = async () =>
    page.evaluate(async () => {
      const paths: string[] = [];
      for (const name of await caches.keys()) {
        for (const req of await (await caches.open(name)).keys()) paths.push(new URL(req.url).pathname);
      }
      return paths.sort();
    });
  expect(await cachedPaths()).toEqual([...publicPaths].sort());
  await context.setOffline(true);
  await expect(page.getByRole('status')).toContainText('You’re offline');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'You’re offline', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'أنت غير متصل بالإنترنت', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /E2E Admin/ })).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      fetch('/api/projects')
        .then(() => 'unexpected response')
        .catch(() => 'offline'),
    ),
  ).toBe('offline');
  expect(await cachedPaths()).toEqual([...publicPaths].sort());
  await context.setOffline(false);
  await page.getByRole('button', { name: /Try again/ }).click();
  await expect(page.getByRole('heading', { name: 'Requests', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  expect((await page.request.get('/api/projects')).status()).toBe(401);
  expect(await cachedPaths()).toEqual([...publicPaths].sort());
});

test('installation help works on narrow Arabic screens and hides once installed', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await open(page, '/login');
  await page.getByRole('button', { name: 'Language', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('button', { name: ar.pwa.install, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: ar.pwa.iphone, exact: true })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: ar.pwa.android, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(320);
  await dialog.getByRole('button', { name: ar.pwa.close, exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(page.getByRole('button', { name: ar.pwa.install, exact: true })).toHaveCount(0);
});
