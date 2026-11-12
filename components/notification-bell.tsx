'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bell, CheckCheck, MessageSquare, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormattedDate } from '@/components/formatted-date';
import { STATUS_KEY } from '@/lib/status';
import type { TaskStatus } from '@/lib/validation';
import { cx } from '@/lib/utils';

type Notice = {
  id: string;
  kind: 'RequestComment' | 'RequestStatus' | 'TaskComment' | 'TaskStatus';
  actor: { name: string } | null;
  createdAt: string;
  readAt: string | null;
  request: { id: string; number: number; title: string } | null;
  task: { id: string; title: string } | null;
  fromStatus: string | null;
  toStatus: string | null;
};
export function NotificationBell() {
  const t = useTranslations('notifications');
  const taskT = useTranslations('tasks.status');
  const requestT = useTranslations('requests.statuses');
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notice[]>([]);
  const [asOf, setAsOf] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const generation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const refreshCount = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/notifications?count=1', { cache: 'no-store', signal });
      if (response.ok) setCount((await response.json()).unreadCount);
      else if (response.status === 401 || response.status === 403) setCount(0);
    } catch {
      /* A temporary offline state must not disrupt the app. */
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      if (!open && document.visibilityState === 'visible') void refreshCount(controller.signal);
    };
    refresh();
    const interval = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [open, pathname, refreshCount]);
  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );

  async function load(more = false) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const ticket = ++generation.current;
    setBusy(true);
    setError(false);
    if (!more) {
      setItems([]);
      setAsOf('');
      setHasMore(false);
    }
    const last = more ? items.at(-1) : undefined;
    const query = last ? `?${new URLSearchParams({ before: last.createdAt, beforeId: last.id })}` : '';
    try {
      const response = await fetch(`/api/notifications${query}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      if (ticket !== generation.current) return;
      setItems((previous) => (more ? [...previous, ...data.notifications] : data.notifications));
      setCount(data.unreadCount);
      setHasMore(data.hasMore);
      if (!more) setAsOf(data.asOf);
    } catch {
      if (ticket === generation.current && !controller.signal.aborted) setError(true);
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  function close() {
    abort.current?.abort();
    generation.current++;
    setOpen(false);
    setItems([]);
    setBusy(false);
  }
  async function markRead(item?: Notice) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const ticket = ++generation.current;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item ? { id: item.id } : { all: true, before: asOf }),
      });
      if (ticket !== generation.current) return;
      if (!response.ok) throw new Error('Unavailable');
      if (item) {
        close();
        router.push(item.request ? `/requests/${item.request.id}` : `/tasks/${item.task!.id}`);
      } else await load();
      void refreshCount();
    } catch {
      if (ticket === generation.current && !controller.signal.aborted) setError(true);
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  function statusLabel(item: Notice, status: string | null) {
    if (!status) return '';
    return item.request ? requestT(status) : taskT(STATUS_KEY[status as TaskStatus]);
  }
  return (
    <>
      <button
        type="button"
        title={t('title')}
        aria-label={t('bell', { count })}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
          void load();
        }}
        className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)] focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]"
      >
        <Bell size={18} aria-hidden />
        {count > 0 && (
          <span
            aria-hidden
            className="absolute -end-1.5 -top-1.5 min-w-4 rounded-full bg-[color:var(--accent)] px-1 text-center text-[10px] font-bold leading-4 text-white"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      <Dialog
        open={open}
        onClose={close}
        title={t('title')}
        description={t('subtitle')}
        className="notification-dialog"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-[color:var(--text-muted)]">{t('unread', { count })}</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              aria-label={t('refresh')}
              onClick={() => void load()}
            >
              <RefreshCw size={16} aria-hidden />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || !asOf || count === 0}
              onClick={() => void markRead()}
            >
              <CheckCheck size={16} aria-hidden />
              {t('readAll')}
            </Button>
          </div>
        </div>
        {error && (
          <p role="alert" className="mb-3 text-sm text-[color:var(--danger)]">
            {t('failed')}
          </p>
        )}
        <div className="max-h-[60dvh] overflow-y-auto overscroll-contain">
          {!items.length && !busy && !error && (
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl bg-[color:var(--surface-muted)] text-center">
              <Bell size={26} aria-hidden className="text-[color:var(--text-faint)]" />
              <p className="text-sm font-medium">{t('empty')}</p>
              <p className="px-4 text-xs text-[color:var(--text-muted)]">{t('emptyHint')}</p>
            </div>
          )}
          <ul className="space-y-2">
            {items.map((item) => {
              const comment = item.kind.endsWith('Comment');
              const Icon = comment ? MessageSquare : ArrowRightLeft;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void markRead(item)}
                    className={cx(
                      'flex w-full items-start gap-3 rounded-xl border p-3 text-start transition-colors hover:border-[color:var(--accent)] disabled:opacity-60',
                      item.readAt
                        ? 'border-[color:var(--border)] bg-[color:var(--surface)]'
                        : 'border-[color:var(--accent-ring)] bg-[color:var(--accent-soft)]',
                    )}
                  >
                    <Icon size={18} aria-hidden className="mt-0.5 shrink-0 text-[color:var(--accent)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-6">
                        {t(item.kind, { actor: item.actor?.name ?? t('someone') })}
                      </span>
                      <bdi className="mt-1 block break-words text-sm font-semibold">
                        {item.request ? `#${item.request.number} · ${item.request.title}` : item.task?.title}
                      </bdi>
                      {!comment && (
                        <span className="mt-1 block text-xs text-[color:var(--text-muted)]">
                          {t('transition', {
                            from: statusLabel(item, item.fromStatus),
                            to: statusLabel(item, item.toStatus),
                          })}
                        </span>
                      )}
                      <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-faint)]">
                        <FormattedDate iso={item.createdAt} timeZone="Asia/Muscat" />
                        {!item.readAt && (
                          <span className="font-medium text-[color:var(--accent)]">{t('new')}</span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {busy && (
            <p role="status" className="py-4 text-center text-sm text-[color:var(--text-muted)]">
              {t('loading')}
            </p>
          )}
          {hasMore && (
            <Button variant="ghost" className="mt-3 w-full" disabled={busy} onClick={() => void load(true)}>
              {t('more')}
            </Button>
          )}
        </div>
      </Dialog>
    </>
  );
}
