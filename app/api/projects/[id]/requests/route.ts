import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, findVisibleProject, notFound, badRequest } from '@/lib/api-auth';
import {
  RequestCreateSchema,
  RequestQuerySchema,
  visibleRequestsWhere,
  RequestError,
  requestErrorResponse,
} from '@/lib/requests';

type Params = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!(await findVisibleProject(id, guard.session.user))) return notFound('Project not found');
  const parsed = RequestQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return badRequest('Invalid query');
  const { page, q, status, categoryId } = parsed.data;
  const where = {
    projectId: id,
    ...visibleRequestsWhere(guard.session.user),
    status,
    categoryId,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { description: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [requests, total] = await Promise.all([
    prisma.workRequest.findMany({
      where,
      include: {
        category: true,
        createdBy: { select: { name: true } },
        _count: { select: { taskLinks: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      skip: (page - 1) * 30,
    }),
    prisma.workRequest.count({ where }),
  ]);
  return NextResponse.json({ requests, total, page, pageSize: 30 });
}
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const project = await findVisibleProject(id, guard.session.user);
  if (!project) return notFound('Project not found');
  const parsed = RequestCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid request', parsed.error.issues);
  try {
    const request = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${id}::uuid FOR SHARE`;
      if ((await tx.project.findUniqueOrThrow({ where: { id } })).isArchived)
        throw new RequestError(403, 'Project is archived');
      await tx.$queryRaw`SELECT id FROM request_categories WHERE id = ${parsed.data.categoryId}::uuid FOR SHARE`;
      if (!(await tx.requestCategory.findFirst({ where: { id: parsed.data.categoryId, isArchived: false } })))
        throw new RequestError(400, 'Choose an active category');
      return tx.workRequest.create({
        data: {
          ...parsed.data,
          occurredAt: new Date(parsed.data.occurredAt),
          projectId: id,
          createdById: guard.session.user.id,
        },
      });
    });
    return NextResponse.json({ request }, { status: 201 });
  } catch (e) {
    return requestErrorResponse(e);
  }
}
