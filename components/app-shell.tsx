'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Inbox,
  Tags,
  CircleCheckBig,
  FolderKanban,
  LayoutGrid,
  Menu,
  Plus,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { LocaleToggle } from '@/components/locale-toggle';
import { SignOutButton } from '@/components/sign-out-button';
import { RoleBadge } from '@/components/role-badge';
import { cx } from '@/lib/utils';
import type { Role } from '@/lib/roles';

export interface ShellUser {
  name: string;
  username: string;
  role: Role;
}

export interface ShellProject {
  id: string;
  name: string;
}

interface Props {
  user: ShellUser;
  projects: ShellProject[];
  /** Hide navigation (e.g. while the user must change a temporary password). */
  minimal?: boolean;
  children: React.ReactNode;
}

export function AppShell({ user, projects, minimal = false, children }: Props) {
  const t = useTranslations('nav');
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-[100svh]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--surface)]/85 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          {!minimal && (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t('openMenu')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)] lg:hidden"
            >
              <Menu size={18} />
            </button>
          )}
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg text-[color:var(--text)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]"
          >
            <BrandMark />
            <BrandName />
          </Link>

          <div className="ms-auto flex items-center gap-2">
            <Link
              href="/account"
              className="hidden items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-sm hover:bg-[color:var(--surface-muted)] sm:inline-flex"
            >
              <span className="max-w-[12rem] truncate text-[color:var(--text)]">
                {user.name || user.username}
              </span>
              <RoleBadge role={user.role} />
            </Link>
            <LocaleToggle compact />
            <SignOutButton />
          </div>
        </div>
      </header>

      {minimal ? (
        <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      ) : (
        <div className="flex">
          {/* Desktop sidebar */}
          <aside className="sticky top-[61px] hidden h-[calc(100svh-61px)] w-64 shrink-0 overflow-y-auto border-e border-[color:var(--border)] bg-[color:var(--surface)] lg:block">
            <SidebarNav user={user} projects={projects} onNavigate={() => undefined} />
          </aside>

          {/* Mobile drawer */}
          {menuOpen && (
            <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
              <button
                type="button"
                aria-label={t('closeMenu')}
                className="absolute inset-0 bg-black/30"
                onClick={() => setMenuOpen(false)}
              />
              <aside className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-[color:var(--surface)] shadow-[var(--shadow-md)]">
                <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
                  <div className="inline-flex items-center gap-2">
                    <BrandMark size={32} />
                    <BrandName />
                  </div>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    aria-label={t('closeMenu')}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)]"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <SidebarNav user={user} projects={projects} onNavigate={() => setMenuOpen(false)} />
                </div>
              </aside>
            </div>
          )}

          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      )}
    </div>
  );
}

function BrandName() {
  const t = useTranslations('app');
  return <span className="text-base font-semibold tracking-tight">{t('brand')}</span>;
}

function SidebarNav({
  user,
  projects,
  onNavigate,
}: {
  user: ShellUser;
  projects: ShellProject[];
  onNavigate: () => void;
}) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col gap-6 p-3">
      <div className="space-y-1">
        <NavLink
          href="/requests"
          active={pathname.startsWith('/requests') || /\/projects\/[^/]+\/requests/.test(pathname)}
          onNavigate={onNavigate}
        >
          <Inbox size={16} />
          {t('requests')}
        </NavLink>
        <NavLink href="/" active={pathname === '/'} onNavigate={onNavigate}>
          <CircleCheckBig size={16} />
          {t('myTasks')}
        </NavLink>
        <NavLink href="/projects" active={pathname === '/projects'} onNavigate={onNavigate}>
          <LayoutGrid size={16} />
          {t('allProjects')}
        </NavLink>
      </div>

      <div className="min-h-0 flex-1">
        <div className="mb-1 flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-faint)]">
            {t('projects')}
          </span>
          <Link
            href="/projects/new"
            onClick={onNavigate}
            title={t('newProject')}
            aria-label={t('newProject')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text)]"
          >
            <Plus size={16} />
          </Link>
        </div>
        {projects.length === 0 ? (
          <p className="px-2 py-1 text-sm text-[color:var(--text-faint)]">{t('noProjects')}</p>
        ) : (
          <ul className="space-y-0.5">
            {projects.map((p) => (
              <li key={p.id}>
                <NavLink
                  href={`/projects/${p.id}`}
                  active={pathname === `/projects/${p.id}` || pathname.startsWith(`/projects/${p.id}/`)}
                  onNavigate={onNavigate}
                >
                  <FolderKanban size={16} className="shrink-0" />
                  <span className="truncate">{p.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1 border-t border-[color:var(--border)] pt-3">
        {user.role === 'admin' && (
          <NavLink
            href="/admin/request-categories"
            active={pathname.startsWith('/admin/request-categories')}
            onNavigate={onNavigate}
          >
            <Tags size={16} />
            {t('requestCategories')}
          </NavLink>
        )}
        {user.role === 'admin' && (
          <NavLink href="/admin/users" active={pathname.startsWith('/admin/users')} onNavigate={onNavigate}>
            <Users size={16} />
            {t('users')}
          </NavLink>
        )}
        <NavLink href="/account" active={pathname === '/account'} onNavigate={onNavigate}>
          <UserCog size={16} />
          {t('account')}
        </NavLink>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  active,
  onNavigate,
  children,
}: {
  href: string;
  active: boolean;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
        active
          ? 'bg-[color:var(--accent-soft)] font-medium text-[color:var(--accent-strong)]'
          : 'text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text)]',
      )}
    >
      {children}
    </Link>
  );
}
