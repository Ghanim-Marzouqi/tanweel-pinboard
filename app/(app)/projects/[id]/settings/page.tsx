import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageProject, visibleProjectsWhere } from '@/lib/access';
import { ProjectSettings } from '@/components/project-settings';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectSettingsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, ...visibleProjectsWhere(session.user) },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, username: true, isActive: true } } },
        orderBy: { addedAt: 'asc' },
      },
      _count: { select: { tasks: true } },
    },
  });
  if (!project) notFound();
  if (!canManageProject(session.user, project)) redirect(`/projects/${project.id}`);

  const memberIds = project.members.map((m) => m.userId);
  const candidates = await prisma.user.findMany({
    where: { isActive: true, id: { notIn: memberIds } },
    select: { id: true, name: true, username: true },
    orderBy: { name: 'asc' },
  });

  return (
    <ProjectSettings
      currentUserId={session.user.id}
      project={{
        id: project.id,
        name: project.name,
        description: project.description,
        isArchived: project.isArchived,
        ownerId: project.ownerId,
        taskCount: project._count.tasks,
      }}
      members={project.members.map((m) => m.user)}
      candidates={candidates}
    />
  );
}
