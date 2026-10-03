// v3 (3 Okt 2026): cache v2 dibuang saat activate - bisa berisi index.html yang tersimpan atas
// nama file chunk JS (insiden loop "Versi baru tersedia" di MOM FAT Admin).
const CACHE_NAME = 'vista-teknik-shell-v3';

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
    // FIX LOOP (3 Okt 2026): dulu file /assets/ yang belum ada di edge (pas deploy baru lagi
    // nyebar) dibalas index.html status 200 - ikut ke-cache di sini & di cache HTTP (immutable
    // 1 tahun) atas nama file JS, import() gagal TERUS walau sudah reload. Sekarang balasan HTML
    // utk asset gak pernah dipakai/di-cache: dibuang, diambil ulang lewat jaringan (cache:'reload'
    // = lewati & timpa cache HTTP yang tercemar).
    const bukanHtml = (res) => !((res.headers.get('content-type') || '').includes('text/html'));
    event.respondWith(
      caches.match(req).then(async (cached) => {
        if (cached && bukanHtml(cached)) return cached;
        if (cached) caches.open(CACHE_NAME).then((c) => c.delete(req));
        let res = await fetch(req);
        if (res && res.ok && !bukanHtml(res)) res = await fetch(req.url, { cache: 'reload', credentials: 'same-origin' });
        if (res && res.ok && bukanHtml(res)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return res;
      })
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

// Push notification (pengingat Maintenance Rutin jatuh tempo, dikirim dari edge function
// maintenance-reminder-check via Web Push API) - payload JSON {title,body,url}, url dipakai
// notificationclick buat fokus/buka tab yang sudah ada alih-alih selalu buka tab baru.
self.addEventListener('push', (event) => {
  let payload = { title: 'Vista Teknik', body: 'Ada pembaruan.', url: '/' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch { /* payload bukan JSON valid - pakai default */ }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
