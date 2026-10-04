// STATUS KONEKSI REALTIME (4 Okt 2026) - satu sumber logika (CLAUDE.md B.1) utk "apakah data
// utama (renhar/raw_schedule/work_orders/panels) masih tersinkron lewat realtime".
//
// Dulu hook berlangganan realtime TANPA memantau status, jadi App.tsx menjalankan heartbeat
// "buta": ambil ulang SEMUA data tiap 60 dtk (+-413 KB/menit/admin) walau koneksi sehat. Dicek
// nyata (realtime-js 2.107): koneksi putus terdeteksi +-40-50 dtk ("CHANNEL_ERROR heartbeat
// timeout"), lalu library tersambung ulang sendiri (status kembali SUBSCRIBED). Event yang
// terlewat selama putus ditutup dengan ambil ulang penuh SAAT tersambung ulang (saatTersambungUlang).
//
// Tiap langganan punya nomor generasi: callback dari channel lama yang sudah dilepas (mis. channel
// panels dibuat ulang saat daftar panel berubah) diabaikan, supaya tidak menimpa status channel baru.

type Entri = { gen: number; status: string; pernahSehat: boolean }
const statusChannel = new Map<string, Entri>()
let genTerakhir = 0

export function pantauStatusRealtime(nama: string, saatTersambungUlang: () => void) {
  const gen = ++genTerakhir
  statusChannel.set(nama, { gen, status: 'MENYAMBUNG', pernahSehat: false })
  const callback = (status: string) => {
    const lama = statusChannel.get(nama)
    if (!lama || lama.gen !== gen) return // callback channel lama
    const tersambungUlang = status === 'SUBSCRIBED' && lama.pernahSehat && lama.status !== 'SUBSCRIBED'
    statusChannel.set(nama, { gen, status, pernahSehat: lama.pernahSehat || status === 'SUBSCRIBED' })
    if (status !== 'SUBSCRIBED') console.warn(`[realtime] channel ${nama}: ${status}`)
    if (tersambungUlang) saatTersambungUlang()
  }
  const lepas = () => {
    if (statusChannel.get(nama)?.gen === gen) statusChannel.delete(nama)
  }
  return { callback, lepas }
}

// true kalau SEMUA channel wajib terdaftar & SUBSCRIBED, dan channel lain yang sedang terdaftar
// juga SUBSCRIBED. Channel wajib yang belum/tidak terdaftar = tidak sehat (aman: App kembali ke
// heartbeat 60 dtk seperti dulu).
export function realtimeSemuaSehat(wajib: string[]): boolean {
  if (!wajib.every(n => statusChannel.get(n)?.status === 'SUBSCRIBED')) return false
  for (const e of statusChannel.values()) if (e.status !== 'SUBSCRIBED') return false
  return true
}
