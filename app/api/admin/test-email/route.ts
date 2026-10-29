import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, requireAdmin } from '@/lib/api-auth';
import { enqueueEmails } from '@/lib/email/outbox';
import { emailLocale, testEmail } from '@/lib/email/templates';

/** Send a test email to the signed-in admin (to check the SMTP settings). */
export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const me = await prisma.user.findUnique({
    where: { id: guard.session.user.id },
    select: { name: true, email: true, locale: true },
  });
  if (!me?.email) return badRequest('Add an email address in My account first');

  await enqueueEmails([testEmail(me.email, emailLocale(me.locale), me.name)]);
  return NextResponse.json({ ok: true, to: me.email });
}
