import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, badRequest, notFound } from '@/lib/api-auth';
import { hashPassword } from '@/lib/password';
import { PasswordResetSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

/** Set a temporary password. The user must change it at next sign-in. */
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  if (id === guard.session.user.id) {
    return badRequest('Change your own password from My account');
  }

  const json = await req.json().catch(() => null);
  const parsed = PasswordResetSchema.safeParse(json);
  if (!parsed.success) return badRequest('Invalid body', parsed.error.issues);

  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return notFound('User not found');

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      mustChangePassword: true,
      sessionVersion: { increment: 1 },
    },
  });
  return NextResponse.json({ ok: true });
}
