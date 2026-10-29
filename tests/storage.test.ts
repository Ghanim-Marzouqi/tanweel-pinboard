import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let dir: string;
let storage: typeof import('@/lib/storage');

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'pinboard-storage-'));
  vi.stubEnv('UPLOADS_DIR', dir);
  vi.resetModules();
  storage = await import('@/lib/storage');
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

describe('disk storage', () => {
  it('writes, reads and removes a file', async () => {
    await storage.putObject('task-1/a.txt', Buffer.from('hello'));
    const file = await storage.openObject('task-1/a.txt');
    expect(file?.size).toBe(5);
    expect(await readAll(file!.stream)).toBe('hello');
    await storage.removeObject('task-1/a.txt');
    expect(await storage.openObject('task-1/a.txt')).toBeNull();
  });

  it('removes a whole task folder', async () => {
    await storage.putObject('task-2/a.txt', Buffer.from('a'));
    await storage.putObject('task-2/b.txt', Buffer.from('b'));
    await storage.removeFolder('task-2/');
    expect(await storage.openObject('task-2/a.txt')).toBeNull();
    expect(await storage.openObject('task-2/b.txt')).toBeNull();
  });

  it('refuses keys that escape the storage folder', () => {
    expect(() => storage.resolveKey('../outside.txt')).toThrow();
    expect(() => storage.resolveKey('task/../../outside.txt')).toThrow();
    expect(() => storage.resolveKey('/etc/passwd')).toThrow();
  });

  it('refuses to remove the storage root', async () => {
    await expect(storage.removeFolder('')).rejects.toThrow();
    await expect(storage.removeFolder('.')).rejects.toThrow();
  });
});

describe('safeExtension', () => {
  it('keeps simple extensions, lower-cased', async () => {
    const { safeExtension } = await import('@/lib/storage');
    expect(safeExtension('Report.PDF', 'application/pdf')).toBe('.pdf');
    expect(safeExtension('ملاحظات.txt', 'text/plain')).toBe('.txt');
  });

  it('drops anything that could form a path', async () => {
    const { safeExtension } = await import('@/lib/storage');
    expect(safeExtension('a/../../x', 'text/plain')).toBe('');
    expect(safeExtension('evil.txt/../../etc', 'text/plain')).toBe('');
    expect(safeExtension('noext', 'image/png')).toBe('.png');
  });
});
