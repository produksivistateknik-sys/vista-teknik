import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import MesinPublic from './MesinPublic.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

const path = window.location.pathname
const isMesinPage = path === '/mesin' || path.startsWith('/mesin?')
const isMesinQuery = window.location.search.includes('id=') && path.includes('mesin')

// import() dinamis yang gagal (chunk basi setelah deploy baru) kadang muncul sebagai
// unhandled promise rejection, bukan error React sinkron yang ke-tangkap ErrorBoundary -
// reload sekali kalau polanya cocok, biar user gak nyangkut di layar putih.
const CHUNK_ERROR_PATTERN = /Failed to fetch dynamically imported module|Loading chunk .* failed|error loading dynamically imported module|ChunkLoadError|Importing a module script failed/i
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason || '')
  if (!CHUNK_ERROR_PATTERN.test(msg)) return
  let sudahCoba = false
  try { sudahCoba = sessionStorage.getItem('vista_teknik_chunk_reload_attempt') === '1' } catch { /* noop */ }
  if (sudahCoba) return
  try { sessionStorage.setItem('vista_teknik_chunk_reload_attempt', '1') } catch { /* noop */ }
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {(path === '/mesin' || isMesinQuery) ? <MesinPublic /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err)
    })
  })
}

// Coba maximize window otomatis kalau dibuka sebagai PWA terinstall (standalone mode)
// Catatan: tidak dijamin berhasil di semua browser, karena window.resizeTo() bisa dibatasi browser modern
if (window.matchMedia('(display-mode: standalone)').matches) {
  try {
    window.resizeTo(window.screen.availWidth, window.screen.availHeight)
    window.moveTo(0, 0)
  } catch (err) {
    console.warn('Auto-resize PWA window tidak didukung browser ini:', err)
  }
}
