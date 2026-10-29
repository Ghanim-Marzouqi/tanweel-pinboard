import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireSession, badRequest } from '@/lib/api-auth';
import { mutateRequest, requestErrorResponse } from '@/lib/requests';
import { putObject, removeObject, safeExtension } from '@/lib/storage';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '@/lib/validation';
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || !file.size) return badRequest('Choose a nonempty file');
  if (file.size > MAX_UPLOAD_BYTES) return badRequest('File too large (max 10 MB)');
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type as (typeof ALLOWED_UPLOAD_TYPES)[number]))
    return badRequest('Unsupported file type');
  const storageKey = `requests/${id}/${randomUUID()}${safeExtension(file.name, file.type)}`;
  let written = false;
  try {
    const attachment = await mutateRequest(id, guard.session.user, async (tx, r) => {
      await putObject(storageKey, Buffer.from(await file.arrayBuffer()));
      written = true;
      const a = await tx.requestAttachment.create({
        data: {
          requestId: r.id,
          uploadedById: guard.session.user.id,
          storageKey,
          fileName: file.name.slice(0, 255),
          sizeBytes: file.size,
          contentType: file.type,
        },
      });
      await tx.requestActivity.create({
        data: { requestId: r.id, actorId: guard.session.user.id, kind: 'uploaded', body: a.fileName },
      });
      return { id: a.id, fileName: a.fileName, sizeBytes: a.sizeBytes };
    });
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (e) {
    if (written) await removeObject(storageKey);
    return requestErrorResponse(e);
  }
}
