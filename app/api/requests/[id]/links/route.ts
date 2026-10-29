import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, badRequest } from '@/lib/api-auth';
import { mutateRequest, RequestLinkSchema, RequestError, requestErrorResponse } from '@/lib/requests';
import { descriptionFields } from '@/lib/html-text';
import { isoToDate } from '@/lib/dates';
import { notifyAssigned, notifySafely } from '@/lib/notify';
type Params = { params: Promise<{ id: string }> };
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const parsed = RequestLinkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Choose a task or provide valid task details');
  try {
    const result = await mutateRequest((await params).id, guard.session.user, async (tx, r) => {
      const input = parsed.data;
      let task;
      let created = false;
      if ('taskId' in input) {
        // Lock against moving/deleting the task while linking it.
        await tx.$queryRaw`SELECT id FROM tasks WHERE id = ${input.taskId}::uuid FOR UPDATE`;
        task = await tx.task.findFirst({ where: { id: input.taskId, projectId: r.projectId } });
        if (!task) throw new RequestError(400, 'Task must belong to this project');
      } else {
        const previous = await tx.requestTaskLink.findUnique({
          where: { creationKey: input.creationKey },
          include: { task: true },
        });
        if (previous) {
          if (previous.requestId !== r.id) throw new RequestError(409, 'Creation key already used');
          return { task: previous.task, created: false };
        }
        const { assigneeId, dueDate, ...fields } = input.task;
        if (
          assigneeId &&
          !(await tx.projectMember.findFirst({
            where: { projectId: r.projectId, userId: assigneeId, user: { isActive: true } },
          }))
        )
          throw new RequestError(400, 'Assignee must be an active project member');
        task = await tx.task.create({
          data: {
            ...fields,
            ...descriptionFields(fields.descriptionHtml),
            projectId: r.projectId,
            createdById: guard.session.user.id,
            assigneeId,
            dueDate: dueDate ? isoToDate(dueDate) : null,
          },
        });
        created = true;
      }
      const exists = await tx.requestTaskLink.findUnique({
        where: { requestId_taskId: { requestId: r.id, taskId: task.id } },
      });
      if (!exists) {
        await tx.requestTaskLink.create({
          data: {
            requestId: r.id,
            taskId: task.id,
            ...('creationKey' in input ? { creationKey: input.creationKey } : {}),
          },
        });
        await tx.requestActivity.create({
          data: { requestId: r.id, actorId: guard.session.user.id, kind: 'linked', body: task.title },
        });
      }
      return { task, created };
    });
    if (result.created && result.task.assigneeId)
      await notifySafely(notifyAssigned(result.task.id, result.task.assigneeId, guard.session.user));
    return NextResponse.json({ task: { id: result.task.id }, created: result.created });
  } catch (e) {
    return requestErrorResponse(e);
  }
}
export async function DELETE(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const parsed = z.object({ taskId: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid task');
  try {
    await mutateRequest((await params).id, guard.session.user, async (tx, r) => {
      const link = await tx.requestTaskLink.findUnique({
        where: { requestId_taskId: { requestId: r.id, taskId: parsed.data.taskId } },
        include: { task: true },
      });
      if (!link) return;
      await tx.requestTaskLink.delete({
        where: { requestId_taskId: { requestId: r.id, taskId: parsed.data.taskId } },
      });
      await tx.requestActivity.create({
        data: { requestId: r.id, actorId: guard.session.user.id, kind: 'unlinked', body: link.task.title },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return requestErrorResponse(e);
  }
}
