import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { requireSession, badRequest, notFound, forbidden, findVisibleTask } from '@/lib/api-auth';
import { canWriteInProject } from '@/lib/access';
import { putObject } from '@/lib/minio';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

function fileExtension(name: string, mime: string): string {
  const dot = name.lastIndexOf('.');
  if (dot >= 0 && dot < name.length - 1) return name.slice(dot);
  if (mime === 'application/pdf') return '.pdf';
  if (mime.startsWith('image/')) return `.${mime.split('/')[1]}`;
  return '';
}

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const task = await findVisibleTask(id, guard.session.user);
  if (!task) return notFound('Task not found');
  if (!canWriteInProject(task.project)) return forbidden('Project is archived');

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return badRequest('Missing file');
  if (file.size === 0) return badRequest('Empty file');
  if (file.size > MAX_UPLOAD_BYTES) return badRequest('File too large (max 10 MB)');
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type as (typeof ALLOWED_UPLOAD_TYPES)[number])) {
    return badRequest('Unsupported file type');
  }

  const ext = fileExtension(file.name, file.type);
  const storageKey = `${id}/${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await putObject(storageKey, buffer, file.type);

  const attachment = await prisma.taskAttachment.create({
    data: {
      taskId: id,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      storageKey,
      uploadedById: guard.session.user.id,
    },
  });

  return NextResponse.json({ attachment }, { status: 201 });
}
