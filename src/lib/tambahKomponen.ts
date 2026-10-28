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
