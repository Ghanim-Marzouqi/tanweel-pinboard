import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, notFound, findVisibleTask } from '@/lib/api-auth';
import { attachmentResponse } from '@/lib/attachment-response';

type Params = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id, attachmentId } = await params;

  const task = await findVisibleTask(id, guard.session.user);
  if (!task) return notFound('Attachment not found');
  const attachment = await prisma.taskAttachment.findFirst({
    where: { id: attachmentId, taskId: id },
  });
  if (!attachment) return notFound('Attachment not found');

  return attachmentResponse(req, attachment);
}

export const HEAD = GET;
