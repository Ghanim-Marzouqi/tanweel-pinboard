import { useTranslations } from 'next-intl';
import type { TaskStatus } from '@/lib/validation';
import { cx } from '@/lib/utils';

const STYLES: Record<TaskStatus, { bg: string; fg: string; key: string }> = {
  Open: { bg: 'var(--status-open-bg)', fg: 'var(--status-open-fg)', key: 'tasks.status.open' },
  InProgress: {
    bg: 'var(--status-progress-bg)',
    fg: 'var(--status-progress-fg)',
    key: 'tasks.status.inProgress',
  },
  Resolved: {
    bg: 'var(--status-resolved-bg)',
    fg: 'var(--status-resolved-fg)',
    key: 'tasks.status.resolved',
  },
  Closed: { bg: 'var(--status-closed-bg)', fg: 'var(--status-closed-fg)', key: 'tasks.status.closed' },
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const t = useTranslations();
  const style = STYLES[status];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        className,
      )}
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.fg }} />
      {t(style.key)}
    </span>
  );
}
