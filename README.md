# Pinboard · لوحة المهام

Tanweel's internal project and task manager, served at **https://pinboard.tanweel.om**. Work is organised into projects that only their members can see. Each task has a title, rich-text description with checklists, status (To do / In progress / In review / Done), priority, due date, one assignee, file attachments and a comment thread. Projects show tasks as a filterable list or a drag-and-drop board, and the home page lists your own open tasks by due date. The whole UI is available in English and Arabic (right-to-left, Tajawal font).

The app is deliberately simple: it's built for Tanweel's own projects, not as a general-purpose task tool.

Pinboard started as the client-notes companion app in the OpenSky ERP repo and is now a standalone project. See the [roadmap](#roadmap) for what's coming.

## Stack

- Node.js 26 LTS
- Next.js 16 (App Router) + React 19 + TypeScript 7 (see note below)
- Tailwind CSS 4
- Auth.js v5 with built-in accounts (argon2id password hashes, admin-created users, no self-registration)
- Prisma 7 + PostgreSQL 18
- Attachments stored as files on the server (`uploads` Docker volume)
- Tiptap v3 rich-text editor (RTL-aware)
- next-intl for English + Arabic
- Vitest (unit) + Playwright (browser) tests, ESLint 10, checks run locally before every push

## Run with Docker

```bash
cp .env.example .env     # fill in POSTGRES_PASSWORD, AUTH_SECRET, ADMIN_PASSWORD
docker compose up -d --build
```

Open http://localhost:3000 and sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`. That first admin is created on container start only while the `users` table is empty, so you can remove `ADMIN_PASSWORD` from `.env` afterwards.

On start the container creates the database if needed, applies Prisma migrations, bootstraps the first admin, then starts Next.js.

## Local development

```bash
cp .env.example .env     # fill in the secrets; DATABASE_URL must use the same POSTGRES_PASSWORD
docker compose up -d db
npm install
npx prisma migrate deploy
node scripts/create-user.mjs --bootstrap   # first admin from ADMIN_* in .env
npm run dev                                # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright browser tests (run `npm run build` first; see below) |
| `npm run check` | Everything above in one go (what runs before each push) |
| `npm run db:migrate` | Create + apply a migration after editing `prisma/schema.prisma` |
| `npm run user:create` | Create a user (see below) |

## Users and permissions

Accounts are created by an administrator on the **Users** page (there is no sign-up page). The admin sets a temporary password, shares it privately, and the person must choose their own password at first sign-in. Admins can also edit, deactivate/reactivate users and reset passwords there. Everyone can change their name, email and password under **My account**.

Users sign in with their username or email (both case-insensitive). "Stay signed in" keeps the session for 30 days; otherwise it ends after 8 hours. After 10 failed attempts for the same username, sign-in is blocked for 15 minutes. Changing or resetting a password, or deactivating a user, ends their other sessions within a minute.

| Who | Can |
| --- | --- |
| **Admin** | See and manage every project; manage users |
| **Project owner** (whoever created it) | Edit the project, add/remove members, archive it, delete it while it has no tasks |
| **Project member** | See the project; create, edit and comment on its tasks; delete their own tasks, comments and files |

The owner and admins can also delete anyone's tasks, comments and files in the project. Archived projects are read-only for everyone.

The CLI is still there for scripting (it creates users without the forced password change):

```bash
npm run user:create -- --username sara --name "Sara Al-Balushi" --email sara@tanweel.om --role member
docker compose exec app node scripts/create-user.mjs --username sara --name "Sara Al-Balushi" --role member
```

It prompts for the password (or reads `USER_PASSWORD`).

## Browser tests

```bash
npm run build
npm run test:e2e
```

Playwright starts its own server on port 3100 against a separate `pinboard_e2e` database on the same Postgres (derived from `DATABASE_URL`, or set `E2E_DATABASE_URL`; the name must end in `_e2e` or `_test`), with uploads in `.e2e-storage/`. The test admin is created on the first run. Locally the tests use your installed Google Chrome.

## Checks before every push

`npm install` points git at `.githooks/`, whose `pre-push` hook runs `npm run check`: lint, typecheck, unit tests, production build and browser tests (about a minute). The push is cancelled if anything fails. Start the database first (`docker compose up -d db`). In an emergency, `git push --no-verify` skips it.

The GitHub Actions workflow runs the same checks on a clean machine, but only when started by hand (Actions → CI → Run workflow), so it doesn't use Actions minutes on every push.

## Toolchain notes

- **Node 26** is the target (`.nvmrc`, Docker image). Locally: `brew install node@26`.
- **TypeScript 7** (the native compiler) doesn't ship a JavaScript API yet, which ESLint and the Next.js build still need. Following Microsoft's guidance, `typescript` is aliased to `@typescript/typescript6` for those tools, and `@typescript/native` provides TypeScript 7's `tsc` for `npm run typecheck`. Remove the alias once typescript-eslint and Next.js support TypeScript 7.1's API.
- **next-auth** v5 is still published as a beta; npm's `latest` tag points at the older v4.

## Production notes

- Set `AUTH_URL=https://pinboard.tanweel.om` and terminate TLS at your reverse proxy in front of port 3000.
- `AUTH_SECRET` signs session cookies; changing it signs everyone out.
- The sign-in rate limiter keeps its state in memory, which is fine for the single app container in `docker-compose.yml`.

## Layout

```
app/
  (auth)/login             sign-in page
  (app)/                   signed-in pages (shared header + project sidebar)
    page.tsx               home: My tasks, grouped by due date
    projects/              overview, new, [id] (list/board), [id]/settings, [id]/tasks/new
    tasks/[id]             task detail (form + files + comments)
    account/               My account (profile, password; forced password change)
    admin/users/           user management (admins)
  api/...                  REST endpoints (projects, members, tasks, users, account)
components/
  app-shell.tsx            header + sidebar / mobile drawer
  task-form.tsx            create/edit task (RHF + zod), move to another project
  task-list.tsx            list view (status counters, table/cards, paging)
  task-board.tsx           board view (dnd-kit; drag to change status)
  task-filters.tsx         search + filters + List/Board switch (state in the URL)
  project-settings.tsx     details, members, archive, delete
  users-admin.tsx          users table + add/edit/reset dialogs
  account-forms.tsx        profile + password forms
lib/
  access.ts                who may see/do what (every route goes through it)
  api-auth.ts              session guards + visible project/task lookups
  auth.ts                  Auth.js config (credentials → users table, session checks)
  password.ts              argon2id hashing
  rate-limit.ts            sign-in failure limiter
  storage.ts               attachment files on disk (path-safe)
  tasks.ts                 task filters, sorting, summary shape
  dates.ts                 Muscat dates, Sunday–Saturday weeks, due-date groups
  html-text.ts             search text + checklist progress from descriptions
  validation.ts            zod schemas
scripts/
  create-user.mjs          user CLI + first-admin bootstrap
  ensure-db.mjs            create the database if missing
  e2e-server.sh            server used by the Playwright tests
  check.sh                 all checks (pre-push hook, `npm run check`)
.githooks/pre-push         runs scripts/check.sh before every push
messages/{en,ar}.json      translations
tests/                     Vitest unit tests; tests/e2e Playwright tests
```

## Roadmap

Replaces the Vikunja instance at tasks.tanweel.om, kept deliberately simple:

0. **Standalone app** (done): built-in accounts, Tanweel branding, own Docker setup, tests.
1. **Users and projects** (done): Users page, My account, stay signed in, forced password change, members-only projects, To do / In progress / In review / Done, sidebar, browser tests, local pre-push checks.
2. **Tasks and views** (done): one assignee, due date, priority (Low / Medium / High / Urgent), checklists, move a task between projects; List and Board views; "My tasks" home page; filters, search in descriptions, paging; Tajawal font for Arabic.
3. **Email notifications**: assigned to you, @mentions, new comments, morning summary of overdue / due-today tasks, "Forgot password".
4. **Go live** at pinboard.tanweel.om: HTTPS, nightly backups of the database and `uploads` volume with a tested restore, health checks; then retire tasks.tanweel.om.

Dates use Muscat time and weeks start on Sunday.
