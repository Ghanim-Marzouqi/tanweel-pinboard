'use client';

import { signOut } from 'next-auth/react';
import { useTransition } from 'react';
import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cx } from '@/lib/utils';

export function SignOutButton() {
  const t = useTranslations('app');
  const [pending, startTransition] = useTransition();
  const onClick = () => startTransition(() => signOut({ callbackUrl: '/login' }));

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title={t('logout')}
      aria-label={t('logout')}
      className={cx(
        'inline-flex h-9 items-center gap-2 rounded-lg border border-transparent px-2 text-sm text-[color:var(--text-muted)]',
        'transition-colors hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]',
        'disabled:opacity-60',
      )}
    >
      <LogOut size={16} />
      <span className="hidden sm:inline">{t('logout')}</span>
    </button>
  );
}
