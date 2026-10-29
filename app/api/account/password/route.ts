import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, badRequest } from '@/lib/api-auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import { loginLimiter } from '@/lib/rate-limit';
import { PasswordChangeSchema } from '@/lib/validation';

/**
 * Change your own password. Every session of this user (including the
 * current one) is invalidated; the browser signs in again with the new
 * password right after.
 */
export async function POST(req: NextRequest) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id, username } = guard.session.user;

  const json = await req.json().catch(() => null);
  const parsed = PasswordChangeSchema.safeParse(json);
  if (!parsed.success) return badRequest('Invalid body', parsed.error.issues);

  if (loginLimiter.isBlocked(username)) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
    loginLimiter.recordFailure(username);
    return badRequest('Current password is incorrect', [{ path: ['currentPassword'] }]);
  }

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
      mustChangePassword: false,
      sessionVersion: { increment: 1 },
    },
  });
  return NextResponse.json({ ok: true });
}
