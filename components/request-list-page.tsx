import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  ChevronRight,
  Folder,
  Inbox,
  Link2,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { visibleProjectsWhere } from '@/lib/access';
import { RequestQuerySchema, REQUEST_STATUSES, visibleRequestsWhere } from '@/lib/requests';
import { ProjectTabs } from '@/components/project-tabs';
import { buttonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormattedDate } from '@/components/formatted-date';
import { RequestStatusBadge } from '@/components/request-status-badge';
import { cx } from '@/lib/utils';

export async function RequestListPage({
  projectId,
  searchParams,
}: {
  projectId?: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const t = await getTranslations('requests');
  const locale = await getLocale();
  const projects = await prisma.project.findMany({
    where: visibleProjectsWhere(session.user),
    select: { id: true, name: true, isArchived: true },
    orderBy: { name: 'asc' },
  });
  const project = projectId ? projects.find((p) => p.id === projectId) : null;
  if (projectId && !project) notFound();
  const parsed = RequestQuerySchema.safeParse(searchParams);
  const { q, status, categoryId, page } = parsed.success ? parsed.data : RequestQuerySchema.parse({});
  const scope = { ...visibleRequestsWhere(session.user), ...(projectId ? { projectId } : {}) };
  const where = {
    ...scope,
    status,
    categoryId,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { description: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [rows, total, categories, counts] = await Promise.all([
    prisma.workRequest.findMany({
      where,
      include: {
        category: true,
        createdBy: { select: { name: true } },
        project: { select: { name: true } },
        _count: { select: { taskLinks: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      skip: (page - 1) * 30,
    }),
    prisma.workRequest.count({ where }),
    prisma.requestCategory.findMany({ orderBy: { nameEn: 'asc' } }),
    prisma.workRequest.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
  ]);
  const baseUrl = projectId ? `/projects/${projectId}/requests` : '/requests';
  const hasFilters = Boolean(q || status || categoryId);
  const overallCount = counts.reduce((sum, item) => sum + item._count._all, 0);
  const activeProjects = projects.filter((p) => !p.isArchived);
  function viewUrl(nextStatus: string | undefined = status, nextPage = 1) {
    const sp = new URLSearchParams({
      ...(q ? { q } : {}),
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(nextPage > 1 ? { page: String(nextPage) } : {}),
    });
    return `${baseUrl}${sp.size ? `?${sp}` : ''}`;
  }
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[color:var(--text-muted)]">
            {project ? <Folder size={15} aria-hidden /> : <Inbox size={15} aria-hidden />}
            <span>{project ? t('projectWorkspace') : t('allProjects')}</span>
          </div>
          <h1 className="text-start break-words text-2xl font-semibold tracking-tight">
            <bdi className="request-copy">{project?.name ?? t('requests')}</bdi>
          </h1>
          <p className="mt-2 flex items-start gap-1.5 text-sm text-[color:var(--text-muted)]">
            {session.user.role !== 'admin' && (
              <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
            )}
            {session.user.role === 'admin' ? t('adminHint') : t('memberHint')}
          </p>
        </div>
        {project && !project.isArchived ? (
          <Link
            href={`/projects/${project.id}/requests/new`}
            aria-label={t('new')}
            title={t('new')}
            className={buttonClass({ className: 'request-toolbar-action shrink-0' })}
          >
            <Plus size={17} aria-hidden />
            <span className="hidden sm:inline">{t('new')}</span>
          </Link>
        ) : !project && activeProjects.length > 0 ? (
          <details className="group relative">
            <summary
              aria-label={t('new')}
              title={t('new')}
              className={buttonClass({
                className:
                  'request-toolbar-action cursor-pointer list-none [&::-webkit-details-marker]:hidden',
              })}
            >
              <Plus size={17} aria-hidden />
              <span className="hidden sm:inline">{t('new')}</span>
            </summary>
            <div className="absolute end-0 z-20 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2 shadow-[var(--shadow-md)]">
              <p className="px-3 py-2 text-xs text-[color:var(--text-muted)]">{t('chooseProject')}</p>
              <div className="max-h-64 overflow-y-auto">
                {activeProjects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}/requests/new`}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-[color:var(--accent-soft)]"
                  >
                    <Folder size={15} className="shrink-0" aria-hidden />
                    <span className="break-words">
                      <bdi>{p.name}</bdi>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </details>
        ) : null}
      </header>
      {project && <ProjectTabs projectId={project.id} active="requests" />}
      {project?.isArchived && (
        <p className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4 text-sm">
          {t('archivedProject')}
        </p>
      )}
      <section className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-4 py-3 sm:px-5">
          <div className="flex w-full items-center justify-between gap-3 sm:hidden">
            <span className="shrink-0 text-xs font-medium text-[color:var(--text-muted)]">
              {t('count', { count: total })}
            </span>
            <div
              className="min-w-0 max-w-52 flex-1"
              key={`mobile:${q ?? ''}:${status ?? ''}:${categoryId ?? ''}`}
            >
              <Select
                form="request-filters"
                name="status"
                defaultValue={status ?? ''}
                aria-label={t('status')}
              >
                <option value="">{t('allStatuses')}</option>
                {REQUEST_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`statuses.${s}`)} ({counts.find((c) => c.status === s)?._count._all ?? 0})
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <nav aria-label={t('statusViews')} className="hidden flex-wrap gap-1 sm:flex">
            {[undefined, ...REQUEST_STATUSES].map((s) => (
              <Link
                key={s ?? 'all'}
                href={viewUrl(s ?? '', 1)}
                aria-current={status === s ? 'page' : undefined}
                className={cx(
                  'inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]',
                  status === s
                    ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]'
                    : 'text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)]',
                )}
              >
                {s ? t(`statuses.${s}`) : t('allRequests')}
                <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-xs tabular-nums">
                  {s ? (counts.find((c) => c.status === s)?._count._all ?? 0) : overallCount}
                </span>
              </Link>
            ))}
          </nav>
          {session.user.role === 'admin' && (
            <Link
              href="/admin/request-categories"
              className="hidden items-center gap-1.5 rounded-lg p-2 text-xs sm:inline-flex text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)]"
            >
              <Settings2 size={15} aria-hidden />
              {t('categories')}
            </Link>
          )}
        </div>
        <form
          id="request-filters"
          key={`${q ?? ''}:${status ?? ''}:${categoryId ?? ''}`}
          className="flex flex-wrap items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--background)]/50 p-4 sm:px-5"
          role="search"
        >
          <div className="relative min-w-0 flex-[2_1_220px]">
            <Search
              size={17}
              aria-hidden
              className="pointer-events-none absolute start-3 top-3.5 text-[color:var(--text-faint)]"
            />
            <Input
              dir="auto"
              className="request-field request-search-field"
              name="q"
              defaultValue={q}
              placeholder={t('search')}
              aria-label={t('search')}
            />
          </div>
          <div className="min-w-0 flex-[1_1_140px]">
            <Select name="categoryId" defaultValue={categoryId ?? ''} aria-label={t('category')}>
              <option value="">{t('allCategories')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === 'ar' ? c.nameAr : c.nameEn}
                  {c.isArchived ? ` (${t('archived')})` : ''}
                </option>
              ))}
            </Select>
          </div>
          <button
            aria-label={t('filter')}
            title={t('filter')}
            className={buttonClass({ variant: 'secondary', className: 'request-toolbar-action h-11' })}
          >
            <SlidersHorizontal size={16} aria-hidden />
            <span className="hidden sm:inline">{t('filter')}</span>
          </button>
          {hasFilters && (
            <Link
              href={baseUrl}
              aria-label={t('clearFilters')}
              title={t('clearFilters')}
              className={buttonClass({ variant: 'ghost', size: 'sm', className: 'request-toolbar-action' })}
            >
              <X size={14} aria-hidden />
              <span className="hidden sm:inline">{t('clearFilters')}</span>
            </Link>
          )}
        </form>
        <div className="hidden items-center justify-between px-5 py-3 text-xs sm:flex text-[color:var(--text-muted)]">
          <span>{t('count', { count: total })}</span>
          <span className="hidden sm:inline">{t('newestFirst')}</span>
        </div>
        <div
          className="hidden grid-cols-[minmax(0,1fr)_160px_130px_32px] gap-5 border-y border-[color:var(--border)] bg-[color:var(--surface-muted)]/60 px-5 py-2.5 text-xs font-medium text-[color:var(--text-muted)] lg:grid"
          aria-hidden
        >
          <span>{t('requestColumn')}</span>
          <span>{t('reporter')}</span>
          <span>{t('status')}</span>
          <span />
        </div>
        <div className="divide-y divide-[color:var(--border)]">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/requests/${r.id}`}
              className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-5 transition-colors hover:bg-[color:var(--accent-soft)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--accent)] sm:px-5 lg:grid-cols-[minmax(0,1fr)_160px_130px_32px] lg:gap-5"
            >
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[color:var(--text-muted)]">
                  <span className="font-mono text-[color:var(--text-faint)]">
                    <bdi>#{r.number}</bdi>
                  </span>
                  <span className="h-3 w-px bg-[color:var(--border-strong)]" aria-hidden />
                  <span>{locale === 'ar' ? r.category.nameAr : r.category.nameEn}</span>
                  {!project && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="truncate">
                        <bdi>{r.project.name}</bdi>
                      </span>
                    </>
                  )}
                </div>
                <h2 className="text-start break-words font-semibold leading-snug group-hover:text-[color:var(--accent-strong)]">
                  <bdi className="request-copy">{r.title}</bdi>
                </h2>
                <p
                  dir="auto"
                  className="request-copy text-left rtl:text-right mt-1.5 line-clamp-1 break-words text-sm text-[color:var(--text-muted)]"
                >
                  {r.description}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[color:var(--text-muted)]">
                  <span className="lg:hidden">
                    <bdi>{r.createdBy.name}</bdi>
                  </span>
                  {r._count.taskLinks > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Link2 size={13} aria-hidden />
                      {t('linkCount', { count: r._count.taskLinks })}
                    </span>
                  )}
                </div>
              </div>
              <div className="hidden min-w-0 text-xs lg:block">
                <p className="truncate font-medium">
                  <bdi>{r.createdBy.name}</bdi>
                </p>
                <p className="mt-1.5 text-[color:var(--text-muted)]">
                  <FormattedDate timeZone="Asia/Muscat" iso={r.createdAt.toISOString()} />
                </p>
              </div>
              <div className="col-start-1 row-start-2 lg:col-auto lg:row-auto">
                <RequestStatusBadge status={r.status} label={t(`statuses.${r.status}`)} />
              </div>
              <ChevronRight
                size={18}
                aria-hidden
                className="col-start-2 row-start-1 text-[color:var(--text-faint)] transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5 lg:col-auto lg:row-auto"
              />
            </Link>
          ))}
          {!rows.length && (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                <Inbox size={23} aria-hidden />
              </div>
              <h2 className="font-semibold">{hasFilters ? t('empty') : t('emptyTitle')}</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[color:var(--text-muted)]">
                {hasFilters
                  ? t('emptyFilteredHint')
                  : !activeProjects.length
                    ? t('noProjects')
                    : t('emptyHint')}
              </p>
              {hasFilters && (
                <Link
                  href={baseUrl}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--accent-strong)]"
                >
                  {t('clearFilters')}
                  <X size={15} aria-hidden />
                </Link>
              )}
            </div>
          )}
        </div>
        {total > 30 && (
          <nav
            className="flex items-center justify-between border-t border-[color:var(--border)] px-5 py-3"
            aria-label={t('pagination')}
          >
            {page > 1 ? (
              <Link
                className={buttonClass({ variant: 'secondary', size: 'sm' })}
                href={viewUrl(status, page - 1)}
              >
                {t('previous')}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-[color:var(--text-muted)]">
              {t('pageOf', { page, pages: Math.ceil(total / 30) })}
            </span>
            {page * 30 < total ? (
              <Link
                className={buttonClass({ variant: 'secondary', size: 'sm' })}
                href={viewUrl(status, page + 1)}
              >
                {t('next')}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
