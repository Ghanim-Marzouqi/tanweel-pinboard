'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Languages } from 'lucide-react';
import { setLocaleAction } from '@/app/actions/locale';
import { cx } from '@/lib/utils';

export function LocaleToggle({ compact }: { compact?: boolean }) {
  const locale = useLocale();
  const t = useTranslations('app');
  const [pending, startTransition] = useTransition();
  const next = locale === 'ar' ? 'en' : 'ar';
  const label = next === 'ar' ? 'العربية' : 'English';

  return (
    <button
      type="button"
      title={t('language')}
      aria-label={t('language')}
      disabled={pending}
      onClick={() => startTransition(() => setLocaleAction(next))}
      className={cx(
        'inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-sm text-[color:var(--text-muted)]',
        'transition-colors hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]',
        'disabled:opacity-60',
        compact ? 'h-9 w-9 justify-center' : 'h-9 px-3',
      )}
    >
      <Languages size={16} />
      {!compact && <span>{label}</span>}
    </button>
  );
}
