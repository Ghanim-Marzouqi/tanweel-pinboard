'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormattedDate } from '@/components/formatted-date';
import { sendJson } from '@/lib/client-api';
import { REQUEST_STATUSES } from '@/lib/request-validation';
import { TASK_PRIORITIES, type TaskStatus } from '@/lib/validation';
import { STATUS_KEY, PRIORITY_KEY } from '@/lib/status';

export interface RequestView {
  id: string;
  number: number;
  title: string;
  description: string;
  suggestions: string;
  shift: string;
  occurredAt: string;
  status: (typeof REQUEST_STATUSES)[number];
  closureReason: string;
  createdAt: string;
  project: { id: string; name: string; isArchived: boolean };
  category: { nameEn: string; nameAr: string };
  createdBy: { name: string };
  taskLinks: { task: { id: string; title: string; status: string } }[];
  attachments: { id: string; fileName: string; sizeBytes: number; uploadedById: string }[];
  activities: { id: string; kind: string; body: string; createdAt: string; actor: { name: string } }[];
}
function escaped(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('\n', '<br>');
}
export function RequestDetail({
  request: r,
  isAdmin,
  userId,
  people,
  initialTasks,
}: {
  request: RequestView;
  isAdmin: boolean;
  userId: string;
  people: { id: string; name: string }[];
  initialTasks: { id: string; title: string }[];
}) {
  const t = useTranslations('requests');
  const taskT = useTranslations('tasks');
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(r.status);
  const [tasks, setTasks] = useState(initialTasks);
  const [search, setSearch] = useState('');
  const [creationKey] = useState(() => crypto.randomUUID());
  const writable = !r.project.isArchived && r.status !== 'Closed';
  async function action(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
    setPending(true);
    setError('');
    const result = await sendJson(`/api/requests/${r.id}${path}`, method, body);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    router.refresh();
    return true;
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError('');
    try {
      const data = new FormData();
      data.set('file', file);
      const res = await fetch(`/api/requests/${r.id}/attachments`, { method: 'POST', body: data });
      if (!res.ok) setError((await res.json()).error ?? t('failed'));
      else router.refresh();
    } catch {
      setError(t('failed'));
    } finally {
      setPending(false);
      e.target.value = '';
    }
  }
  async function searchTasks() {
    setPending(true);
    setError('');
    try {
      const res = await fetch(
        `/api/projects/${r.project.id}/tasks?sort=newest${search.trim() ? `&q=${encodeURIComponent(search.trim())}` : ''}`,
      );
      if (!res.ok) throw Error();
      setTasks((await res.json()).tasks);
    } catch {
      setError(t('failed'));
    } finally {
      setPending(false);
    }
  }
  function activity(a: RequestView['activities'][number]) {
    if (a.kind === 'comment') return a.body;
    if (a.kind === 'status') {
      const change = JSON.parse(a.body) as { from: string; to: string; reason: string };
      return `${t('statusChanged', { from: t(`statuses.${change.from}`), to: t(`statuses.${change.to}`) })}${change.reason ? ` — ${change.reason}` : ''}`;
    }
    return t(`activity.${a.kind}`, { title: a.body });
  }
  return (
    <div className="space-y-6">
      <Link href={`/projects/${r.project.id}/requests`} className="text-sm text-[color:var(--accent)]">
        {r.project.name} / {t('requests')}
      </Link>
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[color:var(--text-muted)]">#{r.number}</span>
          <h1 className="min-w-0 break-words text-2xl font-semibold">{r.title}</h1>
          <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-sm text-[color:var(--accent-strong)]">
            {t(`statuses.${r.status}`)}
          </span>
        </div>
        <p className="mt-3 text-sm text-[color:var(--text-muted)]">
          {t('reporter')}: {r.createdBy.name} · {locale === 'ar' ? r.category.nameAr : r.category.nameEn} ·{' '}
          <FormattedDate timeZone="Asia/Muscat" iso={r.createdAt} />
        </p>
      </header>
      {r.project.isArchived && (
        <p className="rounded-lg bg-[color:var(--surface-muted)] p-4">{t('archivedProject')}</p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--danger)] p-3 text-[color:var(--danger)]"
        >
          {error}
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section className="space-y-5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
            <div>
              <h2 className="font-semibold">{t('description')}</h2>
              <p dir="auto" className="mt-2 whitespace-pre-wrap break-words">
                {r.description}
              </p>
            </div>
            {r.suggestions && (
              <div>
                <h2 className="font-semibold">{t('suggestions')}</h2>
                <p dir="auto" className="mt-2 whitespace-pre-wrap break-words">
                  {r.suggestions}
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-[color:var(--text-muted)]">
              <span>
                {t('occurredAt')}: <FormattedDate timeZone="Asia/Muscat" iso={r.occurredAt} />
              </span>
              {r.shift && (
                <span>
                  {t('shift')}: {r.shift}
                </span>
              )}
            </div>
            {r.closureReason && (
              <div className="rounded-lg bg-[color:var(--surface-muted)] p-3">
                <h2 className="font-semibold">{t('closureReason')}</h2>
                <p className="whitespace-pre-wrap break-words">{r.closureReason}</p>
              </div>
            )}
          </section>
          <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
            <h2 className="font-semibold">{t('attachments')}</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('attachmentHint')}</p>
            <ul className="my-3 space-y-2">
              {r.attachments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3">
                  <a
                    href={`/api/requests/${r.id}/attachments/${a.id}/download`}
                    className="min-w-0 break-all text-[color:var(--accent)]"
                  >
                    {a.fileName}{' '}
                    <span className="text-sm text-[color:var(--text-muted)]">
                      ({Math.ceil(a.sizeBytes / 1024)} KB)
                    </span>
                  </a>
                  {writable && (isAdmin || a.uploadedById === userId) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => action(`/attachments/${a.id}`, 'DELETE')}
                    >
                      {t('remove')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {writable && (
              <label className="block space-y-2">
                <span className="text-sm">{t('upload')}</span>
                <input type="file" className="sr-only peer" onChange={upload} disabled={pending} />
                <span className="inline-flex cursor-pointer rounded-lg border border-[color:var(--border)] px-4 py-2 text-sm peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--accent)]">
                  {t('chooseFile')}
                </span>
              </label>
            )}
          </section>
          <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
            <h2 className="font-semibold">{t('history')}</h2>
            <ol className="mt-4 space-y-4">
              {r.activities.map((a) => (
                <li key={a.id} className="border-s-2 border-[color:var(--border)] ps-4">
                  <div className="flex flex-wrap gap-x-2 text-sm text-[color:var(--text-muted)]">
                    <bdi>{a.actor.name}</bdi>
                    <bdi>
                      <FormattedDate timeZone="Asia/Muscat" iso={a.createdAt} />
                    </bdi>
                  </div>
                  <p dir="auto" className="mt-1 whitespace-pre-wrap break-words">
                    {activity(a)}
                  </p>
                </li>
              ))}
            </ol>
            {writable && (
              <form
                className="mt-5 space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const data = new FormData(form);
                  if (await action('/comments', 'POST', { body: data.get('body') })) form.reset();
                }}
              >
                <label className="block space-y-2">
                  <span>{t('comment')}</span>
                  <Textarea name="body" required maxLength={5000} rows={3} disabled={pending} />
                </label>
                <Button type="submit" disabled={pending}>
                  {t('postComment')}
                </Button>
              </form>
            )}
          </section>
        </div>
        <div className="min-w-0 space-y-6">
          {isAdmin && !r.project.isArchived && (
            <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
              <h2 className="mb-4 font-semibold">{t('review')}</h2>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  void action('', 'PATCH', { status, closureReason: data.get('closureReason') ?? '' });
                }}
              >
                <label className="block space-y-2">
                  <span>{t('status')}</span>
                  <Select
                    aria-label={t('status')}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as typeof status)}
                    disabled={pending}
                  >
                    {REQUEST_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`statuses.${s}`)}
                      </option>
                    ))}
                  </Select>
                </label>
                {status === 'Closed' && (
                  <label className="block space-y-2">
                    <span>{t('closureReason')}</span>
                    <Textarea name="closureReason" required maxLength={2000} defaultValue={r.closureReason} />
                  </label>
                )}
                <Button type="submit" disabled={pending}>
                  {t('saveReview')}
                </Button>
              </form>
            </section>
          )}
          <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
            <h2 className="font-semibold">{t('linkedTasks')}</h2>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">{t('linkHint')}</p>
            <ul className="my-4 space-y-3">
              {r.taskLinks.map(({ task }) => (
                <li key={task.id} className="rounded-lg bg-[color:var(--surface-muted)] p-3">
                  <Link
                    href={`/tasks/${task.id}`}
                    className="break-words font-medium text-[color:var(--accent)]"
                  >
                    {task.title}
                  </Link>
                  <p className="mt-1 text-sm">{taskT(`status.${STATUS_KEY[task.status as TaskStatus]}`)}</p>
                  {isAdmin && writable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => action('/links', 'DELETE', { taskId: task.id })}
                    >
                      {t('unlink')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {!r.taskLinks.length && (
              <p className="my-4 text-sm text-[color:var(--text-muted)]">{t('noLinks')}</p>
            )}
            {isAdmin && writable && (
              <div className="space-y-5">
                <div className="space-y-3">
                  <label className="block space-y-2">
                    <span>{t('searchTasks')}</span>
                    <Input maxLength={200} value={search} onChange={(e) => setSearch(e.target.value)} />
                  </label>
                  <Button variant="secondary" disabled={pending} onClick={searchTasks}>
                    {t('searchButton')}
                  </Button>
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action('/links', 'POST', { taskId: new FormData(e.currentTarget).get('taskId') });
                    }}
                  >
                    <Select name="taskId" aria-label={t('existingTask')} required defaultValue="">
                      <option value="" disabled>
                        {t('existingTask')}
                      </option>
                      {tasks
                        .filter((task) => !r.taskLinks.some((l) => l.task.id === task.id))
                        .map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.title}
                          </option>
                        ))}
                    </Select>
                    <Button type="submit" disabled={pending}>
                      {t('linkTask')}
                    </Button>
                  </form>
                </div>
                <details className="border-t border-[color:var(--border)] pt-4">
                  <summary className="cursor-pointer font-medium">{t('createAndLink')}</summary>
                  <form
                    className="mt-4 space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const data = new FormData(e.currentTarget);
                      void action('/links', 'POST', {
                        creationKey,
                        task: {
                          title: data.get('title'),
                          descriptionHtml: `<p>${escaped(String(data.get('description') ?? ''))}</p>`,
                          priority: data.get('priority'),
                          assigneeId: data.get('assigneeId') || null,
                          dueDate: data.get('dueDate') || null,
                        },
                      });
                    }}
                  >
                    <label className="block space-y-2">
                      <span>{t('taskTitle')}</span>
                      <Input name="title" required maxLength={200} defaultValue={r.title} />
                    </label>
                    <label className="block space-y-2">
                      <span>{t('taskDescription')}</span>
                      <Textarea
                        name="description"
                        rows={5}
                        maxLength={20000}
                        defaultValue={[r.description, r.suggestions].filter(Boolean).join('\n\n')}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span>{t('priority')}</span>
                      <Select aria-label={t('priority')} name="priority" defaultValue="Medium">
                        {TASK_PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {taskT(`priority.${PRIORITY_KEY[p]}`)}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="block space-y-2">
                      <span>{t('assignee')}</span>
                      <Select aria-label={t('assignee')} name="assigneeId">
                        <option value="">{t('unassigned')}</option>
                        {people.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="block space-y-2">
                      <span>{t('dueDate')}</span>
                      <Input type="date" name="dueDate" />
                    </label>
                    <Button type="submit" disabled={pending}>
                      {t('createAndLink')}
                    </Button>
                  </form>
                </details>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
