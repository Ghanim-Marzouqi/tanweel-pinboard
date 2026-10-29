import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CheckCircle2, FolderKanban } from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { visibleTasksWhere } from '@/lib/access';
import { dueBucket, todayIso, type DueBucket } from '@/lib/dates';
import { TASK_SUMMARY_SELECT, toTaskSummary, type TaskSummary } from '@/lib/tasks';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { ChecklistProgress, DueDate, PriorityBadge } from '@/components/task-meta';
import { cx } from '@/lib/utils';

const GROUPS: DueBucket[] = ['overdue', 'today', 'thisWeek', 'later', 'none'];

/** Home: open tasks assigned to me, grouped by when they're due (Muscat time). */
export default async function MyTasksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const t = await getTranslations('myTasks');

  const rows = await prisma.task.findMany({
    where: {
      ...visibleTasksWhere(session.user),
      assigneeId: session.user.id,
      status: { not: 'Done' },
      project: { isArchived: false },
    },
    select: TASK_SUMMARY_SELECT,
    orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { priority: 'desc' }, { createdAt: 'asc' }],
  });

  const today = todayIso();
  const groups = new Map<DueBucket, TaskSummary[]>(GROUPS.map((g) => [g, []]));
  for (const task of rows.map(toTaskSummary)) groups.get(dueBucket(task.dueDate, today))!.push(task);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('subtitle')}</p>
      </div>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
          <CheckCircle2 size={36} className="text-[color:var(--success)]" />
          <p className="text-sm text-[color:var(--text-muted)]">{t('empty')}</p>
        </Card>
      ) : (
        GROUPS.filter((g) => groups.get(g)!.length > 0).map((group) => (
          <section key={group} aria-labelledby={`group-${group}`} className="space-y-2">
            <h2
              id={`group-${group}`}
              className={cx(
                'flex items-center gap-2 text-sm font-semibold',
                group === 'overdue' ? 'text-[color:var(--danger)]' : 'text-[color:var(--text-muted)]',
              )}
            >
              {t(`groups.${group}`)}
              <span className="rounded-full bg-[color:var(--surface-muted)] px-2 text-xs font-medium text-[color:var(--text-muted)]">
                {groups.get(group)!.length}
              </span>
            </h2>
            <Card className="divide-y divide-[color:var(--border)]">
              {groups.get(group)!.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-[color:var(--surface-muted)] sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{task.title}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-[color:var(--text-faint)]">
                      <FolderKanban size={12} className="shrink-0" />
                      <span className="truncate">{task.project.name}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <ChecklistProgress done={task.checklistDone} total={task.checklistTotal} />
                    <DueDate dueDate={task.dueDate} status={task.status} />
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.status} />
                  </div>
                </Link>
              ))}
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
