import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'node:fs'

const buildId = Date.now().toString()

// Tulis dist/version.json pas build kelar - dipakai src/lib/versionCheck.ts buat polling "ada
// versi baru?" (insiden 14 Agu 2026: tab lama gak reload ~40 jam diam-diam jalanin logic basi
// walau server sudah pakai kode terbaru). Angkanya SAMA PERSIS dengan __BUILD_ID__ yang
// di-inject ke bundle JS (define di bawah) - satu sumber, gak mungkin beda.
const versionFilePlugin = () => ({
  name: 'write-version-json',
  writeBundle() {
    writeFileSync('dist/version.json', JSON.stringify({ buildId }))
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionFilePlugin()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
})
