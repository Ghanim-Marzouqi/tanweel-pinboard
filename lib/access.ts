import type { Prisma } from '@prisma/client';
import type { Role } from '@/lib/roles';

/**
 * Who may do what. Every page and API route goes through these helpers so the
 * rules live in one place:
 *
 * - Admins see and manage every project.
 * - Members see projects they belong to; the project owner manages it
 *   (settings, members, archive).
 * - Archived projects are read-only for everyone.
 * - Deleting a task: its creator, the project owner or an admin.
 * - Deleting a comment or attachment: its author, the project owner or an admin.
 */

export interface Actor {
  id: string;
  role: Role;
}

export interface ProjectRef {
  ownerId: string;
  isArchived: boolean;
}

export function isAdmin(actor: Actor): boolean {
  return actor.role === 'admin';
}

/** Prisma filter for the projects an actor can see. */
export function visibleProjectsWhere(actor: Actor): Prisma.ProjectWhereInput {
  return isAdmin(actor) ? {} : { members: { some: { userId: actor.id } } };
}

/** Prisma filter for the tasks an actor can see. */
export function visibleTasksWhere(actor: Actor): Prisma.TaskWhereInput {
  return isAdmin(actor) ? {} : { project: visibleProjectsWhere(actor) };
}

export function canManageProject(actor: Actor, project: ProjectRef): boolean {
  return isAdmin(actor) || project.ownerId === actor.id;
}

/** Creating, editing and commenting on tasks: any member, unless archived. */
export function canWriteInProject(project: ProjectRef): boolean {
  return !project.isArchived;
}

/** Deleting a task, comment or attachment that `authorId` created. */
export function canDeleteOwnedItem(actor: Actor, project: ProjectRef, authorId: string): boolean {
  if (project.isArchived) return false;
  return authorId === actor.id || canManageProject(actor, project);
}
