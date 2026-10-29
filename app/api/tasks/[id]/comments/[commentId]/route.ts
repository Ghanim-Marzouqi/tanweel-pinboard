import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, badRequest, notFound, forbidden, findVisibleTask } from '@/lib/api-auth';
import { canDeleteOwnedItem, canWriteInProject, type Actor } from '@/lib/access';
import { CommentUpdateSchema } from '@/lib/validation';
import { COMMENT_INCLUDE } from '@/lib/tasks';

type Params = { params: Promise<{ id: string; commentId: string }> };

async function load(taskId: string, commentId: string, actor: Actor) {
  const task = await findVisibleTask(taskId, actor);
  if (!task) return null;
  const comment = await prisma.taskComment.findFirst({ where: { id: commentId, taskId } });
  return comment ? { task, comment } : null;
}

export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id, commentId } = await params;

  const found = await load(id, commentId, guard.session.user);
  if (!found) return notFound('Comment not found');
  if (!canWriteInProject(found.task.project)) return forbidden('Project is archived');
  if (found.comment.authorId !== guard.session.user.id) {
    return forbidden('You can only edit your own comments');
  }

  const json = await req.json().catch(() => null);
  const parsed = CommentUpdateSchema.safeParse(json);
  if (!parsed.success) return badRequest('Invalid body', parsed.error.issues);

  const comment = await prisma.taskComment.update({
    where: { id: commentId },
    data: { body: parsed.data.body },
    include: COMMENT_INCLUDE,
  });
  return NextResponse.json({ comment });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id, commentId } = await params;

  const found = await load(id, commentId, guard.session.user);
  if (!found) return notFound('Comment not found');
  if (!canDeleteOwnedItem(guard.session.user, found.task.project, found.comment.authorId)) {
    return forbidden('Only the author, the project owner or an admin can delete this comment');
  }

  await prisma.taskComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
