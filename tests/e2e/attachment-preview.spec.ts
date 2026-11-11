import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { E2E_ADMIN } from './credentials';
import { open, signIn } from './helpers';

const fixture = (name: string) => readFileSync(`tests/fixtures/preview/${name}`);
const files = [
  ['image.png', 'image/png'],
  ['clip.mp4', 'video/mp4'],
  ['tone.wav', 'audio/wav'],
  ['document.pdf', 'application/pdf'],
  ['document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['workbook.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['notes.txt', 'text/plain'],
  ['table.csv', 'text/csv'],
  ['legacy.doc', 'application/msword'],
  ['corrupt.pdf', 'application/pdf'],
];
let requestId: string, taskId: string;
const uploaded: Record<string, Record<string, string>> = {};
test.describe.configure({ mode: 'serial' });
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await signIn(page, E2E_ADMIN.username, E2E_ADMIN.password);
  const project = (
    await (await page.request.post('/api/projects', { data: { name: `Preview ${Date.now()}` } })).json()
  ).project.id;
  taskId = (
    await (
      await page.request.post(`/api/projects/${project}/tasks`, { data: { title: 'Preview fixtures' } })
    ).json()
  ).task.id;
  const category = (await (await page.request.get('/api/request-categories')).json()).categories.find(
    (c: { isArchived: boolean }) => !c.isArchived,
  ).id;
  const request = await page.request.post(`/api/projects/${project}/requests`, {
    data: {
      title: 'Private preview fixtures',
      description: 'A local attachment preview test.',
      categoryId: category,
      occurredAt: '2026-11-11T10:00:00+04:00',
    },
  });
  expect(request.status(), await request.text()).toBe(201);
  requestId = (await request.json()).request.id;
  for (const base of [`/api/requests/${requestId}/attachments`, `/api/tasks/${taskId}/attachments`]) {
    uploaded[base] = {};
    for (const [name, mimeType] of files) {
      const result = await page.request.post(base, {
        multipart: { file: { name, mimeType, buffer: fixture(name) } },
      });
      expect(result.status(), await result.text()).toBe(201);
      uploaded[base][name] = (await result.json()).attachment.id;
    }
  }
  await page.context().close();
});
async function preview(page: Page, name: string) {
  await page.getByRole('link', { name, exact: true }).click();
  const dialog = page.getByRole('dialog', { name, exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
async function closePreview(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('preview and download endpoints retain auth and implement media byte ranges on both parents', async ({
  page,
  request,
}) => {
  await signIn(page, E2E_ADMIN.username, E2E_ADMIN.password);
  for (const [base, ids] of Object.entries(uploaded)) {
    const url = `${base}/${ids['clip.mp4']}/download`;
    expect((await request.get(`${url}?preview=1`, { headers: { Range: 'bytes=0-9' } })).status()).toBe(401);
    const head = await page.request.head(`${url}?preview=1`);
    expect(head.headers()['content-length']).toBe(String(fixture('clip.mp4').length));
    expect(head.headers()['content-disposition']).toMatch(/^inline;/);
    expect((await page.request.get(url)).headers()['content-disposition']).toMatch(/^attachment;/);
    for (const range of ['bytes=0-9', 'bytes=-10']) {
      const response = await page.request.get(`${url}?preview=1`, { headers: { Range: range } });
      expect(response.status()).toBe(206);
      expect(response.headers()['accept-ranges']).toBe('bytes');
      expect(response.headers()['cache-control']).toContain('no-store');
      expect(response.headers()['cross-origin-resource-policy']).toBe('same-origin');
      expect(await response.body()).toEqual(
        range === 'bytes=0-9' ? fixture('clip.mp4').subarray(0, 10) : fixture('clip.mp4').subarray(-10),
      );
    }
    const invalid = await page.request.get(`${url}?preview=1`, { headers: { Range: 'bytes=999999999-' } });
    expect(invalid.status()).toBe(416);
    expect(invalid.headers()['content-range']).toBe(`bytes */${fixture('clip.mp4').length}`);
  }
});

for (const area of ['requests', 'tasks']) {
  test(`${area}: private image, video, audio, PDF, text and Office previews with safe fallbacks`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await signIn(page, E2E_ADMIN.username, E2E_ADMIN.password);
    await open(page, `/${area}/${area === 'requests' ? requestId : taskId}`);
    let downloads = 0;
    page.on('download', () => downloads++);
    const offsite: string[] = [];
    page.on('request', (r) => {
      if (
        !r.url().startsWith('http://localhost:3100') &&
        !r.url().startsWith('blob:') &&
        !r.url().startsWith('data:')
      )
        offsite.push(r.url());
    });
    let dialog = await preview(page, 'image.png');
    await expect
      .poll(() => dialog.locator('img').evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBe(1);
    await closePreview(page);
    dialog = await preview(page, 'clip.mp4');
    await expect
      .poll(() => dialog.locator('video').evaluate((v) => (v as HTMLVideoElement).readyState))
      .toBeGreaterThan(0);
    await dialog.locator('video').evaluate(async (v) => {
      const video = v as HTMLVideoElement;
      video.muted = true;
      await video.play();
      video.currentTime = 1;
    });
    await expect
      .poll(() => dialog.locator('video').evaluate((v) => (v as HTMLVideoElement).currentTime))
      .toBeGreaterThanOrEqual(1);
    await closePreview(page);
    dialog = await preview(page, 'tone.wav');
    await expect
      .poll(() => dialog.locator('audio').evaluate((a) => (a as HTMLAudioElement).readyState))
      .toBeGreaterThan(0);
    await closePreview(page);
    dialog = await preview(page, 'document.pdf');
    await expect(dialog.getByText('Preview page one')).toBeAttached();
    await expect(dialog.locator('canvas')).toBeVisible();
    await dialog.getByRole('button', { name: 'Next page' }).click();
    await expect(dialog.getByText('Page 2 of 2')).toBeVisible();
    await expect(dialog.getByText('Preview page two')).toBeAttached();
    await closePreview(page);
    dialog = await preview(page, 'document.docx');
    await expect(dialog.locator('pre')).toContainText('Private Word preview');
    await expect(dialog.locator('pre')).toContainText('مستند تنويل');
    await closePreview(page);
    dialog = await preview(page, 'workbook.xlsx');
    await expect(dialog.getByRole('cell', { name: 'Private workbook preview' })).toBeVisible();
    await dialog.getByLabel('Worksheet').selectOption({ label: 'Second sheet' });
    await expect(dialog.getByRole('cell', { name: 'Another sheet' })).toBeVisible();
    await closePreview(page);
    dialog = await preview(page, 'notes.txt');
    await expect(dialog.locator('pre')).toContainText('<script>alert("never execute")</script>');
    await closePreview(page);
    dialog = await preview(page, 'table.csv');
    await expect(dialog.locator('pre')).toContainText('Tanweel,50');
    await closePreview(page);
    dialog = await preview(page, 'legacy.doc');
    await expect(dialog.getByText(/This file format cannot be previewed/)).toBeVisible();
    await closePreview(page);
    dialog = await preview(page, 'corrupt.pdf');
    await expect(dialog.getByText(/The preview could not be opened/)).toBeVisible();
    await closePreview(page);
    expect(downloads).toBe(0);
    expect(offsite).toEqual([]);
    dialog = await preview(page, 'notes.txt');
    const downloaded = page.waitForEvent('download');
    await dialog.getByRole('link', { name: 'Download', exact: true }).click();
    expect((await downloaded).suggestedFilename()).toBe('notes.txt');
    await closePreview(page);
  });
}

test('Arabic mobile previews fit the screen, close with Escape and keep download optional', async ({
  page,
}) => {
  await signIn(page, E2E_ADMIN.username, E2E_ADMIN.password);
  await open(page, `/requests/${requestId}`);
  await page.getByRole('button', { name: 'Language', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await page.setViewportSize({ width: 320, height: 740 });
  const dialog = await preview(page, 'document.pdf');
  await expect(dialog.getByText('الصفحة 1 من 2')).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'تنزيل', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await dialog.evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(true);
  await closePreview(page);
  await expect(page.getByRole('link', { name: 'document.pdf', exact: true })).toBeFocused();
});
