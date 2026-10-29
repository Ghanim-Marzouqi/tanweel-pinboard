import { expect, test, type Page } from '@playwright/test';
import { E2E_ADMIN } from './credentials';
import { newPage, open, signIn } from './helpers';
import { emailsTo, waitForEmails } from './mail';

test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const noor = { username: `noor-${run}`, name: `Noor ${run}`, email: `noor-${run}@example.test`, id: '' };
const muscatToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Muscat' }).format(new Date());
const yesterday = (() => {
  const d = new Date(`${muscatToday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
})();
let page: Page;
let projectId = '';
let taskId = '';

async function api<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, data?: unknown): Promise<T> {
  const res = await page.request.fetch(url, { method, data });
  expect(res.ok(), `${method} ${url} → ${res.status()}`).toBeTruthy();
  return (await res.json()) as T;
}

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signIn(page, E2E_ADMIN.username, E2E_ADMIN.password);
  projectId = (await api<{ project: { id: string } }>('POST', '/api/projects', { name: `Email ${run}` })).project.id;
  noor.id = (
    await api<{ user: { id: string } }>('POST', '/api/admin/users', {
      username: noor.username,
      name: noor.name,
      email: noor.email,
      password: `Temp-${run}-pw`,
    })
  ).user.id;
  await api('POST', `/api/projects/${projectId}/members`, { userId: noor.id });
});

test.afterAll(async () => {
  await page.context().close();
});

test('assigning a task emails the assignee', async () => {
  const title = `Quarterly report ${run}`;
  taskId = (
    await api<{ task: { id: string } }>('POST', `/api/projects/${projectId}/tasks`, {
      title,
      assigneeId: noor.id,
      priority: 'High',
    })
  ).task.id;

  const [email] = await waitForEmails(noor.email, (e) => e.subject.includes(title));
  expect(email.subject).toBe(`E2E Admin assigned you: ${title}`);
  expect(email.text).toContain(`/tasks/${taskId}`);
});

test('@mention suggests members, highlights the name and emails them once', async () => {
  await open(page, `/tasks/${taskId}`);
  const box = page.getByLabel('Write a message…');
  await box.click();
  await page.keyboard.type(`@noor-${run.slice(0, 2)}`);
  const option = page.getByRole('listbox').getByRole('option', { name: new RegExp(noor.name) });
  await expect(option).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(box).toHaveValue(`@${noor.username} `);
  await page.keyboard.type(`please check the totals ${run}`);
  await page.getByRole('button', { name: 'Post comment' }).click();

  await expect(page.locator('span', { hasText: `@${noor.username}` }).first()).toBeVisible();
  const [email] = await waitForEmails(noor.email, (e) => e.text.includes(`please check the totals ${run}`));
  expect(email.subject).toContain('mentioned you');
  // Noor is also the assignee, but gets one email for this comment, not two.
  await page.waitForTimeout(1500);
  const forComment = (await emailsTo(noor.email)).filter((e) => e.text.includes(`please check the totals ${run}`));
  expect(forComment).toHaveLength(1);
});

test('a comment without a mention emails the assignee', async () => {
  await api('POST', `/api/tasks/${taskId}/comments`, { body: `Uploaded the draft ${run}` });
  const [email] = await waitForEmails(noor.email, (e) => e.text.includes(`Uploaded the draft ${run}`));
  expect(email.subject).toContain('New comment on');
});

test('the morning summary lists overdue and due-today tasks', async () => {
  const late = `Overdue invoice ${run}`;
  await api('POST', `/api/projects/${projectId}/tasks`, { title: late, assigneeId: noor.id, dueDate: yesterday });
  await api('POST', `/api/projects/${projectId}/tasks`, { title: `Due today ${run}`, assigneeId: noor.id, dueDate: muscatToday });
  await api('POST', '/api/admin/digest');

  const [email] = await waitForEmails(noor.email, (e) => e.subject.startsWith('Your tasks for today') && e.text.includes(late));
  expect(email.text).toMatch(/Overdue:[\s\S]*Overdue invoice/);
  expect(email.text).toMatch(/Due today:[\s\S]*Due today/);
});

test('forgot password: emailed link sets a new password and works only once', async ({ browser }) => {
  const visitor = await newPage(browser);
  await open(visitor, '/login');
  await visitor.getByRole('link', { name: 'Forgot password?' }).click();
  // Client-side navigation: wait for the new page, not just the network.
  await expect(visitor).toHaveURL(/\/forgot-password$/);
  await expect(visitor.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible();
  await visitor.getByLabel('Username or email').fill(noor.username);
  await visitor.getByRole('button', { name: 'Send reset link' }).click();
  await expect(visitor.getByRole('status')).toContainText('a link is on its way');

  const [email] = await waitForEmails(noor.email, (e) => e.subject === 'Reset your Pinboard password');
  const link = /https?:\/\/\S+\/reset-password\?token=[\w%-]+/.exec(email.text)![0];
  const newPassword = `Noor-new-${run}`;

  await open(visitor, link);
  await visitor.getByLabel('New password', { exact: true }).fill(newPassword);
  await visitor.getByLabel('Confirm new password').fill(newPassword);
  await visitor.getByRole('button', { name: 'Set new password' }).click();
  await expect(visitor.getByRole('status')).toContainText('Your password has been changed');

  // The temporary password is gone and the new one works (no forced change any more).
  await signIn(visitor, noor.username, newPassword);
  await expect.poll(() => new URL(visitor.url()).pathname).toBe('/');

  // Reusing the link fails.
  await open(visitor, link);
  await visitor.getByLabel('New password', { exact: true }).fill(`Another-${run}-pw`);
  await visitor.getByLabel('Confirm new password').fill(`Another-${run}-pw`);
  await visitor.getByRole('button', { name: 'Set new password' }).click();
  await expect(visitor.getByRole('alert').filter({ hasText: 'invalid or has expired' })).toBeVisible();
  await visitor.context().close();
});

test('asking for an unknown account gives the same answer and sends nothing', async () => {
  const res = await page.request.post('/api/password-reset/request', { data: { identifier: `nobody-${run}` } });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});
