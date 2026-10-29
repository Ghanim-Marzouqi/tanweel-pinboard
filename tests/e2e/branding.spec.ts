import { expect, test } from '@playwright/test';

test('signed-out users can load official branding without gaining access to project data', async ({ request, page }) => {
  for (const path of ['/brand/tanweel-purple.png', '/brand/tanweel-white.png', '/icon.png', '/apple-icon.png']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toContain('image/png');
    expect((await response.body()).subarray(0, 8).toString('hex'), path).toBe('89504e470d0a1a0a');
  }

  expect((await request.get('/api/projects', { maxRedirects: 0 })).status()).toBe(401);
  await page.goto('/login');
  const logo = page.locator('img[alt="Tanweel"]:visible');
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
});
