import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'node:fs'

const buildId = Date.now().toString()

// Tulis dist/version.json pas build kelar - dipakai src/lib/versionCheck.ts buat polling "ada
// versi baru?" (insiden 14 Agu 2026: tab lama gak reload ~40 jam diam-diam jalanin logic basi
// walau server sudah pakai kode terbaru). Angkanya SAMA PERSIS dengan <meta name="vista-build-id">
// di index.html (plugin di bawah) - satu sumber, gak mungkin beda.
const versionFilePlugin = () => ({
  name: 'write-version-json',
  writeBundle() {
    writeFileSync('dist/version.json', JSON.stringify({ buildId }))
  },
})

// (16 Okt 2026, investigasi chunk error IHSAN/EDO) Cap versi build DULU di-inject ke bundle JS (define
// __BUILD_ID__) -> file JS utama berubah tiap build -> 38 dari 44 nama file chunk ikut berganti walau kode
// SAMA SEKALI tidak berubah (push yang cuma berisi file SQL pun) -> tab yang terbuka sebelum deploy gagal
// membuka menu yang belum pernah dibuka (file lama 404 di Vercel). Sekarang cap versi cuma di index.html
// (tidak di-cache, lihat vercel.json) & dibaca saat jalan lewat src/lib/buildId.ts -> nama chunk stabil.
const buildIdMetaPlugin = () => ({
  name: 'inject-build-id-meta',
  transformIndexHtml(html: string) {
    return html.replace('</head>', `    <meta name="vista-build-id" content="${buildId}" />\n  </head>`)
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionFilePlugin(), buildIdMetaPlugin()],
})
