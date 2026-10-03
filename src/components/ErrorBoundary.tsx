import { Component, type ErrorInfo, type ReactNode } from 'react'
import { activityLogService } from '../services/activityLogService'

// React.lazy()/import() dinamis TIDAK bisa ditangkap oleh Suspense kalau gagal (Suspense cuma
// nanganin state loading, bukan error) - butuh Error Boundary terpisah. Tanpa ini, kalau tab
// browser masih kebuka dari SEBELUM deploy baru (chunk file lama sudah kehapus dari server pas
// deploy berikutnya nimpa), import() gagal -> React crash tanpa pesan -> BLANK WHITE SCREEN total.
// Ini akar masalah utama yang dilaporkan, karena app ini di-deploy sangat sering.

const CHUNK_ERROR_PATTERN = /Failed to fetch dynamically imported module|Loading chunk .* failed|error loading dynamically imported module|ChunkLoadError|Importing a module script failed/i
const RELOAD_GUARD_KEY = 'vista_teknik_chunk_reload_attempt'
const JEDA_AUTO_RELOAD_MS = 2 * 60 * 1000

function isChunkLoadError(error: Error): boolean {
  return error.name === 'ChunkLoadError' || CHUNK_ERROR_PATTERN.test(error.message || '')
}

// FIX LOOP (3 Okt 2026): reload biasa gak mempan kalau file chunk-nya sudah tercemar di cache
// browser (index.html tersimpan atas nama file .js, cache HTTP immutable 1 tahun + cache service
// worker) - tab terakhir (mis. MOM FAT) dibuka lagi -> gagal lagi -> loop. Sebelum reload: ambil
// ulang file yang gagal dengan cache:'reload' (menimpa cache HTTP) + hapus cache service worker.
async function bersihkanCacheChunk(error: Error | null) {
  try {
    const url = (error?.message || '').match(/https?:\/\/\S+?\.js/)?.[0]
    if (url) await fetch(url, { cache: 'reload' }).catch(() => {})
  } catch { /* noop */ }
  try {
    if ('caches' in window) {
      const ks = await caches.keys()
      await Promise.all(ks.map(k => caches.delete(k)))
    }
  } catch { /* noop */ }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.update().catch(() => {})))
    }
  } catch { /* noop */ }
}

// Best-effort log ke activity_log - kalau ini sendiri gagal (misal belum ada koneksi/auth),
// jangan sampai ganggu proses recovery UI, makanya di-try-catch total dan gak di-await di caller.
async function logErrorBestEffort(error: Error, errorInfo: ErrorInfo, isChunk: boolean) {
  try {
    const sess = JSON.parse(localStorage.getItem('vista_admin_session') || '{}')
    await activityLogService.insert({
      user_name: sess?.nama || sess?.name || 'Unknown',
      action: isChunk ? 'CRASH: CHUNK LOAD ERROR' : 'CRASH: UNCAUGHT ERROR',
      description: `${error.message || 'Unknown error'} | ${window.location.pathname} | ${(errorInfo.componentStack || '').slice(0, 500)}`,
      module: 'system_error',
      halaman: 'ErrorBoundary',
    })
  } catch {
    // sengaja diam - logging gak boleh nambah crash baru
  }
}

interface Props { children: ReactNode }
interface State { error: Error | null; isChunkError: boolean; reloading: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, isChunkError: false, reloading: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, isChunkError: isChunkLoadError(error) }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary menangkap error:', error, errorInfo)
    const isChunk = isChunkLoadError(error)
    logErrorBestEffort(error, errorInfo, isChunk)

    if (isChunk) {
      // Auto-reload SEKALI aja - kalau setelah reload errornya masih sama (deploy beneran
      // rusak, bukan cuma chunk basi), jangan loop reload selamanya, tampilkan fallback manual.
      // Penanda = waktu percobaan terakhir (3 Okt 2026), bukan '1' permanen sesi: error chunk
      // berikutnya di sesi yang sama (deploy lain, > JEDA_AUTO_RELOAD_MS kemudian) tetap
      // auto-reload; dalam jeda itu tetap fallback tombol, jadi gak bisa loop.
      let sudahCoba = false
      try {
        const t = Number(sessionStorage.getItem(RELOAD_GUARD_KEY))
        sudahCoba = t > 0 && Date.now() - t < JEDA_AUTO_RELOAD_MS
      } catch { /* noop */ }
      if (!sudahCoba) {
        try { sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now())) } catch { /* noop */ }
        this.setState({ reloading: true })
        bersihkanCacheChunk(error).finally(() => setTimeout(() => window.location.reload(), 300))
      }
    }
  }

  handleReload = () => {
    try { sessionStorage.removeItem(RELOAD_GUARD_KEY) } catch { /* noop */ }
    this.setState({ reloading: true })
    bersihkanCacheChunk(this.state.error).finally(() => window.location.reload())
  }

  render() {
    if (!this.state.error) return this.props.children

    if (this.state.isChunkError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: '#f1f5f9', fontFamily: "'Plus Jakarta Sans',sans-serif", padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 36 }}>🔄</div>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#1e293b' }}>
            {this.state.reloading ? 'Memuat versi terbaru...' : 'Versi baru tersedia'}
          </div>
          <div style={{ fontSize: 13, color: '#64748b', maxWidth: 360 }}>
            {this.state.reloading
              ? 'Halaman ini bakal dimuat ulang otomatis sebentar lagi.'
              : 'Ada update baru di server. Klik tombol di bawah buat lanjut.'}
          </div>
          {!this.state.reloading && (
            <button onClick={this.handleReload}
              style={{ marginTop: 6, padding: '10px 22px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Muat Ulang Halaman
            </button>
          )}
        </div>
      )
    }

    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: '#f1f5f9', fontFamily: "'Plus Jakarta Sans',sans-serif", padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 36 }}>⚠️</div>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#1e293b' }}>Terjadi kesalahan</div>
        <div style={{ fontSize: 13, color: '#64748b', maxWidth: 420 }}>
          Ada masalah teknis yang gak terduga. Coba muat ulang halaman - kalau masih terjadi terus, kabari tim IT dengan screenshot pesan ini.
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', maxWidth: 460, wordBreak: 'break-word' as const, fontFamily: "'DM Mono',monospace" }}>
          {this.state.error.message || String(this.state.error)}
        </div>
        <button onClick={this.handleReload}
          style={{ marginTop: 6, padding: '10px 22px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Muat Ulang Halaman
        </button>
      </div>
    )
  }
}
