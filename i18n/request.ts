import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export const SUPPORTED_LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'pinboard-locale';

function isLocale(value: string | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export async function readLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await readLocale();
  const messages = (await import(`@/messages/${locale}.json`)).default;
  return {
    locale,
    messages,
    // Force Latin numerals for Arabic — keeps 1/2/26/2026 instead of ١/٢/٢٦/٢٠٢٦
    // in plural counts and date formatting routed through next-intl.
    formats: {
      number: {
        default: { numberingSystem: 'latn' },
      },
      dateTime: {
        default: { numberingSystem: 'latn' },
        short: { dateStyle: 'short', numberingSystem: 'latn' },
      },
    },
  };
});
