import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, badRequest, conflict, isUniqueViolation } from '@/lib/api-auth';
import { AccountUpdateSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const json = await req.json().catch(() => null);
  const parsed = AccountUpdateSchema.safeParse(json);
  if (!parsed.success) return badRequest('Invalid body', parsed.error.issues);

  try {
    const user = await prisma.user.update({
      where: { id: guard.session.user.id },
      data: parsed.data,
      select: { name: true, email: true, dailyDigest: true },
    });
    return NextResponse.json({ user });
  } catch (err) {
    if (isUniqueViolation(err)) return conflict('Email already in use');
    throw err;
  }
}
