import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { deliver, type OutgoingEmail } from '@/lib/email/transport';

const MAX_ATTEMPTS = 6;
const BATCH_SIZE = 20;
/** A claim older than this is assumed to belong to a crashed sender. */
const STALE_LOCK_MS = 10 * 60 * 1000;

type Db = PrismaClient | Prisma.TransactionClient;

/** Queue emails; pass a transaction client to queue them atomically with a change. */
export async function enqueueEmails(emails: OutgoingEmail[], db: Db = prisma): Promise<void> {
  if (emails.length === 0) return;
  await db.emailOutbox.createMany({ data: emails });
}

/** Minutes to wait before retry number `attempt` (1, 2, 4, 8, 16 min). */
export function retryDelayMs(attempt: number): number {
  return 60_000 * 2 ** Math.max(0, attempt - 1);
}

interface Claimed {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attempts: number;
}

/**
 * Claim a batch atomically (`FOR UPDATE SKIP LOCKED`), so two app instances
 * never send the same email.
 */
function claimBatch(): Promise<Claimed[]> {
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS);
  return prisma.$queryRaw<Claimed[]>`
    UPDATE email_outbox SET status = 'Sending', "lockedAt" = now()
    WHERE id IN (
      SELECT id FROM email_outbox
      WHERE (status = 'Pending' AND "sendAfter" <= now())
         OR (status = 'Sending' AND "lockedAt" < ${staleBefore})
      ORDER BY "createdAt"
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, "to", subject, html, text, attempts`;
}

/** Send what's due. Returns how many were sent. */
export async function sendPendingEmails(): Promise<number> {
  let sent = 0;
  for (const email of await claimBatch()) {
    try {
      await deliver(email);
      await prisma.emailOutbox.update({
        where: { id: email.id },
        data: { status: 'Sent', sentAt: new Date(), lockedAt: null, attempts: email.attempts + 1 },
      });
      sent++;
    } catch (err) {
      const attempts = email.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[email] Sending "${email.subject}" to ${email.to} failed (attempt ${attempts}): ${message}`);
      await prisma.emailOutbox.update({
        where: { id: email.id },
        data: {
          status: attempts >= MAX_ATTEMPTS ? 'Failed' : 'Pending',
          attempts,
          lastError: message.slice(0, 2000),
          lockedAt: null,
          sendAfter: new Date(Date.now() + retryDelayMs(attempts)),
        },
      });
    }
  }
  return sent;
}
