'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Columns3, List, Search, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PRIORITY_KEY, STATUS_KEY, TASK_PRIORITIES, TASK_STATUSES } from '@/lib/status';
import { cx } from '@/lib/utils';

const FILTER_KEYS = ['q', 'status', 'assignee', 'priority', 'due', 'sort'] as const;

interface Props {
  view: 'list' | 'board';
  /** Project members, for the assignee filter. */
  people: { id: string; name: string }[];
}

/** A navigation we started that the URL hasn't caught up with yet. */
interface Pending {
  /** Query string we're navigating to. */
  qs: string;
  /** Query strings the URL may still show meanwhile (start + intermediate steps). */
  from: string[];
}

/** Filter bar + List/Board switch. All state lives in the URL. */
export function TaskFilters({ view, people }: Props) {
  const t = useTranslations('tasks');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState<Pending | null>(null);

  // Build on the URL we're heading to, not the one still showing: otherwise a
  // second filter change made before the first navigation finishes would
  // start from the old URL and undo the first change.
  const committed = params.toString();
  const live = pending && pending.from.includes(committed) ? pending : null;
  const current = new URLSearchParams(live ? live.qs : committed);
  const [search, setSearch] = useState(current.get('q') ?? '');

  function withChanges(changes: Record<string, string | null>): URLSearchParams {
    const next = new URLSearchParams(current);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Any filter change starts again from the first page.
    if (!('page' in changes)) next.delete('page');
    return next;
  }

  function toHref(next: URLSearchParams): string {
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function update(key: string, value: string) {
    const next = withChanges({ [key]: value || null });
    setPending({ qs: next.toString(), from: live ? [...live.from, live.qs] : [committed] });
    startTransition(() => router.replace(toHref(next)));
  }

  // Search as you type, but only after a short pause.
  useEffect(() => {
    if (search.trim() === (current.get('q') ?? '')) return;
    const timer = setTimeout(() => update('q', search.trim()), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const hasFilters = FILTER_KEYS.some((k) => current.get(k));
  const clearHref = view === 'board' ? `${pathname}?view=board` : pathname;

  return (
    <Card className="space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-[color:var(--text-faint)] start-3"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('filters.search')}
            aria-label={t('filters.search')}
            className="ps-9"
          />
        </div>

        <div
          role="group"
          aria-label={t('views.label')}
          className="inline-flex rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-1"
        >
          <ViewLink href={toHref(withChanges({ view: null, page: null }))} active={view === 'list'}>
            <List size={16} />
            {t('views.list')}
          </ViewLink>
          <ViewLink href={toHref(withChanges({ view: 'board', page: null, status: null, sort: null }))} active={view === 'board'}>
            <Columns3 size={16} />
            {t('views.board')}
          </ViewLink>
        </div>
      </div>

      <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,11rem),1fr))]">
        {view === 'list' && (
          <Select
            value={current.get('status') ?? ''}
            onChange={(e) => update('status', e.target.value)}
            aria-label={t('filters.status')}
          >
            <option value="">{t('filters.anyStatus')}</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${STATUS_KEY[s]}`)}
              </option>
            ))}
          </Select>
        )}

        <Select
          value={current.get('assignee') ?? ''}
          onChange={(e) => update('assignee', e.target.value)}
          aria-label={t('filters.assignee')}
        >
          <option value="">{t('filters.anyone')}</option>
          <option value="me">{t('filters.me')}</option>
          <option value="none">{t('filters.unassigned')}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>

        <Select
          value={current.get('priority') ?? ''}
          onChange={(e) => update('priority', e.target.value)}
          aria-label={t('filters.priority')}
        >
          <option value="">{t('filters.anyPriority')}</option>
          {[...TASK_PRIORITIES].reverse().map((p) => (
            <option key={p} value={p}>
              {t(`priority.${PRIORITY_KEY[p]}`)}
            </option>
          ))}
        </Select>

        <Select
          value={current.get('due') ?? ''}
          onChange={(e) => update('due', e.target.value)}
          aria-label={t('filters.due')}
        >
          <option value="">{t('filters.anyDue')}</option>
          <option value="overdue">{t('filters.overdue')}</option>
          <option value="today">{t('filters.today')}</option>
          <option value="week">{t('filters.week')}</option>
          <option value="none">{t('filters.none')}</option>
        </Select>

        {view === 'list' && (
          <Select
            value={current.get('sort') ?? ''}
            onChange={(e) => update('sort', e.target.value)}
            aria-label={t('filters.sort')}
          >
            <option value="">{t('filters.sortNewest')}</option>
            <option value="due">{t('filters.sortDue')}</option>
            <option value="priority">{t('filters.sortPriority')}</option>
          </Select>
        )}
      </div>

      {hasFilters && (
        <Link
          href={clearHref}
          onClick={() => setSearch('')}
          className="inline-flex items-center gap-1 text-sm text-[color:var(--accent-strong)] hover:underline"
        >
          <X size={14} />
          {t('filters.clear')}
        </Link>
      )}
    </Card>
  );
}

function ViewLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
        active
          ? 'bg-[color:var(--surface)] text-[color:var(--text)] shadow-[var(--shadow-sm)]'
          : 'text-[color:var(--text-muted)] hover:text-[color:var(--text)]',
      )}
    >
      {children}
    </Link>
  );
}
