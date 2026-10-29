import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Public base URL for links in emails, e.g. https://pinboard.tanweel.om */
export function appUrl(): string {
  return (process.env.AUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export function mailFrom(): string {
  return process.env.MAIL_FROM ?? 'Pinboard <no-reply@tanweel.om>';
}

/** SMTP is used when configured, unless MAIL_TRANSPORT=capture (tests). */
export function smtpConfigured(): boolean {
  return process.env.MAIL_TRANSPORT !== 'capture' && !!process.env.SMTP_HOST;
}

let transporter: Transporter | undefined;

function smtp(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    // true for port 465 (implicit TLS); otherwise STARTTLS is used when offered.
    secure: (process.env.SMTP_SECURE ?? '').toLowerCase() === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? '' }
      : undefined,
  });
  return transporter;
}

/**
 * Without SMTP settings (or with MAIL_TRANSPORT=capture) emails are written
 * as JSON files to MAIL_CAPTURE_DIR instead of being sent.
 */
async function capture(email: OutgoingEmail): Promise<void> {
  const dir = path.resolve(/*turbopackIgnore: true*/ process.env.MAIL_CAPTURE_DIR ?? '.mail');
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const file = path.join(/*turbopackIgnore: true*/ dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  await writeFile(/*turbopackIgnore: true*/ file, JSON.stringify({ ...email, capturedAt: new Date().toISOString() }, null, 2));
  console.log(`[email] SMTP not configured — saved "${email.subject}" for ${email.to} to ${file}`);
}

export async function deliver(email: OutgoingEmail): Promise<void> {
  if (!smtpConfigured()) return capture(email);
  await smtp().sendMail({ from: mailFrom(), ...email });
}
