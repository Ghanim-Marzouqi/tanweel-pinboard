import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  canDeleteOwnedItem,
  canManageProject,
  canWriteInProject,
  visibleProjectsWhere,
  visibleTasksWhere,
} from '@/lib/access';
import { dateToIso } from '@/lib/dates';
import { projectPeople } from '@/lib/tasks';
import { TaskForm } from '@/components/task-form';
import type { TaskPriority, TaskStatus } from '@/lib/validation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const { id } = await params;

  const task = await prisma.task.findFirst({
    where: { id, ...visibleTasksWhere(session.user) },
    include: {
      project: { select: { id: true, name: true, ownerId: true, isArchived: true } },
      createdBy: { select: { name: true } },
      assignee: { select: { id: true, name: true } },
      attachments: { orderBy: { uploadedAt: 'asc' } },
    },
  });
  if (!task) notFound();

  const { project } = task;
  const [people, moveTargets] = await Promise.all([
    projectPeople(project.id),
    prisma.project.findMany({
      where: { ...visibleProjectsWhere(session.user), isArchived: false, id: { not: project.id } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <TaskForm
      mode="edit"
      project={{ id: project.id, name: project.name }}
      readOnly={!canWriteInProject(project)}
      canDelete={canDeleteOwnedItem(session.user, project, task.createdById)}
      canModerate={canManageProject(session.user, project)}
      people={people}
      moveTargets={moveTargets}
      initial={{
        id: task.id,
        title: task.title,
        descriptionHtml: task.descriptionHtml,
        status: task.status as TaskStatus,
        priority: task.priority as TaskPriority,
        dueDate: task.dueDate ? dateToIso(task.dueDate) : null,
        assignee: task.assignee,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        createdByName: task.createdBy.name,
        attachments: task.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          contentType: a.contentType,
          sizeBytes: a.sizeBytes,
          uploadedAt: a.uploadedAt.toISOString(),
          uploadedById: a.uploadedById,
        })),
      }}
    />
  );
}
