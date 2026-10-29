import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, notFound } from '@/lib/api-auth';
import { removeObject } from '@/lib/minio';

type Params = { params: Promise<{ id: string; attachmentId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id, attachmentId } = await params;

  const attachment = await prisma.taskAttachment.findFirst({
    where: { id: attachmentId, taskId: id },
  });
  if (!attachment) return notFound('Attachment not found');

  await prisma.taskAttachment.delete({ where: { id: attachmentId } });
  await removeObject(attachment.storageKey).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
