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
import { ProjectMemberAddSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

const MEMBER_USER = { select: { id: true, name: true, username: true, isActive: true } } as const;

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const project = await findVisibleProject(id, guard.session.user);
  if (!project) return notFound('Project not found');

  const members = await prisma.projectMember.findMany({
    where: { projectId: id },
    include: { user: MEMBER_USER },
    orderBy: { addedAt: 'asc' },
  });
  return NextResponse.json({ members });
}

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const project = await findVisibleProject(id, guard.session.user);
  if (!project) return notFound('Project not found');
  if (!canManageProject(guard.session.user, project)) {
    return forbidden('Only the project owner or an admin can add members');
  }

  const json = await req.json().catch(() => null);
  const parsed = ProjectMemberAddSchema.safeParse(json);
  if (!parsed.success) return badRequest('Invalid body', parsed.error.issues);

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { isActive: true },
  });
  if (!user?.isActive) return badRequest('User not found or deactivated');

  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: id, userId: parsed.data.userId } },
    create: { projectId: id, userId: parsed.data.userId },
    update: {},
    include: { user: MEMBER_USER },
  });
  return NextResponse.json({ member }, { status: 201 });
}
