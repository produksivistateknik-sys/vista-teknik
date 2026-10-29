// ATURAN TAMBAH KOMPONEN KE SEL JADWAL (B2, 28 Okt 2026) - FUNGSI MURNI, SATU SUMBER utk:
//  - modal edit sel (ModalJadwalSel.wpItems: komponen yang boleh dipilih = status 'bisa'), dan
//  - popup proses baris komponen "Raw Schedule per WP" (label: terjadwal / progres x/y / terjadwal <tgl> / selesai / + tambah).
// Aturan = aturan modal SEBELUM dipindah ke sini (dipertahankan persis, tampilan lama ikut memakainya):
//  qty komponen di panel 0 -> tidak bisa; tidak relevan / tidak ada di panel (lib/relevansiJadwal) -> tidak bisa;
//  sudah ada di WP itu pada tanggal itu -> 'terjadwal'; ada di tanggal LAIN (WP mana pun) dgn progress proses ini >=100 ->
//  'selesai'; ada di tanggal lain >= hari ini -> 'tanggalLain'. Selain itu 'bisa'.
// Catatan: progress 100 hanya memblokir bila kode itu terjadwal di tanggal lain (perilaku modal lama, tidak diubah).
import { alasanKomponenDilewati, type AlasanDilewati } from './relevansiJadwal'
import { getQtyProsesAsOfDate } from './panelHelpers'

type Entri = { wp?: string; komponen?: string[]; qtyPerKomponen?: Record<string, number> }
type BarisJadwal = { proses?: string; schedule?: Record<string, Entri[]> } | null | undefined
type KomponenChecklist = { qty?: number; progress?: Record<string, number>; qtyProsesByDate?: Record<string, Record<string, number>> }
type PanelJadwal = { tipe?: string; checklist?: Record<string, KomponenChecklist> } | null | undefined

export type StatusTambah =
  | { jenis: 'terjadwal'; x: number; y: number } // sudah di sel ini; x = qty proses s/d tanggal itu, y = qty entri (qtyPerKomponen) / qty panel
  | { jenis: 'selesai' }
  | { jenis: 'tanggalLain'; tanggal: string } // tanggal terdekat >= hari ini
  | { jenis: 'qty0' }
  | { jenis: 'dilewati'; alasan: AlasanDilewati }
  | { jenis: 'bisa' }

export function statusTambahKomponen(row: BarisJadwal, panel: PanelJadwal, tanggal: string, wp: string, kode: string, hariIni: string): StatusTambah {
  const proses = row?.proses || ''
  const cl = panel?.checklist?.[kode]
  const qty = cl?.qty || 0
  const sch = row?.schedule || {}
  const entri = (sch[tanggal] || []).find(e => e.wp === wp)
  if ((entri?.komponen || []).includes(kode)) {
    return { jenis: 'terjadwal', x: getQtyProsesAsOfDate(cl, proses, tanggal), y: entri?.qtyPerKomponen?.[kode] ?? qty }
  }
  if (qty <= 0) return { jenis: 'qty0' }
  const alasan = alasanKomponenDilewati(kode, panel || undefined, proses)
  if (alasan) return { jenis: 'dilewati', alasan }
  let selesai = false
  let lain = ''
  for (const [tgl, es] of Object.entries(sch)) {
    if (tgl === tanggal) continue
    for (const e of es || []) {
      if (!(e.komponen || []).includes(kode)) continue
      if ((cl?.progress?.[proses] || 0) >= 100) selesai = true
      else if (tgl >= hariIni && (!lain || tgl < lain)) lain = tgl
    }
  }
  if (selesai) return { jenis: 'selesai' }
  if (lain) return { jenis: 'tanggalLain', tanggal: lain }
  return { jenis: 'bisa' }
}

// BUANG KODE DARI 1 SEL (B3, 29 Okt 2026) - SATU sumber utk "Batalkan" tambah langsung (ModalJadwalSel.hapusKodeDariSel) &
// hapus per chip (Raw Schedule per WP, RPC ubah_jadwal_multi_v1). Kode dibuang dari entri WP `wp` pada `tanggal` beserta
// kunci per-kodenya (qtyPerKomponen / manualPin / digeserKe). Token __wiring_ ikut dibuang bila tidak ada kode asli tersisa;
// entri kosong dihapus; tanggal tanpa entri dihapus. sisaAsli = kode asli yang tersisa (renhar: set_komponen; kosong = hapus).
type EntriJadwal = { wp?: string; komponen?: string[]; qtyPerKomponen?: Record<string, number>; manualPin?: Record<string, string>; digeserKe?: Record<string, string> }
export function buangKodeDariSel(schedule: Record<string, EntriJadwal[]>, tanggal: string, wp: string, kode: string[]): { schedule: Record<string, EntriJadwal[]>; sisaAsli: string[]; dibuang: string[] } {
  const hapus = new Set(kode)
  const entri = (schedule[tanggal] || []).find(e => e.wp === wp)
  const dibuang = (entri?.komponen || []).filter(k => hapus.has(k))
  if (!entri || dibuang.length === 0) return { schedule, sisaAsli: (entri?.komponen || []).filter(k => !k.startsWith('__wiring_')), dibuang: [] }
  const sisaAsli = (entri.komponen || []).filter(k => !k.startsWith('__wiring_') && !hapus.has(k))
  const tanpa = <T,>(m: Record<string, T> | undefined) => m ? Object.fromEntries(Object.entries(m).filter(([k]) => !hapus.has(k))) : m
  const baru: EntriJadwal | null = sisaAsli.length ? {
    ...entri, komponen: (entri.komponen || []).filter(k => !hapus.has(k)),
    ...(entri.qtyPerKomponen ? { qtyPerKomponen: tanpa(entri.qtyPerKomponen) } : {}),
    ...(entri.manualPin ? { manualPin: tanpa(entri.manualPin) } : {}),
    ...(entri.digeserKe ? { digeserKe: tanpa(entri.digeserKe) } : {}),
  } : null
  const es = (schedule[tanggal] || []).flatMap(e => e.wp !== wp ? [e] : baru ? [baru] : [])
  const hasil = { ...schedule }
  if (es.length) hasil[tanggal] = es; else delete hasil[tanggal]
  return { schedule: hasil, sisaAsli, dibuang }
}

// Isi sama (urutan kunci objek diabaikan - jsonb dari DB tidak menjaga urutan kunci). Utk menolak tulis dari tab basi.
const urutKunci = (v: unknown): unknown => Array.isArray(v) ? v.map(urutKunci)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().map(k => [k, urutKunci((v as Record<string, unknown>)[k])])) : v
export const samaIsiJadwal = (a: unknown, b: unknown) => JSON.stringify(urutKunci(a ?? {})) === JSON.stringify(urutKunci(b ?? {}))
