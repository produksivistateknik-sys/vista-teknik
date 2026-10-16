// Versi build aplikasi yang SEDANG berjalan di tab ini (16 Okt 2026). Dibaca dari <meta name="vista-build-id"> yang
// disisipkan vite.config.ts ke index.html saat build - BUKAN dari konstanta di bundle JS, supaya nama file chunk
// tidak berubah tiap build (lihat komentar buildIdMetaPlugin di vite.config.ts). Saat `npm run dev` meta tidak ada -> 'dev'.
export function buildIdAplikasi(): string {
  try {
    return document.querySelector('meta[name="vista-build-id"]')?.getAttribute('content') || 'dev'
  } catch {
    return 'dev'
  }
}
