import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession, badRequest, notFound } from '@/lib/api-auth';
import { visibleNotificationsWhere } from '@/lib/notifications';

async function currentRecipient() {
  const guard = await requireSession();
  if (!guard.ok) return guard;
  // Do not rely on a cached JWT role after an administrator is demoted.
  const user = await prisma.user.findFirst({
    where: { id: guard.session.user.id, isActive: true },
    select: { id: true, role: true, mustChangePassword: true },
  });
  if (!user || user.mustChangePassword)
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { ok: true as const, user };
}
const querySchema = z
  .object({
    count: z.enum(['1']).optional(),
    before: z.iso.datetime().optional(),
    beforeId: z.uuid().optional(),
  })
  .refine((q) => !!q.before === !!q.beforeId);
export async function GET(req: NextRequest) {
  const guard = await currentRecipient();
  if (!guard.ok) return guard.response;
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return badRequest('Invalid cursor');
  const query = parsed.data;
  const where = visibleNotificationsWhere(guard.user);
  const asOf = new Date();
  const unreadCount = await prisma.notification.count({ where: { ...where, readAt: null } });
  if (query.count) return NextResponse.json({ unreadCount });
  const notifications = await prisma.notification.findMany({
    where: {
      AND: [
        where,
        ...(query.before
          ? [
              {
                OR: [
                  { createdAt: { lt: new Date(query.before) } },
                  { createdAt: new Date(query.before), id: { lt: query.beforeId } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 21,
    select: {
      id: true,
      kind: true,
      readAt: true,
      createdAt: true,
      fromStatus: true,
      toStatus: true,
      actor: { select: { name: true } },
      request: { select: { id: true, title: true, number: true } },
      task: { select: { id: true, title: true } },
    },
  });
  return NextResponse.json({
    notifications: notifications.slice(0, 20),
    hasMore: notifications.length > 20,
    unreadCount,
    asOf,
  });
}

const readSchema = z.union([
  z.object({ id: z.uuid() }).strict(),
  z.object({ all: z.literal(true), before: z.iso.datetime() }).strict(),
]);
export async function PATCH(req: NextRequest) {
  const guard = await currentRecipient();
  if (!guard.ok) return guard.response;
  const parsed = readSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid notification update');
  const where = visibleNotificationsWhere(guard.user);
  if ('id' in parsed.data) {
    const item = await prisma.notification.findFirst({
      where: { ...where, id: parsed.data.id },
      select: { id: true },
    });
    if (!item) return notFound('Notification not found');
    await prisma.notification.updateMany({
      where: { ...where, id: item.id, readAt: null },
      data: { readAt: new Date() },
    });
  } else {
    const before = new Date(Math.min(Date.parse(parsed.data.before), Date.now()));
    await prisma.notification.updateMany({
      where: { ...where, readAt: null, createdAt: { lte: before } },
      data: { readAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}
