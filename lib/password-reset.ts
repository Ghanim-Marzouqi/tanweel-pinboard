import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** New single-use token for `userId`; earlier unused tokens stop working. */
export async function createResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    }),
  ]);
  return token;
}

/**
 * Set a new password with a reset token. Returns false if the token is
 * unknown, used, expired, or the account is deactivated.
 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, usedAt: true, expiresAt: true, user: { select: { isActive: true } } },
  });
  if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.isActive) return false;

  const passwordHash = await hashPassword(newPassword);
  // Claim the token atomically so it can't be used twice in parallel.
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return false;

  await prisma.user.update({
    where: { id: record.userId },
    data: {
      passwordHash,
      mustChangePassword: false,
      // Sign out every existing session.
      sessionVersion: { increment: 1 },
    },
  });
  return true;
}
