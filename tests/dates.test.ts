import { describe, expect, it } from 'vitest';
import { addDays, dueBucket, endOfWeek, formatDueDate, todayIso } from '@/lib/dates';

describe('todayIso', () => {
  it('uses Muscat time (UTC+4), not the server clock', () => {
    // 21:30 UTC on the 29th is already 01:30 on the 30th in Muscat.
    expect(todayIso(new Date('2026-10-29T21:30:00Z'))).toBe('2026-10-30');
    expect(todayIso(new Date('2026-10-29T19:59:00Z'))).toBe('2026-10-29');
  });
});

describe('endOfWeek (weeks run Sunday–Saturday)', () => {
  it('returns the coming Saturday', () => {
    expect(endOfWeek('2026-10-29')).toBe('2026-10-31'); // Thursday
    expect(endOfWeek('2026-11-01')).toBe('2026-11-07'); // Sunday
    expect(endOfWeek('2026-10-31')).toBe('2026-10-31'); // Saturday
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(endOfWeek('2026-12-30')).toBe('2027-01-02');
  });
});

describe('dueBucket', () => {
  const today = '2026-10-29'; // Thursday
  it.each([
    [null, 'none'],
    ['2026-10-28', 'overdue'],
    ['2026-10-29', 'today'],
    ['2026-10-31', 'thisWeek'],
    ['2026-11-01', 'later'],
  ] as const)('%s → %s', (due, bucket) => {
    expect(dueBucket(due, today)).toBe(bucket);
  });
});

describe('formatDueDate', () => {
  it('shows day and month, adding the year only when it differs', () => {
    expect(formatDueDate('2026-11-05', 'en', '2026-10-29')).toBe('5 Nov');
    expect(formatDueDate('2027-01-05', 'en', '2026-10-29')).toBe('5 Jan 2027');
  });

  it('never shifts the calendar date', () => {
    expect(formatDueDate('2026-11-01', 'en', '2026-10-29')).toBe('1 Nov');
  });
});
