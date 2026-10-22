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

// BUG FIX (14 Okt 2026, insiden SDP CT GALLON & FRESH AIR POTONG FS.30): kalau tanggal tujuan MASIH berisi
// JEJAK kode yang ditaruh (digeserKe[kode] di entry WP yang sama - mis. ditarik balik ke tanggal asal
// auto-geser), jejaknya DIHAPUS supaya kode aktif lagi di sini. Dulu kode cuma digabung + diberi pin, jejak
// tetap -> kode abu-abu di sini & sudah hilang dari tanggal asal = hilang dari jadwal aktif.
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
      if (found.digeserKe && kodeAsliDrag.some((k: string) => found.digeserKe![k])) {
        const digeserKe = { ...found.digeserKe }
        kodeAsliDrag.forEach((k: string) => { delete digeserKe[k] })
        if (Object.keys(digeserKe).length > 0) found.digeserKe = digeserKe; else delete found.digeserKe
      }
    } else {
      const manualPin: Record<string, string> = {}
      kodeAsliDrag.forEach((k: string) => { manualPin[k] = nowIso })
      merged.push({ ...e, manualPin })
    }
  })
  newSch[toDate] = merged
  return newSch
}

// ── BUSBAR (9 Okt 2026) - logika confirmDragBusbar apa adanya, dipindah ke sini (SATU sumber dgn
// pindah banyak sel). BUSBAR tidak pakai `schedule`, tapi busbar_schedule {tgl:[kode]} + busbar_jejak
// {tgl:{kode:tglTujuan}} + busbar_manual_pin {tgl:{kode:waktu}}. Beda dari proses biasa: saat move kode
// TETAP ada di tanggal asal & SELALU diberi jejak (tidak tergantung ada pengerjaan).
export type JadwalBusbar = { busbar_schedule: Record<string, string[]>; busbar_jejak: Record<string, Record<string, string>>; busbar_manual_pin: Record<string, Record<string, string>> }

export function lepasBusbar(j: JadwalBusbar, fromDate: string, toDate: string, kode: string[]): JadwalBusbar {
  const jejakFromDate = { ...((j.busbar_jejak || {})[fromDate] || {}) }
  kode.forEach((k) => { jejakFromDate[k] = toDate })
  return { ...j, busbar_jejak: { ...(j.busbar_jejak || {}), [fromDate]: jejakFromDate } }
}

// (14 Okt 2026) sama dgn taruhDiTujuan: kode BUSBAR yang ditaruh di tanggal tempat jejaknya berada
// (busbar_jejak[toDate][kode]) -> jejak dihapus, kode aktif lagi di sini.
export function taruhBusbar(j: JadwalBusbar, toDate: string, kode: string[], nowIso: string): JadwalBusbar {
  const bs = { ...(j.busbar_schedule || {}) }
  bs[toDate] = [...new Set([...(bs[toDate] || []), ...kode])]
  const pin = { ...(j.busbar_manual_pin || {}) }
  const pinAtTarget = { ...(pin[toDate] || {}) }
  kode.forEach((k) => { pinAtTarget[k] = nowIso })
  pin[toDate] = pinAtTarget
  const jejakTujuan = (j.busbar_jejak || {})[toDate]
  if (jejakTujuan && kode.some((k) => jejakTujuan[k])) {
    const sisa = { ...jejakTujuan }
    kode.forEach((k) => { delete sisa[k] })
    const jejak = { ...(j.busbar_jejak || {}) }
    if (Object.keys(sisa).length > 0) jejak[toDate] = sisa; else delete jejak[toDate]
    return { ...j, busbar_schedule: bs, busbar_manual_pin: pin, busbar_jejak: jejak }
  }
  return { ...j, busbar_schedule: bs, busbar_manual_pin: pin }
}

// ── JEJAK yang menunjuk ke suatu tanggal (14 Okt 2026, hapus WP & "Aktifkan di sini") ──────────────────
// Kode di entry WP `wp` tanggal `tanggal` yang merupakan TUJUAN jejak dari tanggal lain:
// [{ kode, dari }] (dari = tanggal tempat jejak digeserKe[kode] === tanggal, WP sama).
export function jejakMenujuTanggal(schedule: Jadwal, tanggal: string, wp: string, kode: string[]): { kode: string; dari: string }[] {
  const set = new Set(kode)
  const out: { kode: string; dari: string }[] = []
  Object.entries(schedule || {}).forEach(([d, es]) => {
    if (d === tanggal) return
    ;(es || []).forEach((e) => {
      if (e.wp !== wp) return
      Object.entries(e.digeserKe || {}).forEach(([k, ke]) => { if (ke === tanggal && set.has(k)) out.push({ kode: k, dari: d }) })
    })
  })
  return out
}
// Hapus jejak digeserKe[kode] di (tanggal, wp) -> kode aktif lagi di tanggal itu.
export function aktifkanJejak(schedule: Jadwal, tanggal: string, wp: string, kode: string[]): Jadwal {
  const set = new Set(kode)
  const es = (schedule?.[tanggal] || []).map((e) => {
    if (e.wp !== wp || !e.digeserKe || !Object.keys(e.digeserKe).some((k) => set.has(k))) return e
    const digeserKe = { ...e.digeserKe }
    set.forEach((k) => { delete digeserKe[k] })
    const { digeserKe: _lama, ...rest } = e
    return Object.keys(digeserKe).length > 0 ? { ...rest, digeserKe } : rest
  })
  return { ...(schedule || {}), [tanggal]: es as EntriJadwal[] }
}
// Buang kode (jejaknya) dari (tanggal, wp) sepenuhnya - entry kosong dihapus.
export function buangJejak(schedule: Jadwal, tanggal: string, wp: string, kode: string[]): Jadwal {
  const set = new Set(kode)
  const es = (schedule?.[tanggal] || []).map((e) => {
    if (e.wp !== wp) return e
    const komponen = (e.komponen || []).filter((k) => !(set.has(k) && e.digeserKe?.[k]))
    if (komponen.length === (e.komponen || []).length) return e
    const digeserKe = { ...(e.digeserKe || {}) }
    set.forEach((k) => { delete digeserKe[k] })
    const { digeserKe: _lama, ...rest } = e
    return { ...rest, komponen, ...(Object.keys(digeserKe).length > 0 ? { digeserKe } : {}) }
  }).filter((e) => (e.komponen || []).length > 0)
  const baru: Jadwal = { ...(schedule || {}) }
  if (es.length > 0) baru[tanggal] = es as EntriJadwal[]; else delete baru[tanggal]
  return baru
}
// Ikuti rantai jejak kode dari (tanggal, wp) sampai entri NYATA: tanggal nyata atau null (rantai putus).
export function tanggalNyataDariJejak(schedule: Jadwal, tanggal: string, wp: string, kode: string): string | null {
  let cur = (schedule?.[tanggal] || []).find((e) => e.wp === wp)?.digeserKe?.[kode]
  for (let i = 0; cur && i < 60; i++) {
    const e = (schedule?.[cur] || []).find((x) => x.wp === wp && (x.komponen || []).includes(kode))
    if (!e) return null
    if (!e.digeserKe?.[kode]) return cur
    cur = e.digeserKe[kode]
  }
  return null
}

// Kode BUSBAR di sel yang boleh ikut pindah: belum jejak di tanggal itu & progress BUSBAR < 100 (sama
// persis aturan drag 1 sel BUSBAR). `checklist` = panels.checklist panel tsb.
export function kodeBusbarBisaDipindah(row: any, checklist: any, tanggal: string): string[] {
  const jejakHariIni: Record<string, string> = row?.busbar_jejak?.[tanggal] || {}
  return ((row?.busbar_schedule?.[tanggal] || []) as string[]).filter((k) => !jejakHariIni[k] && ((checklist?.[k]?.progress?.BUSBAR) || 0) < 100)
}

// ── Pindah BANYAK sel sekaligus (offset hari sama) ───────────────────────────────────────────────
export type Jadwal4 = { schedule: Jadwal } & JadwalBusbar
export type SelPindahV2 = { rawId: number; dari: string; ke: string; entries?: EntriJadwal[]; adaPengerjaan?: Set<string>; kodeBusbar?: string[] }
export type RencanaPindahMultiV2 = {
  rows: { raw_id: number; sebelum: Jadwal4; sesudah: Jadwal4 }[]
  renhar: { raw_id: number; wp: string; dari: string; ke: string; kode: string[] }[]
  sel: { raw_id: number; dari: string; ke: string; kode_busbar?: string[] }[]
}
export const ambilJadwal4 = (row: any): Jadwal4 => ({
  schedule: row?.schedule || {}, busbar_schedule: row?.busbar_schedule || {},
  busbar_jejak: row?.busbar_jejak || {}, busbar_manual_pin: row?.busbar_manual_pin || {},
})

// Per baris: LEPAS semua sumber dulu (dari snapshot awal), BARU taruh semua tujuan - jangan pindah
// satu-satu berurutan (geser +1 hari sel 8 & 9 Okt di baris sama: tujuan 9 Okt = sumber sel lain).
// Sel BUSBAR (kodeBusbar terisi) lewat lepasBusbar/taruhBusbar; sel lain (termasuk QC/PACKING
// "MARKED") lewat lepasDariAsal/taruhDiTujuan.
export function rencanakanPindahMultiV2(jadwalPerBaris: Map<number, Jadwal4>, sel: SelPindahV2[], nowIso: string): RencanaPindahMultiV2 {
  const perBaris = new Map<number, SelPindahV2[]>()
  sel.forEach((s) => { if (!perBaris.has(s.rawId)) perBaris.set(s.rawId, []); perBaris.get(s.rawId)!.push(s) })
  const rows: RencanaPindahMultiV2['rows'] = []
  perBaris.forEach((daftar, rawId) => {
    const sebelum = jadwalPerBaris.get(rawId) || ambilJadwal4(null)
    let j: Jadwal4 = JSON.parse(JSON.stringify(sebelum))
    daftar.forEach((s) => {
      if (s.kodeBusbar) j = { ...j, ...lepasBusbar(j, s.dari, s.ke, s.kodeBusbar) }
      else j = { ...j, schedule: lepasDariAsal(j.schedule, s.dari, s.ke, s.entries || [], s.adaPengerjaan || new Set()) }
    })
    daftar.forEach((s) => {
      if (s.kodeBusbar) j = { ...j, ...taruhBusbar(j, s.ke, s.kodeBusbar, nowIso) }
      else j = { ...j, schedule: taruhDiTujuan(j.schedule, s.ke, s.entries || [], nowIso) }
    })
    rows.push({ raw_id: rawId, sebelum, sesudah: j })
  })
  const renhar = sel.flatMap((s) => s.kodeBusbar
    ? [{ raw_id: s.rawId, wp: 'BUSBAR', dari: s.dari, ke: s.ke, kode: [...s.kodeBusbar] }]
    : (s.entries || []).map((e) => ({ raw_id: s.rawId, wp: e.wp, dari: s.dari, ke: s.ke, kode: [...(e.komponen || [])] })))
  return { rows, renhar, sel: sel.map((s) => ({ raw_id: s.rawId, dari: s.dari, ke: s.ke, ...(s.kodeBusbar ? { kode_busbar: [...s.kodeBusbar] } : {}) })) }
}

export const isMinggu = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).getUTCDay() === 0 }

// ── PENANDA QC TEST / PACKING (Tahap 3a) - logika toggleMarkerCell tampilan lama APA ADANYA: sel berisi ->
// dikosongkan (tanggal dihapus); sel kosong -> diisi 1 penanda {wp: proses, komponen: ["MARKED"]}.
export function togglePenanda(schedule: Jadwal, date: string, proses: string): Jadwal {
  const existing = schedule?.[date] || []
  const baru: Jadwal = { ...(schedule || {}) }
  if (existing.length > 0) delete baru[date]
  else baru[date] = [{ wp: proses, komponen: ['MARKED'] }]
  return baru
}

// ── SALIN (gabung) BANYAK SEL (Tahap 3a, keputusan user: salin MENGGABUNG ke tujuan, bukan menimpa) - sama
// dgn salin 1 sel tampilan lama (confirmDrag mode copy): taruh di tujuan (gabung per WP + manualPin; BUSBAR:
// gabung + busbar_manual_pin), sel asal TIDAK diubah. Rencana harian tidak ikut (sama dgn copy lama).
export function rencanakanSalinMultiV2(jadwalPerBaris: Map<number, Jadwal4>, sel: SelPindahV2[], nowIso: string): { raw_id: number; sebelum: Jadwal4; sesudah: Jadwal4 }[] {
  const perBaris = new Map<number, SelPindahV2[]>()
  sel.forEach((s) => { if (!perBaris.has(s.rawId)) perBaris.set(s.rawId, []); perBaris.get(s.rawId)!.push(s) })
  const rows: { raw_id: number; sebelum: Jadwal4; sesudah: Jadwal4 }[] = []
  perBaris.forEach((daftar, rawId) => {
    const sebelum = jadwalPerBaris.get(rawId) || ambilJadwal4(null)
    let j: Jadwal4 = JSON.parse(JSON.stringify(sebelum))
    daftar.forEach((s) => {
      if (s.kodeBusbar) j = { ...j, ...taruhBusbar(j, s.ke, s.kodeBusbar, nowIso) }
      else j = { ...j, schedule: taruhDiTujuan(j.schedule, s.ke, s.entries || [], nowIso) }
    })
    rows.push({ raw_id: rawId, sebelum, sesudah: j })
  })
  return rows
}

// PILIH PER WP (22 Okt 2026, keputusan user) - sel Raw Schedule tampilan lama bisa dipilih per chip WP. `wps`
// undefined = seluruh sel (perilaku lama); berisi = hanya entri WP itu yang ikut dipindah/disalin/dihapus.
// SATU titik saring dipakai buatSelV2 (multi-pindah, seret banyak, potong-tempel), drag 1 sel & salin.
export function saringEntriWp<T extends { wp?: string }>(entries: T[], wps?: string[] | null): T[] {
  return wps ? (entries || []).filter(e => wps.includes(String(e.wp))) : (entries || [])
}
