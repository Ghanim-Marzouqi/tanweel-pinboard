import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { mutateRequest, requestErrorResponse, RequestError } from '@/lib/requests';
import { removeObject } from '@/lib/storage';
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id, attachmentId } = await params;
  try {
    const key = await mutateRequest(id, guard.session.user, async (tx, r) => {
      const a = await tx.requestAttachment.findFirst({ where: { id: attachmentId, requestId: r.id } });
      if (!a) throw new RequestError(404, 'Attachment not found');
      if (guard.session.user.role !== 'admin' && a.uploadedById !== guard.session.user.id)
        throw new RequestError(403, 'Only the uploader or an admin can remove this file');
      await tx.requestAttachment.delete({ where: { id: a.id } });
      await tx.requestActivity.create({
        data: { requestId: r.id, actorId: guard.session.user.id, kind: 'removedFile', body: a.fileName },
      });
      return a.storageKey;
    });
    await removeObject(key);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return requestErrorResponse(e);
  }
}
