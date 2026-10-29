import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RequestError, requestErrorResponse } from '@/lib/requests';
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
import { notifyAssigned, notifySafely } from '@/lib/notify';
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

  let task;
  try {
    task = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tasks WHERE id = ${id}::uuid FOR UPDATE`;
      if (projectId !== existing.project.id && (await tx.requestTaskLink.count({ where: { taskId: id } }))) {
        throw new RequestError(409, 'Ask an admin to unlink requests before moving this task');
      }
      return tx.task.update({
        where: { id },
        data: {
          ...fields,
          ...(fields.descriptionHtml !== undefined ? descriptionFields(fields.descriptionHtml) : {}),
          ...(dueDate !== undefined ? { dueDate: dueDate ? isoToDate(dueDate) : null } : {}),
          ...(nextAssignee !== existing.assigneeId ? { assigneeId: nextAssignee } : {}),
          ...(projectId !== existing.project.id ? { projectId } : {}),
        },
      });
    });
  } catch (e) {
    return requestErrorResponse(e);
  }
  if (nextAssignee && nextAssignee !== existing.assigneeId) {
    await notifySafely(notifyAssigned(task.id, nextAssignee, guard.session.user));
  }
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

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tasks WHERE id = ${id}::uuid FOR UPDATE`;
      if (await tx.requestTaskLink.count({ where: { taskId: id } }))
        throw new RequestError(409, 'Ask an admin to unlink requests before deleting this task');
      await tx.task.delete({ where: { id } });
    });
  } catch (e) {
    return requestErrorResponse(e);
  }
  // Best-effort cleanup of stored files (DB cascade has already removed rows).
  await removeFolder(`${id}/`).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
