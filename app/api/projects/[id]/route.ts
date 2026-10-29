import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  requireSession,
  badRequest,
  notFound,
  forbidden,
  conflict,
  findVisibleProject,
} from '@/lib/api-auth';
import { canManageProject } from '@/lib/access';
import { ProjectUpdateSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const visible = await findVisibleProject(id, guard.session.user);
  if (!visible) return notFound('Project not found');

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { tasks: true, members: true } },
    },
  });
  return NextResponse.json({ project });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = ProjectUpdateSchema.safeParse(json);
  if (!parsed.success) return badRequest('Invalid body', parsed.error.issues);

  const existing = await findVisibleProject(id, guard.session.user);
  if (!existing) return notFound('Project not found');
  if (!canManageProject(guard.session.user, existing)) {
    return forbidden('Only the project owner or an admin can change the project');
  }

  const project = await prisma.project.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ project });
}

/** Only empty projects can be deleted; archive projects that have tasks. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const existing = await findVisibleProject(id, guard.session.user);
  if (!existing) return notFound('Project not found');
  if (!canManageProject(guard.session.user, existing)) {
    return forbidden('Only the project owner or an admin can delete the project');
  }

  const taskCount = await prisma.task.count({ where: { projectId: id } });
  if (taskCount > 0) return conflict('Project still has tasks; archive it instead');

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
