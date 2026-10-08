// LOGIKA PINDAH JADWAL RAW SCHEDULE (8 Okt 2026) - SATU sumber (CLAUDE.md B.1) utk drag 1 sel lama
// (confirmDrag) DAN pindah banyak sel sekaligus (multi-pilih). Isi lepasDariAsal/taruhDiTujuan =
// logika confirmDrag apa adanya (dipindah ke sini), bedanya cuma TIDAK memutasi objek jadwal lama
// (dulu entry tujuan yang sudah ada diubah di tempat -> objek "sebelum" ikut berubah).
//
// - lepasDariAsal: buang kode yang di-drag dari tanggal asal; kode yang ADA pengerjaan (timer) di
//   tanggal asal TETAP tinggal sbg jejak (digeserKe[kode]=tanggal tujuan). Kode yang tidak ikut
//   di-drag (mis. sudah selesai, sudah difilter keluar sejak onDragStart) tidak disentuh.
// - taruhDiTujuan: GABUNG ke entry WP yang sama di tanggal tujuan (union komponen) atau tambah entry
//   baru; tiap kode asli (bukan token __wiring_) di-stamp manualPin[kode]=waktu sekarang (supaya
//   auto-geser-harian tidak menggeser ulang, lihat isManualPinKode Edge Function).
// Proyeksi WIRING (token __wiring_) ikut apa adanya seperti dulu.

export type EntriJadwal = { wp: string; komponen: string[]; digeserKe?: Record<string, string>; manualPin?: Record<string, string>; [k: string]: any }
export type Jadwal = Record<string, EntriJadwal[]>

export function lepasDariAsal(schedule: Jadwal, fromDate: string, toDate: string, entries: EntriJadwal[], adaPengerjaan: Set<string>): Jadwal {
  const newSch: Jadwal = { ...(schedule || {}) }
  const sisaDiAsal = (schedule?.[fromDate] || []).map((orig: any) => {
    const dragged = entries.find((e: any) => e.wp === orig.wp)
    if (!dragged) return orig
    const digeserKe = { ...(orig.digeserKe || {}) }
    const komponenSisa = (orig.komponen || []).filter((k: string) => {
      if (!dragged.komponen.includes(k)) return true
      if (adaPengerjaan.has(k)) { digeserKe[k] = toDate; return true }
      return false
    })
    if (komponenSisa.length === 0) return null
    return Object.keys(digeserKe).length > 0 ? { ...orig, komponen: komponenSisa, digeserKe } : { ...orig, komponen: komponenSisa }
  }).filter(Boolean) as EntriJadwal[]
  if (sisaDiAsal.length > 0) newSch[fromDate] = sisaDiAsal; else delete newSch[fromDate]
  return newSch
}

export function taruhDiTujuan(schedule: Jadwal, toDate: string, entries: EntriJadwal[], nowIso: string): Jadwal {
  const newSch: Jadwal = { ...(schedule || {}) }
  const merged: EntriJadwal[] = (newSch[toDate] || []).map((m) => ({ ...m }))
  entries.forEach((e) => {
    const kodeAsliDrag = (e.komponen || []).filter((k: string) => !k.startsWith('__wiring_'))
    const found = merged.find((m) => m.wp === e.wp)
    if (found) {
      found.komponen = [...new Set([...found.komponen, ...e.komponen])]
      const manualPin = { ...(found.manualPin || {}) }
      kodeAsliDrag.forEach((k: string) => { manualPin[k] = nowIso })
      found.manualPin = manualPin
    } else {
      const manualPin: Record<string, string> = {}
      kodeAsliDrag.forEach((k: string) => { manualPin[k] = nowIso })
      merged.push({ ...e, manualPin })
    }
  })
  newSch[toDate] = merged
  return newSch
}

// ── Pindah BANYAK sel sekaligus (offset hari sama) ───────────────────────────────────────────────
export type SelPindah = { rawId: number; dari: string; ke: string; entries: EntriJadwal[]; adaPengerjaan: Set<string> }
export type RencanaPindahMulti = {
  rows: { raw_id: number; sebelum: Jadwal; sesudah: Jadwal }[]
  renhar: { raw_id: number; wp: string; dari: string; ke: string; kode: string[] }[]
  sel: { raw_id: number; dari: string; ke: string }[]
}

// Per baris: LEPAS semua sumber dulu (dari snapshot awal), BARU taruh semua tujuan - jangan pindah
// satu-satu berurutan. Contoh geser +1 hari sel 8 & 9 Okt di baris yang sama: tujuan 9 Okt adalah
// sumber sel lain - kalau berurutan, isi 8 Okt yang baru mendarat di 9 Okt ikut terbawa ke 10 Okt.
export function rencanakanPindahMulti(jadwalPerBaris: Map<number, Jadwal>, sel: SelPindah[], nowIso: string): RencanaPindahMulti {
  const perBaris = new Map<number, SelPindah[]>()
  sel.forEach((s) => { if (!perBaris.has(s.rawId)) perBaris.set(s.rawId, []); perBaris.get(s.rawId)!.push(s) })
  const rows: RencanaPindahMulti['rows'] = []
  perBaris.forEach((daftar, rawId) => {
    const sebelum = jadwalPerBaris.get(rawId) || {}
    let sch: Jadwal = JSON.parse(JSON.stringify(sebelum))
    daftar.forEach((s) => { sch = lepasDariAsal(sch, s.dari, s.ke, s.entries, s.adaPengerjaan) })
    daftar.forEach((s) => { sch = taruhDiTujuan(sch, s.ke, s.entries, nowIso) })
    rows.push({ raw_id: rawId, sebelum, sesudah: sch })
  })
  const renhar = sel.flatMap((s) => s.entries.map((e) => ({ raw_id: s.rawId, wp: e.wp, dari: s.dari, ke: s.ke, kode: [...(e.komponen || [])] })))
  return { rows, renhar, sel: sel.map((s) => ({ raw_id: s.rawId, dari: s.dari, ke: s.ke })) }
}

export const isMinggu = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).getUTCDay() === 0 }
