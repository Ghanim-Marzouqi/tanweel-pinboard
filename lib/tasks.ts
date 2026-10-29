import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { dateToIso, endOfWeek, isoToDate, todayIso } from '@/lib/dates';
import type { TaskListQuery, TaskPriority, TaskStatus } from '@/lib/validation';

export const PAGE_SIZE = 25;
/** The board shows every matching task; this only guards against runaway projects. */
export const BOARD_LIMIT = 500;

type Filters = Partial<Pick<TaskListQuery, 'status' | 'priority' | 'assignee' | 'due' | 'q'>>;

/** Prisma filter for the list/board filters (shared by pages and the API). */
export function taskFilterWhere(
  filters: Filters,
  ctx: { userId: string; today?: string },
): Prisma.TaskWhereInput {
  const today = ctx.today ?? todayIso();
  const and: Prisma.TaskWhereInput[] = [];

  if (filters.status) and.push({ status: filters.status });
  if (filters.priority) and.push({ priority: filters.priority });

  if (filters.assignee === 'me') and.push({ assigneeId: ctx.userId });
  else if (filters.assignee === 'none') and.push({ assigneeId: null });
  else if (filters.assignee) and.push({ assigneeId: filters.assignee });

  switch (filters.due) {
    case 'overdue':
      and.push({ dueDate: { lt: isoToDate(today) }, status: { not: 'Done' } });
      break;
    case 'today':
      and.push({ dueDate: isoToDate(today) });
      break;
    case 'week':
      and.push({ dueDate: { gte: isoToDate(today), lte: isoToDate(endOfWeek(today)) } });
      break;
    case 'none':
      and.push({ dueDate: null });
      break;
  }

  if (filters.q) {
    and.push({
      OR: [
        { title: { contains: filters.q, mode: 'insensitive' } },
        { descriptionText: { contains: filters.q, mode: 'insensitive' } },
      ],
    });
  }

  return and.length ? { AND: and } : {};
}

export function taskOrderBy(sort: TaskListQuery['sort']): Prisma.TaskOrderByWithRelationInput[] {
  const dueFirst: Prisma.TaskOrderByWithRelationInput = { dueDate: { sort: 'asc', nulls: 'last' } };
  switch (sort) {
    case 'due':
      return [dueFirst, { priority: 'desc' }, { createdAt: 'desc' }];
    case 'priority':
      return [{ priority: 'desc' }, dueFirst, { createdAt: 'desc' }];
    default:
      return [{ createdAt: 'desc' }];
  }
}

/** Fields shown in the list, on the board and in My tasks. */
export const TASK_SUMMARY_SELECT = {
  id: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  checklistTotal: true,
  checklistDone: true,
  createdAt: true,
  assignee: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  _count: { select: { attachments: true, comments: true } },
} satisfies Prisma.TaskSelect;

type TaskSummaryRow = Prisma.TaskGetPayload<{ select: typeof TASK_SUMMARY_SELECT }>;

/** JSON-safe task summary for client components. */
export interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  checklistTotal: number;
  checklistDone: number;
  createdAt: string;
  assignee: { id: string; name: string } | null;
  project: { id: string; name: string };
  attachments: number;
  comments: number;
}

export function toTaskSummary(row: TaskSummaryRow): TaskSummary {
  return {
    id: row.id,
    title: row.title,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    dueDate: row.dueDate ? dateToIso(row.dueDate) : null,
    checklistTotal: row.checklistTotal,
    checklistDone: row.checklistDone,
    createdAt: row.createdAt.toISOString(),
    assignee: row.assignee,
    project: row.project,
    attachments: row._count.attachments,
    comments: row._count.comments,
  };
}

export async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { userId: true },
  });
  return member !== null;
}

/** Active members of a project, for the assignee picker and filter. */
export function projectPeople(projectId: string) {
  return prisma.user.findMany({
    where: { isActive: true, memberships: { some: { projectId } } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

/** Author fields returned with every comment. */
export const COMMENT_INCLUDE = {
  author: { select: { id: true, name: true, role: true } },
} as const;
