import { useTranslations } from 'next-intl';
import type { TaskStatus } from '@/lib/validation';
import { STATUS_KEY } from '@/lib/status';
import { cx } from '@/lib/utils';

const STYLES: Record<TaskStatus, { bg: string; fg: string }> = {
  Todo: { bg: 'var(--status-todo-bg)', fg: 'var(--status-todo-fg)' },
  InProgress: { bg: 'var(--status-progress-bg)', fg: 'var(--status-progress-fg)' },
  InReview: { bg: 'var(--status-review-bg)', fg: 'var(--status-review-fg)' },
  Done: { bg: 'var(--status-done-bg)', fg: 'var(--status-done-fg)' },
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const t = useTranslations('tasks.status');
  const style = STYLES[status];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        className,
      )}
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.fg }} />
      {t(STATUS_KEY[status])}
    </span>
  );
}
