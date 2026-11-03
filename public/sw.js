/* Pinboard intentionally stores no authenticated pages, API responses or uploads. */
const CACHE_PREFIX = 'pinboard-public-offline-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const OFFLINE_URL = '/offline.html';
const PUBLIC_ASSETS = [OFFLINE_URL, '/pwa/icon-192.png', '/pwa/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(
        PUBLIC_ASSETS.map((url) => new Request(url, { cache: 'reload', credentials: 'omit' })),
      );
      // Only the public fallback changes; this worker never caches application code.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (PUBLIC_ASSETS.includes(url.pathname) && !url.search) {
    event.respondWith(
      (async () => (await caches.match(request, { cacheName: CACHE_NAME })) || fetch(request))(),
    );
    return;
  }
  // API downloads and Next.js data requests must never receive offline HTML.
  if (request.mode !== 'navigate' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/'))
    return;
  event.respondWith(
    (async () => {
      try {
        return await fetch(request, { cache: 'no-store' });
      } catch {
        return (
          (await caches.match(OFFLINE_URL, { cacheName: CACHE_NAME })) ||
          new Response('Pinboard is offline. Reconnect and try again.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
          })
        );
      }
    })(),
  );
});
