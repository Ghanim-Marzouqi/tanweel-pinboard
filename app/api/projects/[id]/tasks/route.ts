import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, badRequest, notFound, forbidden, findVisibleProject } from '@/lib/api-auth';
import { canWriteInProject } from '@/lib/access';
import { TaskFormSchema, TaskListQuerySchema } from '@/lib/validation';
import { taskListWhere } from '@/lib/tasks';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const project = await findVisibleProject(id, guard.session.user);
  if (!project) return notFound('Project not found');

  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = TaskListQuerySchema.safeParse(query);
  if (!parsed.success) return badRequest('Invalid query', parsed.error.issues);

  const tasks = await prisma.task.findMany({
    where: taskListWhere(project.id, parsed.data),
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { attachments: true, comments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const project = await findVisibleProject(id, guard.session.user);
  if (!project) return notFound('Project not found');
  if (!canWriteInProject(project)) return forbidden('Project is archived');

  const json = await req.json().catch(() => null);
  const parsed = TaskFormSchema.safeParse(json);
  if (!parsed.success) return badRequest('Invalid body', parsed.error.issues);

  const task = await prisma.task.create({
    data: { ...parsed.data, projectId: project.id, createdById: guard.session.user.id },
  });

  return NextResponse.json({ task }, { status: 201 });
}
