import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  requireSession,
  badRequest,
  notFound,
  forbidden,
  findVisibleProject,
} from '@/lib/api-auth';
import { canManageProject } from '@/lib/access';

type Params = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id, userId } = await params;

  const project = await findVisibleProject(id, guard.session.user);
  if (!project) return notFound('Project not found');
  if (!canManageProject(guard.session.user, project)) {
    return forbidden('Only the project owner or an admin can remove members');
  }
  if (userId === project.ownerId) return badRequest('The project owner cannot be removed');

  // Someone who leaves a project can't stay assigned to its tasks.
  await prisma.$transaction([
    prisma.task.updateMany({ where: { projectId: id, assigneeId: userId }, data: { assigneeId: null } }),
    prisma.projectMember.deleteMany({ where: { projectId: id, userId } }),
  ]);
  return NextResponse.json({ ok: true });
}
