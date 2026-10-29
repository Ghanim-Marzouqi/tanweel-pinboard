# Pinboard · لوحة المهام

Tanweel's team task manager, served at **https://pinboard.tanweel.om**. Each task has a title, rich-text description, status, file attachments and a comment thread. The whole UI is available in English and Arabic (with right-to-left layout).

Pinboard started as the client-notes companion app in the OpenSky ERP repo and is now a standalone project. See the [roadmap](#roadmap) for what's coming.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- Auth.js v5 with built-in accounts (argon2id password hashes, admin-created users, no self-registration)
- Prisma 7 + PostgreSQL 16
- MinIO (or any S3-compatible store) for attachments
- Tiptap v3 rich-text editor (RTL-aware)
- next-intl for English + Arabic
- Vitest + ESLint

## Run with Docker

```bash
cp .env.example .env     # fill in POSTGRES_PASSWORD, AUTH_SECRET, MINIO_SECRET_KEY, ADMIN_PASSWORD
docker compose up -d --build
```

Open http://localhost:3000 and sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`. That first admin is created on container start only while the `users` table is empty, so you can remove `ADMIN_PASSWORD` from `.env` afterwards.

On start the container creates the database if needed, applies Prisma migrations, bootstraps the first admin, then starts Next.js.

## Local development

```bash
cp .env.example .env     # fill in the secrets; DATABASE_URL must use the same POSTGRES_PASSWORD
docker compose up -d db minio
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
| `npm run db:migrate` | Create + apply a migration after editing `prisma/schema.prisma` |
| `npm run user:create` | Create a user (see below) |

## Managing users

Accounts are created by an administrator; there is no sign-up page. Until the admin UI lands (roadmap phase 4), use the CLI:

```bash
npm run user:create -- --username sara --name "Sara Al-Balushi" --email sara@tanweel.om --role member
```

It prompts for the password (or reads `USER_PASSWORD`). Inside the running container:

```bash
docker compose exec app node scripts/create-user.mjs --username sara --name "Sara Al-Balushi" --role member
```

Users sign in with their username or email. Usernames and emails are case-insensitive. After 10 failed attempts for the same username, sign-in is blocked for 15 minutes. Deactivating a user (`isActive = false`) ends their sessions within a minute.

Roles:
- **admin**: can delete any task or comment.
- **member**: can create and edit tasks, but only delete their own tasks and comments.

## Production notes

- Set `AUTH_URL=https://pinboard.tanweel.om` and terminate TLS at your reverse proxy in front of port 3000.
- `AUTH_SECRET` signs session cookies; changing it signs everyone out.
- The sign-in rate limiter keeps its state in memory, which is fine for the single app container in `docker-compose.yml`.

## Layout

```
app/
  (auth)/login         sign-in page
  tasks/               list (server component) + new + [id] (form + comments)
  api/tasks/...        REST endpoints
components/
  task-form.tsx        create/edit form (RHF + zod)
  task-attachments.tsx multi-file upload (immediate on edit, queued on create)
  comments-section.tsx task discussion thread
  rich-text-editor.tsx Tiptap v3 wrapper, RTL-aware
lib/
  auth.ts              Auth.js config (credentials → users table)
  password.ts          argon2id hashing
  rate-limit.ts        sign-in failure limiter
  prisma.ts            PrismaClient singleton (Prisma 7 adapter pattern)
  minio.ts             MinIO client + bucket helpers
  validation.ts        zod schemas
scripts/create-user.mjs  user CLI + first-admin bootstrap
i18n/request.ts        next-intl config (cookie-based locale)
messages/{en,ar}.json  translations
tests/                 Vitest unit tests
```

## Roadmap

Feature parity with the Vikunja instance at tasks.tanweel.om, in phases:

0. **Standalone app** (done): built-in accounts, Tanweel branding, own Docker setup, tests.
1. **Core model**: projects (nested, archived, favourites), teams, project sharing (read / write / admin), assignees, labels, priority, start/due/end dates, progress, task IDs, task relations.
2. **Views**: list, table, Kanban, Gantt; "my tasks" / overdue / upcoming home page; saved filters; full search; quick-add.
3. **Collaboration**: rich comments with @mentions, activity history, in-app and email notifications, reminders, repeating tasks.
4. **Accounts & integrations**: admin user management, two-factor sign-in (TOTP), user settings, dark mode, API tokens, webhooks.
