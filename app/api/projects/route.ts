import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, badRequest } from '@/lib/api-auth';
import { visibleProjectsWhere } from '@/lib/access';
import { ProjectCreateSchema } from '@/lib/validation';

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const projects = await prisma.project.findMany({
    where: visibleProjectsWhere(guard.session.user),
    include: { _count: { select: { tasks: true, members: true } } },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const json = await req.json().catch(() => null);
  const parsed = ProjectCreateSchema.safeParse(json);
  if (!parsed.success) return badRequest('Invalid body', parsed.error.issues);

  const userId = guard.session.user.id;
  const project = await prisma.project.create({
    data: {
      ...parsed.data,
      ownerId: userId,
      members: { create: { userId } },
    },
  });
  return NextResponse.json({ project }, { status: 201 });
}
