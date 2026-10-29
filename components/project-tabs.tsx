import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { cx } from '@/lib/utils';
export async function ProjectTabs({
  projectId,
  active,
}: {
  projectId: string;
  active: 'requests' | 'tasks';
}) {
  const t = await getTranslations('requests');
  return (
    <nav aria-label={t('projectSections')} className="flex gap-1 border-b border-[color:var(--border)]">
      {(['requests', 'tasks'] as const).map((tab) => (
        <Link
          key={tab}
          href={tab === 'requests' ? `/projects/${projectId}/requests` : `/projects/${projectId}`}
          aria-current={active === tab ? 'page' : undefined}
          className={cx(
            'px-4 py-3 text-sm font-medium border-b-2',
            active === tab
              ? 'border-[color:var(--accent)] text-[color:var(--accent-strong)]'
              : 'border-transparent text-[color:var(--text-muted)]',
          )}
        >
          {t(tab)}
        </Link>
      ))}
    </nav>
  );
}
