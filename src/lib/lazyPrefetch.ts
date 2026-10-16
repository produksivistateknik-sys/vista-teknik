// LAZY + UNDUH DI BELAKANG LAYAR (16 Okt 2026, investigasi chunk error) - pengganti React.lazy untuk halaman admin.
// Masalah: tab yang dibuka sebelum deploy baru gagal membuka menu yang BELUM PERNAH dibuka (file chunk lama sudah 404
// di Vercel) -> 7 kejadian 9-16 Okt. Sekarang semua halaman yang didaftarkan lewat lazyP() diunduh diam-diam beberapa
// detik setelah aplikasi terbuka (saat browser senggang), jadi menu yang dibuka belakangan sudah ada di memori tab.
// Perilaku React.lazy TIDAK berubah (Suspense/ErrorBoundary sama); kegagalan unduh di belakang layar diabaikan
// (halaman tetap dimuat normal saat dibuka).
import { lazy, type ComponentType } from 'react'

const daftar: (() => Promise<unknown>)[] = []

export function lazyP<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  daftar.push(factory)
  return lazy(factory)
}

let sudahJalan = false
export function unduhSemuaHalaman(jedaAwalMs = 6000): void {
  if (sudahJalan || typeof window === 'undefined') return
  sudahJalan = true
  const tungguSenggang = () => new Promise<void>(r => {
    const ric = (window as any).requestIdleCallback
    if (typeof ric === 'function') ric(() => r(), { timeout: 3000 }); else setTimeout(r, 200)
  })
  setTimeout(async () => {
    for (const f of daftar) {
      await tungguSenggang()
      try { await f() } catch { /* diabaikan - halaman dimuat normal saat dibuka */ }
    }
  }, jedaAwalMs)
}
