import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

/**
 * Attachment files on the server's disk (a Docker volume in production).
 * The `turbopackIgnore` comments stop Next's file tracer from treating these
 * runtime paths as code to bundle (it would otherwise copy the whole project).
 * Keys look like `<taskId>/<uuid>.<ext>`; everything for a task lives in one
 * folder so deleting the task removes its files in one go.
 */
const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOADS_DIR ?? 'storage');

/** Absolute path for a key, refusing anything that would escape ROOT. */
export function resolveKey(key: string): string {
  const full = path.resolve(/*turbopackIgnore: true*/ ROOT, key);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return full;
}

/** File extension safe to use in a storage key (".pdf"), or "" if none/suspicious. */
export function safeExtension(fileName: string, contentType: string): string {
  const match = /\.([a-z0-9]{1,10})$/i.exec(fileName);
  if (match) return `.${match[1].toLowerCase()}`;
  if (contentType === 'application/pdf') return '.pdf';
  const image = /^image\/([a-z0-9]{1,10})$/.exec(contentType);
  return image ? `.${image[1]}` : '';
}

export async function putObject(key: string, body: Buffer): Promise<void> {
  const file = resolveKey(key);
  await mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ file, body, { flag: 'wx' });
}

/** Open a stored file for reading, or null if it isn't on disk. */
export async function openObject(key: string): Promise<{ stream: Readable; size: number } | null> {
  const file = resolveKey(key);
  try {
    const info = await stat(/*turbopackIgnore: true*/ file);
    return { stream: createReadStream(/*turbopackIgnore: true*/ file), size: info.size };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function removeObject(key: string): Promise<void> {
  await rm(/*turbopackIgnore: true*/ resolveKey(key), { force: true });
}

/** Remove every file under `prefix` (e.g. `<taskId>/`). */
export async function removeFolder(prefix: string): Promise<void> {
  const dir = resolveKey(prefix);
  if (dir === ROOT) throw new Error('Refusing to remove the storage root');
  await rm(/*turbopackIgnore: true*/ dir, { recursive: true, force: true });
}
