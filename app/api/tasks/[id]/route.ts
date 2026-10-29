import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  requireSession,
  badRequest,
  notFound,
  forbidden,
  findVisibleProject,
  findVisibleTask,
} from '@/lib/api-auth';
import { canDeleteOwnedItem, canWriteInProject } from '@/lib/access';
import { isoToDate } from '@/lib/dates';
import { descriptionFields } from '@/lib/html-text';
import { isProjectMember } from '@/lib/tasks';
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

  const { projectId: targetId, dueDate, assigneeId, ...fields } = parsed.data;

  const existing = await findVisibleTask(id, guard.session.user);
  if (!existing) return notFound('Task not found');
  if (!canWriteInProject(existing.project)) return forbidden('Project is archived');

  // Moving to another project: it must be visible to the user and writable.
  let projectId = existing.project.id;
  if (targetId && targetId !== projectId) {
    const target = await findVisibleProject(targetId, guard.session.user);
    if (!target) return notFound('Project not found');
    if (!canWriteInProject(target)) return forbidden('Project is archived');
    projectId = target.id;
  }

  // The assignee must be a member of the task's (new) project. A newly
  // picked outsider is an error; an existing assignee left behind by a move
  // is simply unassigned.
  const assigneeChanged = assigneeId !== undefined && assigneeId !== existing.assigneeId;
  let nextAssignee = assigneeChanged ? assigneeId : existing.assigneeId;
  let unassigned = false;
  if (nextAssignee && !(await isProjectMember(projectId, nextAssignee))) {
    if (assigneeChanged) return badRequest('The assignee must be a member of the project');
    nextAssignee = null;
    unassigned = true;
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...fields,
      ...(fields.descriptionHtml !== undefined ? descriptionFields(fields.descriptionHtml) : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ? isoToDate(dueDate) : null } : {}),
      ...(nextAssignee !== existing.assigneeId ? { assigneeId: nextAssignee } : {}),
      ...(projectId !== existing.project.id ? { projectId } : {}),
    },
  });
  return NextResponse.json({ task, unassigned });
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
