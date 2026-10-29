import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest } from '@/lib/api-auth';
import { enqueueEmails } from '@/lib/email/outbox';
import { emailLocale, passwordResetEmail } from '@/lib/email/templates';
import { appUrl } from '@/lib/email/transport';
import { createResetToken } from '@/lib/password-reset';
import { resetLimiter } from '@/lib/rate-limit';
import { PasswordResetRequestSchema } from '@/lib/validation';

/**
 * "Forgot password": email a reset link if the account exists, is active and
 * has an email address. The answer is always the same, so the form can't be
 * used to find out which accounts exist.
 */
export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = PasswordResetRequestSchema.safeParse(json);
  if (!parsed.success) return badRequest('Invalid body', parsed.error.issues);
  const { identifier } = parsed.data;

  if (!resetLimiter.isBlocked(identifier)) {
    resetLimiter.recordFailure(identifier); // counts every request for this name
    const user = await prisma.user.findFirst({
      where: {
        AND: [
          identifier.includes('@') ? { email: identifier } : { username: identifier },
          { isActive: true, email: { not: null } },
        ],
      },
      select: { id: true, username: true, email: true, locale: true },
    });
    if (user?.email) {
      const token = await createResetToken(user.id);
      const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
      await enqueueEmails([passwordResetEmail(user.email, emailLocale(user.locale), user.username, link)]);
    }
  }

  return NextResponse.json({ ok: true });
}
