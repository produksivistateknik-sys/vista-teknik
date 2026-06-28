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
