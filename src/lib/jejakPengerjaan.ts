// JEJAK PENGERJAAN (23 Okt 2026, keputusan user) - riwayat per hari "siapa mengerjakan komponen x proses ini sejak awal",
// ditampilkan kecil di bawah kolom Operator Rencana Harian (operator HARI INI tetap aturan lama, lib/operatorHarian).
// Sumber (hanya baca, tanpa tabel baru):
//  - NAMA: fcs_timer_kerja (pekerja_id, tanggal = hari kerja WIB). Hari yang qty-nya NAIK tapi tanpa timer -> nama dari
//    progress_checkpoint_log berlabel "dicatat:" (checkpoint = nama akun/rencana, bukan bukti siapa bekerja).
//  - JUMLAH: checklist[kode].qtyProsesByDate[proses] (qty kumulatif per hari -> selisih); tanpa itu progressByDate (+N%).
//    BUSBAR: persen tahap dari kolom progress timer (FABRIKASI/PLATING/...).
//  - Hari tanpa timer DAN tanpa tambahan -> disembunyikan; hari dgn timer tanpa tambahan -> "(89 mnt, belum selesai)" =
//    lama kerja (gabungan rentang timer hari itu) + belum tuntas (23 Okt 2026, kasus FS.30 STEL panel 528).
// Data timer dimuat SEKALI utk semua panel yang tampil (hooks/useJejakPengerjaan), dikelompokkan di memori.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type TimerJejak = { panel_id: number; kode_komponen: string; proses: string; tahap: string | null; tanggal: string; pekerja_id: number; mulai: string; selesai?: string | null; durasi_menit?: number | null; progress: number | null }
export type HariJejak = { tanggal: string; nama: string[]; dicatat: boolean; jumlah: string; tanpaTambah: boolean; menitKerja?: number }

export const kunciJejak = (panelId: any, kode: string, proses: string) => `${panelId}|${kode}|${proses}`
export function indeksTimerJejak(rows: TimerJejak[]): Map<string, TimerJejak[]> {
  const m = new Map<string, TimerJejak[]>()
  rows.forEach((t) => { const k = kunciJejak(t.panel_id, t.kode_komponen, t.proses); const a = m.get(k); if (a) a.push(t); else m.set(k, [t]) })
  return m
}

const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export const tglJejak = (iso: string) => { const [, m, d] = iso.split('-'); return `${Number(d)} ${BLN[Number(m) - 1]}` }
const TAHAP_LABEL: Record<string, string> = { FABRIKASI: 'Fabrikasi', PLATING: 'Plating', HEATSHRINK: 'Heatshrink', PASANG: 'Pasang' }

// Selisih kumulatif per tanggal (nilai - maksimum tanggal sebelumnya); hanya yang naik.
function kenaikanPerHari(seri: Record<string, any> | undefined): Map<string, number> {
  const out = new Map<string, number>()
  let maks = 0
  Object.entries(seri || {}).sort(([a], [b]) => a.localeCompare(b)).forEach(([t, v]) => {
    const x = Number(v) || 0
    if (x > maks) { out.set(t, x - maks); maks = x }
  })
  return out
}

export function susunJejak(o: {
  timer: TimerJejak[] // timer kode+proses ini (semua tanggal)
  cl: any // panels.checklist[kode]
  proses: string
  checkpoint: { tanggal: string; pekerja_nama: string | null }[] // checkpoint kode+proses ini
  namaById: (id: any) => string | undefined
  sebelum: string // hanya hari < tanggal ini (hari ini = baris utama kolom Operator)
}): HariJejak[] {
  const { proses, cl } = o
  const perHariTimer = new Map<string, TimerJejak[]>()
  o.timer.filter((t) => t.tanggal && t.tanggal < o.sebelum).forEach((t) => perHariTimer.set(t.tanggal, [...(perHariTimer.get(t.tanggal) || []), t]))
  const pakaiQty = proses !== 'BUSBAR' && Object.keys(cl?.qtyProsesByDate?.[proses] || {}).length > 0
  const naik = kenaikanPerHari(pakaiQty ? cl?.qtyProsesByDate?.[proses] : cl?.progressByDate?.[proses])
  const fmtNaik = (n: number) => (pakaiQty ? `${n} qty` : `+${Math.round(n)}%`)
  const hari = [...new Set([...perHariTimer.keys(), ...[...naik.keys()].filter((t) => t < o.sebelum)])].sort()
  const hasil: HariJejak[] = []
  for (const t of hari) {
    const ts = (perHariTimer.get(t) || []).slice().sort((a, b) => String(a.mulai).localeCompare(String(b.mulai)))
    const tambah = naik.get(t) || 0
    if (ts.length) {
      const nama = [...new Set(ts.map((x) => o.namaById(x.pekerja_id) || `#${x.pekerja_id}`))]
      let jumlah = tambah > 0 ? fmtNaik(tambah) : ''
      if (proses === 'BUSBAR') { // persen tahap dari kolom progress timer (maks per tahap hari itu)
        const pt = new Map<string, number>()
        ts.forEach((x) => { if (x.tahap && x.progress != null) pt.set(x.tahap, Math.max(pt.get(x.tahap) || 0, Number(x.progress) || 0)) })
        jumlah = [...pt.entries()].map(([k, v]) => `${TAHAP_LABEL[k] || k} ${v}%`).join(', ') || jumlah
      }
      hasil.push({ tanggal: t, nama, dicatat: false, jumlah, tanpaTambah: !jumlah, menitKerja: menitGabungan(ts) })
    } else if (tambah > 0) {
      const nama = [...new Set(o.checkpoint.filter((c) => c.tanggal === t && c.pekerja_nama).flatMap((c) => String(c.pekerja_nama).split(',').map((s) => s.trim()).filter(Boolean)))]
      hasil.push({ tanggal: t, nama, dicatat: true, jumlah: fmtNaik(tambah), tanpaTambah: false })
    }
    // tanpa timer & tanpa tambahan (mis. kunci progress ulang) -> disembunyikan
  }
  return hasil
}

// "12 Okt · A, B (8 qty)" | "19 Okt · A (89 mnt, belum selesai)" | "20 Okt · dicatat: C (3 qty)" | "20 Okt · tanpa nama (3 qty)"
export function teksHariJejak(h: HariJejak, awal = false): string {
  const siapa = h.nama.length ? (h.dicatat ? `dicatat: ${h.nama.join(', ')}` : h.nama.join(', ')) : 'tanpa nama'
  const isi = h.tanpaTambah ? `${labelLama(h.menitKerja || 0, true)}, belum selesai` : h.jumlah
  return `${awal ? 'Mulai: ' : ''}${tglJejak(h.tanggal)} · ${siapa}${isi ? ` (${isi})` : ''}`
}
// Ringkas: baris "Mulai" + maks 2 baris terakhir (tanpa menulis baris pertama dua kali) + jumlah yang tersembunyi.
export function ringkasJejak(hari: HariJejak[], maks = 2): { baris: string[]; lagi: number } {
  if (!hari.length) return { baris: [], lagi: 0 }
  const sisa = hari.slice(1)
  const akhir = sisa.slice(-maks)
  return { baris: [teksHariJejak(hari[0], true), ...akhir.map((h) => teksHariJejak(h))], lagi: sisa.length - akhir.length }
}

// Lama kerja satu hari = panjang GABUNGAN rentang timer (orang yang bekerja bersamaan tidak dijumlah dobel); timer yang
// masih berjalan dihitung sampai sekarang.
export function menitGabungan(ts: TimerJejak[], sekarangMs = Date.now()): number {
  const rentang = ts.map((t) => {
    const a = Date.parse(t.mulai)
    const b = t.selesai ? Date.parse(t.selesai) : sekarangMs
    return [a, b] as [number, number]
  }).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a).sort((x, y) => x[0] - y[0])
  let total = 0, ca = 0, cb = 0, ada = false
  for (const [a, b] of rentang) {
    if (!ada || a > cb) { if (ada) total += cb - ca; ca = a; cb = b; ada = true } else cb = Math.max(cb, b)
  }
  if (ada) total += cb - ca
  return total / 60000
}
// "7 dtk" | "89 mnt" | "1 j 28 mnt" (chip operator); menitSaja=true -> "89 mnt" (jejak)
export function labelLama(menit: number, menitSaja = false): string {
  const d = Math.round(menit * 60)
  if (d < 60) return `${d} dtk`
  const m = Math.round(menit)
  return m < 60 || menitSaja ? `${m} mnt` : `${Math.floor(m / 60)} j${m % 60 ? ` ${m % 60} mnt` : ''}`
}
