import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin, visibleProjectsWhere, visibleTasksWhere, type Actor } from '@/lib/access';

type AuthedSession = Session & { user: NonNullable<Session['user']> };

export async function requireSession(): Promise<
  { ok: true; session: AuthedSession } | { ok: false; response: NextResponse }
> {
  const session = (await auth()) as Session | null;
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { ok: true, session: session as AuthedSession };
}

export async function requireAdmin(): Promise<
  { ok: true; session: AuthedSession } | { ok: false; response: NextResponse }
> {
  const guard = await requireSession();
  if (guard.ok && !isAdmin(guard.session.user)) {
    return { ok: false, response: forbidden('Admins only') };
  }
  return guard;
}

/** A project the actor can see, or null (callers answer 404 so ids don't leak). */
export function findVisibleProject(projectId: string, actor: Actor) {
  return prisma.project.findFirst({
    where: { id: projectId, ...visibleProjectsWhere(actor) },
    select: { id: true, ownerId: true, isArchived: true },
  });
}

/** A task the actor can see, with the access fields of its project. */
export function findVisibleTask(taskId: string, actor: Actor) {
  return prisma.task.findFirst({
    where: { id: taskId, ...visibleTasksWhere(actor) },
    select: {
      id: true,
      createdById: true,
      assigneeId: true,
      project: { select: { id: true, ownerId: true, isArchived: true } },
    },
  });
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}
