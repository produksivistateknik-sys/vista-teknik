import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import MesinPublic from './MesinPublic.tsx'

const path = window.location.pathname
const isMesinPage = path === '/mesin' || path.startsWith('/mesin?')
const isMesinQuery = window.location.search.includes('id=') && path.includes('mesin')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {(path === '/mesin' || isMesinQuery) ? <MesinPublic /> : <App />}
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
