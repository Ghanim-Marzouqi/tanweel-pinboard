import type { Prisma } from '@prisma/client';
import type { TaskStatus } from '@/lib/validation';

/** Shared filter for a project's task list page and `GET /api/projects/[id]/tasks`. */
export function taskListWhere(
  projectId: string,
  filters: { status?: TaskStatus; q?: string },
): Prisma.TaskWhereInput {
  return {
    projectId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q ? { title: { contains: filters.q, mode: 'insensitive' } } : {}),
  };
}

/** Author fields returned with every comment. */
export const COMMENT_INCLUDE = {
  author: { select: { id: true, name: true, role: true } },
} as const;
