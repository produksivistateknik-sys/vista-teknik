const CACHE_NAME = 'vista-teknik-shell-v2';

self.addEventListener('install', () => {
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

// Cuma cache APP SHELL (HTML/JS/CSS/font/icon aplikasi sendiri, same-origin GET) - request ke
// Supabase (origin beda: *.supabase.co) TIDAK PERNAH lewat sini sama sekali, selalu langsung ke
// network apa adanya. Level ini gak pernah nyimpen DATA, cuma KODE aplikasinya biar loading awal
// tetap cepat pas sinyal lemot.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isHashedAsset = url.pathname.startsWith('/assets/');
  if (isHashedAsset) {
    // Nama file dari Vite punya hash konten (mis. index-abc123.js) - begitu ke-cache gak akan
    // pernah stale, aman cache-first biar gak download ulang tiap buka.
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return res;
      }))
    );
    return;
  }

  // index.html/manifest/ikon dll - network-first biar versi APLIKASI TERBARU yang kepakai kalau
  // online, cache cuma fallback pas sinyal lemot/putus biar shell tetap kebuka (bukan network-only,
  // beda dari sebelumnya yang caches.match-nya gak pernah ke-isi sama sekali).
  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, clone));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
