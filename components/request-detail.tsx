'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  CalendarDays,
  CheckCheck,
  FileText,
  Link2,
  MessageSquare,
  Paperclip,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { RequestStatusBadge } from '@/components/request-status-badge';
import { FormattedDate } from '@/components/formatted-date';
import { sendJson } from '@/lib/client-api';
import { REQUEST_STATUSES } from '@/lib/request-validation';
import { TASK_PRIORITIES, type TaskStatus } from '@/lib/validation';
import { StatusBadge } from '@/components/status-badge';
import { PRIORITY_KEY } from '@/lib/status';

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
  const [taskDialog, setTaskDialog] = useState<'existing' | 'create' | null>(null);
  const [creationKey] = useState(() => crypto.randomUUID());
  const availableTasks = tasks.filter((task) => !r.taskLinks.some((link) => link.task.id === task.id));
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
    <div className="mx-auto max-w-7xl space-y-6">
      <Link
        href={`/projects/${r.project.id}/requests`}
        className="inline-flex items-center gap-2 text-sm text-[color:var(--text-muted)] hover:text-[color:var(--accent-strong)]"
      >
        <ArrowLeft size={16} aria-hidden className="shrink-0 rtl:rotate-180" />
        {r.project.name} / {t('requests')}
      </Link>
      <header className="border-b border-[color:var(--border)] pb-6">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm text-[color:var(--text-faint)]">#{r.number}</span>
          <RequestStatusBadge status={r.status} label={t(`statuses.${r.status}`)} />
          <span className="text-sm text-[color:var(--text-muted)]">
            {locale === 'ar' ? r.category.nameAr : r.category.nameEn}
          </span>
        </div>
        <h1
          dir="auto"
          className="request-copy max-w-4xl break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl"
        >
          {r.title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[color:var(--text-muted)]">
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--accent-soft)] font-semibold text-[color:var(--accent-strong)]"
            >
              {r.createdBy.name.slice(0, 1)}
            </span>
            <bdi>{r.createdBy.name}</bdi>
          </span>
          <FormattedDate timeZone="Asia/Muscat" iso={r.createdAt} />
        </div>
      </header>
      {r.project.isArchived && (
        <p className="rounded-lg bg-[color:var(--surface-muted)] p-4">{t('archivedProject')}</p>
      )}
      {error && !taskDialog && (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--danger)] p-3 text-[color:var(--danger)]"
        >
          {error}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <section className="space-y-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <FileText size={17} aria-hidden className="text-[color:var(--text-faint)]" />
                {t('description')}
              </h2>
              <p dir="auto" className="request-copy mt-3 whitespace-pre-wrap break-words leading-relaxed">
                {r.description}
              </p>
            </div>
            {r.suggestions && (
              <div>
                <h2 className="text-sm font-semibold">{t('suggestionsHeading')}</h2>
                <p dir="auto" className="request-copy mt-3 whitespace-pre-wrap break-words leading-relaxed">
                  {r.suggestions}
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-[color:var(--border)] pt-4 text-xs text-[color:var(--text-muted)]">
              <span>
                <CalendarDays size={14} aria-hidden className="me-1.5 inline" />
                {t('occurredAt')}: <FormattedDate timeZone="Asia/Muscat" iso={r.occurredAt} />
              </span>
              {r.shift && (
                <span>
                  {t('shiftLabel')}: {r.shift}
                </span>
              )}
            </div>
            {r.closureReason && (
              <div className="rounded-xl border border-[color:var(--border)] p-3">
                <h2 className="font-semibold">{t('closureReason')}</h2>
                <p className="whitespace-pre-wrap break-words">{r.closureReason}</p>
              </div>
            )}
          </section>
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold">
                <Paperclip size={17} aria-hidden className="text-[color:var(--text-faint)]" />
                {t('attachments')}
                <span className="text-xs font-normal text-[color:var(--text-faint)]">
                  {r.attachments.length}
                </span>
              </h2>
              {writable && (
                <label
                  title={t('upload')}
                  className="request-toolbar-action relative inline-flex cursor-pointer items-center justify-center rounded-lg border border-[color:var(--border)] px-3 py-2 text-xs font-medium hover:bg-[color:var(--surface-muted)] focus-within:ring-2 focus-within:ring-[color:var(--accent-ring)]"
                >
                  <input
                    aria-label={t('upload')}
                    type="file"
                    className="sr-only"
                    onChange={upload}
                    disabled={pending}
                  />
                  <span className="inline-flex items-center gap-1.5">
                    <Upload size={14} aria-hidden />
                    <span className="hidden sm:inline">{t('upload')}</span>
                  </span>
                </label>
              )}
            </div>
            <p className="mt-2 text-xs text-[color:var(--text-muted)]">{t('attachmentHintShort')}</p>
            <ul className="my-3 space-y-2">
              {r.attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-[color:var(--surface-muted)] px-3 py-2.5"
                >
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
          </section>
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <MessageSquare size={17} aria-hidden className="text-[color:var(--text-faint)]" />
              {t('history')}
            </h2>
            <ol className="mt-4 space-y-4">
              {r.activities.map((a) => (
                <li
                  key={a.id}
                  className="relative border-s border-[color:var(--border)] ps-5 before:absolute before:-start-1 before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-[color:var(--border-strong)]"
                >
                  <div className="flex flex-wrap gap-x-2 text-xs text-[color:var(--text-muted)]">
                    <bdi>{a.actor.name}</bdi>
                    <bdi>
                      <FormattedDate timeZone="Asia/Muscat" iso={a.createdAt} />
                    </bdi>
                  </div>
                  <p
                    dir="auto"
                    className={
                      a.kind === 'comment'
                        ? 'mt-2 rounded-xl bg-[color:var(--surface-muted)] p-3 text-sm leading-relaxed whitespace-pre-wrap break-words'
                        : 'mt-1 whitespace-pre-wrap break-words text-xs text-[color:var(--text-muted)]'
                    }
                  >
                    {activity(a)}
                  </p>
                </li>
              ))}
            </ol>
            {writable && (
              <form
                className="mt-5 space-y-3 border-t border-[color:var(--border)] pt-5"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const data = new FormData(form);
                  if (await action('/comments', 'POST', { body: data.get('body') })) form.reset();
                }}
              >
                <label className="block space-y-2">
                  <span>{t('comment')}</span>
                  <Textarea
                    name="body"
                    required
                    maxLength={5000}
                    rows={3}
                    placeholder={t('commentPlaceholder')}
                    disabled={pending}
                  />
                </label>
                <Button type="submit" disabled={pending}>
                  {t('postComment')}
                </Button>
              </form>
            )}
          </section>
        </div>
        <div className="min-w-0 space-y-5 self-start lg:sticky lg:top-24">
          {isAdmin && !r.project.isArchived && (
            <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
              <h2 className="mb-4 flex items-center gap-2 font-semibold">
                <CheckCheck size={17} aria-hidden className="text-[color:var(--text-faint)]" />
                {t('review')}
              </h2>
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
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Link2 size={17} aria-hidden className="text-[color:var(--text-faint)]" />
              {t('linkedTasks')}
              <span className="text-xs font-normal text-[color:var(--text-faint)]">{r.taskLinks.length}</span>
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[color:var(--text-muted)]">{t('linkHint')}</p>
            <ul className="my-4 space-y-3">
              {r.taskLinks.map(({ task }) => (
                <li key={task.id} className="rounded-xl border border-[color:var(--border)] p-3">
                  <Link
                    href={`/tasks/${task.id}`}
                    className="break-words text-sm font-medium hover:text-[color:var(--accent-strong)]"
                  >
                    {task.title}
                  </Link>
                  <p className="mt-2 text-xs text-[color:var(--text-muted)]">
                    <StatusBadge status={task.status as TaskStatus} />
                  </p>
                  {isAdmin && writable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => action('/links', 'DELETE', { taskId: task.id })}
                    >
                      <X size={12} aria-hidden />
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
              <div className="flex flex-col gap-2 border-t border-[color:var(--border)] pt-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setError('');
                    setTaskDialog('existing');
                  }}
                >
                  <Link2 size={15} aria-hidden />
                  {t('linkTask')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setError('');
                    setTaskDialog('create');
                  }}
                >
                  <Plus size={15} aria-hidden />
                  {t('createAndLink')}
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>
      <Dialog
        open={taskDialog !== null}
        onClose={() => !pending && setTaskDialog(null)}
        title={t(taskDialog === 'create' ? 'createAndLink' : 'linkTask')}
        description={t(taskDialog === 'create' ? 'createTaskHint' : 'linkExistingHint')}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-[color:var(--danger-soft)] p-3 text-sm text-[color:var(--danger)]"
          >
            {error}
          </p>
        )}
        {taskDialog === 'existing' && (
          <div className="space-y-3">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void searchTasks();
              }}
            >
              <label className="block space-y-2">
                <span className="text-sm">{t('searchTasks')}</span>
                <Input autoFocus maxLength={200} value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
              <Button type="submit" variant="secondary" disabled={pending}>
                {t('searchButton')}
              </Button>
            </form>
            {availableTasks.length ? (
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await action('/links', 'POST', { taskId: new FormData(e.currentTarget).get('taskId') }))
                    setTaskDialog(null);
                }}
              >
                <Select name="taskId" aria-label={t('existingTask')} required defaultValue="">
                  <option value="" disabled>
                    {t('existingTask')}
                  </option>
                  {availableTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </Select>
                <Button type="submit" disabled={pending}>
                  {t('linkTask')}
                </Button>
              </form>
            ) : (
              <div className="rounded-xl bg-[color:var(--surface-muted)] p-4 text-sm">
                <p className="mb-3 leading-relaxed text-[color:var(--text-muted)]">{t('noAvailableTasks')}</p>
                <Button variant="secondary" onClick={() => setTaskDialog('create')}>
                  <Plus size={15} aria-hidden />
                  {t('createAndLink')}
                </Button>
              </div>
            )}
          </div>
        )}
        {taskDialog === 'create' && (
          <form
            className="mt-4 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              if (
                await action('/links', 'POST', {
                  creationKey,
                  task: {
                    title: data.get('title'),
                    descriptionHtml: `<p>${escaped(String(data.get('description') ?? ''))}</p>`,
                    priority: data.get('priority'),
                    assigneeId: data.get('assigneeId') || null,
                    dueDate: data.get('dueDate') || null,
                  },
                })
              )
                setTaskDialog(null);
            }}
          >
            <label className="block space-y-2">
              <span>{t('taskTitle')}</span>
              <Input autoFocus name="title" required maxLength={200} defaultValue={r.title} />
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
        )}
      </Dialog>
    </div>
  );
}
