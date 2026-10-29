import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, badRequest, notFound, forbidden, findVisibleTask } from '@/lib/api-auth';
import { canDeleteOwnedItem, canWriteInProject } from '@/lib/access';
import { TaskUpdateSchema } from '@/lib/validation';
import { removeFolder } from '@/lib/storage';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const visible = await findVisibleTask(id, guard.session.user);
  if (!visible) return notFound('Task not found');

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      attachments: { orderBy: { uploadedAt: 'asc' } },
    },
  });
  return NextResponse.json({ task });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = TaskUpdateSchema.safeParse(json);
  if (!parsed.success) return badRequest('Invalid body', parsed.error.issues);

  const existing = await findVisibleTask(id, guard.session.user);
  if (!existing) return notFound('Task not found');
  if (!canWriteInProject(existing.project)) return forbidden('Project is archived');

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

  const existing = await findVisibleTask(id, guard.session.user);
  if (!existing) return notFound('Task not found');
  if (!canDeleteOwnedItem(guard.session.user, existing.project, existing.createdById)) {
    return forbidden('Only the creator, the project owner or an admin can delete this task');
  }

  await prisma.task.delete({ where: { id } });
  // Best-effort cleanup of stored files (DB cascade has already removed rows).
  await removeFolder(`${id}/`).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
