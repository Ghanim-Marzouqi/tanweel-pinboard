'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CalendarDays, ListChecks, UserRound } from 'lucide-react';
import { formatDueDate, todayIso } from '@/lib/dates';
import { PRIORITY_KEY } from '@/lib/status';
import { cx } from '@/lib/utils';
import type { TaskPriority, TaskStatus } from '@/lib/validation';

const PRIORITY_STYLE: Record<TaskPriority, { bg: string; fg: string }> = {
  Low: { bg: 'var(--priority-low-bg)', fg: 'var(--priority-low-fg)' },
  Medium: { bg: 'var(--priority-medium-bg)', fg: 'var(--priority-medium-fg)' },
  High: { bg: 'var(--priority-high-bg)', fg: 'var(--priority-high-fg)' },
  Urgent: { bg: 'var(--priority-urgent-bg)', fg: 'var(--priority-urgent-fg)' },
};

export function PriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  const t = useTranslations('tasks.priority');
  const style = PRIORITY_STYLE[priority];
  return (
    <span
      className={cx(
        'inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium',
        className,
      )}
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {t(PRIORITY_KEY[priority])}
    </span>
  );
}

/** Due date; red when overdue (unless the task is done). */
export function DueDate({
  dueDate,
  status,
  className,
}: {
  dueDate: string | null;
  status: TaskStatus;
  className?: string;
}) {
  const t = useTranslations('tasks');
  const locale = useLocale();
  if (!dueDate) return null;
  const today = todayIso();
  const overdue = status !== 'Done' && dueDate < today;
  const label = dueDate === today ? t('due.today') : formatDueDate(dueDate, locale, today);
  return (
    <span
      // "Today" and month names can differ between server and browser
      // around midnight or across ICU versions; the client value wins.
      suppressHydrationWarning
      title={overdue ? t('due.overdue') : t('fields.dueDate')}
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap text-xs',
        overdue ? 'font-medium text-[color:var(--danger)]' : 'text-[color:var(--text-muted)]',
        className,
      )}
    >
      <CalendarDays size={12} aria-hidden />
      {overdue && <span className="sr-only">{t('due.overdue')}: </span>}
      {label}
    </span>
  );
}

export function AssigneeName({ assignee, className }: { assignee: { name: string } | null; className?: string }) {
  const t = useTranslations('tasks.fields');
  return (
    <span
      className={cx(
        'inline-flex min-w-0 items-center gap-1 text-xs',
        assignee ? 'text-[color:var(--text-muted)]' : 'text-[color:var(--text-faint)]',
        className,
      )}
    >
      <UserRound size={12} aria-hidden className="shrink-0" />
      <span className="truncate">{assignee?.name ?? t('unassigned')}</span>
    </span>
  );
}

export function ChecklistProgress({ done, total }: { done: number; total: number }) {
  const t = useTranslations('tasks.fields');
  if (total === 0) return null;
  return (
    <span
      title={t('checklist')}
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap text-xs',
        done === total ? 'text-[color:var(--success)]' : 'text-[color:var(--text-muted)]',
      )}
    >
      <ListChecks size={12} aria-hidden />
      {done}/{total}
    </span>
  );
}
