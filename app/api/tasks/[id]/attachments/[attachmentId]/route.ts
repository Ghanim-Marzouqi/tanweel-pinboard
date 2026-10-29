import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, notFound, forbidden, findVisibleTask } from '@/lib/api-auth';
import { canDeleteOwnedItem } from '@/lib/access';
import { removeObject } from '@/lib/storage';

type Params = { params: Promise<{ id: string; attachmentId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id, attachmentId } = await params;

  const task = await findVisibleTask(id, guard.session.user);
  if (!task) return notFound('Attachment not found');
  const attachment = await prisma.taskAttachment.findFirst({
    where: { id: attachmentId, taskId: id },
  });
  if (!attachment) return notFound('Attachment not found');
  if (!canDeleteOwnedItem(guard.session.user, task.project, attachment.uploadedById)) {
    return forbidden('Only the uploader, the project owner or an admin can remove this file');
  }

  await prisma.taskAttachment.delete({ where: { id: attachmentId } });
  await removeObject(attachment.storageKey).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
