/**
 * Dates for Tanweel: everything is shown in Muscat time and weeks run
 * Sunday–Saturday. Due dates are calendar dates (`YYYY-MM-DD`); Prisma
 * represents a `@db.Date` as a Date at UTC midnight of that day.
 */
export const APP_TIME_ZONE = 'Asia/Muscat';

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in Muscat, e.g. "2026-10-29". */
export function todayIso(now: Date = new Date()): string {
  return isoDateFormatter.format(now);
}

/** "2026-10-29" → Date at UTC midnight (what Prisma stores for @db.Date). */
export function isoToDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Date from a @db.Date column → "2026-10-29". */
export function dateToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = isoToDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return dateToIso(d);
}

/** Saturday of the Sunday–Saturday week containing `iso`. */
export function endOfWeek(iso: string): string {
  return addDays(iso, 6 - isoToDate(iso).getUTCDay());
}

export type DueBucket = 'overdue' | 'today' | 'thisWeek' | 'later' | 'none';

/** Which "My tasks" group a due date falls into. */
export function dueBucket(dueIso: string | null, today: string): DueBucket {
  if (!dueIso) return 'none';
  if (dueIso < today) return 'overdue';
  if (dueIso === today) return 'today';
  if (dueIso <= endOfWeek(today)) return 'thisWeek';
  return 'later';
}

/** Short due-date label, e.g. "29 Oct" (adds the year when it isn't this year). */
export function formatDueDate(dueIso: string, locale: string, today: string = todayIso()): string {
  const sameYear = dueIso.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-OM' : 'en-GB', {
    timeZone: 'UTC', // the value is a calendar date; don't shift it
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    numberingSystem: 'latn',
  }).format(isoToDate(dueIso));
}
