import { Client as MinioClient } from 'minio';
import { Readable } from 'node:stream';

const globalForMinio = globalThis as unknown as {
  minio: MinioClient | undefined;
  bucketReady: Promise<void> | undefined;
};

function makeClient() {
  return new MinioClient({
    endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: (process.env.MINIO_USE_SSL ?? 'false').toLowerCase() === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY ?? '',
    secretKey: process.env.MINIO_SECRET_KEY ?? '',
  });
}

export const minio = globalForMinio.minio ?? makeClient();
if (process.env.NODE_ENV !== 'production') globalForMinio.minio = minio;

export const BUCKET = process.env.MINIO_BUCKET ?? 'pinboard-attachments';

export async function ensureBucket(): Promise<void> {
  if (globalForMinio.bucketReady) return globalForMinio.bucketReady;
  globalForMinio.bucketReady = (async () => {
    const exists = await minio.bucketExists(BUCKET).catch(() => false);
    if (!exists) {
      await minio.makeBucket(BUCKET);
    }
  })();
  return globalForMinio.bucketReady;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await ensureBucket();
  await minio.putObject(BUCKET, key, body, body.byteLength, {
    'Content-Type': contentType,
  });
}

export async function getObjectStream(key: string): Promise<Readable> {
  return minio.getObject(BUCKET, key);
}

export async function removeObject(key: string): Promise<void> {
  await minio.removeObject(BUCKET, key);
}

export async function removeFolder(prefix: string): Promise<void> {
  const objects: string[] = [];
  await new Promise<void>((resolve, reject) => {
    const stream = minio.listObjectsV2(BUCKET, prefix, true);
    stream.on('data', (obj) => obj.name && objects.push(obj.name));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  if (objects.length) {
    await minio.removeObjects(BUCKET, objects);
  }
}
