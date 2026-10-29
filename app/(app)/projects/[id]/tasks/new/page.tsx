import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canWriteInProject, visibleProjectsWhere } from '@/lib/access';
import { TaskForm } from '@/components/task-form';
import { projectPeople } from '@/lib/tasks';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NewTaskPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, ...visibleProjectsWhere(session.user) },
    select: { id: true, name: true, isArchived: true, ownerId: true },
  });
  if (!project) notFound();
  if (!canWriteInProject(project)) redirect(`/projects/${project.id}`);

  const people = await projectPeople(project.id);

  return <TaskForm mode="create" project={{ id: project.id, name: project.name }} people={people} />;
}
