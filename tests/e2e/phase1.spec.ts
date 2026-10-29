import { expect, test } from '@playwright/test';
import { E2E_ADMIN } from './credentials';
import { createProject, expectHome, newPage, open, signIn } from './helpers';

// One scenario across two people (admin + member), so the steps share state.
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const member = { username: `sara-${run}`, name: `Sara ${run}`, password: '', newPassword: `Sara-new-${run}` };
const sharedProject = `Website ${run}`;
const privateProject = `Payroll ${run}`;
const taskTitle = `Draft homepage copy ${run}`;
let sharedProjectUrl = '';
let privateProjectUrl = '';

test('admin creates a user and two projects, sharing one', async ({ page }) => {
  await signIn(page, E2E_ADMIN.username, E2E_ADMIN.password);
  await expectHome(page);

  await test.step('add a member with a temporary password', async () => {
    await open(page, '/admin/users');
    await page.getByRole('button', { name: 'Add user' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add user' });
    await dialog.getByLabel('Username').fill(member.username);
    await dialog.getByLabel('Full name').fill(member.name);
    member.password = await dialog.getByLabel('Temporary password').inputValue();
    expect(member.password.length).toBeGreaterThanOrEqual(8);
    await dialog.getByRole('button', { name: 'Save' }).click();
    const row = page.getByRole('row', { name: new RegExp(member.name) });
    await expect(row).toContainText('Temporary password');
  });

  await test.step('create a shared and a private project', async () => {
    sharedProjectUrl = await createProject(page, sharedProject);
    privateProjectUrl = await createProject(page, privateProject);
  });

  await test.step('add the member to the shared project', async () => {
    await open(page, `${sharedProjectUrl}/settings`);
    await page.getByLabel('Add member').selectOption({ label: `${member.name} (@${member.username})` });
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('listitem').filter({ hasText: member.name })).toBeVisible();
  });
});

test('member must change the temporary password, sees only shared projects, adds a task and a file', async ({ browser }) => {
  const page = await newPage(browser);
  await signIn(page, member.username, member.password);

  await test.step('forced password change', async () => {
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText('Choose your own password')).toBeVisible();
    // Other pages are blocked until the password is changed.
    await open(page, '/projects');
    await expect(page).toHaveURL(/\/account$/);

    await page.getByLabel('Current password').fill(member.password);
    await page.getByLabel('New password', { exact: true }).fill(member.newPassword);
    await page.getByLabel('Confirm new password').fill(member.newPassword);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expectHome(page);
  });

  await test.step('sidebar lists only the shared project', async () => {
    const nav = page.getByRole('navigation');
    await expect(nav.getByRole('link', { name: sharedProject })).toBeVisible();
    await expect(nav.getByRole('link', { name: privateProject })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Users' })).toHaveCount(0);
  });

  await test.step('private project and admin pages are off-limits', async () => {
    const res = await page.goto(privateProjectUrl);
    expect(res?.status()).toBe(404);
    await page.goto('/admin/users');
    await expectHome(page);
    const api = await page.request.get('/api/admin/users');
    expect(api.status()).toBe(403);
  });

  await test.step('create a task in the shared project', async () => {
    await open(page, `${sharedProjectUrl}/tasks/new`);
    await page.getByLabel('Title').fill(taskTitle);
    await page.getByLabel('Status').selectOption('InReview');
    await page.getByRole('button', { name: 'Create task' }).click();
    await expect(page).toHaveURL(new RegExp(`${sharedProjectUrl}$`));
    const row = page.getByRole('row', { name: new RegExp(taskTitle) });
    await expect(row).toContainText('In review');
  });

  await test.step('attach a file and download it again', async () => {
    await page.getByRole('link', { name: taskTitle }).click();
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'ملاحظات.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(`hello from ${run}`),
    });
    const link = page.getByRole('link', { name: 'ملاحظات.txt' });
    await expect(link).toBeVisible();
    const res = await page.request.get((await link.getAttribute('href'))!);
    expect(res.status()).toBe(200);
    expect(await res.text()).toBe(`hello from ${run}`);
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
  });

  await page.context().close();
});

test('archived projects are read-only and deactivated users cannot sign in', async ({ page, browser }) => {
  await signIn(page, E2E_ADMIN.username, E2E_ADMIN.password);

  await test.step('admin archives the shared project', async () => {
    await open(page, `${sharedProjectUrl}/settings`);
    await page.getByRole('button', { name: 'Archive project' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Archive project' }).click();
    await expect(page.getByRole('button', { name: 'Restore project' })).toBeVisible();
  });

  const memberPage = await newPage(browser);
  await test.step('member sees the project read-only', async () => {
    await signIn(memberPage, member.username, member.newPassword);
    await expectHome(memberPage);
    await open(memberPage, sharedProjectUrl);
    await expect(memberPage.getByText('This project is archived')).toBeVisible();
    await expect(memberPage.getByRole('link', { name: 'Add task' })).toHaveCount(0);
  });

  await test.step('admin deactivates the member', async () => {
    await open(page, '/admin/users');
    const row = page.getByRole('row', { name: new RegExp(member.name) });
    await row.getByRole('button', { name: 'Deactivate' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Deactivate' }).click();
    await expect(row).toContainText('Deactivated');
  });

  await test.step('member can no longer sign in', async () => {
    const fresh = await newPage(browser);
    await signIn(fresh, member.username, member.newPassword, { expectSuccess: false });
    await expect(fresh.getByRole('alert').filter({ hasText: 'Incorrect' })).toBeVisible();
    await fresh.context().close();
  });

  await memberPage.context().close();
});

test('switching to Arabic flips the layout to right-to-left', async ({ page }) => {
  await signIn(page, E2E_ADMIN.username, E2E_ADMIN.password);
  await page.getByRole('button', { name: 'Language' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'مهامي', level: 1 })).toBeVisible();
});
