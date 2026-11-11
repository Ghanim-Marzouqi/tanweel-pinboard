export type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'docx' | 'xlsx' | 'unsupported';

/** Exact allowlist: never render uploaded HTML/SVG or trust a renamed extension. */
export function previewKind(contentType: string): PreviewKind {
  if (['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(contentType)) return 'image';
  if (['video/mp4', 'video/quicktime', 'video/webm'].includes(contentType)) return 'video';
  if (
    ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm'].includes(contentType)
  )
    return 'audio';
  if (contentType === 'application/pdf') return 'pdf';
  if (['text/plain', 'text/csv'].includes(contentType)) return 'text';
  if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    return 'docx';
  if (contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  return 'unsupported';
}

export const TEXT_PREVIEW_BYTES = 256 * 1024;
export const OFFICE_PREVIEW_BYTES = 10 * 1024 * 1024;
export const PREVIEW_ROWS = 200;
export const PREVIEW_COLUMNS = 30;
export type DocumentPreview =
  | { text: string; truncated: boolean }
  | {
      sheets: { name: string; rows: string[][]; truncated: boolean }[];
    };

/** One RFC 9110 byte range. Multiple ranges are deliberately rejected. */
export function parseByteRange(value: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || size <= 0) return null;
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last)))
    return null;
  if (first === null) {
    if (!last) return null;
    return { start: Math.max(0, size - last), end: size - 1 };
  }
  if (first >= size || (last !== null && last < first)) return null;
  return { start: first, end: Math.min(last ?? size - 1, size - 1) };
}
