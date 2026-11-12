import { test, expect, type Page, type APIResponse } from '@playwright/test';
import { E2E_ADMIN } from './credentials';
import { open, signIn } from './helpers';

test.describe.configure({ mode: 'serial' });
const run = Date.now().toString(36);
let admin: Page, owner: Page, member: Page, follower: Page, outsider: Page, reviewer: Page;
let project: string, requestId: string, taskId: string;
const ids: Record<string, string> = {},
  usernames: Record<string, string> = {};
type Notice = {
  id: string;
  kind: string;
  readAt: string | null;
  createdAt: string;
  fromStatus: string;
  toStatus: string;
  request: { id: string } | null;
  task: { id: string } | null;
};
async function json(response: APIResponse) {
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function inbox(page: Page) {
  return json(await page.request.get('/api/notifications'));
}
async function notices(page: Page, target: string) {
  return (await inbox(page)).notifications.filter(
    (n: Notice) => n.request?.id === target || n.task?.id === target,
  ) as Notice[];
}

test.beforeAll(async ({ browser }) => {
  admin = await browser.newPage();
  await signIn(admin, E2E_ADMIN.username, E2E_ADMIN.password);
  const pages: Page[] = [];
  for (const name of ['owner', 'member', 'follower', 'outsider', 'reviewer']) {
    const username = `notice-${name}-${run}`,
      password = `Temporary-${run}`,
      next = `Permanent-${run}`;
    usernames[name] = username;
    ids[name] = (
      await json(
        await admin.request.post('/api/admin/users', {
          data: { username, name: `${name} ${run}`, password },
        }),
      )
    ).user.id;
    const page = await browser.newPage();
    await signIn(page, username, password);
    await json(
      await page.request.post('/api/account/password', {
        data: { currentPassword: password, newPassword: next },
      }),
    );
    await signIn(page, username, next);
    pages.push(page);
  }
  [owner, member, follower, outsider, reviewer] = pages;
  await json(await admin.request.patch(`/api/admin/users/${ids.reviewer}`, { data: { role: 'admin' } }));
  await signIn(reviewer, usernames.reviewer, `Permanent-${run}`);
  project = (
    await json(await owner.request.post('/api/projects', { data: { name: `Notifications ${run}` } }))
  ).project.id;
  for (const name of ['member', 'follower'])
    await json(await admin.request.post(`/api/projects/${project}/members`, { data: { userId: ids[name] } }));
  const categoryId = (await json(await admin.request.get('/api/request-categories'))).categories.find(
    (c: { isArchived: boolean }) => !c.isArchived,
  ).id;
  requestId = (
    await json(
      await owner.request.post(`/api/projects/${project}/requests`, {
        data: {
          title: `Notification request ${run}`,
          description: 'Private request',
          categoryId,
          occurredAt: '2026-11-12T10:00:00+04:00',
        },
      }),
    )
  ).request.id;
  taskId = (
    await json(
      await owner.request.post(`/api/projects/${project}/tasks`, {
        data: { title: `Notification task ${run}`, assigneeId: ids.member },
      }),
    )
  ).task.id;
});
test.afterAll(async () => {
  for (const page of [admin, owner, member, follower, outsider, reviewer]) await page?.context().close();
});

test('request comments notify submitter and admins, statuses notify submitter, without self or no-op alerts', async () => {
  await json(
    await owner.request.post(`/api/requests/${requestId}/comments`, {
      data: { body: 'A question for reviewers' },
    }),
  );
  expect(await notices(owner, requestId)).toHaveLength(0);
  expect(await notices(reviewer, requestId)).toHaveLength(1);
  expect(await notices(member, requestId)).toHaveLength(0);
  await json(
    await reviewer.request.post(`/api/requests/${requestId}/comments`, {
      data: { body: 'Here is my response' },
    }),
  );
  expect((await notices(owner, requestId)).map((n) => n.kind)).toEqual(['RequestComment']);
  await json(await reviewer.request.patch(`/api/requests/${requestId}`, { data: { status: 'UnderReview' } }));
  const status = (await notices(owner, requestId)).find((n) => n.kind === 'RequestStatus')!;
  expect(status).toMatchObject({ fromStatus: 'New', toStatus: 'UnderReview' });
  await json(await reviewer.request.patch(`/api/requests/${requestId}`, { data: { status: 'UnderReview' } }));
  expect(await notices(owner, requestId)).toHaveLength(2);
  expect(await notices(reviewer, requestId)).toHaveLength(1);
  expect(await notices(outsider, requestId)).toHaveLength(0);
});

test('task followers, assignee and mentions receive only accessible events once; concurrent no-op changes do not duplicate', async () => {
  await json(
    await follower.request.post(`/api/tasks/${taskId}/comments`, {
      data: { body: 'Following the investigation' },
    }),
  );
  expect(await notices(owner, taskId)).toHaveLength(1);
  expect(await notices(member, taskId)).toHaveLength(1);
  await json(
    await owner.request.post(`/api/tasks/${taskId}/comments`, {
      data: { body: `Reply @${usernames.member} @${usernames.member} @${usernames.outsider}` },
    }),
  );
  expect(await notices(member, taskId)).toHaveLength(2);
  expect(await notices(follower, taskId)).toHaveLength(1);
  expect(await notices(outsider, taskId)).toHaveLength(0);
  expect(await notices(owner, taskId)).toHaveLength(1);
  await Promise.all(
    [1, 2].map(() =>
      member.request.put(`/api/tasks/${taskId}`, { data: { status: 'InProgress' } }).then(json),
    ),
  );
  expect((await notices(owner, taskId)).filter((n) => n.kind === 'TaskStatus')).toHaveLength(1);
  expect((await notices(follower, taskId)).filter((n) => n.kind === 'TaskStatus')).toHaveLength(1);
  expect((await notices(member, taskId)).filter((n) => n.kind === 'TaskStatus')).toHaveLength(0);
});

test('bell marks one notification on navigation, persists read state and fits Arabic mobile', async () => {
  await open(owner, '/');
  await owner.getByRole('button', { name: /^Notifications:/ }).click();
  let dialog = owner.getByRole('dialog', { name: 'Notifications', exact: true });
  const row = dialog
    .getByRole('button')
    .filter({ hasText: `${usernames.member.replace(`notice-member-`, 'member ')} changed the task status` });
  await expect(dialog.getByText('To do → In progress')).toBeVisible();
  await row.click();
  await expect(owner).toHaveURL(`/tasks/${taskId}`);
  expect((await notices(owner, taskId)).find((n) => n.kind === 'TaskStatus')?.readAt).not.toBeNull();
  await owner.getByRole('button', { name: 'Language', exact: true }).click();
  await expect(owner.locator('html')).toHaveAttribute('lang', 'ar');
  await owner.setViewportSize({ width: 320, height: 740 });
  await owner.getByRole('button', { name: /^التنبيهات:/ }).click();
  dialog = owner.getByRole('dialog', { name: 'التنبيهات', exact: true });
  await expect(dialog.getByText('من «جديد» إلى «قيد المراجعة»')).toBeVisible();
  expect(await owner.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await dialog.evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'تحديد الكل كمقروء' }).click();
  await expect(dialog.getByText('0 غير مقروءة', { exact: true })).toBeVisible();
  await owner.keyboard.press('Escape');
  await owner.reload();
  await expect(owner.getByRole('button', { name: 'التنبيهات: 0 غير مقروءة', exact: true })).toBeVisible();
  await owner.getByRole('button', { name: 'اللغة', exact: true }).click();
  await expect(owner.locator('html')).toHaveAttribute('lang', 'en');
});

test('pagination, cutoff read-all, cross-user writes and loss of access are protected', async ({
  request,
}) => {
  expect((await request.get('/api/notifications')).status()).toBe(401);
  const foreign = (await notices(reviewer, requestId))[0];
  expect((await member.request.patch('/api/notifications', { data: { id: foreign.id } })).status()).toBe(404);
  const before = (await inbox(owner)).asOf;
  for (let i = 0; i < 22; i++)
    await json(
      await reviewer.request.post(`/api/requests/${requestId}/comments`, {
        data: { body: `Additional reply ${i}` },
      }),
    );
  await json(await owner.request.patch('/api/notifications', { data: { all: true, before } }));
  const first = await inbox(owner);
  expect(first.unreadCount).toBe(22);
  expect(first.notifications).toHaveLength(20);
  expect(first.hasMore).toBe(true);
  const last = first.notifications.at(-1);
  const older = await json(
    await owner.request.get(
      `/api/notifications?${new URLSearchParams({ before: last.createdAt, beforeId: last.id })}`,
    ),
  );
  expect(older.notifications.length).toBeGreaterThan(0);
  expect(
    older.notifications.some((n: Notice) => first.notifications.some((f: Notice) => f.id === n.id)),
  ).toBe(false);
  // Demotion must take effect immediately, even with a cached admin session.
  await json(await admin.request.patch(`/api/admin/users/${ids.reviewer}`, { data: { role: 'member' } }));
  expect(await notices(reviewer, requestId)).toHaveLength(0);
  expect((await reviewer.request.patch('/api/notifications', { data: { id: foreign.id } })).status()).toBe(
    404,
  );
  const memberNotice = (await notices(member, taskId))[0];
  await json(await admin.request.delete(`/api/projects/${project}/members/${ids.member}`));
  expect(await notices(member, taskId)).toHaveLength(0);
  expect((await member.request.patch('/api/notifications', { data: { id: memberNotice.id } })).status()).toBe(
    404,
  );
  const previous = (await inbox(member)).unreadCount;
  await json(await owner.request.put(`/api/tasks/${taskId}`, { data: { status: 'Done' } }));
  expect((await inbox(member)).unreadCount).toBe(previous);
  await json(await admin.request.delete(`/api/requests/${requestId}`));
  expect(await notices(owner, requestId)).toHaveLength(0);
  await json(await admin.request.patch(`/api/admin/users/${ids.follower}`, { data: { isActive: false } }));
  expect((await follower.request.get('/api/notifications')).status()).toBe(401);
});
