// SHIFT PER SESI TIMER (8 Nov 2026, tab Aktivitas Panel - operator estafet Shift 1 / Shift 2). Fungsi murni, tanpa query.
// fcs_timer_kerja TIDAK menyimpan shift. Satu-satunya catatan shift = panels.checklist[kode].history[proses][].shift, ditulis
// vista-pekerja saat Simpan Progress dari shift sesi HP ("Pilih shift kerja Anda hari ini"). Maka shift satu sesi diturunkan:
// 1. kolom t.shift bila suatu saat ada (draf kolom fcs_timer_kerja.shift, belum dijalankan);
// 2. entri history ber-shift di sel yang sama (panel+kode+proses) antara jam mulai dan selesai+10 mnt (berjalan: sampai
//    sekarang+10 mnt); tepat satu shift -> itu, dua shift (sesi melintasi pergantian) -> tidak diketahui;
// 3. masih kosong: sesi lain operator itu pada hari kerja yang sama, HANYA bila semua sesinya hari itu satu shift
//    (keputusan user 8 Nov; operator dua shift tidak diisi).
// Bukti 8 Nov (sejak 1 Okt): langkah 2 = 79% sesi, + langkah 3 = ~95%. Aturan jam TIDAK dipakai: paling tinggi cocok 88%,
// jam masuk shift 2 beda per bagian (Mekanik 15.00). Tidak diketahui -> null (layar "Shift ?").
// Durasi per shift = gabungan rentang (lib/jejakPengerjaan menitGabungan), tidak menjumlah orang yang bekerja bersamaan.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Shift = '1' | '2'
export type EntriHistoryShift = { ts?: string | null; shift?: string | number | null }
export type SesiShift = { id: number | string; pekerja_id: any; tanggal?: string | null; mulai: string; selesai?: string | null; shift?: string | number | null }
export type InfoShift = { shift: Shift | null; dariSesiLain: boolean }

export const JEDA_SIMPAN_MS = 10 * 60000
const valid = (s: any): Shift | null => (s === '1' || s === 1 ? '1' : s === '2' || s === 2 ? '2' : null)

// Shift satu sesi dari kolom timer (bila ada) atau dari history sel yang sama.
export function shiftDariHistory(t: SesiShift, history: EntriHistoryShift[] | null | undefined, sekarangMs = Date.now()): Shift | null {
  const kolom = valid(t.shift)
  if (kolom) return kolom
  const a = Date.parse(t.mulai)
  if (!Number.isFinite(a)) return null
  const b = (t.selesai ? Date.parse(t.selesai) : sekarangMs) + JEDA_SIMPAN_MS
  const ada = new Set<Shift>()
  for (const e of Array.isArray(history) ? history : []) {
    const v = valid(e?.shift); const w = e?.ts ? Date.parse(e.ts) : NaN
    if (v && w >= a && w <= b) ada.add(v)
  }
  return ada.size === 1 ? [...ada][0] : null
}

// Peta id timer -> shift utk semua timer satu hari (semua sel, supaya langkah 3 bisa melihat sesi lain operator).
export function petaShiftHari(timers: SesiShift[], historyUntuk: (t: SesiShift) => EntriHistoryShift[] | null | undefined, sekarangMs = Date.now()): Map<string, InfoShift> {
  const hasil = new Map<string, InfoShift>()
  const perOrang = new Map<string, Set<Shift>>()
  const kunciOrang = (t: SesiShift) => `${t.pekerja_id}|${t.tanggal ?? ''}`
  for (const t of timers || []) {
    const s = shiftDariHistory(t, historyUntuk(t), sekarangMs)
    hasil.set(String(t.id), { shift: s, dariSesiLain: false })
    if (s) { const k = kunciOrang(t); (perOrang.get(k) || perOrang.set(k, new Set()).get(k)!).add(s) }
  }
  for (const t of timers || []) {
    const r = hasil.get(String(t.id))!
    if (r.shift) continue
    const s = perOrang.get(kunciOrang(t))
    if (s && s.size === 1) hasil.set(String(t.id), { shift: [...s][0], dariSesiLain: true })
  }
  return hasil
}

// Kelompokkan sesi satu sel per shift, urut menurut mulai paling awal. menit dihitung pemanggil (gabungan rentang).
export function kelompokPerShift<T extends SesiShift>(timers: T[], peta: Map<string, InfoShift>): { shift: Shift | null; sesi: T[]; dariSesiLain: boolean }[] {
  const g = new Map<string, { shift: Shift | null; sesi: T[]; dariSesiLain: boolean }>()
  for (const t of [...(timers || [])].sort((x, y) => String(x.mulai).localeCompare(String(y.mulai)))) {
    const info = peta.get(String(t.id)) || { shift: null, dariSesiLain: false }
    const k = info.shift ?? '?'
    const r = g.get(k) || g.set(k, { shift: info.shift, sesi: [], dariSesiLain: false }).get(k)!
    r.sesi.push(t)
    if (info.dariSesiLain) r.dariSesiLain = true
  }
  return [...g.values()]
}
