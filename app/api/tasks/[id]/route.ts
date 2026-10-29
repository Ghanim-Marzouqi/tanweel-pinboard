import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, badRequest, notFound, forbidden, isAdmin } from '@/lib/api-auth';
import { TaskUpdateSchema } from '@/lib/validation';
import { removeFolder } from '@/lib/minio';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      attachments: { orderBy: { uploadedAt: 'asc' } },
    },
  });
  if (!task) return notFound('Task not found');
  return NextResponse.json({ task });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = TaskUpdateSchema.safeParse(json);
  if (!parsed.success) return badRequest('Invalid body', parsed.error.issues);

  const existing = await prisma.task.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return notFound('Task not found');

  const task = await prisma.task.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json({ task });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const existing = await prisma.task.findUnique({ where: { id }, select: { createdById: true } });
  if (!existing) return notFound('Task not found');
  if (existing.createdById !== guard.session.user.id && !isAdmin(guard.session)) {
    return forbidden('Only the creator or an admin can delete this task');
  }

  await prisma.task.delete({ where: { id } });
  // Best-effort cleanup of stored files (DB cascade has already removed rows).
  await removeFolder(`${id}/`).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
