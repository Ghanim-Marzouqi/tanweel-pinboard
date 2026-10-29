import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect } from '@playwright/test';

/** Same folder as MAIL_CAPTURE_DIR in playwright.config.ts. */
const DIR = path.resolve('.e2e-mail');

export interface CapturedEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function all(): Promise<CapturedEmail[]> {
  const files = await readdir(DIR).catch(() => [] as string[]);
  return Promise.all(
    files.filter((f) => f.endsWith('.json')).map(async (f) => JSON.parse(await readFile(path.join(DIR, f), 'utf8'))),
  );
}

/** Emails to `to` matching `match`, once at least `count` have arrived (the sender runs every 0.5 s). */
export async function waitForEmails(
  to: string,
  match: (email: CapturedEmail) => boolean,
  count = 1,
): Promise<CapturedEmail[]> {
  let found: CapturedEmail[] = [];
  await expect
    .poll(
      async () => {
        found = (await all()).filter((e) => e.to === to && match(e));
        return found.length;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(count);
  return found;
}

export async function emailsTo(to: string): Promise<CapturedEmail[]> {
  return (await all()).filter((e) => e.to === to);
}
