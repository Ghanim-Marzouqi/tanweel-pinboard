import { maybeSendDailyDigests } from '@/lib/email/digest';
import { sendPendingEmails } from '@/lib/email/outbox';
import { smtpConfigured } from '@/lib/email/transport';

const globalForWorker = globalThis as unknown as { emailWorkerStarted?: boolean };

/**
 * Background email sender, started once per server process (instrumentation.ts).
 * Every few seconds it sends queued emails and, once a day, the morning summary.
 */
export function startEmailWorker(): void {
  if (globalForWorker.emailWorkerStarted) return;
  globalForWorker.emailWorkerStarted = true;

  const intervalMs = Number(process.env.EMAIL_WORKER_INTERVAL_MS ?? 10_000);
  console.log(
    `[email] Sender started (every ${intervalMs / 1000}s; ${smtpConfigured() ? 'SMTP' : 'SMTP not configured, capturing to files'})`,
  );

  const tick = async () => {
    try {
      await sendPendingEmails();
      await maybeSendDailyDigests();
    } catch (err) {
      console.error('[email] Sender error:', err);
    } finally {
      setTimeout(tick, intervalMs).unref();
    }
  };
  setTimeout(tick, 2_000).unref();
}
