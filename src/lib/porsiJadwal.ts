// PORSI JADWAL (13 Nov 2026, investigasi "jadwal dobel" - lapis 2, keputusan user). SATU sumber hitungan "kode ini
// terjadwal dobel" di satu baris raw_schedule (1 panel x 1 proses), dipakai penanda UI Raw Schedule (per WP & lama) dan
// nanti penjaga tulis (lapis 1) & Cek Kesehatan (lapis 4).
// Aturan user:
// - Pembagian qty ke beberapa hari/WP (qtyPerKomponen) yang totalnya = qty itu SAH; DOBEL = total porsi aktif > qty.
// - Pengecualian: BUSBAR (pakai busbar_schedule per tahap, tidak dihitung di sini) dan WIRING CONTROL/POWER bila sel-selnya
//   membentuk rentang tanggal yang BERURUTAN PERSIS (tanpa lompatan hari). Token __wiring_ bukan komponen (dilewati).
// - Proses penanda panel (QC TEST/PACKING "MARKED", NAMEPLATE/YELLOWMARK) tidak dihitung.
// Porsi aktif = entri yang memuat kode di `komponen` (BUKAN kunci qtyPerKomponen - porsi yatim tidak ikut), bukan jejak
// (digeserKe[kode]). Entri tanpa porsi = qty penuh (cara data lama dibaca; lapis 1 akan menulis porsi eksplisit).
// TIDAK memakai filter progres: data jadwal dobel tetap ditandai walau komponennya sudah 100% (sebagai bukti).
import { PROSES_TANPA_MAPPING_KOMPONEN } from './panelHelpers'

export type PorsiLebih = { total: number; qty: number }
const PROSES_DIKECUALIKAN = new Set<string>(['BUSBAR', ...PROSES_TANPA_MAPPING_KOMPONEN])
const isWiring = (proses: string) => proses === 'WIRING CONTROL' || proses === 'WIRING POWER'

const tanggalBerikut = (t: string) => { const d = new Date(t + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) }
// Tanggal-tanggal ini membentuk satu rentang berurutan persis (tanpa lompatan hari)?
// Dua sel pada hari yang sama BUKAN rentang (temuan regresi-penguji 13 Nov 2026).
export function rentangBerurutan(tanggal: string[]): boolean {
  if (new Set(tanggal).size !== tanggal.length) return false
  if (tanggal.some((t) => !/^\d{4}-\d{2}-\d{2}$/.test(t))) return false // kunci tanggal rusak -> bukan rentang (jangan melempar)
  const u = [...new Set(tanggal)].sort()
  for (let i = 1; i < u.length; i++) if (u[i] !== tanggalBerikut(u[i - 1])) return false
  return true
}

// Kode di satu baris jadwal yang total porsi aktifnya > qty (dengan pengecualian di atas). Kode qty <= 0 / tidak ada di
// checklist dilewati (ditangani cek kode tidak valid K25).
type EntriPorsi = { komponen?: string[]; digeserKe?: Record<string, string>; qtyPerKomponen?: Record<string, number> }
export function kodePorsiLebih(row: { proses?: string; schedule?: Record<string, EntriPorsi[]> } | null | undefined, checklist: Record<string, { qty?: number } | undefined> | null | undefined): Map<string, PorsiLebih> {
  const hasil = new Map<string, PorsiLebih>()
  const proses = row?.proses || ''
  if (!row || PROSES_DIKECUALIKAN.has(proses)) return hasil
  const total = new Map<string, number>()
  const tanggalKode = new Map<string, string[]>()
  for (const [tgl, entri] of Object.entries(row.schedule || {})) {
    for (const e of entri || []) {
      for (const kode of e?.komponen || []) {
        if (!kode || kode.startsWith('__') || e?.digeserKe?.[kode]) continue
        const qty = Number(checklist?.[kode]?.qty) || 0
        if (qty <= 0) continue
        const porsi = e?.qtyPerKomponen?.[kode]
        total.set(kode, (total.get(kode) || 0) + (porsi != null ? Number(porsi) || 0 : qty))
        const t = tanggalKode.get(kode) || []; t.push(tgl); tanggalKode.set(kode, t)
      }
    }
  }
  for (const [kode, jml] of total) {
    const qty = Number(checklist?.[kode]?.qty) || 0
    if (jml <= qty + 1e-9) continue
    if (isWiring(proses) && rentangBerurutan(tanggalKode.get(kode) || [])) continue
    hasil.set(kode, { total: jml, qty })
  }
  return hasil
}

export const labelAriaPorsiLebih = (p: PorsiLebih) => `Jadwal dobel: total ${Number(p.total.toFixed(2))} lebih dari qty ${p.qty}`
export const teksPorsiLebih = (p: PorsiLebih) => `Dobel: total porsi terjadwal ${Number(p.total.toFixed(2))} > qty ${p.qty} (aturan: satu komponen per proses tidak boleh melebihi qty)`

// Peta kode dobel per id baris raw_schedule utk seluruh daftar (tampilan Raw lama). Di-cache per pasangan objek
// (daftar baris, sumber checklist) - dihitung ulang hanya bila salah satunya berganti (data realtime baru), bukan per render.
type BarisPorsi = { id: number; proses?: string; schedule?: Record<string, EntriPorsi[]>; panel_id?: number; panelId?: number }
const cachePeta = new WeakMap<object, { sumber: object; peta: Map<number, Map<string, PorsiLebih>> }>()
export function petaPorsiLebihBaris(rows: BarisPorsi[], panelById: Map<number, { checklist?: Record<string, { qty?: number } | undefined> }>): Map<number, Map<string, PorsiLebih>> {
  if (!rows) return new Map() // data belum termuat - jangan sampai WeakMap(undefined) melempar
  const c = cachePeta.get(rows)
  if (c && c.sumber === panelById) return c.peta
  const peta = new Map<number, Map<string, PorsiLebih>>()
  for (const r of rows || []) peta.set(r.id, kodePorsiLebih(r, panelById.get(Number(r.panel_id || r.panelId))?.checklist))
  cachePeta.set(rows, { sumber: panelById, peta })
  return peta
}
