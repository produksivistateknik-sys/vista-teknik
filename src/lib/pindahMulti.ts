// PINDAH BANYAK SEL RAW SCHEDULE - VALIDASI & AKSES SERVER (Tahap 0 migrasi accordion, 9 Okt 2026).
// Dipindah APA ADANYA dari RawSchedule.tsx supaya SATU sumber utk tampilan lama & accordion baru:
// - cekPindahMulti/buatSelV2: murni (data & aturan lewat parameter).
// - muatTimerBusbarAktif / isiPengerjaanAsal / rpcPindahMultiV2 / rpcPulihkanMultiV2: query & RPC (tanpa
//   state React; pesan ke operator tetap urusan pemanggil).
// Rumus jadwal ada di lib/jadwalPindah.ts, kapasitas di lib/kapasitasHari.ts, aturan pilih di
// lib/isiSelJadwal.ts.
import { supabase } from './supabase'
import { isMinggu, kodeBusbarBisaDipindah, rencanakanPindahMultiV2, rencanakanSalinMultiV2, ambilJadwal4, type SelPindahV2, type RencanaPindahMultiV2 } from './jadwalPindah'

export type SelAsal = { rawId: number; date: string }
export type SelTujuan = SelAsal & { ke: string }
export type SelBentrok = SelTujuan & { alasan: string }

export type KonteksSelV2 = {
  checklistPanel: (row: any) => any // checklist panel baris (BUSBAR)
  entriesTanpaSelesai: (row: any, entries: any[]) => any[]
}

// Sel -> data pindah (BUSBAR: kode busbar yang boleh pindah; lainnya termasuk QC/PACKING: entries tanpa
// yang selesai/jejak). Jejak (adaPengerjaan) diisi belakangan oleh isiPengerjaanAsal.
export function buatSelV2(rawData: any[], ikut: SelTujuan[], ctx: KonteksSelV2) {
  const sel: SelPindahV2[] = []; const jadwal = new Map<number, any>()
  for (const c of ikut) {
    const row = rawData.find((r: any) => r.id === c.rawId); if (!row) continue
    if (row.proses === 'BUSBAR') {
      const kode = kodeBusbarBisaDipindah(row, ctx.checklistPanel(row), c.date)
      if (kode.length === 0) continue
      sel.push({ rawId: row.id, dari: c.date, ke: c.ke, kodeBusbar: kode })
    } else {
      const entries = ctx.entriesTanpaSelesai(row, row.schedule?.[c.date] || [])
      if (entries.length === 0) continue
      sel.push({ rawId: row.id, dari: c.date, ke: c.ke, entries, adaPengerjaan: new Set<string>() })
    }
    jadwal.set(row.id, ambilJadwal4(row))
  }
  return { sel, jadwal }
}

export type KonteksCekPindah = KonteksSelV2 & {
  tanggalKeIdx: (d: string) => number
  idxKeTanggal: (i: number) => string
  totalKolom: number
  alasanTakBisaPilih: (row: any, date: string) => string | null // aturan pilih dgn kosongBoleh=false
  timerBusbar: Set<string> // "panelId|kode" yang timer BUSBAR-nya berjalan
  kapasitasPada: (d: string, pr: string) => number
  hitungTerpakaiHari: (rows: any[], d: string, pr: string) => number
}

// Sel yang ikut dipindah & sel yang bentrok utk offset tertentu (bayangan drag, validasi sebelum modal,
// Ctrl+X/V). Sel KOSONG di pilihan (mis. dari Shift+klik) diabaikan.
// REVISI 9 Okt 2026: Minggu BUKAN bentrok otomatis - boleh bila kapasitas Minggu itu (tanggal+proses)
// diatur > 0 DAN pemakaian SETELAH semua pindahan <= kapasitas (dihitung dari snapshot jadwal setelah
// dipindah: beban yang mendarat dijumlah, sumber berkurang dari hari asal). Hari biasa tidak dicek
// kapasitas (sama dgn drag lama). BUSBAR: timer berjalan = bentrok.
export function cekPindahMulti(rawData: any[], cells: SelAsal[], offset: number, ctx: KonteksCekPindah) {
  let ikut: SelTujuan[] = []; const bentrok: SelBentrok[] = []
  const mingguOk = new Set<string>() // "rawId|ke" yang mendarat di Minggu dgn kapasitas tersedia
  for (const c of cells) {
    const row = rawData.find((r: any) => r.id === c.rawId)
    if (row && (row.schedule?.[c.date] || []).length === 0 && (row.busbar_schedule?.[c.date] || []).length === 0) continue
    const idxKe = ctx.tanggalKeIdx(c.date) + offset
    const ke = idxKe >= 0 && idxKe < ctx.totalKolom ? ctx.idxKeTanggal(idxKe) : ''
    let alasan = !ke ? 'di luar rentang jadwal' : ctx.alasanTakBisaPilih(row, c.date)
    if (!alasan && row?.proses === 'BUSBAR') {
      const pid = Number(row.panel_id || row.panelId)
      const kode = kodeBusbarBisaDipindah(row, ctx.checklistPanel(row), c.date)
      if (kode.some(k => ctx.timerBusbar.has(pid + '|' + k))) alasan = 'timer BUSBAR berjalan'
    }
    if (alasan) bentrok.push({ ...c, ke, alasan }); else ikut.push({ ...c, ke })
  }
  const keMinggu = ikut.filter(c => isMinggu(c.ke))
  if (keMinggu.length > 0 && offset !== 0) {
    const { sel } = buatSelV2(rawData, ikut, ctx)
    const grup = cekMingguKapasitas(rawData, sel, ctx)
    const alasanPer = new Map<string, string | null>()
    grup.forEach(g => g.kunci.forEach(k => alasanPer.set(k, g.alasan)))
    const ditolak = new Set<string>()
    // urutan bentrok = urutan grup (tanggal+proses) seperti sebelumnya
    grup.forEach(g => keMinggu.filter(c => g.kunci.includes(c.rawId + '|' + c.date)).forEach(c => {
      if (g.alasan) { bentrok.push({ ...c, alasan: g.alasan }); ditolak.add(c.rawId + '|' + c.date) } else mingguOk.add(c.rawId + '|' + c.ke)
    }))
    keMinggu.forEach(c => { if (!alasanPer.has(c.rawId + '|' + c.date)) mingguOk.add(c.rawId + '|' + c.ke) })
    if (ditolak.size) ikut = ikut.filter(c => !ditolak.has(c.rawId + '|' + c.date))
  }
  return { ikut, bentrok, mingguOk }
}

// MINGGU BERKAPASITAS (revisi 9 Okt 2026) - SATU sumber utk tampilan lama (cekPindahMulti) & accordion:
// data pindah yang mendarat di hari Minggu dikelompokkan per (tanggal tujuan, proses baris); boleh bila
// kapasitas Minggu itu diatur > 0 DAN pemakaian SETELAH semua pindahan (snapshot jadwal sesudah, termasuk
// sumber yang berkurang) <= kapasitas. Hasil: grup berurutan kemunculan, kunci "rawId|tanggalAsal",
// alasan null = boleh.
export type KonteksMinggu = { kapasitasPada: (d: string, pr: string) => number; hitungTerpakaiHari: (rows: any[], d: string, pr: string) => number }
// mode 'salin' (Tahap 3a): sumber TETAP ada -> pemakaian dihitung dari jadwal setelah DISALIN (bukan dipindah).
export function cekMingguKapasitas(rawData: any[], sel: SelPindahV2[], ctx: KonteksMinggu, mode: 'pindah' | 'salin' = 'pindah') {
  const keMinggu = sel.filter(s => isMinggu(s.ke))
  const hasil: { ke: string; pr: string; kunci: string[]; alasan: string | null }[] = []
  if (keMinggu.length === 0) return hasil
  const jadwal = new Map<number, any>()
  sel.forEach(s => { if (!jadwal.has(s.rawId)) { const row = rawData.find((r: any) => r.id === s.rawId); if (row) jadwal.set(s.rawId, ambilJadwal4(row)) } })
  const rowsRencana = mode === 'salin' ? rencanakanSalinMultiV2(jadwal, sel, 'cek') : rencanakanPindahMultiV2(jadwal, sel, 'cek').rows
  const sesudahById = new Map(rowsRencana.map(r => [r.raw_id, r.sesudah]))
  const rowsSetelah = rawData.map((r: any) => sesudahById.has(r.id) ? { ...r, ...sesudahById.get(r.id) } : r)
  const grup = new Map<string, { ke: string; pr: string; kunci: string[]; alasan: string | null }>()
  keMinggu.forEach(s => {
    const pr = rawData.find((r: any) => r.id === s.rawId)?.proses || ''
    const k = s.ke + '@' + pr
    if (!grup.has(k)) grup.set(k, { ke: s.ke, pr, kunci: [], alasan: null })
    grup.get(k)!.kunci.push(s.rawId + '|' + s.dari)
  })
  grup.forEach(g => {
    const kap = ctx.kapasitasPada(g.ke, g.pr)
    g.alasan = kap <= 0 ? 'kapasitas Minggu belum diatur' : ctx.hitungTerpakaiHari(rowsSetelah, g.ke, g.pr) > kap ? 'kapasitas Minggu penuh' : null
    hasil.push(g)
  })
  return hasil
}

// Timer BUSBAR yang sedang berjalan utk panel-panel ini -> Set "panelId|kode". null = gagal dimuat
// (pemanggil memakai Set kosong; pengecekan pasti tetap di server, RPC v2).
export async function muatTimerBusbarAktif(panelIds: number[]): Promise<Set<string> | null> {
  if (panelIds.length === 0) return new Set()
  const { data, error } = await supabase.from('fcs_timer_kerja').select('panel_id,kode_komponen').eq('proses', 'BUSBAR').is('selesai', null).in('panel_id', panelIds).range(0, 999)
  if (error) { console.error('[Pindah banyak sel] gagal cek timer BUSBAR (server tetap mengecek):', error); return null }
  return new Set((data || []).map((t: any) => Number(t.panel_id) + '|' + t.kode_komponen))
}

// Jejak digeserKe = kode yg ADA pengerjaan (timer) di tanggal asal - SATU query (dipaginasi) utk semua
// sel non-BUSBAR, lalu dicocokkan persis panel+proses+tanggal+kode; hasil diisikan ke s.adaPengerjaan.
// BUSBAR tidak pakai jejak-bila-ada-pengerjaan (jejak BUSBAR selalu ditaruh). error != null = gagal
// (tidak ada yang boleh dipindah).
export async function isiPengerjaanAsal(rawData: any[], sel: SelPindahV2[]): Promise<{ error: any }> {
  const rowsById = new Map<number, any>(rawData.map((r: any) => [r.id, r]))
  const panelIds = [...new Set(sel.map(s => Number(rowsById.get(s.rawId)?.panel_id || rowsById.get(s.rawId)?.panelId)))]
  const tanggalAsal = [...new Set(sel.map(s => s.dari))]
  const selBiasa = sel.filter(s => !s.kodeBusbar)
  const kodeSemua = [...new Set(selBiasa.flatMap(s => (s.entries || []).flatMap((e: any) => (e.komponen || []).filter((k: string) => !k.startsWith('__wiring_')))))]
  if (kodeSemua.length === 0) return { error: null }
  let semua: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('fcs_timer_kerja').select('panel_id,proses,tanggal,kode_komponen')
      .in('panel_id', panelIds).in('tanggal', tanggalAsal).in('kode_komponen', kodeSemua).range(from, from + 999)
    if (error) { console.error('[Pindah banyak sel] gagal cek pengerjaan:', error); return { error } }
    semua = semua.concat(data || [])
    if (!data || data.length < 1000) break
  }
  selBiasa.forEach(s => {
    const row = rowsById.get(s.rawId); const pid = Number(row?.panel_id || row?.panelId)
    semua.forEach((t: any) => { if (Number(t.panel_id) === pid && t.proses === row?.proses && t.tanggal === s.dari) s.adaPengerjaan!.add(t.kode_komponen) })
  })
  return { error: null }
}

// RPC v2 (migration 20261009010000): 4 kolom jadwal (schedule + busbar_schedule/jejak/manual_pin) +
// renhar dalam 1 transaksi; server menolak (P0001) kalau data sudah diubah orang lain / Minggu tanpa
// kapasitas / timer BUSBAR berjalan. Hasil = snapshot utk Undo.
export const rpcPindahMultiV2 = (rencana: RencanaPindahMultiV2, user: string) =>
  supabase.rpc('pindah_multi_sel_v2', { p_sel: rencana.sel as any, p_rows: rencana.rows as any, p_renhar: rencana.renhar as any, p_user: user })

// Undo = MEMULIHKAN keadaan persis sebelum pindah (bukan pindah balik, yang menambah jejak baru). Server
// menolak (P0001) kalau data sudah berubah lagi sejak dipindah.
export const rpcPulihkanMultiV2 = (snap: any, user: string) =>
  supabase.rpc('pulihkan_multi_sel_v2', { p_snap: snap, p_user: user })
