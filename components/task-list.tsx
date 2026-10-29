'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Plus, Search, Inbox, Paperclip, MessageSquare, ChevronRight } from 'lucide-react';
import { buttonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/status-badge';
import { Card } from '@/components/ui/card';
import { FormattedDate } from '@/components/formatted-date';
import type { TaskStatus } from '@/lib/validation';

interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  attachmentsCount: number;
  commentsCount: number;
}

interface Props {
  tasks: TaskRow[];
  initialFilters: { status?: TaskStatus; q: string };
}

const STATUS_OPTIONS: TaskStatus[] = ['Open', 'InProgress', 'Resolved', 'Closed'];

function statusKey(s: TaskStatus): string {
  return s === 'InProgress' ? 'inProgress' : s.toLowerCase();
}

export function TaskListClient({ tasks, initialFilters }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(initialFilters.q);
  const [status, setStatus] = useState<string>(initialFilters.status ?? '');

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (status) params.set('status', status);
      const qs = params.toString();
      startTransition(() => router.replace(`/tasks${qs ? `?${qs}` : ''}`));
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const empty = tasks.length === 0;

  const stats = useMemo(() => {
    const counts: Record<TaskStatus, number> = {
      Open: 0,
      InProgress: 0,
      Resolved: 0,
      Closed: 0,
    };
    for (const task of tasks) counts[task.status]++;
    return counts;
  }, [tasks]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('tasks.title')}</h1>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('tasks.subtitle')}</p>
        </div>
        <Link href="/tasks/new" className={buttonClass({ className: 'whitespace-nowrap' })}>
          <Plus size={16} />
          {t('tasks.addNew')}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {STATUS_OPTIONS.map((s) => {
          const isActive = status === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(isActive ? '' : s)}
              aria-pressed={isActive}
              className={`text-start rounded-xl border p-3 transition-colors sm:p-4 ${
                isActive
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)]'
                  : 'border-[color:var(--border)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-muted)]'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]`}
            >
              <StatusBadge status={s} />
              <div className="mt-2 text-2xl font-semibold tracking-tight sm:mt-3">{stats[s]}</div>
            </button>
          );
        })}
      </div>

      <Card className="p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_minmax(0,200px)]">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-[color:var(--text-faint)] start-3"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('tasks.filters.search')}
              className="ps-9"
              aria-label={t('tasks.filters.search')}
            />
          </div>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label={t('tasks.filters.status')}
          >
            <option value="">{t('common.all')} — {t('tasks.filters.status')}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`tasks.status.${statusKey(s)}`)}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {empty ? (
        <Card className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center sm:py-16">
          <Inbox size={36} className="text-[color:var(--text-faint)]" />
          <p className="text-sm text-[color:var(--text-muted)]">{t('tasks.empty')}</p>
          <Link href="/tasks/new" className={buttonClass({})}>
            {t('tasks.addNew')}
          </Link>
        </Card>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="space-y-2 sm:hidden">
            {tasks.map((n) => (
              <Link
                key={n.id}
                href={`/tasks/${n.id}`}
                className="block rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 transition-colors hover:bg-[color:var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold tracking-tight text-[color:var(--text)]">
                      {n.title}
                    </h3>
                    <div className="mt-0.5 truncate text-xs text-[color:var(--text-faint)]">
                      {n.createdByName} ·{' '}
                      <FormattedDate iso={n.createdAt} className="text-xs" />
                    </div>
                  </div>
                  <ChevronRight
                    size={16}
                    className="mt-0.5 shrink-0 text-[color:var(--text-faint)] rtl:rotate-180"
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={n.status} />
                  {n.attachmentsCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-1.5 py-0.5 text-xs text-[color:var(--text-muted)]">
                      <Paperclip size={11} />
                      {n.attachmentsCount}
                    </span>
                  )}
                  {n.commentsCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-1.5 py-0.5 text-xs text-[color:var(--text-muted)]">
                      <MessageSquare size={11} />
                      {n.commentsCount}
                    </span>
                  )}
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
                    <th className="px-4 py-3 text-start font-medium">{t('tasks.fields.status')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('tasks.fields.createdAt')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('tasks.fields.attachments')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('comments.title')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((n) => (
                    <tr
                      key={n.id}
                      className="cursor-pointer border-t border-[color:var(--border)] transition-colors hover:bg-[color:var(--surface-muted)]"
                      onClick={() => router.push(`/tasks/${n.id}`)}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/tasks/${n.id}`}
                          className="font-medium text-[color:var(--text)] hover:text-[color:var(--accent)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {n.title}
                        </Link>
                        <div className="mt-0.5 text-xs text-[color:var(--text-faint)]">
                          {n.createdByName}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <StatusBadge status={n.status} />
                      </td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap text-[color:var(--text-muted)]">
                        <FormattedDate iso={n.createdAt} />
                      </td>
                      <td className="px-4 py-3 align-middle text-[color:var(--text-muted)]">
                        <span className="inline-flex items-center gap-1.5">
                          <Paperclip size={14} className="text-[color:var(--text-faint)]" />
                          {t('tasks.table.attachments', { count: n.attachmentsCount })}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle text-[color:var(--text-muted)]">
                        <span className="inline-flex items-center gap-1.5">
                          <MessageSquare size={14} className="text-[color:var(--text-faint)]" />
                          {t('tasks.table.comments', { count: n.commentsCount })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
