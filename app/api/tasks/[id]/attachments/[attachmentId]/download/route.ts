import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, notFound, findVisibleTask } from '@/lib/api-auth';
import { getObjectStream } from '@/lib/minio';
import { Readable } from 'node:stream';

type Params = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id, attachmentId } = await params;

  const task = await findVisibleTask(id, guard.session.user);
  if (!task) return notFound('Attachment not found');
  const attachment = await prisma.taskAttachment.findFirst({
    where: { id: attachmentId, taskId: id },
  });
  if (!attachment) return notFound('Attachment not found');

  const stream = await getObjectStream(attachment.storageKey);
  const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    headers: {
      'Content-Type': attachment.contentType,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      'Content-Length': String(attachment.sizeBytes),
      'Cache-Control': 'private, max-age=0, no-store',
    },
  });
}
