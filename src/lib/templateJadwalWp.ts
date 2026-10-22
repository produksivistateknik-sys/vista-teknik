// TEMPLATE JADWAL WP - auto-tata jadwal WP saat FCS (22 Okt 2026, permintaan user; tahap 1 = sandbox Raw per WP saja).
// Saat panel di-FCS, tiap (proses, WP) ditaruh di "Day ke-n" menurut template jenis panel, bukan menumpuk di tanggal
// mulai. Kapasitas harian BOLEH bentrok (template hanya memudahkan admin menata). Sumber template: tabel
// template_jadwal_wp (tipe_panel x proses x wp -> hari; tidak ada baris = "-" = WP itu tidak mengerjakan proses itu).
// Keputusan user 22 Okt 2026:
//  - Day 1 = tanggal mulai FCS; hari libur = Minggu + tanggal yang SELURUH kapasitas override-nya 0 (tanpa tabel libur).
//  - BUSBAR, WIRING CONTROL, WIRING POWER = hari PASANG KOMPONEN paling awal pada template jenis itu.
//  - QC TEST & PACKING = H-1 target WO (hari kerja sebelumnya), hari yang sama.
//  - Kode relevan di proses yang bertanda "-" utk WP-nya = hari proses SEBELUMNYA pada WP yang sama (urutan ALL_PROSES
//    yang ada di template), ditandai "di luar template" di dialog & activity_log.
// Fungsi di sini murni (tanpa Supabase) - dipakai generator FCS (services/fcsService opsi.template) & uji.
import { ALL_PROSES } from '../constants/panelTypes'

export type BarisTemplate = { tipe_panel: string; proses: string; wp: string; hari: number }

export const PROSES_TEMPLATE = ['POTONG', 'BENDING', 'STEL', 'FINISHING', 'RENDAM', 'PAINTING', 'RAKIT', 'PASANG KOMPONEN']

// Salinan isi file TEMPLATE WP.xlsx (4 pola) - HANYA cadangan sandbox selama tabel template_jadwal_wp belum dibuat
// (SQL dijalankan user). Seed SQL (supabase/migrations/20261023010000_template_jadwal_wp.sql) berisi angka yang sama.
const POLA_FILE: Record<string, Record<string, (number | 0)[]>> = {
  FS: { POTONG: [1, 2, 3, 5], BENDING: [1, 2, 3, 5], STEL: [2, 3, 4, 0], FINISHING: [2, 3, 4, 0], RENDAM: [3, 4, 5, 6], PAINTING: [3, 4, 5, 6], RAKIT: [4, 5, 6, 7], 'PASANG KOMPONEN': [5, 6, 0, 0] },
  WM: { POTONG: [1, 1, 5, 2], BENDING: [1, 1, 5, 2], STEL: [0, 2, 0, 3], FINISHING: [0, 2, 0, 3], RENDAM: [2, 2, 5, 3], PAINTING: [2, 2, 5, 3], RAKIT: [3, 3, 6, 4], 'PASANG KOMPONEN': [4, 4, 0, 0] },
  OUWM: { POTONG: [1, 1, 3, 0], BENDING: [1, 1, 3, 0], STEL: [0, 2, 4, 0], FINISHING: [0, 2, 4, 0], RENDAM: [2, 2, 5, 0], PAINTING: [2, 2, 5, 0], RAKIT: [3, 3, 6, 0], 'PASANG KOMPONEN': [4, 4, 0, 0] },
  POLY: { POTONG: [1, 1, 3, 4], BENDING: [1, 1, 3, 4], STEL: [0, 2, 4, 5], FINISHING: [0, 2, 4, 5], RENDAM: [2, 2, 5, 6], PAINTING: [2, 2, 5, 6], RAKIT: [3, 3, 6, 7], 'PASANG KOMPONEN': [4, 4, 0, 0] },
}
const PETA_FILE: Record<string, string> = { FS: 'FS', F3B: 'FS', FS_SS: 'FS', OU_FS: 'FS', WM_MS: 'WM', WM_SS: 'WM', 'BOX_KOSONG WM': 'WM', 'OU_WM.MS': 'OUWM', WM_POLY: 'POLY' }
export function templateCadanganFile(): BarisTemplate[] {
  const out: BarisTemplate[] = []
  for (const [tipe, pola] of Object.entries(PETA_FILE)) for (const [proses, hari] of Object.entries(POLA_FILE[pola]))
    hari.forEach((h, i) => { if (h > 0) out.push({ tipe_panel: tipe, proses, wp: 'WP' + (i + 1), hari: h }) })
  return out
}

// ---- tanggal ----
const keUtc = (d: string) => { const [y, m, h] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, h)) }
const dariUtc = (x: Date) => x.toISOString().slice(0, 10)
const geser = (d: string, n: number) => { const x = keUtc(d); x.setUTCDate(x.getUTCDate() + n); return dariUtc(x) }
export const isTanggalValid = (d: any): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(keUtc(d).getTime())

// Libur = Minggu ATAU tanggal yang punya baris override dan SEMUA barisnya berkapasitas 0 (menit, orang, unit).
// Tanggal tanpa baris override = hari kerja biasa (kapasitas default).
export function buatCekLibur(overrideRows: any[]): (tgl: string) => boolean {
  const per = new Map<string, { n: number; nol: number }>()
  for (const o of overrideRows || []) {
    if (!o?.tanggal) continue
    const p = per.get(o.tanggal) || { n: 0, nol: 0 }
    p.n++
    if (!(Number(o.kapasitas_menit) > 0) && !(Number(o.jumlah_orang) > 0) && !(Number(o.kapasitas_unit) > 0)) p.nol++
    per.set(o.tanggal, p)
  }
  return (tgl: string) => {
    if (keUtc(tgl).getUTCDay() === 0) return true
    const p = per.get(tgl)
    return !!p && p.n > 0 && p.nol === p.n
  }
}
export function hariKerjaPertama(tgl: string, libur: (t: string) => boolean): string {
  let d = tgl; for (let i = 0; i < 60 && libur(d); i++) d = geser(d, 1); return d
}
// Day ke-n (n>=1) dari Day 1 (Day 1 sendiri digeser ke hari kerja pertama).
export function tanggalHariKe(day1: string, n: number, libur: (t: string) => boolean): string {
  let d = hariKerjaPertama(day1, libur)
  for (let k = 1; k < n; k++) { d = geser(d, 1); d = hariKerjaPertama(d, libur) }
  return d
}
// Hari kerja sebelum `tgl` (H-1).
export function hariKerjaSebelum(tgl: string, libur: (t: string) => boolean): string {
  let d = geser(tgl, -1); for (let i = 0; i < 60 && libur(d); i++) d = geser(d, -1); return d
}

// ---- penata ----
export type PosisiTemplate = { hari: number; tanggal: string; diLuarTemplate: boolean }
export type PenataTemplate = {
  day1: string
  punya: (tipeTemplate: string) => boolean
  posisi: (tipeTemplate: string, proses: string, wp: string) => PosisiTemplate | null
  hariPasangAwal: (tipeTemplate: string) => { hari: number; tanggal: string } | null
  libur: (tgl: string) => boolean
}
export function buatPenataTemplate(baris: BarisTemplate[], day1: string, libur: (t: string) => boolean): PenataTemplate {
  const peta = new Map<string, number>() // tipe|proses|wp -> hari
  const tipe = new Set<string>()
  for (const b of baris || []) {
    const h = Number(b.hari)
    if (!b?.tipe_panel || !PROSES_TEMPLATE.includes(b.proses) || !/^WP\d$/.test(b.wp) || !(h >= 1)) continue
    peta.set(`${b.tipe_panel}|${b.proses}|${b.wp}`, h); tipe.add(b.tipe_panel)
  }
  const d1 = hariKerjaPertama(day1, libur)
  const tglHari = (n: number) => tanggalHariKe(d1, n, libur)
  return {
    day1: d1, libur,
    punya: t => tipe.has(t),
    posisi(t, proses, wp) {
      if (!tipe.has(t) || !PROSES_TEMPLATE.includes(proses)) return null
      const h = peta.get(`${t}|${proses}|${wp}`)
      if (h) return { hari: h, tanggal: tglHari(h), diLuarTemplate: false }
      // "-" -> hari proses sebelumnya (urutan ALL_PROSES) yang ada di template utk WP yang sama; tidak ada -> Day 1.
      const idx = ALL_PROSES.indexOf(proses)
      for (let i = idx - 1; i >= 0; i--) { const hs = peta.get(`${t}|${ALL_PROSES[i]}|${wp}`); if (hs) return { hari: hs, tanggal: tglHari(hs), diLuarTemplate: true } }
      return { hari: 1, tanggal: tglHari(1), diLuarTemplate: true }
    },
    hariPasangAwal(t) {
      let min = 0
      for (const [k, h] of peta) { const [tp, pr] = k.split('|'); if (tp === t && pr === 'PASANG KOMPONEN' && (!min || h < min)) min = h }
      return min ? { hari: min, tanggal: tglHari(min) } : null
    },
  }
}

// QC TEST/PACKING = H-1 target WO. Target kosong/tidak valid -> null (tidak dijadwalkan, diperingatkan).
// H-1 sebelum Day 1 -> ditaruh di tanggal terakhir jadwal template panel itu (diperingatkan).
export function tanggalQcPacking(target: any, day1: string, tanggalTerakhirTemplate: string | null, libur: (t: string) => boolean):
  { tanggal: string | null; peringatan: string | null } {
  if (!isTanggalValid(target)) return { tanggal: null, peringatan: 'target WO kosong/tidak valid - QC TEST & PACKING tidak dijadwalkan' }
  const h1 = hariKerjaSebelum(target, libur)
  if (h1 < day1) {
    const t = tanggalTerakhirTemplate || day1
    return { tanggal: t, peringatan: `H-1 target (${h1}) sebelum Day 1 (${day1}) - QC TEST & PACKING ditaruh di hari terakhir template ${t}` }
  }
  if (tanggalTerakhirTemplate && h1 < tanggalTerakhirTemplate) return { tanggal: h1, peringatan: `target lebih awal dari selesai template: jadwal terakhir ${tanggalTerakhirTemplate} > QC/PACKING ${h1} (H-1 target ${target})` }
  return { tanggal: h1, peringatan: null }
}

// Ringkasan hasil per panel (dialog + activity_log).
export type HasilTemplatePanel = {
  panelId: number; panel: string; tipe: string; tipeTemplate: string | null
  day1: string; tanpaTemplate?: boolean
  diLuarTemplate: string[] // "PROSES WPn: kode, kode (Day n, tanggal)"
  peringatan: string[]
  tanggalProses: Record<string, string[]> // proses -> tanggal unik
}
export function teksHasilTemplate(h: HasilTemplatePanel): string {
  if (h.tanpaTemplate) return `${h.panel} (${h.tipe}): tidak ada template - jadwal memakai cara lama (mulai ${h.day1})`
  const bagian = [`${h.panel} (${h.tipe}, template ${h.tipeTemplate}, Day 1 ${h.day1})`]
  if (h.diLuarTemplate.length) bagian.push('di luar template: ' + h.diLuarTemplate.join('; '))
  if (h.peringatan.length) bagian.push('peringatan: ' + h.peringatan.join('; '))
  return bagian.join(' - ')
}
