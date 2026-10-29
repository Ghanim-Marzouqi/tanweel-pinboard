'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Inbox, MessageSquare, Paperclip } from 'lucide-react';
import { buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { AssigneeName, ChecklistProgress, DueDate, PriorityBadge } from '@/components/task-meta';
import { TASK_STATUSES } from '@/lib/status';
import type { TaskSummary } from '@/lib/tasks';
import { cx } from '@/lib/utils';
import type { TaskStatus } from '@/lib/validation';

interface Props {
  projectId: string;
  tasks: TaskSummary[];
  /** Per-status totals for the whole project (ignoring filters). */
  counts: Record<TaskStatus, number>;
  total: number;
  page: number;
  pageSize: number;
  /** False for archived projects. */
  canCreate: boolean;
  /** Whether any filter is active (changes the empty-state message). */
  filtered: boolean;
}

export function TaskList({ projectId, tasks, counts, total, page, pageSize, canCreate, filtered }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const activeStatus = params.get('status');

  function hrefWith(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {TASK_STATUSES.map((s) => {
          const isActive = activeStatus === s;
          return (
            <Link
              key={s}
              href={hrefWith({ status: isActive ? null : s, page: null })}
              aria-current={isActive ? 'true' : undefined}
              className={cx(
                'rounded-xl border p-3 transition-colors sm:p-4',
                isActive
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)]'
                  : 'border-[color:var(--border)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-muted)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]',
              )}
            >
              <StatusBadge status={s} />
              <div className="mt-2 text-2xl font-semibold tracking-tight sm:mt-3">{counts[s]}</div>
            </Link>
          );
        })}
      </div>

      {tasks.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center sm:py-16">
          <Inbox size={36} className="text-[color:var(--text-faint)]" />
          <p className="text-sm text-[color:var(--text-muted)]">
            {filtered ? t('tasks.emptyFiltered') : t('tasks.empty')}
          </p>
          {canCreate && !filtered && (
            <Link href={`/projects/${projectId}/tasks/new`} className={buttonClass({})}>
              {t('tasks.addNew')}
            </Link>
          )}
        </Card>
      ) : (
        <>
          {/* Phones: stacked cards */}
          <div className="space-y-2 sm:hidden">
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="block rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 transition-colors hover:bg-[color:var(--surface-muted)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 flex-1 text-sm font-semibold tracking-tight">{task.title}</h3>
                  <ChevronRight size={16} className="mt-0.5 shrink-0 text-[color:var(--text-faint)] rtl:rotate-180" />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                  <DueDate dueDate={task.dueDate} status={task.status} />
                  <AssigneeName assignee={task.assignee} />
                  <ChecklistProgress done={task.checklistDone} total={task.checklistTotal} />
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden overflow-hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium">{t('tasks.fields.title')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('tasks.fields.assignee')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('tasks.fields.priority')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('tasks.fields.dueDate')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('tasks.fields.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr
                      key={task.id}
                      className="cursor-pointer border-t border-[color:var(--border)] transition-colors hover:bg-[color:var(--surface-muted)]"
                      onClick={() => router.push(`/tasks/${task.id}`)}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/tasks/${task.id}`}
                          className="font-medium text-[color:var(--text)] hover:text-[color:var(--accent)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {task.title}
                        </Link>
                        <div className="mt-1 flex items-center gap-3 text-xs text-[color:var(--text-faint)]">
                          <ChecklistProgress done={task.checklistDone} total={task.checklistTotal} />
                          {task.attachments > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Paperclip size={12} />
                              {task.attachments}
                            </span>
                          )}
                          {task.comments > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <MessageSquare size={12} />
                              {task.comments}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-[12rem] px-4 py-3 align-middle">
                        <AssigneeName assignee={task.assignee} className="!text-sm" />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {task.dueDate ? (
                          <DueDate dueDate={task.dueDate} status={task.status} className="!text-sm" />
                        ) : (
                          <span className="text-[color:var(--text-faint)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <StatusBadge status={task.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {total > pageSize && (
            <nav className="flex items-center justify-between gap-3 text-sm text-[color:var(--text-muted)]">
              <span>{t('tasks.pagination.range', { from, to, total })}</span>
              <div className="flex gap-2">
                <PageLink href={hrefWith({ page: page > 2 ? String(page - 1) : null })} disabled={page <= 1}>
                  <ChevronLeft size={16} className="rtl:rotate-180" />
                  {t('tasks.pagination.previous')}
                </PageLink>
                <PageLink href={hrefWith({ page: String(page + 1) })} disabled={page >= lastPage}>
                  {t('tasks.pagination.next')}
                  <ChevronRight size={16} className="rtl:rotate-180" />
                </PageLink>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  const className = buttonClass({ variant: 'secondary', size: 'sm' });
  if (disabled) {
    return (
      <span aria-disabled="true" className={cx(className, 'pointer-events-none opacity-50')}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
