import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { visibleProjectsWhere } from '@/lib/access';
import { RequestQuerySchema, REQUEST_STATUSES, visibleRequestsWhere } from '@/lib/requests';
import { ProjectTabs } from '@/components/project-tabs';
import { buttonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormattedDate } from '@/components/formatted-date';

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
  const query = parsed.success ? parsed.data : RequestQuerySchema.parse({});
  const { q, status, categoryId, page } = query;
  const where = {
    ...visibleRequestsWhere(session.user),
    ...(projectId ? { projectId } : {}),
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
  const [rows, total, categories] = await Promise.all([
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
  ]);
  function pageUrl(n: number) {
    const sp = new URLSearchParams({
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      ...(categoryId ? { categoryId } : {}),
      page: String(n),
    });
    return `?${sp}`;
  }
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{project?.name ?? t('requests')}</h1>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            {session.user.role === 'admin' ? t('adminHint') : t('memberHint')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {session.user.role === 'admin' && (
            <Link href="/admin/request-categories" className={buttonClass({ variant: 'secondary' })}>
              {t('categories')}
            </Link>
          )}
          {project && !project.isArchived && (
            <Link href={`/projects/${project.id}/requests/new`} className={buttonClass()}>
              {t('new')}
            </Link>
          )}
        </div>
      </header>
      {project && <ProjectTabs projectId={project.id} active="requests" />}
      {project?.isArchived && (
        <p className="rounded-lg bg-[color:var(--surface-muted)] p-4">{t('archivedProject')}</p>
      )}
      {!project && (
        <details className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <summary className="cursor-pointer font-medium">{t('chooseProject')}</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {projects
              .filter((p) => !p.isArchived)
              .map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}/requests`}
                  className={buttonClass({ variant: 'secondary' })}
                >
                  {p.name}
                </Link>
              ))}
            {projects.length === 0 && <p>{t('noProjects')}</p>}
          </div>
        </details>
      )}
      <form className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]" role="search">
        <Input name="q" defaultValue={q} placeholder={t('search')} aria-label={t('search')} />
        <Select name="status" defaultValue={status ?? ''} aria-label={t('status')}>
          <option value="">{t('allStatuses')}</option>
          {REQUEST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </Select>
        <Select name="categoryId" defaultValue={categoryId ?? ''} aria-label={t('category')}>
          <option value="">{t('allCategories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {locale === 'ar' ? c.nameAr : c.nameEn}
              {c.isArchived ? ` (${t('archived')})` : ''}
            </option>
          ))}
        </Select>
        <button className={buttonClass({ variant: 'secondary' })}>{t('filter')}</button>
      </form>
      <p className="text-sm text-[color:var(--text-muted)]">{t('count', { count: total })}</p>
      <div className="space-y-3">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/requests/${r.id}`}
            className="block rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 hover:border-[color:var(--accent)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold break-words">
                <span className="me-2 text-[color:var(--text-faint)]">#{r.number}</span>
                {r.title}
              </h2>
              <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-sm text-[color:var(--accent-strong)]">
                {t(`statuses.${r.status}`)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[color:var(--text-muted)]">
              <span>{locale === 'ar' ? r.category.nameAr : r.category.nameEn}</span>
              {!project && <span>{r.project.name}</span>}
              <span>{r.createdBy.name}</span>
              <FormattedDate timeZone="Asia/Muscat" iso={r.createdAt.toISOString()} />
              <span>{t('linkCount', { count: r._count.taskLinks })}</span>
            </div>
          </Link>
        ))}
        {!rows.length && (
          <div className="rounded-xl border border-dashed border-[color:var(--border)] p-10 text-center text-[color:var(--text-muted)]">
            {t('empty')}
          </div>
        )}
      </div>
      <nav className="flex items-center justify-between" aria-label={t('pagination')}>
        {page > 1 ? (
          <Link className={buttonClass({ variant: 'secondary' })} href={pageUrl(page - 1)}>
            {t('previous')}
          </Link>
        ) : (
          <span />
        )}
        {page * 30 < total && (
          <Link className={buttonClass({ variant: 'secondary' })} href={pageUrl(page + 1)}>
            {t('next')}
          </Link>
        )}
      </nav>
    </div>
  );
}
