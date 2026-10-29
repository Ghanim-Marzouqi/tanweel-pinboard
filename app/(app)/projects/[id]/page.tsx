import Link from 'next/link';
import { ProjectTabs } from '@/components/project-tabs';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Archive, Plus, Settings } from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageProject, canWriteInProject, visibleProjectsWhere } from '@/lib/access';
import { TaskListQuerySchema, TASK_STATUSES, type TaskStatus } from '@/lib/validation';
import {
  BOARD_LIMIT,
  PAGE_SIZE,
  projectPeople,
  TASK_SUMMARY_SELECT,
  taskFilterWhere,
  taskOrderBy,
  toTaskSummary,
} from '@/lib/tasks';
import { TaskBoard } from '@/components/task-board';
import { TaskFilters } from '@/components/task-filters';
import { TaskList } from '@/components/task-list';
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

  // Bad filter values (hand-edited URLs) are ignored rather than erroring.
  const raw = await searchParams;
  const single = Object.fromEntries(
    Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === 'string'),
  );
  const parsed = TaskListQuerySchema.safeParse(single);
  const query = parsed.success ? parsed.data : TaskListQuerySchema.parse({});
  const isBoard = query.view === 'board';

  const filterWhere = taskFilterWhere(
    // The board's columns are the statuses, so it ignores a status filter.
    isBoard ? { ...query, status: undefined } : query,
    { userId: session.user.id },
  );
  const where = { projectId: project.id, ...filterWhere };
  const paging: { skip?: number; take: number } = isBoard
    ? { take: BOARD_LIMIT }
    : { skip: (query.page - 1) * PAGE_SIZE, take: PAGE_SIZE };

  const [rows, total, grouped, people] = await Promise.all([
    prisma.task.findMany({
      where,
      select: TASK_SUMMARY_SELECT,
      orderBy: isBoard ? taskOrderBy('priority') : taskOrderBy(query.sort),
      ...paging,
    }),
    isBoard ? Promise.resolve(0) : prisma.task.count({ where }),
    prisma.task.groupBy({ by: ['status'], where: { projectId: project.id }, _count: { _all: true } }),
    projectPeople(project.id),
  ]);
  const counts = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
  for (const g of grouped) counts[g.status as TaskStatus] = g._count._all;

  const canWrite = canWriteInProject(project);
  const tasks = rows.map(toTaskSummary);
  const filtered = Object.keys(filterWhere).length > 0;

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
            <Link href={`/projects/${project.id}/settings`} className={buttonClass({ variant: 'secondary' })}>
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

      <ProjectTabs projectId={project.id} active="tasks" />
      <TaskFilters view={query.view} people={people} />

      {isBoard ? (
        // Re-mount when the data changes so the board's local state follows it.
        <TaskBoard key={tasks.map((x) => `${x.id}:${x.status}`).join(',')} tasks={tasks} canEdit={canWrite} />
      ) : (
        <TaskList
          projectId={project.id}
          tasks={tasks}
          counts={counts}
          total={total}
          page={query.page}
          pageSize={PAGE_SIZE}
          canCreate={canWrite}
          filtered={filtered}
        />
      )}
    </div>
  );
}
