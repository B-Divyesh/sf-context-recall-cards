try { importScripts('/precache-manifest.js'); } catch { self.__CRC_PRECACHE = []; }
const VERSION = `crc-v2-${(self.__CRC_PRECACHE || []).join('|')}`;
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  ...(self.__CRC_PRECACHE || []),
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/assets/recall-room-640.webp',
  '/assets/recall-room-1280.webp',
  '/privacy/',
  '/terms/'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then(async (cache) => {
    await Promise.all(APP_SHELL.map(async (path) => {
      const response = await fetch(new Request(path, { cache: 'reload' }));
      if (!response.ok) throw new Error(`Could not precache ${path}`);
      await cache.put(path, response);
    }));
  }));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => ![SHELL, RUNTIME].includes(key)).map((key) => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = (await caches.match(event.request, { ignoreVary: true })) || (await caches.match('/', { ignoreVary: true }));
      if (cached) {
        if (self.navigator.onLine) fetch(event.request).then((response) => {
          if (response.ok) caches.open(RUNTIME).then((cache) => cache.put(event.request, response));
        }).catch(() => undefined);
        return cached;
      }
      try {
        const response = await fetch(event.request);
        if (response.ok) await (await caches.open(RUNTIME)).put(event.request, response.clone());
        return response;
      } catch {
        return caches.match('/offline.html', { ignoreVary: true });
      }
    })());
    return;
  }
  event.respondWith(caches.match(event.request, { ignoreVary: true }).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) caches.open(RUNTIME).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
