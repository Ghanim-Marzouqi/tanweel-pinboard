import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { LocaleToggle } from '@/components/locale-toggle';
import { SignOutButton } from '@/components/sign-out-button';
import { RoleBadge } from '@/components/role-badge';
import { BrandMark } from '@/components/brand-mark';

export async function Header() {
  const session = await auth();
  const t = await getTranslations('app');

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--surface)]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/tasks"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg text-[color:var(--text)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]"
        >
          <BrandMark />
          <span className="text-base font-semibold tracking-tight">{t('brand')}</span>
        </Link>

        <div className="ms-auto flex items-center gap-2">
          {session?.user?.id && (
            <div className="hidden items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-sm sm:inline-flex">
              <span className="max-w-[12rem] truncate text-[color:var(--text)]">
                {session.user.name || session.user.username}
              </span>
              <RoleBadge role={session.user.role} />
            </div>
          )}
          {session?.user?.id && (
            <div className="inline-flex sm:hidden">
              <RoleBadge role={session.user.role} />
            </div>
          )}
          <LocaleToggle compact />
          {session?.user?.id && <SignOutButton />}
        </div>
      </div>
    </header>
  );
}
