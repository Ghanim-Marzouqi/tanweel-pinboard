import ar from '../../messages/ar.json';
import { test, expect, type Page, type APIResponse } from '@playwright/test';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { E2E_ADMIN } from './credentials';
import { signIn, open } from './helpers';

test.describe.configure({ mode: 'serial' });
const run = Date.now().toString(36);
let admin: Page, owner: Page, colleague: Page, outsider: Page;
let colleagueId: string;
let project: string,
  otherProject: string,
  category: string,
  ownRequest: string,
  otherRequest: string,
  task: string,
  attachment: string,
  ownerId: string;
async function json(res: APIResponse) {
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}
const payload = (title: string) => ({
  title,
  description: 'Notification delay observed during the evening shift.',
  suggestions: 'Check the delivery logs.',
  shift: 'Evening',
  occurredAt: '2026-10-29T20:15:00+04:00',
  categoryId: category,
});

test.beforeAll(async ({ browser }) => {
  admin = await browser.newPage();
  await signIn(admin, E2E_ADMIN.username, E2E_ADMIN.password);
  const pages: Page[] = [];
  const ids: string[] = [];
  for (const role of ['owner', 'colleague', 'outsider']) {
    const username = `req-${role}-${run}`,
      password = `Temporary-${run}-pw`,
      nextPassword = `Permanent-${run}-pw`;
    ids.push(
      (
        await json(
          await admin.request.post('/api/admin/users', {
            data: { username, name: `${role} ${run}`, email: `${username}@example.test`, password },
          }),
        )
      ).user.id,
    );
    const page = await browser.newPage();
    await signIn(page, username, password);
    await json(
      await page.request.post('/api/account/password', {
        data: { currentPassword: password, newPassword: nextPassword },
      }),
    );
    await signIn(page, username, nextPassword);
    pages.push(page);
  }
  [owner, colleague, outsider] = pages;
  ownerId = ids[0];
  colleagueId = ids[1];
  project = (await json(await owner.request.post('/api/projects', { data: { name: `Requests ${run}` } })))
    .project.id;
  otherProject = (
    await json(await admin.request.post('/api/projects', { data: { name: `Other requests ${run}` } }))
  ).project.id;
  await json(await admin.request.post(`/api/projects/${project}/members`, { data: { userId: ids[1] } }));
  category = (
    await json(
      await admin.request.post('/api/request-categories', {
        data: { nameEn: `Operations ${run}`, nameAr: `العمليات ${run}` },
      }),
    )
  ).category.id;
  otherRequest = (
    await json(
      await colleague.request.post(`/api/projects/${project}/requests`, {
        data: payload(`Private colleague ${run}`),
      }),
    )
  ).request.id;
  task = (
    await json(
      await admin.request.post(`/api/projects/${project}/tasks`, { data: { title: `Investigate ${run}` } }),
    )
  ).task.id;
});

test.afterAll(async () => {
  for (const page of [admin, owner, colleague, outsider]) await page?.context().close();
});

test('member submits a project request; Requests appears before Tasks; uploads and comments persist', async () => {
  await open(owner, `/projects/${project}/requests`);
  const sections = owner.getByRole('navigation', { name: 'Project sections' });
  expect(await sections.getByRole('link').allTextContents()).toEqual(['Requests', 'Tasks']);
  await owner.getByRole('link', { name: 'New request', exact: true }).click();
  await owner.getByLabel('Request title', { exact: true }).fill(`Own issue ${run}`);
  await owner.getByLabel('Category', { exact: true }).selectOption(category);
  await owner.getByLabel('Date and time (Oman)').fill('2026-10-29T20:15');
  await owner.getByLabel('Description', { exact: true }).fill('My private issue description.');
  await owner.getByLabel('Ideas and suggested solutions (optional)').fill('Investigate logs.');
  await owner.getByRole('button', { name: 'Submit request' }).click();
  await expect(owner.getByRole('heading', { name: `Own issue ${run}` })).toBeVisible();
  ownRequest = new URL(owner.url()).pathname.split('/').pop()!;
  const saved = (await json(await owner.request.get(`/api/requests/${ownRequest}`))).request;
  expect(saved.occurredAt).toBe('2026-10-29T16:15:00.000Z');
  await owner.getByLabel('Add a comment', { exact: true }).fill('Additional context from the shift.');
  await owner.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(owner.getByText('Additional context from the shift.', { exact: true })).toBeVisible();
  await owner
    .getByLabel('Add a file')
    .setInputFiles({ name: 'evidence.txt', mimeType: 'text/plain', buffer: Buffer.from('private evidence') });
  await expect(owner.getByRole('link', { name: /evidence.txt/ })).toBeVisible();
  attachment = (await json(await owner.request.get(`/api/requests/${ownRequest}`))).request.attachments[0].id;
  expect(
    await (await owner.request.get(`/api/requests/${ownRequest}/attachments/${attachment}/download`)).text(),
  ).toBe('private evidence');
});

test('privacy covers owners, lists, detail, comments, files, outsiders and backlinks', async () => {
  const list = await json(await owner.request.get(`/api/projects/${project}/requests`));
  expect(list.requests.map((r: { id: string }) => r.id)).toEqual([ownRequest]);
  const filtered = await json(
    await owner.request.get(`/api/projects/${project}/requests?q=definitely-no-match&status=&categoryId=`),
  );
  expect(filtered.total).toBe(0);
  await open(owner, `/projects/${project}/requests`);
  await owner.getByRole('textbox', { name: 'Search requests' }).fill('definitely-no-match');
  await owner.getByRole('button', { name: 'Apply filters' }).click();
  await expect(owner.getByText('No requests match this view.', { exact: true })).toBeVisible();
  expect((await owner.request.get(`/api/requests/${otherRequest}`)).status()).toBe(404);
  expect((await colleague.request.get(`/api/requests/${ownRequest}`)).status()).toBe(404);
  expect(
    (
      await colleague.request.post(`/api/requests/${ownRequest}/comments`, { data: { body: 'Intrusion' } })
    ).status(),
  ).toBe(404);
  expect(
    (await colleague.request.get(`/api/requests/${ownRequest}/attachments/${attachment}/download`)).status(),
  ).toBe(404);
  expect((await outsider.request.get(`/api/projects/${project}/requests`)).status()).toBe(404);
  expect(
    (
      await outsider.request.post(`/api/projects/${project}/requests`, { data: payload('Intrusion') })
    ).status(),
  ).toBe(404);
  await open(owner, `/requests/${otherRequest}`);
  await expect(owner.getByRole('heading', { name: `Private colleague ${run}` })).toHaveCount(0);
  await open(owner, '/requests');
  await expect(owner.getByText(`Private colleague ${run}`, { exact: true })).toHaveCount(0);
  expect((await json(await admin.request.get(`/api/projects/${project}/requests`))).total).toBe(2);
});

test('only admins can review, manage categories and link tasks; archived categories preserve history', async () => {
  expect(
    (await owner.request.patch(`/api/requests/${ownRequest}`, { data: { status: 'Accepted' } })).status(),
  ).toBe(403);
  expect(
    (await owner.request.post(`/api/requests/${ownRequest}/links`, { data: { taskId: task } })).status(),
  ).toBe(403);
  expect(
    (
      await owner.request.post('/api/request-categories', { data: { nameEn: 'Forbidden', nameAr: 'ممنوع' } })
    ).status(),
  ).toBe(403);
  expect(
    (
      await owner.request.patch(`/api/request-categories/${category}`, {
        data: { nameEn: 'Forbidden', nameAr: 'ممنوع' },
      })
    ).status(),
  ).toBe(403);
  await open(admin, '/admin/request-categories');
  await admin.getByText(`Operations ${run}`, { exact: true }).click();
  const categoryForm = admin.getByRole('form', { name: `Operations ${run}` });
  await categoryForm.getByLabel('English name').fill(`Updated ${run}`);
  await categoryForm.getByLabel('Archived', { exact: true }).check();
  await categoryForm.getByRole('button', { name: 'Save category' }).click();
  await expect(admin.getByText(`Updated ${run}`, { exact: true })).toBeVisible();
  expect(
    (
      await owner.request.post(`/api/projects/${project}/requests`, { data: payload('Archived selection') })
    ).status(),
  ).toBe(400);
  expect((await json(await owner.request.get(`/api/requests/${ownRequest}`))).request.category.nameEn).toBe(
    `Updated ${run}`,
  );
});

test('review and many-to-many links remain independent; cross-project linking is rejected', async () => {
  const otherTask = (
    await json(
      await admin.request.post(`/api/projects/${otherProject}/tasks`, { data: { title: 'Outside task' } }),
    )
  ).task.id;
  expect(
    (await admin.request.post(`/api/requests/${ownRequest}/links`, { data: { taskId: otherTask } })).status(),
  ).toBe(400);
  await open(admin, `/requests/${ownRequest}`);
  await admin.getByRole('button', { name: 'Link task', exact: true }).click();
  await admin.getByLabel('Select an existing task', { exact: true }).selectOption(task);
  await admin.getByRole('dialog').getByRole('button', { name: 'Link task', exact: true }).click();
  await expect(admin.getByRole('link', { name: `Investigate ${run}`, exact: true })).toBeVisible();
  for (const id of [ownRequest, otherRequest, ownRequest])
    await json(await admin.request.post(`/api/requests/${id}/links`, { data: { taskId: task } }));
  let data = (await json(await admin.request.get(`/api/requests/${ownRequest}`))).request;
  expect(data.taskLinks).toHaveLength(1);
  expect(data.status).toBe('New');
  await open(admin, `/requests/${ownRequest}`);
  await admin.getByRole('button', { name: 'Link task', exact: true }).click();
  const [searchResponse] = await Promise.all([
    admin.waitForResponse((response) => response.url().includes(`/api/projects/${project}/tasks?`)),
    admin.getByRole('button', { name: 'Search', exact: true }).click(),
  ]);
  expect(searchResponse.ok()).toBe(true);
  expect((await searchResponse.json()).tasks.map((item: { id: string }) => item.id)).toContain(task);
  await admin.getByRole('dialog').press('Escape');
  await expect(admin.getByRole('button', { name: 'Link task', exact: true })).toBeFocused();
  await admin.getByLabel('Review status', { exact: true }).selectOption('Accepted');
  await admin.getByRole('button', { name: 'Save review' }).click();
  await expect
    .poll(async () => (await json(await admin.request.get(`/api/requests/${ownRequest}`))).request.status)
    .toBe('Accepted');
  await json(await admin.request.put(`/api/tasks/${task}`, { data: { status: 'Done' } }));
  data = (await json(await admin.request.get(`/api/requests/${ownRequest}`))).request;
  expect(data.status).toBe('Accepted');
  await open(owner, `/tasks/${task}`);
  await expect(owner.getByRole('link', { name: new RegExp(`Own issue ${run}`) })).toBeVisible();
  await expect(owner.getByRole('link', { name: new RegExp(`Private colleague ${run}`) })).toHaveCount(0);
  expect(
    (await admin.request.put(`/api/tasks/${task}`, { data: { projectId: otherProject } })).status(),
  ).toBe(409);
  expect((await admin.request.delete(`/api/tasks/${task}`)).status()).toBe(409);
});

test('create-and-link is atomic and retry-safe; multiple tasks can serve one request', async () => {
  const data = {
    creationKey: randomUUID(),
    task: { title: `New linked ${run}`, assigneeId: ownerId, priority: 'High' },
  };
  const responses = await Promise.all([
    admin.request.post(`/api/requests/${ownRequest}/links`, { data }),
    admin.request.post(`/api/requests/${ownRequest}/links`, { data }),
  ]);
  const results = await Promise.all(responses.map(json));
  expect(results[0].task.id).toBe(results[1].task.id);
  const request = (await json(await admin.request.get(`/api/requests/${ownRequest}`))).request;
  expect(request.taskLinks).toHaveLength(2);
  expect(request.status).toBe('Accepted');
  expect(
    request.activities.filter(
      (a: { kind: string; body: string }) => a.kind === 'linked' && a.body === data.task.title,
    ),
  ).toHaveLength(1);
  await open(admin, `/requests/${ownRequest}`);
  await admin.getByRole('button', { name: 'Create task and link', exact: true }).click();
  await admin.getByLabel('Task title', { exact: true }).fill(`UI linked ${run}`);
  await admin.getByRole('dialog').getByLabel('Priority', { exact: true }).selectOption('High');
  await admin.getByLabel('Assignee', { exact: true }).selectOption(ownerId);
  await admin.getByRole('dialog').getByRole('button', { name: 'Create task and link', exact: true }).click();
  await expect(admin.getByRole('link', { name: `UI linked ${run}`, exact: true })).toBeVisible();
  expect(
    (
      await admin.request.patch(`/api/requests/${ownRequest}`, {
        data: { status: 'Closed', closureReason: '' },
      })
    ).status(),
  ).toBe(400);
  await json(
    await admin.request.patch(`/api/requests/${ownRequest}`, {
      data: { status: 'Closed', closureReason: 'Verified with operations' },
    }),
  );
  expect(
    (
      await owner.request.post(`/api/requests/${ownRequest}/comments`, { data: { body: 'Late edit' } })
    ).status(),
  ).toBe(409);
  await json(await admin.request.patch(`/api/requests/${ownRequest}`, { data: { status: 'UnderReview' } }));
  expect((await json(await admin.request.get(`/api/requests/${ownRequest}`))).request.closureReason).toBe('');
  for (const id of [ownRequest, otherRequest])
    await json(await admin.request.delete(`/api/requests/${id}/links`, { data: { taskId: task } }));
  await json(await admin.request.put(`/api/tasks/${task}`, { data: { projectId: otherProject } }));
});

test('editable request priorities are admin-managed, preserved when archived, and filterable', async () => {
  const priorityName = `Critical ${run}`;
  expect(
    (
      await owner.request.post('/api/request-priorities', { data: { nameEn: priorityName, nameAr: 'ممنوع' } })
    ).status(),
  ).toBe(403);
  await open(admin, '/admin/request-priorities');
  const addForm = admin.getByRole('form', { name: 'Add priority', exact: true });
  await addForm.getByLabel('English name').fill(priorityName);
  await addForm.getByLabel('Arabic name').fill(`حرجة ${run}`);
  await addForm.getByLabel('Display order (lowest first)').fill('5');
  await admin.getByRole('button', { name: 'Add priority', exact: true }).click();
  await expect(admin.getByText(priorityName, { exact: true })).toBeVisible();
  const priority = (await json(await admin.request.get('/api/request-priorities'))).priorities.find(
    (p: { nameEn: string }) => p.nameEn === priorityName,
  );
  expect(priority.sortOrder).toBe(5);
  expect(
    (
      await owner.request.patch(`/api/request-priorities/${priority.id}`, {
        data: { nameEn: 'Forbidden', nameAr: 'ممنوع' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await admin.request.post('/api/request-priorities', { data: { nameEn: priorityName, nameAr: 'مكرر' } })
    ).status(),
  ).toBe(409);
  const active = (await json(await admin.request.get('/api/request-categories'))).categories.find(
    (c: { isArchived: boolean }) => !c.isArchived,
  ).id;
  await open(owner, `/projects/${project}/requests/new`);
  await owner.getByLabel('Request title', { exact: true }).fill(`Prioritized ${run}`);
  await owner.getByLabel('Category', { exact: true }).selectOption(active);
  await owner.getByLabel('Priority', { exact: true }).selectOption(priority.id);
  await owner.getByLabel('Description', { exact: true }).fill('Customer suggestion');
  await owner.getByRole('button', { name: 'Submit request' }).click();
  await expect(owner.getByRole('heading', { name: `Prioritized ${run}` })).toBeVisible();
  const id = new URL(owner.url()).pathname.split('/').pop()!;
  expect((await json(await owner.request.get(`/api/requests/${id}`))).request.priorityId).toBe(priority.id);
  expect(
    (
      await owner.request.patch(`/api/requests/${id}`, { data: { status: 'New', priorityId: null } })
    ).status(),
  ).toBe(403);
  await open(owner, `/projects/${project}/requests`);
  await owner.getByRole('combobox', { name: 'Priority', exact: true }).selectOption(priority.id);
  await owner.getByRole('button', { name: 'Apply filters' }).click();
  await expect(owner.getByRole('link', { name: new RegExp(`Prioritized ${run}`) })).toBeVisible();
  await expect(owner.getByRole('link', { name: new RegExp(`Own issue ${run}`) })).toHaveCount(0);
  const filtered = await json(
    await owner.request.get(`/api/projects/${project}/requests?priorityId=${priority.id}`),
  );
  expect(filtered.requests.map((r: { id: string }) => r.id)).toEqual([id]);
  await open(admin, `/requests/${ownRequest}`);
  await admin.getByLabel('Priority', { exact: true }).selectOption(priority.id);
  await admin.getByRole('button', { name: 'Save review' }).click();
  await expect(
    admin.getByText(`Priority changed from Not set to ${priorityName}`, { exact: true }),
  ).toBeVisible();
  await open(admin, '/admin/request-priorities');
  await admin.getByText(priorityName, { exact: true }).click();
  const form = admin.getByRole('form', { name: priorityName });
  await form.getByLabel('English name').fill(`Updated priority ${run}`);
  await form.getByLabel('Archived', { exact: true }).check();
  await form.getByRole('button', { name: 'Save priority' }).click();
  await expect(admin.getByText(`Updated priority ${run}`, { exact: true })).toBeVisible();
  expect((await json(await owner.request.get(`/api/requests/${id}`))).request.priority.nameEn).toBe(
    `Updated priority ${run}`,
  );
  expect(
    (await json(await owner.request.get('/api/request-priorities'))).priorities.some(
      (p: { id: string }) => p.id === priority.id,
    ),
  ).toBe(false);
  expect(
    (
      await owner.request.post(`/api/projects/${project}/requests`, {
        data: { ...payload('Archived priority'), categoryId: active, priorityId: priority.id },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await owner.request.post(`/api/projects/${project}/requests`, {
        data: { ...payload('Unknown priority'), categoryId: active, priorityId: randomUUID() },
      })
    ).status(),
  ).toBe(400);
  // An existing archived selection survives status-only edits and can be cleared.
  await json(
    await admin.request.patch(`/api/requests/${id}`, {
      data: { status: 'Accepted', priorityId: priority.id },
    }),
  );
  await json(
    await admin.request.patch(`/api/requests/${id}`, { data: { status: 'Accepted', priorityId: null } }),
  );
  expect(
    (
      await admin.request.patch(`/api/requests/${id}`, {
        data: { status: 'Accepted', priorityId: priority.id },
      })
    ).status(),
  ).toBe(400);
  await json(await admin.request.delete(`/api/requests/${id}`));
});

test('admins delete unlinked requests; confirmation, closed requests, files and concurrent linking are protected', async () => {
  const task = (
    await json(
      await admin.request.post(`/api/projects/${project}/tasks`, { data: { title: `Deletion link ${run}` } }),
    )
  ).task.id;
  const active = (await json(await admin.request.get('/api/request-categories'))).categories.find(
    (c: { isArchived: boolean }) => !c.isArchived,
  ).id;
  const create = async (title: string) =>
    (
      await json(
        await owner.request.post(`/api/projects/${project}/requests`, {
          data: { ...payload(title), categoryId: active },
        }),
      )
    ).request.id;
  const id = await create(`Delete check ${run}`);
  await json(
    await owner.request.post(`/api/requests/${id}/comments`, {
      data: { body: 'Remove this discussion too' },
    }),
  );
  const upload = await json(
    await owner.request.post(`/api/requests/${id}/attachments`, {
      multipart: {
        file: { name: 'delete-evidence.txt', mimeType: 'text/plain', buffer: Buffer.from('deletion proof') },
      },
    }),
  );
  expect(existsSync(`.e2e-storage/requests/${id}`)).toBe(true);
  for (const page of [colleague, outsider])
    expect((await page.request.delete(`/api/requests/${id}`)).status()).toBe(404);
  await json(await admin.request.patch(`/api/requests/${id}`, { data: { status: 'UnderReview' } }));
  expect((await owner.request.delete(`/api/requests/${id}`)).status()).toBe(409);
  await open(owner, `/requests/${id}`);
  await expect(owner.getByRole('button', { name: 'Delete request', exact: true })).toHaveCount(0);
  await json(await admin.request.patch(`/api/requests/${id}`, { data: { status: 'New' } }));
  await json(await admin.request.post(`/api/requests/${id}/links`, { data: { taskId: task } }));
  expect((await owner.request.delete(`/api/requests/${id}`)).status()).toBe(409);
  await open(owner, `/requests/${id}`);
  await expect(owner.getByRole('button', { name: 'Delete request', exact: true })).toBeDisabled();
  expect((await admin.request.delete(`/api/requests/${id}`)).status()).toBe(409);
  await open(admin, `/requests/${id}`);
  await expect(admin.getByRole('button', { name: 'Delete request', exact: true })).toBeDisabled();
  await admin.getByRole('button', { name: 'Unlink', exact: true }).click();
  await expect(admin.getByRole('button', { name: 'Delete request', exact: true })).toBeEnabled();
  await admin.getByRole('button', { name: 'Delete request', exact: true }).click();
  const dialog = admin.getByRole('dialog');
  await expect(dialog.locator(':focus')).toHaveAccessibleName('Cancel');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  expect((await admin.request.get(`/api/requests/${id}`)).status()).toBe(200);
  // Closed requests can also be deleted after unlinking.
  await json(
    await admin.request.patch(`/api/requests/${id}`, {
      data: { status: 'Closed', closureReason: 'Duplicate' },
    }),
  );
  await open(admin, `/requests/${id}`);
  await admin.getByRole('button', { name: 'Delete request', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete request', exact: true }).click();
  await expect(admin).toHaveURL(`/projects/${project}/requests`);
  expect((await admin.request.get(`/api/requests/${id}`)).status()).toBe(404);
  expect(
    (await admin.request.get(`/api/requests/${id}/attachments/${upload.attachment.id}/download`)).status(),
  ).toBe(404);
  expect(existsSync(`.e2e-storage/requests/${id}`)).toBe(false);
  expect((await admin.request.get(`/api/tasks/${task}`)).status()).toBe(200);
  const racing = await create(`Concurrent deletion ${run}`);
  const [linked, deleted] = await Promise.all([
    admin.request.post(`/api/requests/${racing}/links`, { data: { taskId: task } }),
    owner.request.delete(`/api/requests/${racing}`),
  ]);
  if (deleted.ok()) {
    expect(linked.status()).toBe(404);
    expect((await admin.request.get(`/api/requests/${racing}`)).status()).toBe(404);
  } else {
    expect(deleted.status()).toBe(409);
    expect(linked.ok()).toBe(true);
    expect((await json(await admin.request.get(`/api/requests/${racing}`))).request.taskLinks).toHaveLength(
      1,
    );
    await json(await admin.request.delete(`/api/requests/${racing}/links`, { data: { taskId: task } }));
    await json(await admin.request.delete(`/api/requests/${racing}`));
  }
  await json(await admin.request.delete(`/api/tasks/${task}`));
});

test('submitters delete only their own New requests; confirmation, review races and Arabic mobile are protected', async () => {
  const active = (await json(await admin.request.get('/api/request-categories'))).categories.find(
    (c: { isArchived: boolean }) => !c.isArchived,
  ).id;
  const create = async (title: string) =>
    (
      await json(
        await owner.request.post(`/api/projects/${project}/requests`, {
          data: { ...payload(title), categoryId: active },
        }),
      )
    ).request.id;
  const id = await create(`Submitter deletion ${run}`);
  await open(owner, `/requests/${id}`);
  await expect(owner.getByRole('heading', { name: 'Review request', exact: true })).toHaveCount(0);
  await json(
    await owner.request.post(`/api/requests/${id}/comments`, { data: { body: 'Disposable test comment' } }),
  );
  await json(
    await owner.request.post(`/api/requests/${id}/attachments`, {
      multipart: {
        file: {
          name: 'submitter-delete.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('test attachment'),
        },
      },
    }),
  );
  await open(owner, `/requests/${id}`);
  await owner.getByRole('button', { name: 'Delete request', exact: true }).click();
  const dialog = owner.getByRole('dialog');
  await expect(dialog.locator(':focus')).toHaveAccessibleName('Cancel');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  expect((await owner.request.get(`/api/requests/${id}`)).status()).toBe(200);
  // The status is checked again on confirmation, not just when the dialog opens.
  await owner.getByRole('button', { name: 'Delete request', exact: true }).click();
  await json(await admin.request.patch(`/api/requests/${id}`, { data: { status: 'UnderReview' } }));
  await dialog.getByRole('button', { name: 'Delete request', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('no longer New');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  for (const status of ['UnderReview', 'Accepted', 'Closed']) {
    await json(
      await admin.request.patch(`/api/requests/${id}`, {
        data: { status, closureReason: 'Completed review' },
      }),
    );
    expect((await owner.request.delete(`/api/requests/${id}`)).status()).toBe(409);
    await open(owner, `/requests/${id}`);
    await expect(owner.getByRole('button', { name: 'Delete request', exact: true })).toHaveCount(0);
  }
  await json(await admin.request.patch(`/api/requests/${id}`, { data: { status: 'New' } }));
  await open(owner, `/requests/${id}`);
  await owner.setViewportSize({ width: 320, height: 844 });
  await owner.getByRole('button', { name: 'Language', exact: true }).click();
  await owner.getByRole('button', { name: ar.requests.deleteRequest, exact: true }).click();
  await expect(dialog.getByRole('heading', { name: ar.requests.deleteRequest })).toBeVisible();
  expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(320);
  await dialog.getByRole('button', { name: ar.requests.deleteRequest, exact: true }).click();
  await expect(owner).toHaveURL(`/projects/${project}/requests`);
  expect((await owner.request.get(`/api/requests/${id}`)).status()).toBe(404);
  expect(existsSync(`.e2e-storage/requests/${id}`)).toBe(false);
  await owner.getByRole('button', { name: 'اللغة', exact: true }).click();
  await expect(owner.locator('html')).toHaveAttribute('lang', 'en');
  await owner.setViewportSize({ width: 1280, height: 900 });
  // Simultaneous review/deletion must have one consistent outcome.
  const racing = await create(`Review deletion race ${run}`);
  const [reviewed, deleted] = await Promise.all([
    admin.request.patch(`/api/requests/${racing}`, { data: { status: 'UnderReview' } }),
    owner.request.delete(`/api/requests/${racing}`),
  ]);
  if (deleted.ok()) {
    expect(reviewed.status()).toBe(404);
    expect((await owner.request.get(`/api/requests/${racing}`)).status()).toBe(404);
  } else {
    expect(deleted.status()).toBe(409);
    expect(reviewed.status()).toBe(200);
    expect((await json(await owner.request.get(`/api/requests/${racing}`))).request.status).toBe(
      'UnderReview',
    );
  }
});

test('submitters edit only their own New requests with history, stale-form and status protection', async () => {
  const activeCategory = (
    await json(
      await admin.request.post('/api/request-categories', {
        data: { nameEn: `Editable ${run}`, nameAr: `قابل للتعديل ${run}` },
      }),
    )
  ).category.id;
  const priority = (
    await json(
      await admin.request.post('/api/request-priorities', {
        data: { nameEn: `Edit priority ${run}`, nameAr: `أولوية التعديل ${run}`, sortOrder: 2 },
      }),
    )
  ).priority.id;
  const created = (
    await json(
      await owner.request.post(`/api/projects/${project}/requests`, {
        data: { ...payload(`Edit me ${run}`), categoryId: activeCategory, priorityId: priority },
      }),
    )
  ).request;
  const id = created.id;
  const editBody = (r: typeof created, title = r.title) => ({
    title,
    description: r.description,
    suggestions: r.suggestions,
    shift: r.shift,
    categoryId: r.categoryId,
    priorityId: r.priorityId,
    occurredAt: r.occurredAt,
    updatedAt: r.updatedAt,
  });
  const read = async () => (await json(await owner.request.get(`/api/requests/${id}`))).request;
  for (const [actor, status] of [
    [colleague, 404],
    [outsider, 404],
    [admin, 403],
  ] as const) {
    expect(
      (
        await actor.request.patch(`/api/requests/${id}/content`, { data: editBody(created, 'Not mine') })
      ).status(),
    ).toBe(status);
  }
  expect(
    (
      await owner.request.patch(`/api/requests/${id}/content`, {
        data: { ...editBody(created), status: 'Accepted' },
      })
    ).status(),
  ).toBe(400);
  await open(owner, `/requests/${id}`);
  await owner.getByRole('link', { name: 'Edit request', exact: true }).click();
  await expect(owner.getByRole('heading', { name: 'Edit request', exact: true })).toBeVisible();
  await expect(owner.getByLabel('Request title', { exact: true })).toHaveValue(created.title);
  await owner.getByLabel('Request title', { exact: true }).fill(`Corrected ${run}`);
  await owner.getByLabel('Description', { exact: true }).fill('Corrected description');
  await owner.getByLabel('Date and time (Oman)').fill('2026-11-08T12:30');
  await owner.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(owner.getByRole('heading', { name: `Corrected ${run}` })).toBeVisible();
  await expect(owner.getByText('Edited: title, description, date and time', { exact: true })).toBeVisible();
  let saved = await read();
  expect(saved).toMatchObject({
    createdById: ownerId,
    projectId: project,
    status: 'New',
    description: 'Corrected description',
    occurredAt: '2026-11-08T08:30:00.000Z',
    number: created.number,
  });
  expect(JSON.parse(saved.activities.find((a: { kind: string }) => a.kind === 'edited').body).title).toEqual({
    from: created.title,
    to: `Corrected ${run}`,
  });
  expect(
    (
      await owner.request.patch(`/api/requests/${id}/content`, { data: editBody(created, 'Stale overwrite') })
    ).status(),
  ).toBe(409);
  await json(await owner.request.patch(`/api/requests/${id}/content`, { data: editBody(saved) }));
  expect((await read()).activities.length).toBe(saved.activities.length);
  // Existing archived selections remain valid, but cannot be newly assigned.
  await json(
    await admin.request.patch(`/api/request-categories/${activeCategory}`, {
      data: { nameEn: `Editable ${run}`, nameAr: `قابل للتعديل ${run}`, isArchived: true },
    }),
  );
  await json(
    await admin.request.patch(`/api/request-priorities/${priority}`, {
      data: {
        nameEn: `Edit priority ${run}`,
        nameAr: `أولوية التعديل ${run}`,
        sortOrder: 2,
        isArchived: true,
      },
    }),
  );
  await json(
    await owner.request.patch(`/api/requests/${id}/content`, {
      data: editBody(saved, `Archived selection preserved ${run}`),
    }),
  );
  saved = await read();
  const active = (await json(await admin.request.get('/api/request-categories'))).categories.find(
    (c: { isArchived: boolean }) => !c.isArchived,
  ).id;
  await json(
    await owner.request.patch(`/api/requests/${id}/content`, {
      data: { ...editBody(saved), categoryId: active, priorityId: null },
    }),
  );
  saved = await read();
  expect(
    (
      await owner.request.patch(`/api/requests/${id}/content`, {
        data: { ...editBody(saved), categoryId: activeCategory },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await owner.request.patch(`/api/requests/${id}/content`, {
        data: { ...editBody(saved), priorityId: priority },
      })
    ).status(),
  ).toBe(400);
  // A locale refresh must not silently advance the revision attached to an unsaved form.
  await open(owner, `/requests/${id}/edit`);
  await owner.getByLabel('Request title', { exact: true }).fill('Draft before locale refresh');
  await json(
    await owner.request.patch(`/api/requests/${id}/content`, {
      data: editBody(saved, 'Saved from another tab'),
    }),
  );
  await owner.getByRole('button', { name: 'Language', exact: true }).click();
  await owner.getByRole('button', { name: ar.requests.saveEdit, exact: true }).click();
  await expect(owner.getByRole('alert').filter({ hasText: ar.requests.editConflict })).toBeVisible();
  expect((await read()).title).toBe('Saved from another tab');
  await owner.getByRole('button', { name: 'اللغة', exact: true }).click();
  await expect(owner.locator('html')).toHaveAttribute('lang', 'en');
  // A review begun after the form was opened must reject save without discarding draft text.
  await open(owner, `/requests/${id}/edit`);
  await owner.getByLabel('Request title', { exact: true }).fill('Keep this unsaved correction');
  await json(await admin.request.patch(`/api/requests/${id}`, { data: { status: 'UnderReview' } }));
  await owner.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(
    owner.getByRole('alert').filter({ hasText: 'Your changes have not been saved' }),
  ).toBeVisible();
  await expect(owner.getByLabel('Request title', { exact: true })).toHaveValue(
    'Keep this unsaved correction',
  );
  for (const status of ['UnderReview', 'Accepted', 'Closed']) {
    await json(await admin.request.patch(`/api/requests/${id}`, { data: { status, closureReason: 'Done' } }));
    const current = await read();
    expect(
      (
        await owner.request.patch(`/api/requests/${id}/content`, {
          data: editBody(current, 'Forbidden edit'),
        })
      ).status(),
    ).toBe(409);
    await open(owner, `/requests/${id}/edit`);
    await expect(owner).toHaveURL(new RegExp(`/requests/${id}$`));
    await expect(owner.getByRole('link', { name: 'Edit request', exact: true })).toHaveCount(0);
  }
  await json(await admin.request.patch(`/api/requests/${id}`, { data: { status: 'New' } }));
  saved = await read();
  // Review and content edits use the same database row lock.
  const [editing, reviewing] = await Promise.all([
    owner.request.patch(`/api/requests/${id}/content`, { data: editBody(saved, 'Concurrent correction') }),
    admin.request.patch(`/api/requests/${id}`, { data: { status: 'UnderReview' } }),
  ]);
  expect([200, 409]).toContain(editing.status());
  expect(reviewing.status()).toBe(200);
  expect((await read()).status).toBe('UnderReview');
  await json(await admin.request.patch(`/api/requests/${id}`, { data: { status: 'New' } }));
  await open(owner, `/requests/${id}/edit`);
  await owner.getByRole('button', { name: 'Language', exact: true }).click();
  for (const width of [320, 390]) {
    await owner.setViewportSize({ width, height: 844 });
    await expect(owner.getByRole('heading', { name: ar.requests.editRequest, exact: true })).toBeVisible();
    expect(await owner.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await owner.getByLabel(ar.requests.title, { exact: true }).fill('تصحيح عنوان الطلب');
  await owner.getByRole('button', { name: ar.requests.saveEdit, exact: true }).click();
  await expect(owner.getByRole('heading', { name: 'تصحيح عنوان الطلب' })).toBeVisible();
  await owner.getByRole('button', { name: 'اللغة', exact: true }).click();
  await expect(owner.locator('html')).toHaveAttribute('lang', 'en');
  await owner.setViewportSize({ width: 1280, height: 900 });
  // An archived project also blocks a New request, including its direct edit URL.
  const isolated = (
    await json(await owner.request.post('/api/projects', { data: { name: `Edit archive ${run}` } }))
  ).project.id;
  const archived = (
    await json(
      await owner.request.post(`/api/projects/${isolated}/requests`, {
        data: { ...payload('Archived edit'), categoryId: active },
      }),
    )
  ).request;
  await json(await owner.request.patch(`/api/projects/${isolated}`, { data: { isArchived: true } }));
  expect(
    (
      await owner.request.patch(`/api/requests/${archived.id}/content`, {
        data: editBody(archived, 'Blocked'),
      })
    ).status(),
  ).toBe(403);
});

test('Arabic requests fit mobile; request-only projects cannot be deleted; archived projects are read-only', async () => {
  await owner.setViewportSize({ width: 390, height: 844 });
  await open(owner, `/requests/${ownRequest}`);
  await owner.getByRole('button', { name: 'Language' }).click();
  await expect(owner.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(owner.getByRole('heading', { name: 'النقاش والسجل' })).toBeVisible();
  expect(await owner.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await owner.screenshot({ path: 'test-results/requests-arabic-mobile.png', fullPage: true });
  for (const width of [320, 390, 768]) {
    await owner.setViewportSize({ width, height: 844 });
    await open(owner, `/projects/${project}/requests`);
    expect(await owner.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width < 640) {
      await expect(owner.getByRole('navigation', { name: ar.requests.statusViews })).toBeHidden();
      await owner
        .getByRole('combobox', { name: ar.requests.status, exact: true })
        .selectOption('UnderReview');
      await owner.getByRole('button', { name: ar.requests.filter, exact: true }).click();
      await expect(owner).toHaveURL(/status=UnderReview/);
      await expect(owner.getByRole('link', { name: new RegExp(`Own issue ${run}`) })).toBeVisible();
    } else {
      await expect(owner.getByRole('navigation', { name: ar.requests.statusViews })).toBeVisible();
    }
    const newButton = owner.getByRole('link', { name: ar.requests.new, exact: true });
    const bounds = await newButton.boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    const filterButton = owner.getByRole('button', { name: ar.requests.filter, exact: true });
    expect((await filterButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await owner.getByRole('textbox', { name: ar.requests.search }).fill('no-matching-request');
    await filterButton.click();
    await expect(owner.getByText(ar.requests.empty, { exact: true })).toBeVisible();
    await owner.getByRole('link', { name: ar.requests.clearFilters, exact: true }).first().click();
    await expect(owner.getByRole('textbox', { name: ar.requests.search })).toHaveValue('');
    if (width === 390)
      await owner.screenshot({ path: 'test-results/requests-list-arabic-mobile.png', fullPage: true });
    await newButton.click();
    await expect(owner.getByRole('heading', { name: ar.requests.new, exact: true })).toBeVisible();
    expect(await owner.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await admin.setViewportSize({ width: 320, height: 844 });
  await open(admin, `/requests/${ownRequest}`);
  await admin.getByRole('button', { name: 'Language' }).click();
  await expect(admin.locator('html')).toHaveAttribute('dir', 'rtl');
  await admin.getByRole('button', { name: ar.requests.linkTask, exact: true }).click();
  const dialog = admin.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(320);
  await dialog.getByRole('button', { name: ar.requests.createAndLink, exact: true }).click();
  await expect(dialog.getByLabel(ar.requests.taskTitle, { exact: true })).toBeFocused();
  expect(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await dialog.press('Escape');
  await open(admin, '/admin/request-categories');
  expect(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await json(await admin.request.delete(`/api/projects/${project}/members/${colleagueId}`));
  expect((await colleague.request.get(`/api/requests/${otherRequest}`)).status()).toBe(404);
  const empty = (
    await json(await admin.request.post('/api/projects', { data: { name: `Request-only ${run}` } }))
  ).project.id;
  const active = (await json(await admin.request.get('/api/request-categories'))).categories.find(
    (c: { isArchived: boolean }) => !c.isArchived,
  ).id;
  await json(
    await admin.request.post(`/api/projects/${empty}/requests`, {
      data: { ...payload('Keep history'), categoryId: active },
    }),
  );
  expect((await admin.request.delete(`/api/projects/${empty}`)).status()).toBe(409);
  await json(await admin.request.patch(`/api/projects/${project}`, { data: { isArchived: true } }));
  expect((await admin.request.delete(`/api/requests/${otherRequest}`)).status()).toBe(403);
  expect((await owner.request.delete(`/api/requests/${ownRequest}`)).status()).toBe(403);
  expect(
    (await admin.request.patch(`/api/requests/${ownRequest}`, { data: { status: 'Accepted' } })).status(),
  ).toBe(403);
  expect(
    (
      await owner.request.post(`/api/projects/${project}/requests`, {
        data: { ...payload('Archived project'), categoryId: active },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await admin.request.post(`/api/requests/${ownRequest}/links`, { data: { taskId: task } })).status(),
  ).toBe(403);
});
