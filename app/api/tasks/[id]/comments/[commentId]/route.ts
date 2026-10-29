import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, badRequest, notFound, forbidden, isAdmin } from '@/lib/api-auth';
import { CommentUpdateSchema } from '@/lib/validation';
import { COMMENT_INCLUDE } from '@/lib/tasks';

type Params = { params: Promise<{ id: string; commentId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id, commentId } = await params;

  const existing = await prisma.taskComment.findFirst({
    where: { id: commentId, taskId: id },
  });
  if (!existing) return notFound('Comment not found');
  if (existing.authorId !== guard.session.user.id) return forbidden('You can only edit your own comments');

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

  const existing = await prisma.taskComment.findFirst({
    where: { id: commentId, taskId: id },
  });
  if (!existing) return notFound('Comment not found');
  if (existing.authorId !== guard.session.user.id && !isAdmin(guard.session)) {
    return forbidden('You can only delete your own comments');
  }

  await prisma.taskComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
