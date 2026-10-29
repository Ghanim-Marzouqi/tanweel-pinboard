import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, badRequest, notFound, forbidden, findVisibleTask } from '@/lib/api-auth';
import { canWriteInProject } from '@/lib/access';
import { CommentCreateSchema } from '@/lib/validation';
import { COMMENT_INCLUDE } from '@/lib/tasks';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const task = await findVisibleTask(id, guard.session.user);
  if (!task) return notFound('Task not found');

  const comments = await prisma.taskComment.findMany({
    where: { taskId: id },
    include: COMMENT_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const task = await findVisibleTask(id, guard.session.user);
  if (!task) return notFound('Task not found');
  if (!canWriteInProject(task.project)) return forbidden('Project is archived');

  const json = await req.json().catch(() => null);
  const parsed = CommentCreateSchema.safeParse(json);
  if (!parsed.success) return badRequest('Invalid body', parsed.error.issues);

  const comment = await prisma.taskComment.create({
    data: {
      taskId: id,
      body: parsed.data.body,
      authorId: guard.session.user.id,
    },
    include: COMMENT_INCLUDE,
  });
  return NextResponse.json({ comment }, { status: 201 });
}
