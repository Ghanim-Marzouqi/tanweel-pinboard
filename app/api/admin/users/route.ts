import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, badRequest, conflict, isUniqueViolation } from '@/lib/api-auth';
import { hashPassword } from '@/lib/password';
import { PUBLIC_USER_SELECT } from '@/lib/users';
import { UserCreateSchema } from '@/lib/validation';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const users = await prisma.user.findMany({
    select: PUBLIC_USER_SELECT,
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const json = await req.json().catch(() => null);
  const parsed = UserCreateSchema.safeParse(json);
  if (!parsed.success) return badRequest('Invalid body', parsed.error.issues);
  const { password, ...fields } = parsed.data;

  try {
    const user = await prisma.user.create({
      data: { ...fields, passwordHash: await hashPassword(password), mustChangePassword: true },
      select: PUBLIC_USER_SELECT,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) return conflict('Username or email already in use');
    throw err;
  }
}
