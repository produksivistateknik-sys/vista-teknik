const CACHE_NAME = 'vista-teknik-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy: selalu coba ambil dari network dulu (supaya data selalu up-to-date),
  // fallback ke cache hanya kalau offline
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
