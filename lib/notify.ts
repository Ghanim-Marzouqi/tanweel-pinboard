import { prisma } from '@/lib/prisma';
import { dateToIso } from '@/lib/dates';
import { enqueueEmails } from '@/lib/email/outbox';
import { assignedEmail, commentEmail, emailLocale, type TaskInfo } from '@/lib/email/templates';
import { extractMentions } from '@/lib/mentions';

/**
 * Who gets an email when:
 * - assigned: the new assignee (not when you assign yourself)
 * - comment: people @mentioned who can see the task, and the task's creator
 *   and assignee; never the comment's author, never twice for one comment.
 * Only active users with an email address receive anything.
 */

interface Actor {
  id: string;
  name: string;
}

const RECIPIENT = { id: true, email: true, locale: true } as const;

async function taskInfo(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      priority: true,
      dueDate: true,
      createdById: true,
      assigneeId: true,
      projectId: true,
      project: { select: { name: true } },
    },
  });
  if (!task) return null;
  const info: TaskInfo = {
    id: task.id,
    title: task.title,
    projectName: task.project.name,
    priority: task.priority,
    dueDate: task.dueDate ? dateToIso(task.dueDate) : null,
  };
  return { ...task, info };
}

export async function notifyAssigned(taskId: string, assigneeId: string, actor: Actor): Promise<void> {
  if (assigneeId === actor.id) return;
  const [user, task] = await Promise.all([
    prisma.user.findFirst({ where: { id: assigneeId, isActive: true, email: { not: null } }, select: RECIPIENT }),
    taskInfo(taskId),
  ]);
  if (!user?.email || !task) return;
  await enqueueEmails([assignedEmail(user.email, emailLocale(user.locale), actor.name, task.info)]);
}

export async function notifyComment(taskId: string, body: string, actor: Actor): Promise<void> {
  const task = await taskInfo(taskId);
  if (!task) return;

  const usernames = extractMentions(body);
  const mentioned = usernames.length
    ? await prisma.user.findMany({
        where: {
          username: { in: usernames },
          isActive: true,
          email: { not: null },
          id: { not: actor.id },
          // Only people who can see the task (members, or admins).
          OR: [{ role: 'admin' }, { memberships: { some: { projectId: task.projectId } } }],
        },
        select: RECIPIENT,
      })
    : [];

  const mentionedIds = new Set(mentioned.map((u) => u.id));
  const followerIds = [task.createdById, task.assigneeId].filter(
    (id): id is string => !!id && id !== actor.id && !mentionedIds.has(id),
  );
  const followers = followerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: followerIds }, isActive: true, email: { not: null } },
        select: RECIPIENT,
      })
    : [];

  await enqueueEmails([
    ...mentioned.map((u) => commentEmail(u.email!, emailLocale(u.locale), 'mention', actor.name, task.info, body)),
    ...followers.map((u) => commentEmail(u.email!, emailLocale(u.locale), 'comment', actor.name, task.info, body)),
  ]);
}

/** Notifications must never make the action that caused them fail. */
export function notifySafely(work: Promise<void>): Promise<void> {
  return work.catch((err) => {
    console.error('[notify] Could not queue notification:', err);
  });
}
