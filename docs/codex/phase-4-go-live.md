# Pinboard — Phase 4: go live at https://pinboard.tanweel.om

Take Phase 4 from start to finish: deploy **Pinboard** (Arabic: **لوحة المهام**), Tanweel's internal project and task app, to production at **https://pinboard.tanweel.om**, and then retire the old tool at tasks.tanweel.om. Plan it your way and ask the user whenever you need information or a decision. Reply in the language the user writes in (English or Arabic).

## Where things stand

- **Repo:** https://github.com/Ghanim-Marzouqi/tanweel-pinboard, branch `main` (commit `d2501fd`), local checkout `/Users/gscprogram/Projects/github/tanweel-project-management`. `README.md` documents setup, users and permissions, email, tests and the code layout.
- **Phases 0–3 are done:** built-in accounts with an admin Users page and forced change of temporary passwords; members-only projects with owners and archiving; tasks with one assignee, due date, priority, checklists, attachments and comments; List and Board views, filters and search; a "My tasks" home page; email notifications (assigned, @mentions, new comments, a 07:00 Muscat morning summary Sunday–Thursday) and "Forgot password"; English and Arabic (RTL, Tajawal font).
- **Stack:** Node.js 26 LTS, Next.js 16 (`output: 'standalone'`), React 19, TypeScript 7, Prisma 7 + PostgreSQL 18, Auth.js v5 (credentials), Nodemailer 10, next-intl. Package manager: npm.
- **Runtime:** `docker-compose.yml` runs `db` (postgres:18-alpine, volume `pg-data` at `/var/lib/postgresql`) and `app` (repo `Dockerfile`, node:26-alpine, uid 1001, volume `uploads` at `/app/storage`, healthcheck on `/login`); `mail` (Mailpit) is a dev-only profile. The entrypoint creates the database if needed, runs `prisma migrate deploy`, creates the first admin from `ADMIN_*` while the users table is empty, then starts the server. The email sender and the sign-in rate limiter run inside the app process, so it's designed for a single app container.
- **Configuration:** see `.env.example` — database credentials, `AUTH_SECRET`, `AUTH_URL` (must be the public https URL; used for cookies and email links), first-admin `ADMIN_*`, `SMTP_*` and `MAIL_FROM` (without `SMTP_HOST` emails are saved to files, not sent), `DAILY_DIGEST_HOUR`. Uploads are up to 10 MB per file; Auth.js runs with `trustHost: true`.
- **Checks:** `npm run check` runs lint, typecheck, unit tests, build and Playwright tests (needs `docker compose up -d db`); it is also the git pre-push hook. GitHub Actions is manual-only on purpose (no Actions minutes on the account).
- **Project preferences:** keep it simple (one company, internal use), use the latest stable versions, npm rather than Bun.

## The production server

- SSH alias **`tanweel-production`** (in `~/.ssh/config` on this Mac).
- It already runs about 13 Docker containers, including the old tool — `tanweel-tasks` (vikunja/vikunja:2.7.1) and `tanweel-tasks-db` (postgres:16.14), serving https://tasks.tanweel.om — and other Tanweel services (for example `tanweel-email-automation-postgres-1`, `tanweel-driver-registration-db-1`) that must keep running.
- The old tool was never used, so there is nothing to migrate. The user's plan is to shut it down once Pinboard is live and they confirm.

## Phase 4 is done when

- https://pinboard.tanweel.om serves Pinboard over HTTPS with a valid certificate, routed through the server's existing setup.
- Real email works (the admin **Users → Send test email** button arrives).
- The first admin can sign in, and staff accounts can be created.
- The database and the `uploads` volume are backed up nightly, and a restore has been tested.
- Logs don't grow without limit.
- tasks.tanweel.om is retired once the user confirms.
- The README describes how production is deployed, updated, backed up and restored.

## What you'll need from the user

SMTP details (or permission to reuse what the old tool uses), the first admin's username and email, the DNS record for `pinboard.tanweel.om`, where backups should be kept, and the go-ahead to retire tasks.tanweel.om.
