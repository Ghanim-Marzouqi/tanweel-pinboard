import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  requireAdmin,
  badRequest,
  notFound,
  conflict,
  isUniqueViolation,
} from '@/lib/api-auth';
import { countOtherActiveAdmins, PUBLIC_USER_SELECT } from '@/lib/users';
import { UserUpdateSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = UserUpdateSchema.safeParse(json);
  if (!parsed.success) return badRequest('Invalid body', parsed.error.issues);
  const changes = parsed.data;

  const existing = await prisma.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
  if (!existing) return notFound('User not found');

  const losesAdmin =
    existing.role === 'admin' &&
    existing.isActive &&
    (changes.role === 'member' || changes.isActive === false);
  if (losesAdmin) {
    if (id === guard.session.user.id) {
      return badRequest('You cannot remove your own admin access or deactivate yourself');
    }
    if ((await countOtherActiveAdmins(id)) === 0) {
      return badRequest('At least one active admin is required');
    }
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...changes,
        // Deactivation ends the user's sessions right away.
        ...(changes.isActive === false ? { sessionVersion: { increment: 1 } } : {}),
      },
      select: PUBLIC_USER_SELECT,
    });
    return NextResponse.json({ user });
  } catch (err) {
    if (isUniqueViolation(err)) return conflict('Email already in use');
    throw err;
  }
}
