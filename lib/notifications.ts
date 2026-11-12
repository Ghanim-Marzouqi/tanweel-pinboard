import type { Prisma } from '@prisma/client';
import { type Actor, visibleTasksWhere } from '@/lib/access';
import { visibleRequestsWhere } from '@/lib/requests';
import { extractMentions } from '@/lib/mentions';

/** Apply current access on every read/count/update; historic notifications grant no access. */
export function visibleNotificationsWhere(actor: Actor): Prisma.NotificationWhereInput {
  return {
    recipientId: actor.id,
    OR: [{ request: { is: visibleRequestsWhere(actor) } }, { task: { is: visibleTasksWhere(actor) } }],
  };
}

type Event = { actorId: string; eventKey: string; fromStatus?: string; toStatus?: string };
/** Call inside the mutation transaction: notification creation and the event commit together. */
export async function notifyRequestInApp(
  tx: Prisma.TransactionClient,
  request: {
    id: string;
    createdById: string;
    projectId: string;
  },
  event: Event & { kind: 'RequestComment' | 'RequestStatus' },
) {
  const recipients = await tx.user.findMany({
    where: {
      isActive: true,
      id: { not: event.actorId },
      OR:
        event.kind === 'RequestComment'
          ? [
              { role: 'admin' },
              { id: request.createdById, memberships: { some: { projectId: request.projectId } } },
            ]
          : [
              {
                id: request.createdById,
                OR: [{ role: 'admin' }, { memberships: { some: { projectId: request.projectId } } }],
              },
            ],
    },
    select: { id: true },
  });
  await tx.notification.createMany({
    data: recipients.map((user) => ({ ...event, recipientId: user.id, requestId: request.id })),
    skipDuplicates: true,
  });
}

export async function notifyTaskInApp(
  tx: Prisma.TransactionClient,
  task: {
    id: string;
    createdById: string;
    assigneeId: string | null;
    projectId: string;
  },
  event: Event & { kind: 'TaskComment' | 'TaskStatus' },
  commentBody = '',
) {
  const people: Prisma.UserWhereInput[] = [
    { id: { in: [task.createdById, task.assigneeId].filter((id): id is string => !!id) } },
    { comments: { some: { taskId: task.id } } },
  ];
  if (event.kind === 'TaskComment') people.push({ username: { in: extractMentions(commentBody) } });
  const recipients = await tx.user.findMany({
    where: {
      isActive: true,
      id: { not: event.actorId },
      AND: [
        { OR: people },
        { OR: [{ role: 'admin' }, { memberships: { some: { projectId: task.projectId } } }] },
      ],
    },
    select: { id: true },
  });
  await tx.notification.createMany({
    data: recipients.map((user) => ({ ...event, recipientId: user.id, taskId: task.id })),
    skipDuplicates: true,
  });
}
