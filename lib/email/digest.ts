import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { APP_TIME_ZONE, dateToIso, isoToDate, todayIso } from '@/lib/dates';
import { enqueueEmails } from '@/lib/email/outbox';
import { digestEmail, emailLocale, type TaskInfo } from '@/lib/email/templates';

/** Local hour the morning summary goes out (Muscat time). */
const DIGEST_HOUR = Number(process.env.DAILY_DIGEST_HOUR ?? 7);

const clockFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  hour: 'numeric',
  hourCycle: 'h23',
  weekday: 'short',
});
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Hour (0–23) and weekday (0 = Sunday) in Muscat. */
export function muscatClock(now: Date = new Date()): { hour: number; weekday: number } {
  const parts = Object.fromEntries(clockFormat.formatToParts(now).map((p) => [p.type, p.value]));
  return { hour: Number(parts.hour), weekday: WEEKDAYS.indexOf(parts.weekday) };
}

/** Summaries go out on Oman's work days (Sunday–Thursday) from DIGEST_HOUR. */
export function isDigestTime(now: Date = new Date(), hour: number = DIGEST_HOUR): boolean {
  const clock = muscatClock(now);
  return clock.weekday >= 0 && clock.weekday <= 4 && clock.hour >= hour;
}

/**
 * Queue a summary for everyone who has overdue or due-today open tasks (and
 * hasn't switched the summary off). Returns how many emails were queued.
 */
export async function sendDailyDigests(day: string = todayIso()): Promise<number> {
  const people = await prisma.user.findMany({
    where: { isActive: true, dailyDigest: true, email: { not: null } },
    select: { id: true, name: true, email: true, locale: true },
  });
  if (people.length === 0) return 0;

  const tasks = await prisma.task.findMany({
    where: {
      assigneeId: { in: people.map((p) => p.id) },
      status: { not: 'Done' },
      dueDate: { lte: isoToDate(day) },
      project: { isArchived: false },
    },
    select: {
      id: true,
      title: true,
      priority: true,
      dueDate: true,
      assigneeId: true,
      project: { select: { name: true } },
    },
    orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
  });

  const emails = people.flatMap((person) => {
    const mine = tasks.filter((t) => t.assigneeId === person.id);
    const info = (t: (typeof mine)[number]): TaskInfo => ({
      id: t.id,
      title: t.title,
      projectName: t.project.name,
      priority: t.priority,
      dueDate: t.dueDate ? dateToIso(t.dueDate) : null,
    });
    const overdue = mine.filter((t) => t.dueDate && dateToIso(t.dueDate) < day).map(info);
    const today = mine.filter((t) => t.dueDate && dateToIso(t.dueDate) === day).map(info);
    if (overdue.length + today.length === 0) return [];
    return [digestEmail(person.email!, emailLocale(person.locale), person.name, overdue, today)];
  });

  await enqueueEmails(emails);
  return emails.length;
}

/** Called by the background sender: runs the day's summary once, at the right time. */
export async function maybeSendDailyDigests(now: Date = new Date()): Promise<void> {
  if ((process.env.DAILY_DIGEST ?? 'on') === 'off' || !isDigestTime(now)) return;
  const day = todayIso(now);
  try {
    // The primary key on `day` makes this a once-a-day lock, even with several app instances.
    await prisma.digestRun.create({ data: { day: isoToDate(day) } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
    throw err;
  }
  const count = await sendDailyDigests(day);
  console.log(`[email] Morning summary for ${day}: ${count} email(s) queued`);
}
