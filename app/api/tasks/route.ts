import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, badRequest } from '@/lib/api-auth';
import { TaskCreateSchema, TaskListQuerySchema } from '@/lib/validation';
import { taskListWhere } from '@/lib/tasks';

export async function GET(req: NextRequest) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = TaskListQuerySchema.safeParse(params);
  if (!parsed.success) return badRequest('Invalid query', parsed.error.issues);

  const tasks = await prisma.task.findMany({
    where: taskListWhere(parsed.data),
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { attachments: true, comments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const json = await req.json().catch(() => null);
  const parsed = TaskCreateSchema.safeParse(json);
  if (!parsed.success) return badRequest('Invalid body', parsed.error.issues);

  const task = await prisma.task.create({
    data: { ...parsed.data, createdById: guard.session.user.id },
  });

  return NextResponse.json({ task }, { status: 201 });
}
