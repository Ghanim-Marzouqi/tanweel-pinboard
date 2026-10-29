'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from '@/i18n/request';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function setLocaleAction(locale: Locale) {
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
  });
  // Remember it on the account too, so emails use the same language.
  const session = await auth();
  if (session?.user?.id) {
    await prisma.user.update({ where: { id: session.user.id }, data: { locale } }).catch(() => undefined);
  }
  revalidatePath('/', 'layout');
}
