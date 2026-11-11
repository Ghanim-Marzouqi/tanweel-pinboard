import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { resolveKey } from '@/lib/storage';
import { parseByteRange, previewKind } from '@/lib/attachment-preview';

/** Called only after both parent and attachment authorization have succeeded. */
export async function attachmentResponse(
  req: Request,
  attachment: {
    storageKey: string;
    contentType: string;
    fileName: string;
  },
) {
  const path = resolveKey(attachment.storageKey);
  let size: number;
  try {
    size = (await stat(/*turbopackIgnore: true*/ path)).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return Response.json({ error: 'File is missing from storage' }, { status: 404 });
    throw error;
  }
  const kind = previewKind(attachment.contentType);
  const inline = new URL(req.url).searchParams.get('preview') === '1' && kind !== 'unsupported';
  const headers = new Headers({
    'Content-Type': kind === 'unsupported' ? 'application/octet-stream' : attachment.contentType,
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Accept-Ranges': 'bytes',
  });
  // HEAD describes the full representation. No validators: ignore If-Range and return a full body.
  const rangeHeader = req.method === 'GET' && !req.headers.has('if-range') ? req.headers.get('range') : null;
  const range = rangeHeader ? parseByteRange(rangeHeader, size) : undefined;
  if (range === null) {
    headers.set('Content-Range', `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  headers.set('Content-Length', String(range ? end - start + 1 : size));
  if (range) headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  const stream =
    req.method === 'HEAD' || size === 0
      ? null
      : Readable.toWeb(createReadStream(/*turbopackIgnore: true*/ path, { start, end }));
  return new Response(stream as ReadableStream<Uint8Array> | null, { status: range ? 206 : 200, headers });
}
