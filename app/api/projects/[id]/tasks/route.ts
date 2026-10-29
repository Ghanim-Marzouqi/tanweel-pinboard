import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, badRequest, notFound, forbidden, findVisibleProject } from '@/lib/api-auth';
import { canWriteInProject } from '@/lib/access';
import { isoToDate } from '@/lib/dates';
import { descriptionFields } from '@/lib/html-text';
import { notifyAssigned, notifySafely } from '@/lib/notify';
import {
  isProjectMember,
  PAGE_SIZE,
  TASK_SUMMARY_SELECT,
  taskFilterWhere,
  taskOrderBy,
  toTaskSummary,
} from '@/lib/tasks';
import { TaskFormSchema, TaskListQuerySchema } from '@/lib/validation';

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
  const filters = parsed.data;

  const where = {
    projectId: project.id,
    ...taskFilterWhere(filters, { userId: guard.session.user.id }),
  };
  const [total, rows] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      select: TASK_SUMMARY_SELECT,
      orderBy: taskOrderBy(filters.sort),
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return NextResponse.json({
    tasks: rows.map(toTaskSummary),
    page: filters.page,
    pageSize: PAGE_SIZE,
    total,
  });
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
  const { dueDate, assigneeId, ...fields } = parsed.data;

  if (assigneeId && !(await isProjectMember(project.id, assigneeId))) {
    return badRequest('The assignee must be a member of the project');
  }

  const task = await prisma.task.create({
    data: {
      ...fields,
      ...descriptionFields(fields.descriptionHtml),
      dueDate: dueDate ? isoToDate(dueDate) : null,
      assigneeId,
      projectId: project.id,
      createdById: guard.session.user.id,
    },
  });
  if (assigneeId) await notifySafely(notifyAssigned(task.id, assigneeId, guard.session.user));

  return NextResponse.json({ task }, { status: 201 });
}
