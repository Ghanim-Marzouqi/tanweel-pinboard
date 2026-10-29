import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isAdmin, visibleProjectsWhere, type Actor } from '@/lib/access';
export * from '@/lib/request-validation';

export function visibleRequestsWhere(actor: Actor): Prisma.WorkRequestWhereInput {
  return { project: visibleProjectsWhere(actor), ...(isAdmin(actor) ? {} : { createdById: actor.id }) };
}
export const requestInclude = {
  category: true,
  createdBy: { select: { name: true } },
  project: { select: { id: true, name: true, isArchived: true } },
  taskLinks: {
    include: { task: { select: { id: true, title: true, status: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  attachments: {
    select: { id: true, fileName: true, sizeBytes: true, uploadedById: true },
    orderBy: { uploadedAt: 'asc' as const },
  },
  activities: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.WorkRequestInclude;
export function findVisibleRequest(id: string, actor: Actor) {
  if (!z.uuid().safeParse(id).success) return Promise.resolve(null);
  return prisma.workRequest.findFirst({
    where: { id, ...visibleRequestsWhere(actor) },
    include: requestInclude,
  });
}
export class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
/** Serialize review/link mutations, and hold the project against concurrent archiving. */
export async function mutateRequest<T>(
  id: string,
  actor: Actor,
  action: (
    tx: Prisma.TransactionClient,
    request: NonNullable<Awaited<ReturnType<typeof findVisibleRequest>>>,
  ) => Promise<T>,
  allowClosed = false,
) {
  if (!z.uuid().safeParse(id).success) throw new RequestError(404, 'Request not found');
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM work_requests WHERE id = ${id}::uuid FOR UPDATE`;
    const request = await tx.workRequest.findFirst({
      where: { id, ...visibleRequestsWhere(actor) },
      include: requestInclude,
    });
    if (!request) throw new RequestError(404, 'Request not found');
    await tx.$queryRaw`SELECT id FROM projects WHERE id = ${request.projectId}::uuid FOR SHARE`;
    const project = await tx.project.findUniqueOrThrow({ where: { id: request.projectId } });
    if (project.isArchived) throw new RequestError(403, 'Project is archived');
    if (!allowClosed && request.status === 'Closed')
      throw new RequestError(409, 'Reopen the request before making changes');
    return action(tx, request);
  });
}
export function requestErrorResponse(error: unknown): Response {
  if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
    return Response.json({ error: 'This name or link already exists' }, { status: 409 });
  throw error;
}
