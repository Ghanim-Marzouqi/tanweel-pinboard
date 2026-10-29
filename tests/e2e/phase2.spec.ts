import { expect, test, type Page } from '@playwright/test';
import { E2E_ADMIN } from './credentials';
import { createProject, open, signIn } from './helpers';

// One admin session working through tasks, views and My tasks.
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const muscatToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Muscat' }).format(new Date());
const title = `Prepare invoice ${run}`;
const otherPerson = { username: `laila-${run}`, name: `Laila ${run}` };
let projectUrl = '';
let projectId = '';
let otherProjectId = '';
let otherPersonId = '';
let page: Page;

async function api<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, data?: unknown): Promise<T> {
  const res = await page.request.fetch(url, { method, data });
  expect(res.ok(), `${method} ${url} → ${res.status()}`).toBeTruthy();
  return (await res.json()) as T;
}

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signIn(page, E2E_ADMIN.username, E2E_ADMIN.password);

  projectUrl = await createProject(page, `Finance ${run}`);
  projectId = projectUrl.split('/').pop()!;
  otherProjectId = (await api<{ project: { id: string } }>('POST', '/api/projects', { name: `HR ${run}` })).project.id;

  // A second person who is a member of the first project only.
  const created = await api<{ user: { id: string } }>('POST', '/api/admin/users', {
    username: otherPerson.username,
    name: otherPerson.name,
    password: `Temp-${run}-pw`,
  });
  otherPersonId = created.user.id;
  await api('POST', `/api/projects/${projectId}/members`, { userId: otherPersonId });
});

test.afterAll(async () => {
  await page.context().close();
});

test('create a task with assignee, priority, due date and a checklist', async () => {
  await open(page, `${projectUrl}/tasks/new`);
  await page.getByLabel('Title').fill(title);

  const editor = page.locator('.tiptap');
  await editor.click();
  await page.getByRole('button', { name: 'Checklist' }).click();
  await page.keyboard.type('Collect receipts');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Email the client');

  await page.getByLabel('Assignee').selectOption({ label: 'E2E Admin' });
  await page.getByLabel('Priority').selectOption('Urgent');
  await page.getByLabel('Due date').fill(muscatToday);
  await page.getByRole('button', { name: 'Create task' }).click();

  await expect(page).toHaveURL(new RegExp(`${projectUrl}$`));
  const row = page.getByRole('row', { name: new RegExp(title) });
  await expect(row).toContainText('Urgent');
  await expect(row).toContainText('Today');
  await expect(row).toContainText('0/2');
  await expect(row).toContainText('E2E Admin');
});

test('My tasks lists it under "Due today"', async () => {
  await open(page, '/');
  const today = page.getByRole('region', { name: /Due today/ });
  await expect(today.getByRole('link', { name: new RegExp(title) })).toBeVisible();
});

test('search finds text inside the description; filters narrow the list', async () => {
  await open(page, projectUrl);
  const search = page.getByLabel('Search tasks…');

  await search.fill('receipts');
  await expect(page).toHaveURL(/q=receipts/);
  await expect(page.getByRole('row', { name: new RegExp(title) })).toBeVisible();

  await search.fill(`nothing-matches-${run}`);
  await expect(page.getByText('No tasks match these filters.')).toBeVisible();

  await search.fill('');
  await expect(page).not.toHaveURL(/q=/);
  await page.getByLabel('Priority').selectOption('Low');
  await expect(page.getByText('No tasks match these filters.')).toBeVisible();
  await page.getByLabel('Priority').selectOption('Urgent');
  await page.getByLabel('Assignee').selectOption('me');
  await expect(page.getByRole('row', { name: new RegExp(title) })).toBeVisible();
});

test('dragging a card on the board changes its status', async () => {
  await open(page, `${projectUrl}?view=board`);
  const card = page.locator('article', { hasText: title });
  const done = page.locator('section[data-status="Done"]');
  await expect(card).toBeVisible();

  // Pointer drag in small steps (dnd-kit waits for real movement before it starts).
  const from = (await card.boundingBox())!;
  const to = (await done.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + 12);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + 20, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 15 });
  await page.mouse.up();

  // dnd-kit briefly shows a copy for the drop animation; wait until it settles.
  await expect(done.locator('article', { hasText: title })).toHaveCount(1);
  // It was saved, not just moved on screen.
  await expect.poll(async () => {
    await page.reload();
    return page.locator('section[data-status="Done"] article', { hasText: title }).count();
  }).toBe(1);
});

test('moving a task to a project its assignee is not in leaves it unassigned', async () => {
  const { task } = await api<{ task: { id: string } }>('POST', `/api/projects/${projectId}/tasks`, {
    title: `Payroll question ${run}`,
    assigneeId: otherPersonId,
  });

  await open(page, `/tasks/${task.id}`);
  await expect(page.getByLabel('Assignee')).toHaveValue(otherPersonId);
  await page.getByLabel('Move to another project').selectOption({ label: `HR ${run}` });
  await page.getByRole('button', { name: 'Move' }).click();
  await expect(page.getByText(/it's now unassigned/)).toBeVisible();

  const moved = await api<{ task: { projectId: string; assigneeId: string | null } }>('GET', `/api/tasks/${task.id}`);
  expect(moved.task.projectId).toBe(otherProjectId);
  expect(moved.task.assigneeId).toBeNull();
});

test('assignees must be project members, and leaving a project unassigns their tasks', async () => {
  // Outsider can't be assigned.
  const res = await page.request.post(`/api/projects/${otherProjectId}/tasks`, {
    data: { title: `Not allowed ${run}`, assigneeId: otherPersonId },
  });
  expect(res.status()).toBe(400);

  // Member assigned, then removed from the project → task unassigned.
  const { task } = await api<{ task: { id: string } }>('POST', `/api/projects/${projectId}/tasks`, {
    title: `Follow up ${run}`,
    assigneeId: otherPersonId,
  });
  await api('DELETE', `/api/projects/${projectId}/members/${otherPersonId}`);
  const after = await api<{ task: { assigneeId: string | null } }>('GET', `/api/tasks/${task.id}`);
  expect(after.task.assigneeId).toBeNull();
});
