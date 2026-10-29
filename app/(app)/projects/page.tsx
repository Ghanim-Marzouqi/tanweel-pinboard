import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Archive, FolderKanban, Plus, Users } from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin, visibleProjectsWhere } from '@/lib/access';
import { buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/projects');
  const t = await getTranslations('projects');

  const projects = await prisma.project.findMany({
    where: visibleProjectsWhere(session.user),
    include: {
      owner: { select: { name: true } },
      _count: { select: { members: true, tasks: true } },
    },
    orderBy: { name: 'asc' },
  });
  const openCounts = await prisma.task.groupBy({
    by: ['projectId'],
    where: { projectId: { in: projects.map((p) => p.id) }, status: { not: 'Done' } },
    _count: { _all: true },
  });
  const openByProject = new Map(openCounts.map((c) => [c.projectId, c._count._all]));

  const active = projects.filter((p) => !p.isArchived);
  const archived = projects.filter((p) => p.isArchived);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            {isAdmin(session.user) ? t('subtitleAdmin') : t('subtitle')}
          </p>
        </div>
        <Link href="/projects/new" className={buttonClass({ className: 'whitespace-nowrap' })}>
          <Plus size={16} />
          {t('addNew')}
        </Link>
      </div>

      {active.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
          <FolderKanban size={36} className="text-[color:var(--text-faint)]" />
          <p className="text-sm text-[color:var(--text-muted)]">{t('empty')}</p>
          <Link href="/projects/new" className={buttonClass({})}>
            {t('addNew')}
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="flex flex-col rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-sm)] transition-colors hover:border-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]"
            >
              <div className="flex items-start gap-2">
                <FolderKanban size={18} className="mt-0.5 shrink-0 text-[color:var(--accent)]" />
                <h2 className="min-w-0 flex-1 truncate font-semibold tracking-tight">{p.name}</h2>
              </div>
              {p.description && (
                <p className="mt-2 line-clamp-2 text-sm text-[color:var(--text-muted)]">{p.description}</p>
              )}
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-xs text-[color:var(--text-faint)]">
                <span className="font-medium text-[color:var(--text-muted)]">
                  {t('openCount', { count: openByProject.get(p.id) ?? 0 })}
                </span>
                <span>{t('taskCount', { count: p._count.tasks })}</span>
                <span className="inline-flex items-center gap-1">
                  <Users size={12} />
                  {t('memberCount', { count: p._count.members })}
                </span>
                <span className="truncate">
                  {t('owner')}: {p.owner.name}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-muted)]">
            <Archive size={14} />
            {t('archived')}
          </h2>
          <Card className="divide-y divide-[color:var(--border)]">
            {archived.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-[color:var(--surface-muted)]"
              >
                <span className="truncate text-[color:var(--text-muted)]">{p.name}</span>
                <span className="shrink-0 text-xs text-[color:var(--text-faint)]">
                  {t('taskCount', { count: p._count.tasks })}
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
