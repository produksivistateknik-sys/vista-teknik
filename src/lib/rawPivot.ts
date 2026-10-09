// SUSUNAN DATA RAW SCHEDULE ACCORDION PER WP (Tahap 1 migrasi, 9 Okt 2026) - FUNGSI MURNI.
//
// Data tersimpan TIDAK berubah bentuk: raw_schedule tetap 1 baris per (panel, proses) dgn
// schedule[tanggal] = [{wp, komponen[], digeserKe, manualPin, carriedOverFrom, ...}]. Di sini data yang
// SUDAH dimuat disusun ulang (dalam memori) menjadi:
//   panel -> grup (WP1..WPn dari BOM, lalu BUSBAR) -> komponen -> tanggal -> chip proses
//   + penanda QC TEST / PACKING (1 per panel) + ringkasan header WP per tanggal.
// Tanpa request. Pemanggil mengurutkan baris (bandingkanBarisRaw) & menyaring panel; urutan panel di sini
// = urutan kemunculan pertama di `rows`.
//
// Aturan (keputusan user 9 Okt 2026):
// - Komponen -> WP dari BOM (cfg tipe, = bom_master.wp); kode terjadwal yang tidak ada di BOM tetap tampil
//   di grup entry.wp-nya (dicek live: 0 kasus, 5.195 entri).
// - BUSBAR: 1 baris per komponen busbar (pseudo-komponen H-BUS/INCOMING/...), chip "BUSBAR"; tahap kerja
//   (FABRIKASI/PLATING/...) hanya di tooltip (data jadwal busbar tidak menyimpan tahap).
// - QC TEST / PACKING: penanda 1 per panel, status dari statusPenandaPanel (qc_checklist/packing_done).
// - WIRING: chip di hari jadwal + hari "jadwal lanjutan" (jadwalLanjutanWiring, sama dgn tampilan lama &
//   kapasitas) dgn angka kebutuhan orang; real menang (hari yang sudah punya entry real tidak diberi chip
//   lanjutan utk kode yang sama).
// - Ringkasan header WP per tanggal: per proses = jumlah komponen WP itu yang terjadwal (jejak digeserKe
//   TIDAK dihitung); selesai = semua komponen itu progress proses tsb >= 100.
import { ALL_PROSES } from '../constants/panelTypes'
import { kebutuhanOrangWiring, getProgressAsOfDate, getPanelBusbarKomponen, getBusbarKomponen, statusPenandaPanel } from './panelHelpers'
import { hariKeNFromMap } from '../services/fcsService'
import { PROSES_ORANG_RAW, jadwalLanjutanWiring } from './isiSelJadwal'

export const PROSES_PENANDA = ['QC TEST', 'PACKING'] as const

export type ChipProses = {
  proses: string
  rawId: number
  wp: string
  selesai: boolean
  jejakKe?: string // digeserKe / busbar_jejak: histori, sudah dipindah ke tanggal ini
  pin?: boolean // manualPin / busbar_manual_pin
  dariTanggal?: string // carriedOverFrom (auto-geser)
  lanjutan?: boolean // WIRING: hari lanjutan dari durasi standar bobot (bukan entry tersimpan)
  orang?: number // WIRING: kebutuhan orang hari itu
}
export type BarisKomponen = { kode: string; nama: string; sel: Record<string, ChipProses[]> }
export type RingkasanProses = { proses: string; n: number; selesai: boolean }
export type GrupKomponen = {
  key: string // 'WP1' ... | 'BUSBAR'
  jenis: 'wp' | 'busbar'
  komponen: BarisKomponen[]
  ringkasan: Record<string, RingkasanProses[]> // tanggal -> chip ringkasan (urut ALL_PROSES)
}
export type Penanda = { proses: string; rawId: number; sel: Record<string, true>; selesai: boolean }
export type BlokPanel = {
  panelId: number
  proyek: string
  panel: string
  prioritas: string
  tipe: string
  woId: number | null
  grup: GrupKomponen[]
  penanda: Penanda[]
}

export type KonteksPivot = {
  panelById: Map<number, any>
  cfgTipe: (tipe: string) => any // konfigurasi WP & komponen tipe (livePanelTypes/BOM)
  wiringHariKerjaMap: any
}

const urutProses = (a: string, b: string) => {
  const ia = ALL_PROSES.indexOf(a), ib = ALL_PROSES.indexOf(b)
  return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
}

function ringkas(komponen: BarisKomponen[]): Record<string, RingkasanProses[]> {
  const perTgl: Record<string, Map<string, { kode: Set<string>; selesai: boolean }>> = {}
  for (const k of komponen) {
    for (const [d, chips] of Object.entries(k.sel)) {
      for (const c of chips) {
        if (c.jejakKe) continue
        const m = (perTgl[d] = perTgl[d] || new Map())
        const x = m.get(c.proses) || { kode: new Set<string>(), selesai: true }
        if (!x.kode.has(k.kode)) { x.kode.add(k.kode); if (!c.selesai) x.selesai = false }
        m.set(c.proses, x)
      }
    }
  }
  const out: Record<string, RingkasanProses[]> = {}
  for (const [d, m] of Object.entries(perTgl)) {
    out[d] = [...m.entries()].sort((a, b) => urutProses(a[0], b[0])).map(([proses, x]) => ({ proses, n: x.kode.size, selesai: x.selesai }))
  }
  return out
}

export function susunPivot(rows: any[], ctx: KonteksPivot): BlokPanel[] {
  const perPanel = new Map<number, any[]>()
  const urutan: number[] = []
  for (const r of rows) {
    const pid = Number(r.panel_id || r.panelId)
    if (!perPanel.has(pid)) { perPanel.set(pid, []); urutan.push(pid) }
    perPanel.get(pid)!.push(r)
  }
  const hasil: BlokPanel[] = []
  for (const pid of urutan) {
    const rs = perPanel.get(pid)!
    const r0 = rs[0]
    const panelData = ctx.panelById.get(pid)
    const tipe = panelData?.tipe || ''
    const cl = panelData?.checklist || {}
    const cfg = ctx.cfgTipe(tipe)

    // ── komponen WP: chip per kode per tanggal dari semua baris proses biasa ──
    const chipPerKode = new Map<string, Record<string, ChipProses[]>>()
    const wpKode = new Map<string, string>() // kode -> wp (entry)
    const tambahChip = (kode: string, d: string, c: ChipProses) => {
      const m = chipPerKode.get(kode) || {}
      ;(m[d] = m[d] || []).push(c)
      chipPerKode.set(kode, m)
    }
    for (const r of rs) {
      if (r.proses === 'BUSBAR' || (PROSES_PENANDA as readonly string[]).includes(r.proses)) continue
      const isOrang = PROSES_ORANG_RAW.includes(r.proses)
      const realHari = new Set<string>() // "kode|tanggal" yang punya entry real (WIRING: real menang)
      for (const [d, ents] of Object.entries(r.schedule || {}) as [string, any[]][]) {
        for (const e of ents || []) {
          for (const kode of e.komponen || []) {
            if (kode.startsWith('__wiring_')) continue
            if (!wpKode.has(kode)) wpKode.set(kode, e.wp)
            realHari.add(kode + '|' + d)
            const c: ChipProses = { proses: r.proses, rawId: r.id, wp: e.wp, selesai: (cl[kode]?.progress?.[r.proses] || 0) >= 100 }
            if (e.digeserKe?.[kode]) c.jejakKe = e.digeserKe[kode]
            if (e.manualPin?.[kode]) c.pin = true
            if (e.carriedOverFrom) c.dariTanggal = e.carriedOverFrom
            if (isOrang && !c.jejakKe) c.orang = kebutuhanOrangWiring(r.bobot_komponen?.[kode], hariKeNFromMap(ctx.wiringHariKerjaMap, r.panel_id || r.panelId, kode, r.proses, d))
            tambahChip(kode, d, c)
          }
        }
      }
      if (isOrang) {
        for (const [d, list] of Object.entries(jadwalLanjutanWiring(r, panelData, ctx.wiringHariKerjaMap))) {
          for (const p of list) {
            if (realHari.has(p.kode + '|' + d)) continue
            tambahChip(p.kode, d, { proses: r.proses, rawId: r.id, wp: p.wp, selesai: false, lanjutan: true, orang: p.orang })
          }
        }
      }
    }
    for (const sel of chipPerKode.values()) for (const d of Object.keys(sel)) sel[d].sort((a, b) => urutProses(a.proses, b.proses))

    const grup: GrupKomponen[] = []
    const sudah = new Set<string>()
    for (const w of cfg?.wps || []) {
      const komponen: BarisKomponen[] = []
      for (const it of w.items || []) {
        const terjadwal = chipPerKode.has(it.kode)
        if (!terjadwal && !((cl[it.kode]?.qty || 0) > 0)) continue
        sudah.add(it.kode)
        komponen.push({ kode: it.kode, nama: it.nama, sel: chipPerKode.get(it.kode) || {} })
      }
      if (komponen.length) grup.push({ key: w.wp, jenis: 'wp', komponen, ringkasan: ringkas(komponen) })
    }
    // kode terjadwal yang tidak ada di BOM tipe ini -> grup entry.wp (dibuat bila belum ada)
    for (const [kode, sel] of chipPerKode) {
      if (sudah.has(kode)) continue
      const wp = wpKode.get(kode) || 'Lainnya'
      let g = grup.find(x => x.key === wp)
      if (!g) { g = { key: wp, jenis: 'wp', komponen: [], ringkasan: {} }; grup.push(g) }
      g.komponen.push({ kode, nama: kode, sel })
    }
    for (const g of grup) g.ringkasan = ringkas(g.komponen)

    // ── BUSBAR ──
    const rowBB = rs.find(r => r.proses === 'BUSBAR')
    if (rowBB) {
      const daftar = getPanelBusbarKomponen(panelData || { tipe, checklist: cl, id: pid }, [rowBB])
      const master = getBusbarKomponen(tipe)
      const idx = (k: string) => { const i = master.indexOf(k); return i < 0 ? 999 : i }
      const kodeBB = [...daftar].sort((a, b) => idx(a) - idx(b) || a.localeCompare(b))
      const komponen: BarisKomponen[] = kodeBB.map(kode => {
        const sel: Record<string, ChipProses[]> = {}
        for (const [d, list] of Object.entries(rowBB.busbar_schedule || {}) as [string, string[]][]) {
          if (!(list || []).includes(kode)) continue
          const c: ChipProses = { proses: 'BUSBAR', rawId: rowBB.id, wp: 'BUSBAR', selesai: getProgressAsOfDate(cl[kode], 'BUSBAR', d) >= 100 }
          const jejak = rowBB.busbar_jejak?.[d]?.[kode]; if (jejak) c.jejakKe = jejak
          if (rowBB.busbar_manual_pin?.[d]?.[kode]) c.pin = true
          sel[d] = [c]
        }
        return { kode, nama: kode, sel }
      })
      if (komponen.length) grup.push({ key: 'BUSBAR', jenis: 'busbar', komponen, ringkasan: ringkas(komponen) })
    }

    // ── penanda QC TEST / PACKING (1 per panel) ──
    const penanda: Penanda[] = []
    for (const pr of PROSES_PENANDA) {
      const r = rs.find(x => x.proses === pr)
      if (!r) continue
      const sel: Record<string, true> = {}
      for (const [d, ents] of Object.entries(r.schedule || {}) as [string, any[]][]) if ((ents || []).length) sel[d] = true
      penanda.push({ proses: pr, rawId: r.id, sel, selesai: statusPenandaPanel(panelData, pr) === 'DONE' })
    }

    hasil.push({ panelId: pid, proyek: r0.proyek, panel: r0.panel, prioritas: r0.prioritas, tipe, woId: r0.wo_id ?? r0.woId ?? null, grup, penanda })
  }
  return hasil
}
