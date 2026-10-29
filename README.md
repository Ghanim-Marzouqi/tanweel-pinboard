# Pinboard · لوحة المهام

Tanweel's internal project and task manager, served at **https://pinboard.tanweel.om**. Work is organised into projects that only their members can see. Each task has a title, rich-text description with checklists, status (To do / In progress / In review / Done), priority, due date, one assignee, file attachments and a comment thread. Projects show tasks as a filterable list or a drag-and-drop board, and the home page lists your own open tasks by due date. People get emails when a task is assigned to them, when they're @mentioned, when their tasks get comments, and a morning summary of overdue and due-today work; "Forgot password" works by email. The whole UI is available in English and Arabic (right-to-left, Tajawal font).

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

## Email

Emails are queued in the `email_outbox` table in the same request as the action that causes them, and a background sender inside the app (`instrumentation.ts` → `lib/email/worker.ts`) sends them every few seconds, retrying failures with back-off (1, 2, 4, 8, 16 minutes; then marked failed).

| Email | Goes to |
| --- | --- |
| Assigned | The new assignee (not when you assign yourself) |
| Mentioned | People `@username`-mentioned in a comment who can see the task |
| New comment | The task's creator and assignee (unless already mentioned, never the author) |
| Morning summary | Everyone with overdue or due-today open tasks; 07:00 Muscat time, Sunday–Thursday; can be switched off in My account |
| Forgot password | The account's email; link valid for 1 hour, works once |

Emails use the recipient's language (saved when they switch it in the app). Only active users with an email address receive anything.

Configure SMTP with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `MAIL_FROM` (see `.env.example`); links in emails use `AUTH_URL`. Admins can check the settings with **Send test email** on the Users page (it goes to their own address). Without `SMTP_HOST`, emails are saved as JSON files in `.mail/` instead.

For local development, Mailpit catches everything the app sends:

```bash
docker compose --profile dev up -d mail   # inbox at http://localhost:8025
```

and set `SMTP_HOST=localhost`, `SMTP_PORT=1025` in `.env`.

## Browser tests

```bash
npm run build
npm run test:e2e
```

Playwright starts its own server on port 3100 against a separate `pinboard_e2e` database on the same Postgres (derived from `DATABASE_URL`, or set `E2E_DATABASE_URL`; the name must end in `_e2e` or `_test`), with uploads in `.e2e-storage/` and emails captured to `.e2e-mail/`, where the tests read them. The test admin is created on the first run. Locally the tests use your installed Google Chrome.

## Checks before every push

`npm install` points git at `.githooks/`, whose `pre-push` hook runs `npm run check`: lint, typecheck, unit tests, production build and browser tests (about a minute). The push is cancelled if anything fails. Start the database first (`docker compose up -d db`). In an emergency, `git push --no-verify` skips it.

The GitHub Actions workflow runs the same checks on a clean machine, but only when started by hand (Actions → CI → Run workflow), so it doesn't use Actions minutes on every push.

## Toolchain notes

- **Node 26** is the target (`.nvmrc`, Docker image). Locally: `brew install node@26`.
- **TypeScript 7** (the native compiler) doesn't ship a JavaScript API yet, which ESLint and the Next.js build still need. Following Microsoft's guidance, `typescript` is aliased to `@typescript/typescript6` for those tools, and `@typescript/native` provides TypeScript 7's `tsc` for `npm run typecheck`. Remove the alias once typescript-eslint and Next.js support TypeScript 7.1's API.
- **next-auth** v5 is still published as a beta; npm's `latest` tag points at the older v4.

## Production operations

Production uses `tanweel-production` (SSH), `/srv/tanweel-pinboard/current` (a release symlink), and the root-only `/srv/tanweel-pinboard/.env`. The public URL is **https://pinboard.tanweel.om**. Cloudflare proxies its A record to `169.58.241.86`; the existing Caddy container terminates origin TLS and forwards to `tanweel-pinboard-app:3000` on the dedicated `pinboard-proxy` network. Neither PostgreSQL nor the app publishes a host port. Caddy's Compose file persists its membership in that network. Shared Caddy upstreams must use unique container names or aliases: Pinboard uses `tanweel-pinboard-app:3000`, and driver registration uses `tanweel-driver-registration-app-1:3000`. The generic Compose alias `app` exists on both networks and must not be used by the shared proxy.

Use the production wrapper rather than the development Compose command:

```bash
ssh tanweel-production
cd /srv/tanweel-pinboard
current/ops/compose.sh ps
current/ops/compose.sh logs --tail 100 app
```

`docker-compose.production.yml` overlays the base file, requires real SMTP and an explicit release image tag, and caps each app/database container's logs at 3 × 10 MB. Existing Caddy logs are capped at 5 × 10 MB. Keep one app container: its email worker and rate limiter are in-process. `AUTH_SECRET` rotation signs everyone out. After first-admin verification, remove `ADMIN_PASSWORD` from the runtime environment and recreate only the app.

### Release and update

1. Run `npm run check` locally with the development PostgreSQL running. CI remains manual-only.
2. Export reviewed source into a new `/srv/tanweel-pinboard/releases/<release>` directory. Include only source; never upload `.env`, local databases, uploads, captured mail, `node_modules`, or build output. Record the source commit and archive SHA-256 in `RELEASE`.
3. Back up the current version using `current/ops/backup.sh`. Keep the previous source directory, image and configuration.
4. Build the new image using both Compose files and the root runtime environment, with a unique `PINBOARD_IMAGE` tag. Do not overwrite an earlier release tag.
5. Set that tag in the root `.env`, switch `current` to the new release, and run `current/ops/compose.sh up -d --wait`. The entrypoint applies migrations before serving traffic.
6. Verify public HTTPS, sign-in, Users, projects and attachment upload/download. Verify existing Tanweel services separately. Never run a broad `docker compose down`, prune shared networks, or remove volumes.

Caddy's configuration is `/srv/tanweel-driver-registration/Caddyfile`; its container is `tanweel-driver-registration-caddy-1`. The Pinboard block is in `ops/Caddyfile.pinboard`. Back up the live configuration before editing, validate with `docker exec tanweel-driver-registration-caddy-1 caddy validate --config /etc/caddy/Caddyfile`, then use `caddy reload` with the same arguments. A reload does not restart other applications.

For code-only rollback with a compatible schema, restore the previous release symlink and image tag and recreate the app. If migrations are incompatible, restore the matching database and uploads from the pre-update backup. Database restoration loses writes after that snapshot; choose and communicate the recovery point before doing it.

### Nightly backups and restore verification

`pinboard-backup.timer` runs at **02:30 Asia/Muscat** with up to two minutes of jitter, retaining **14 days** in `/var/backups/tanweel-pinboard`. It also catches a missed run after boot. The backup briefly stops the app to keep database rows and file contents consistent, restarts it even on failure, and saves PostgreSQL's custom-format dump, uploads, file checksums, source, release identity and runtime configuration. The directory and files are root-only because the dump contains private work and `runtime.env` contains secrets.

```bash
systemctl status pinboard-backup.timer
systemctl list-timers pinboard-backup.timer
journalctl -u pinboard-backup.service --since yesterday
systemctl start pinboard-backup.service   # manual backup; brief app interruption
/srv/tanweel-pinboard/current/ops/restore-test.sh /var/backups/tanweel-pinboard/<timestamp>
```

The restore test checks archive checksums, restores SQL into a disposable PostgreSQL 18 container with **no network**, restores uploads into a separate disposable volume, compares every file hash and attachment size, checks uid 1001 can write, and reports row counts. It never starts an email worker or touches production volumes, and cleans up its own containers and volumes.

These are local server backups: **they do not protect against loss of the VPS/disk**. Off-server backup storage is intentionally deferred. Check the systemd service for failures; external failure notifications are not configured.

### Recover production from a backup

First run `restore-test.sh` on the selected backup. Take another backup of current production if it is healthy, preserve its runtime configuration, and schedule the interruption. Restore the matching source and image before the database. As root on the server:

```bash
ROOT=/srv/tanweel-pinboard
SNAPSHOT=/var/backups/tanweel-pinboard/<verified-timestamp>
C="$ROOT/current/ops/compose.sh"
"$C" stop -t 60 app
# Destructive recovery: the following replaces the current database.
"$C" exec -T db sh -c 'dropdb --force -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
"$C" exec -T db sh -c 'pg_restore --exit-on-error --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$SNAPSHOT/database.dump"
# Preserve current files outside the volume before replacing them.
"$C" run --rm --no-deps -T --user 0 --entrypoint tar app -C /app/storage -czf - . > "$ROOT/uploads-before-restore.tar.gz"
"$C" run --rm --no-deps -T --user 0 --entrypoint sh app -c 'find /app/storage -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +'
"$C" run --rm --no-deps -T --user 0 --entrypoint tar app -C /app/storage -xzf - < "$SNAPSHOT/uploads.tar.gz"
"$C" up -d --wait app
```

Retain the root runtime `.env` when restoring data on the same server. For a replacement host, restore `runtime.env` securely, the source archive, `RELEASE`, the Docker network, Caddy route and systemd units first; recreate the release image from its source and lockfile. Verify sign-in and download at least one restored attachment before declaring recovery complete. Keep backups and secrets out of Git.

### Vikunja user import and retirement

Only account identities are imported: usernames, names and email addresses. `ghanim` is the administrator; the other imported accounts are members. No old password hashes, projects, tasks or attachments are imported. Imported users select **Forgot password** at the new login page to set their password. No bulk invitation email is sent automatically. The go-live import created 13 accounts; at Ghanim's request the unused `tanweel` member account and its reset tokens were subsequently permanently deleted from live Pinboard, leaving 12 users (one administrator, 11 members). The separate SMTP configuration remains `Pinboard <tanweelapp@gmail.com>`; sending email does not require a Pinboard account for that address.

`scripts/import-vikunja-users.mjs users.json` validates a private JSON export and performs a dry run. Add `--apply` to import transactionally; reruns skip matching existing accounts and reject identity conflicts. Input fields are restricted to `username`, `name`, `email`, `status`, `language`; inactive source users require review. Delete temporary identity exports after verification.

Vikunja was retired on **29 October 2026**, after Ghanim confirmed a successful password reset/sign-in and explicitly approved retirement. `https://tasks.tanweel.om` now returns an uncached **302** to `https://pinboard.tanweel.om`; old paths and query strings are discarded because old task IDs have no matching destination. HTTP first redirects to HTTPS. The old DNS and TLS remain active.

Only `tanweel-tasks-web`, `tanweel-tasks`, and `tanweel-tasks-db` were stopped. Their runtime restart policies and `/srv/tanweel-tasks/compose.yaml` are set to `no`; containers, images, database volume, uploads and configuration are retained. Do not run `down -v` or prune them. Other containers retained their IDs and start times.

The private retirement archive is `/var/backups/tanweel-vikunja-retired/20261029T124209Z` (not part of the rolling Pinboard backup retention). It contains pre-cutover and final SQL/files/configuration snapshots, Caddy/Compose rollback files and `SHA256SUMS`. The final dump was taken after stopping both writers and restored successfully in an isolated PostgreSQL 16 container: 13 historical users, 13 projects and 9 tasks. Those historical projects/tasks were **not** migrated to Pinboard. Historical archives preserve the old account records; removing an account from live Pinboard does not rewrite backups.

For an authorized rollback, restore `compose.before.yaml` to `/srv/tanweel-tasks/compose.yaml`, restore `unless-stopped` on the three old containers, start the database and wait for readiness, then start the API and web containers. Restore the old hostname block from `Caddyfile.rollback-vikunja`, validate Caddy and hot-reload it, then verify the old service. This prepared rollback configuration retains Pinboard and the corrected driver-registration upstream. If unrelated proxy changes have happened since retirement, merge only the old hostname block into the current Caddyfile instead of replacing the whole file. The retained volume can be started directly; use `final.dump` and `final-directory.tar.gz` only if data recovery is required.

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
  email/                   transport (SMTP or capture), templates, outbox, morning summary, sender
  notify.ts                who gets which email
  mentions.ts              @username parsing
  password-reset.ts        hashed single-use reset tokens
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
3. **Email notifications** (done): assigned to you, @mentions, new comments, morning summary of overdue / due-today tasks, "Forgot password", admin test email.
4. **Go live — completed 29 October 2026:** Pinboard serves HTTPS, real email and administrator sign-in are verified, nightly database/uploads backups and restore tests are in place, logs are bounded, and tasks.tanweel.om redirects to Pinboard after approved Vikunja retirement.

Dates use Muscat time and weeks start on Sunday.
