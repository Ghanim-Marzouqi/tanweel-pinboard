import type { Metadata } from 'next';
import { Tajawal } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { SessionProvider } from 'next-auth/react';
import { readLocale } from '@/i18n/request';
import { auth } from '@/lib/auth';
import { ConfirmProvider } from '@/components/confirm-dialog';
import { ToastProvider } from '@/components/toast';
import './globals.css';

// Arabic UI font. Downloaded at build time and served from this app (no
// requests to Google at runtime). Tajawal has no 600, so semibold uses 700.
const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-arabic',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  return { title: t('brand'), description: t('tagline') };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await readLocale();
  const messages = await getMessages();
  const session = await auth();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className={`${tajawal.variable} h-full antialiased`}>
      <body className="min-h-full">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SessionProvider session={session}>
            <ToastProvider>
              <ConfirmProvider>{children}</ConfirmProvider>
            </ToastProvider>
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
