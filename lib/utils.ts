export type ClassValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | ClassValue[]
  | { [key: string]: boolean | undefined | null };

export function cx(...inputs: ClassValue[]): string {
  const classes: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === 'string' || typeof input === 'number') {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      const inner = cx(...input);
      if (inner) classes.push(inner);
    } else if (typeof input === 'object') {
      for (const key of Object.keys(input)) {
        if (input[key]) classes.push(key);
      }
    }
  }
  return classes.join(' ');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDateTime(value: string | Date, locale: string, timeZone?: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  // Force Latin (Western Arabic) numerals everywhere — even when locale is `ar`
  // the user wants 26/04/2026 rather than ٢٦/٠٤/٢٠٢٦.
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-OM' : 'en-GB', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
    numberingSystem: 'latn',
  }).format(date);
}

/** Only follow same-origin paths after sign-in (never `//host`, `/\host` or absolute URLs). */
export function safeCallbackUrl(value: string | null | undefined, fallback = '/'): string {
  if (value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) {
    return value;
  }
  return fallback;
}
