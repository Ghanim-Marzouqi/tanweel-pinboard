import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Archive, Plus, Settings } from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageProject, canWriteInProject, visibleProjectsWhere } from '@/lib/access';
import { TaskListQuerySchema, TASK_STATUSES, type TaskStatus } from '@/lib/validation';
import { taskListWhere } from '@/lib/tasks';
import { TaskListClient } from '@/components/task-list';
import { buttonClass } from '@/components/ui/button';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProjectPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const { id } = await params;
  const t = await getTranslations();

  const project = await prisma.project.findFirst({
    where: { id, ...visibleProjectsWhere(session.user) },
    select: { id: true, name: true, description: true, ownerId: true, isArchived: true },
  });
  if (!project) notFound();

  const raw = await searchParams;
  const parsed = TaskListQuerySchema.safeParse({
    status: typeof raw.status === 'string' ? raw.status : undefined,
    q: typeof raw.q === 'string' ? raw.q : undefined,
  });
  const filters = parsed.success ? parsed.data : {};

  const [tasks, grouped] = await Promise.all([
    prisma.task.findMany({
      where: taskListWhere(project.id, filters),
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { attachments: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.task.groupBy({
      by: ['status'],
      where: { projectId: project.id },
      _count: { _all: true },
    }),
  ]);
  const counts = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
  for (const g of grouped) counts[g.status as TaskStatus] = g._count._all;

  const canWrite = canWriteInProject(project);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{project.name}</h1>
            {project.isArchived && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--surface-muted)] px-2 py-0.5 text-xs font-medium text-[color:var(--text-muted)]">
                <Archive size={12} />
                {t('projects.archivedBadge')}
              </span>
            )}
          </div>
          {project.description && (
            <p className="mt-1 max-w-3xl whitespace-pre-line text-sm text-[color:var(--text-muted)]">
              {project.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canManageProject(session.user, project) && (
            <Link
              href={`/projects/${project.id}/settings`}
              className={buttonClass({ variant: 'secondary' })}
            >
              <Settings size={16} />
              {t('projects.settings')}
            </Link>
          )}
          {canWrite && (
            <Link
              href={`/projects/${project.id}/tasks/new`}
              className={buttonClass({ className: 'whitespace-nowrap' })}
            >
              <Plus size={16} />
              {t('tasks.addNew')}
            </Link>
          )}
        </div>
      </div>

      {!canWrite && (
        <p className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
          {t('tasks.archivedNotice')}
        </p>
      )}

      <TaskListClient
        projectId={project.id}
        canCreate={canWrite}
        counts={counts}
        tasks={tasks.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status as TaskStatus,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
          createdByName: task.createdBy.name,
          attachmentsCount: task._count.attachments,
          commentsCount: task._count.comments,
        }))}
        initialFilters={{ status: filters.status, q: filters.q ?? '' }}
      />
    </div>
  );
}
