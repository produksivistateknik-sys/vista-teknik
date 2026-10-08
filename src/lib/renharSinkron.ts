// SINKRON RENHAR SAAT JADWAL DIPINDAH (8 Okt 2026) - SATU helper (CLAUDE.md B.1) dipakai drag Raw
// Schedule (proses biasa/WIRING & BUSBAR) dan Reschedule Outstanding. Dulu tiap jalur punya logika
// sendiri yang:
// - tidak pernah mengecek hasil update/create renhar (koneksi putus = raw_schedule sudah pindah,
//   renhar - yang dibaca Vista Pekerja - tertinggal di tanggal lama, admin tidak tahu);
// - mengurangi komponen di baris ASAL dulu baru menambah ke TUJUAN (gagal di tengah = komponen
//   hilang dari renhar di kedua tanggal);
// - memindah SELURUH baris dgn update `tanggal` walau di tanggal tujuan sudah ada baris renhar
//   raw+wp yang sama -> ditolak constraint unik renhar_raw_wp_tanggal_unique, diam-diam;
// - (Raw Schedule) membaca baris asal dari state lokal yang bisa basi.
//
// Aturan helper ini:
// 1. Baris asal & tujuan dibaca SEGAR dari DB lewat withRenharQueue (antrian per raw+wp+tanggal).
// 2. Urutan aman: TAMBAH ke tujuan dulu, baru KURANGI asal. Gagal di tengah = komponen paling
//    buruk tampil di 2 tanggal (terlihat, bisa dibereskan), tidak pernah hilang.
// 3. Pindah semua + tujuan belum ada baris -> baris asal digeser tanggalnya (perilaku lama, id &
//    riwayat ikut). Tujuan sudah ada -> digabung ke tujuan, baris asal dikosongkan (TIDAK dihapus).
// 4. Di baris asal kode yang pindah dibersihkan dari komponen, komponen_released &
//    pekerja_per_komponen (pola Outstanding kasus jejak, FIX "renhar lama nyangkut").
// 5. simpanBarisAsal=true -> baris asal selalu dipertahankan (riwayat "siapa yang sempat kerja di
//    sini"), tidak pernah digeser tanggalnya.
// 6. Semua hasil tulis dicek (gagal = throw). Idempoten: aman dijalankan ulang setelah gagal.
import { markRenharDirty } from './globalState'

type HasilTulis = { success?: boolean; data?: any; error?: string; code?: string } | undefined

export type DepsSinkronRenhar = {
  withRenharQueue: (task: any, fn: (existingFresh: any) => Promise<void>) => Promise<void>
  updateRenhar: (id: number, payload: any) => Promise<HasilTulis>
  createRenhar: (payload: any) => Promise<HasilTulis>
  setRenhar: (fn: (prev: any[]) => any[]) => void
  tandaiDirty?: (id: number) => void
}

export type OpsiPindahRenhar = {
  rawId: number | string
  wp: string
  fromDate: string
  toDate: string
  kode: string[]
  simpanBarisAsal?: boolean
  /** isi kolom `pekerja` kalau baris tujuan BARU dibuat (default: salin dari baris asal) */
  pekerjaBarisBaru?: any[]
}

const cekTulis = (res: HasilTulis, apa: string) => {
  if (!res?.success) throw Object.assign(new Error(res?.error || `Gagal ${apa}`), { code: res?.code })
  return res
}

export async function pindahKomponenRenhar(deps: DepsSinkronRenhar, o: OpsiPindahRenhar): Promise<{ dipindah: string[] }> {
  const { withRenharQueue, updateRenhar, createRenhar, setRenhar } = deps
  const tandai = deps.tandaiDirty || ((id: number) => markRenharDirty(id))
  const kodeSet = new Set(o.kode)
  const kunciAsal = { rawId: o.rawId, wp: o.wp, tanggal: o.fromDate }
  const kunciTujuan = { rawId: o.rawId, wp: o.wp, tanggal: o.toDate }
  if (o.fromDate === o.toDate || kodeSet.size === 0) return { dipindah: [] }

  // 1) Baca asal segar.
  let asal: any = null
  await withRenharQueue(kunciAsal, async (ex) => { asal = ex })
  const pindah: string[] = (asal?.komponen || []).filter((k: string) => kodeSet.has(k))
  if (!asal || pindah.length === 0) return { dipindah: [] } // tidak ada renhar / sudah pindah (idempoten)
  const sisa: string[] = (asal.komponen || []).filter((k: string) => !kodeSet.has(k))
  const releasedPindah: string[] = pindah.filter((k) => (asal.komponen_released || []).includes(k))
  const ppkAsal = asal.pekerja_per_komponen || {}
  const ppkPindah = Object.fromEntries(pindah.filter((k) => ppkAsal[k]).map((k) => [k, ppkAsal[k]]))

  // 2) Tujuan dulu.
  let asalSudahDigeser = false
  await withRenharQueue(kunciTujuan, async (tujuan) => {
    if (tujuan) {
      const komponen = [...new Set([...(tujuan.komponen || []), ...pindah])]
      const komponen_released = [...new Set([...(tujuan.komponen_released || []), ...releasedPindah])]
      const pekerja_per_komponen = { ...(tujuan.pekerja_per_komponen || {}), ...ppkPindah }
      tandai(tujuan.id)
      cekTulis(await updateRenhar(tujuan.id, { komponen, komponen_released, pekerja_per_komponen }), 'menambah komponen ke rencana harian tujuan')
      setRenhar((prev) => prev.map((x: any) => x.id === tujuan.id ? { ...x, komponen, komponen_released, pekerja_per_komponen } : x))
    } else if (sisa.length === 0 && !o.simpanBarisAsal) {
      // Pindah semua & tujuan kosong -> geser baris asal (perilaku lama; id & riwayat ikut).
      tandai(asal.id)
      cekTulis(await updateRenhar(asal.id, { tanggal: o.toDate, komponen: pindah }), 'memindah rencana harian')
      setRenhar((prev) => prev.map((x: any) => x.id === asal.id ? { ...x, tanggal: o.toDate, komponen: pindah } : x))
      asalSudahDigeser = true
    } else {
      const res = cekTulis(await createRenhar({
        raw_id: asal.raw_id ?? o.rawId, wo_id: asal.wo_id, panel_id: asal.panel_id,
        proyek: asal.proyek, panel: asal.panel, proses: asal.proses,
        prioritas: asal.prioritas || 'Sedang', wp: o.wp, komponen: pindah,
        tanggal: o.toDate, ...(asal.divisi ? { divisi: asal.divisi } : {}),
        pekerja: o.pekerjaBarisBaru ?? (asal.pekerja || []),
        komponen_released: releasedPindah, pekerja_per_komponen: ppkPindah,
      }), 'membuat rencana harian di tanggal tujuan')
      if (!res?.data) throw new Error('Gagal membuat rencana harian di tanggal tujuan (tanpa data balikan)')
      tandai(res.data.id)
      setRenhar((prev) => prev.some((x: any) => x.id === res.data.id) ? prev : [...prev, res.data])
    }
  })
  if (asalSudahDigeser) return { dipindah: pindah }

  // 3) Baru kurangi asal (baca ulang segar - bisa berubah selama langkah 2).
  await withRenharQueue(kunciAsal, async (ex) => {
    if (!ex) return
    const komponen = (ex.komponen || []).filter((k: string) => !kodeSet.has(k))
    const komponen_released = (ex.komponen_released || []).filter((k: string) => !kodeSet.has(k))
    const pekerja_per_komponen = { ...(ex.pekerja_per_komponen || {}) }
    pindah.forEach((k) => { delete pekerja_per_komponen[k] })
    const berubah = komponen.length !== (ex.komponen || []).length || komponen_released.length !== (ex.komponen_released || []).length || Object.keys(pekerja_per_komponen).length !== Object.keys(ex.pekerja_per_komponen || {}).length
    if (!berubah) return
    tandai(ex.id)
    cekTulis(await updateRenhar(ex.id, { komponen, komponen_released, pekerja_per_komponen }), 'mengurangi komponen di rencana harian asal')
    setRenhar((prev) => prev.map((x: any) => x.id === ex.id ? { ...x, komponen, komponen_released, pekerja_per_komponen } : x))
  })
  return { dipindah: pindah }
}

// Pesan gagal sinkron + tawarkan ulang (dipakai semua pemanggil). `ulang` dijalankan selama admin
// menekan OK & masih gagal. Mengembalikan true kalau akhirnya berhasil.
export async function tanganiGagalSinkronRenhar(err: any, konteks: string, ulang: () => Promise<void>): Promise<boolean> {
  let e = err
  for (;;) {
    console.error(`[Sinkron Rencana Harian - ${konteks}] gagal:`, e)
    const kode = typeof e?.code === 'string' ? e.code.trim() : ''
    const sebab = kode ? `ditolak server (kode ${kode}): ${e?.message || e}` : `koneksi lambat/putus (${e?.message || e})`
    const coba = window.confirm(
      `Jadwal Raw Schedule SUDAH tersimpan, tapi sinkron Rencana Harian GAGAL - ${sebab}.\n\n` +
      `Akibatnya Rencana Harian / Vista Pekerja bisa masih menampilkan data lama untuk: ${konteks}.\n\n` +
      `Coba sinkron ulang sekarang? (OK = ulangi, Batal = biarkan & beri tahu admin)`)
    if (!coba) return false
    try { await ulang(); return true } catch (err2) { e = err2 }
  }
}
