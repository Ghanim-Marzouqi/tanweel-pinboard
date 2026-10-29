'use client';

import { useSyncExternalStore } from 'react';
import { useLocale } from 'next-intl';
import { formatDateTime } from '@/lib/utils';

const subscribe = () => () => {};

/**
 * Renders a formatted date that is hydration-safe. The server renders the
 * raw ISO date (deterministic, no timezone conversion); after hydration, the
 * client renders the locale-aware formatted version using the browser's
 * timezone.
 */
export function FormattedDate({ iso, className }: { iso: string; className?: string }) {
  const locale = useLocale();
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const text = hydrated ? formatDateTime(iso, locale) : iso.slice(0, 16).replace('T', ' ');

  return (
    <span suppressHydrationWarning className={className}>
      {text}
    </span>
  );
}
