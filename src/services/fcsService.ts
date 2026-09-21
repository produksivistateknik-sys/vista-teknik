import { supabase } from '../lib/supabase'
import { ALL_PROSES } from '../constants/panelTypes'
import { kebutuhanOrangWiring, WIRING_BOBOT_TABLE, getBusbarKomponen } from '../lib/panelHelpers'
import { activityLogService } from './activityLogService'

// ================= WIRING CONTROL/POWER: "hari kerja ke-N" dari histori fcs_timer_kerja =================
// Sinyal "hari kerja aktual" (BUKAN hari kalender) - dipakai bareng kebutuhanOrangWiring() buat
// tau kebutuhan orang komponen wiring di tanggal manapun. Di-fetch BATCHED (satu query per
// panelIds, bukan N+1 per kode) - fcs_timer_kerja tumbuh terus tiap hari, jangan query per-kode.
export async function fetchWiringHariKerjaMap(panelIds: number[]): Promise<Record<string, string[]>> {
  if (panelIds.length === 0) return {}
  const map: Record<string, Set<string>> = {}
  let from = 0
  while (true) {
    const { data, error } = await supabase.from('fcs_timer_kerja')
      .select('panel_id,kode_komponen,proses,tanggal')
      .in('panel_id', panelIds)
      .in('proses', ['WIRING CONTROL', 'WIRING POWER'])
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    ;(data || []).forEach((r: any) => {
      const key = `${r.panel_id}|${r.kode_komponen}|${r.proses}`
      if (!map[key]) map[key] = new Set()
      map[key].add(r.tanggal)
    })
    if (!data || data.length < 1000) break
    from += 1000
  }
  const out: Record<string, string[]> = {}
  Object.entries(map).forEach(([k, v]) => { out[k] = [...v].sort() })
  return out
}
// hariKeN(tanggal) = jumlah hari kerja aktual SEBELUM tanggal ini (dari histori) + 1 - dipakai
// SAMA baik buat tanggal yang sudah kejadian maupun tanggal kandidat yang belum kejadian (proyeksi
// cascading), sengaja gak ada percabangan "kalau sudah lewat vs belum" (lihat catatan di
// panelHelpers.ts WIRING_BOBOT_TABLE).
export function hariKeNFromMap(map: Record<string, string[]>, panelId: number, kode: string, proses: string, tanggal: string): number {
  const dates = map[`${panelId}|${kode}|${proses}`] || []
  return dates.filter((t) => t < tanggal).length + 1
}

// Proyeksi hari-hari kerja BERIKUTNYA (H+1, H+2, ...) untuk SATU komponen wiring yang lagi live
// di `liveDate`, sepanjang sisa durasi standar bobotnya - DIPINDAH ke sini (5 Sep 2026, dulu lokal
// di RawSchedule.tsx) supaya jadi SATU sumber kebenaran dipakai BARENG oleh kartu proyeksi di grid
// Raw Schedule (wiringForwardMap) dan daftar proyeksi di Rencana Harian, biar formulanya gak
// pernah bisa "kesplit"/beda antara dua tampilan itu. Gak termasuk liveDate itu sendiri (offset
// mulai dari 1) - liveDate direpresentasikan oleh entry ASLI (real), bukan proyeksi. hariKeNLive
// dihitung SEKALI dari histori kerja AKTUAL (fcs_timer_kerja, lewat hariKeNFromMap) - offset
// berikutnya cuma proyeksi optimis "kalau lanjut mulus", BUKAN dihitung ulang per tanggal proyeksi
// (soalnya tanggal-tanggal itu belum kejadian, belum ada histori).
export function hitungProyeksiWiring(
  panelIdRow: any, kode: string, proses: string, wp: string, liveDate: string, bobot: string | undefined,
  wiringHariKerjaMap: Record<string, string[]>,
): { tanggal: string; kode: string; wp: string; hariKeN: number; orang: number }[] {
  const tableLen = (WIRING_BOBOT_TABLE[bobot || 'MEDIUM'] || WIRING_BOBOT_TABLE.MEDIUM).length
  const hariKeNLive = hariKeNFromMap(wiringHariKerjaMap, panelIdRow, kode, proses, liveDate)
  const sisaHari = Math.max(1, tableLen - hariKeNLive + 1)
  const hasil: { tanggal: string; kode: string; wp: string; hariKeN: number; orang: number }[] = []
  for (let off = 1; off < sisaHari; off++) {
    const hariKeNProj = hariKeNLive + off
    hasil.push({ tanggal: addDays(liveDate, off), kode, wp, hariKeN: hariKeNProj, orang: kebutuhanOrangWiring(bobot, hariKeNProj) })
  }
  return hasil
}

interface FCSProcessTime {
  kode_komponen: string
  nama_komponen: string
  tipe_panel: string
  wp: string
  jenis_pekerjaan: string
  menit_per_pcs: number
}

interface FCSScheduleItem {
  wo_id: number
  wo_number: string
  proyek: string
  panel_id: number
  panel_nama: string
  tipe_panel: string
  kode_komponen: string
  nama_komponen: string
  wp: string
  jenis_pekerjaan: string
  tanggal: string
  qty_total: number
  qty_hari: number
  menit_per_pcs: number
  total_menit: number
  status: string
  urutan: number
  generated_by: string
}

function addDays(tanggal: string, n: number): string {
  const d = new Date(tanggal)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// generateFCSBatch/generateFCSSchedule/generateFCSWiring/nextTanggalDenganKapasitas/
// KomponenKebutuhan DIHAPUS (20 Sep 2026, retirement fcs_schedule Fase 1) - satu-satunya
// pemanggil (tombol "Generate FCS" di ManajemenWO.tsx, modal fcsModal) gak pernah reachable
// dari UI manapun (setFcsModal() dgn nilai isi TIDAK ADA di codebase manapun, cuma
// setFcsModal(null)) - dead code total. Dicek live (audit database 20 Sep 2026): fcs_schedule
// 0 baris. Alur generate jadwal aktif sekarang lewat generateAndSaveToRawSchedule (v2, di
// bawah, langsung ke raw_schedule).

// ===== v2 FINAL - Swap functions berbasis Raw Schedule (bukan fcs_schedule) =====
// Append ke fcsService.ts, TIDAK menimpa fungsi v1 yang lama

export interface KomponenSwapOptionV2 {
  raw_id: number
  wo_id: number
  wo_number: string
  wo_target: string
  panel_id: number
  panel_nama: string
  wp: string
  kode_komponen: string
  nama_komponen: string
  qty: number
  total_menit: number
  progress: number
}

export async function checkKapasitasDanKomponenSwapV2(params: {
  tanggal: string
  jenisPekerjaan: string
  menitDibutuhkan: number
  excludeRawId?: number
  excludeWp?: string
}): Promise<{
  cukup: boolean
  kapasitasHari: number
  terpakaiSaatIni: number
  sisaKapasitas: number
  opsiSwap: KomponenSwapOptionV2[]
  error?: string
}> {
  const { tanggal, jenisPekerjaan, menitDibutuhkan } = params

  const { data: overrideRow } = await supabase
    .from('fcs_kapasitas_override')
    .select('kapasitas_menit')
    .eq('tanggal', tanggal)
    .eq('jenis_pekerjaan', jenisPekerjaan)
    .maybeSingle()

  if (!overrideRow) {
    return {
      cukup: false, kapasitasHari: 0, terpakaiSaatIni: 0, sisaKapasitas: 0, opsiSwap: [],
      error: `Kapasitas ${jenisPekerjaan} untuk tanggal ${tanggal} belum diatur di Override Tanggal.`
    }
  }
  const kapasitasHari = Number(overrideRow.kapasitas_menit)

  const { data: rawRows } = await supabase
    .from('raw_schedule')
    .select('id, wo_id, panel_id, panel, proyek, proses, schedule')
    .eq('proses', jenisPekerjaan)

  const { data: ptData } = await supabase
    .from('fcs_process_time')
    .select('tipe_panel, jenis_pekerjaan, kode_komponen, nama_komponen, menit_per_pcs')
    .eq('jenis_pekerjaan', jenisPekerjaan)
    .eq('is_active', true)

  const panelIds = [...new Set((rawRows || []).map((r: any) => r.panel_id).filter(Boolean))]
  const { data: panelRows } = await supabase
    .from('panels')
    .select('id, nama, tipe, checklist')
    .in('id', panelIds.length > 0 ? panelIds : [-1])

  const woIds = [...new Set((rawRows || []).map((r: any) => r.wo_id).filter(Boolean))]
  const { data: woRows } = await supabase
    .from('work_orders')
    .select('id, wo, target')
    .in('id', woIds.length > 0 ? woIds : [-1])

  const panelMap: Record<number, any> = {}
  ;(panelRows || []).forEach((p: any) => { panelMap[p.id] = p })

  const woMap: Record<number, string> = {}
  const woTargetMap: Record<number, string> = {}
  ;(woRows || []).forEach((w: any) => { woMap[w.id] = w.wo; woTargetMap[w.id] = w.target || '' })

  const ptMap: Record<string, any> = {}
  ;(ptData || []).forEach((pt: any) => { ptMap[`${pt.tipe_panel}|${pt.kode_komponen}`] = pt })

  let terpakaiSaatIni = 0
  const opsiSwap: KomponenSwapOptionV2[] = []

  for (const row of rawRows || []) {
    const entries = row.schedule?.[tanggal] || []
    const panel = panelMap[row.panel_id]
    if (!panel) continue

    for (const entry of entries) {
      if (params.excludeRawId && row.id === params.excludeRawId && params.excludeWp && entry.wp === params.excludeWp) continue
      for (const kode of (entry.komponen || [])) {
        // Kode berstatus jejak (entry.digeserKe[kode] sudah keisi) itu histori read-only - GAK
        // dihitung kapasitas (kode itu udah dipindah aksinya ke tanggal lain, gak lagi "makan
        // slot" di tanggal ini) dan JELAS gak ditawarkan sebagai kandidat swap (gak boleh ikut
        // proses geser/cascading lagi).
        if (entry.digeserKe && entry.digeserKe[kode]) continue
        const qty = panel.checklist?.[kode]?.qty || 0
        const pt = ptMap[`${panel.tipe}|${kode}`]
        const menitPcs = pt ? Number(pt.menit_per_pcs) : 0
        const totalMenit = qty * menitPcs
        if (totalMenit <= 0) continue

        terpakaiSaatIni += totalMenit
        const progress = panel.checklist?.[kode]?.progress?.[jenisPekerjaan] || 0

        opsiSwap.push({
          raw_id: row.id,
          wo_id: row.wo_id,
          wo_number: woMap[row.wo_id] || '',
          wo_target: woTargetMap[row.wo_id] || '',
          panel_id: row.panel_id,
          panel_nama: panel.nama,
          wp: entry.wp,
          kode_komponen: kode,
          nama_komponen: pt?.nama_komponen || kode,
          qty,
          total_menit: totalMenit,
          progress,
        })
      }
    }
  }

  const sisaKapasitas = kapasitasHari - terpakaiSaatIni

  if (sisaKapasitas >= menitDibutuhkan) {
    return { cukup: true, kapasitasHari, terpakaiSaatIni, sisaKapasitas, opsiSwap: [] }
  }

  opsiSwap.sort((a, b) => {
    const targetCompare = (b.wo_target || '9999-99-99').localeCompare(a.wo_target || '9999-99-99')
    if (targetCompare !== 0) return targetCompare
    return a.progress - b.progress
  })

  return { cukup: false, kapasitasHari, terpakaiSaatIni, sisaKapasitas, opsiSwap }
}

// Helper internal: hitung total menit terpakai di raw_schedule untuk tanggal+proses tertentu
async function hitungTerpakaiRawSchedule(tanggal: string, jenisPekerjaan: string): Promise<number> {
  const { data: rawRows } = await supabase
    .from('raw_schedule')
    .select('panel_id, schedule')
    .eq('proses', jenisPekerjaan)

  const { data: ptData } = await supabase
    .from('fcs_process_time')
    .select('tipe_panel, kode_komponen, menit_per_pcs')
    .eq('jenis_pekerjaan', jenisPekerjaan)
    .eq('is_active', true)

  const panelIds = [...new Set((rawRows || []).map((r: any) => r.panel_id).filter(Boolean))]
  const { data: panelRows } = await supabase
    .from('panels')
    .select('id, tipe, checklist')
    .in('id', panelIds.length > 0 ? panelIds : [-1])

  const panelMap: Record<number, any> = {}
  ;(panelRows || []).forEach((p: any) => { panelMap[p.id] = p })

  const ptMap: Record<string, number> = {}
  ;(ptData || []).forEach((pt: any) => { ptMap[`${pt.tipe_panel}|${pt.kode_komponen}`] = Number(pt.menit_per_pcs) })

  let total = 0
  for (const row of rawRows || []) {
    const panel = panelMap[row.panel_id]
    if (!panel) continue
    const entries = row.schedule?.[tanggal] || []
    for (const entry of entries) {
      for (const kode of (entry.komponen || [])) {
        // Jejak (digeserKe) itu histori read-only - gak dihitung kapasitas.
        if (entry.digeserKe && entry.digeserKe[kode]) continue
        const qty = panel.checklist?.[kode]?.qty || 0
        const menitPcs = ptMap[`${panel.tipe}|${kode}`] || 0
        total += qty * menitPcs
      }
    }
  }
  return total
}

export async function executeSwapKomponenV2(params: {
  items: Array<{ raw_id: number; wp: string; kode_komponen: string; total_menit: number; progress?: number }>
  jenisPekerjaan: string
  tanggalAsal: string
}): Promise<{ success: boolean; error?: string }> {
  const { items, jenisPekerjaan, tanggalAsal } = params

  try {
    const menitTotalDipindah = items.reduce((s, it) => s + it.total_menit, 0)

    // Cari tanggal tujuan: ada override DAN sisa kapasitas cukup untuk semua item yang dipindah
    let tanggalTujuan = addDays(tanggalAsal, 1)
    let found = false
    for (let i = 0; i < 60; i++) {
      const { data: ov } = await supabase
        .from('fcs_kapasitas_override')
        .select('kapasitas_menit')
        .eq('tanggal', tanggalTujuan)
        .eq('jenis_pekerjaan', jenisPekerjaan)
        .maybeSingle()

      if (ov) {
        const kap = Number(ov.kapasitas_menit)
        const terpakai = await hitungTerpakaiRawSchedule(tanggalTujuan, jenisPekerjaan)
        if (kap - terpakai >= menitTotalDipindah) {
          found = true
          break
        }
      }
      tanggalTujuan = addDays(tanggalTujuan, 1)
    }

    if (!found) {
      return { success: false, error: 'Tidak ada tanggal dengan kapasitas cukup dalam 60 hari ke depan untuk semua komponen yang dipindah' }
    }

    const byRawId: Record<number, Array<{ wp: string; kode_komponen: string; progress: number }>> = {}
    items.forEach(it => {
      if (!byRawId[it.raw_id]) byRawId[it.raw_id] = []
      byRawId[it.raw_id].push({ wp: it.wp, kode_komponen: it.kode_komponen, progress: it.progress || 0 })
    })

    for (const [rawIdStr, komponenList] of Object.entries(byRawId)) {
      const rawId = Number(rawIdStr)
      const { data: row } = await supabase
        .from('raw_schedule')
        .select('id, panel_id, proses, schedule')
        .eq('id', rawId)
        .single()

      if (!row) continue

      // REVISI (10 Agu 2026): jejak (digeserKe) cuma ditinggalkan kalau BENERAN ADA pengerjaan
      // (fcs_timer_kerja) di tanggalAsal - kalau enggak, pindah senyap tanpa jejak. Sama skema
      // dengan RawSchedule.tsx/auto-geser-harian/Outstanding.
      const kodeUnik = [...new Set(komponenList.map((k) => k.kode_komponen))]
      const { data: timerRows } = kodeUnik.length > 0 ? await supabase.from('fcs_timer_kerja').select('kode_komponen')
        .eq('panel_id', row.panel_id).eq('proses', row.proses).eq('tanggal', tanggalAsal).in('kode_komponen', kodeUnik) : { data: [] }
      const adaPengerjaanSet = new Set((timerRows || []).map((t: any) => t.kode_komponen))

      const schedule: Record<string, any> = { ...(row.schedule as any) }
      const entriesAsal = [...(schedule[tanggalAsal] || [])]

      for (const { wp, kode_komponen } of komponenList) {
        const idxAsal = entriesAsal.findIndex((e: any) => e.wp === wp)
        if (idxAsal === -1) continue
        if (adaPengerjaanSet.has(kode_komponen)) {
          entriesAsal[idxAsal] = { ...entriesAsal[idxAsal], digeserKe: { ...(entriesAsal[idxAsal].digeserKe || {}), [kode_komponen]: tanggalTujuan } }
        } else {
          entriesAsal[idxAsal] = { ...entriesAsal[idxAsal], komponen: entriesAsal[idxAsal].komponen.filter((k: string) => k !== kode_komponen) }
        }
      }
      schedule[tanggalAsal] = entriesAsal.filter((e: any) => e.komponen.length > 0)

      if (!schedule[tanggalTujuan]) schedule[tanggalTujuan] = []
      for (const { wp, kode_komponen } of komponenList) {
        const entryTujuan = schedule[tanggalTujuan].find((e: any) => e.wp === wp)
        if (entryTujuan) {
          if (!entryTujuan.komponen.includes(kode_komponen)) entryTujuan.komponen.push(kode_komponen)
        } else {
          schedule[tanggalTujuan].push({ wp, komponen: [kode_komponen] })
        }
      }

      await supabase.from('raw_schedule').update({ schedule }).eq('id', rawId)
      // FIX bug "row renhar lama nyangkut" - lihat komentar bersihkanRenharSetelahGeser di bawah.
      await bersihkanRenharSetelahGeser(rawId, komponenList.map((k) => ({ wp: k.wp, kode: k.kode_komponen })), tanggalAsal)
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}


// ===== Swap functions berbasis kuota ORANG (untuk WIRING POWER / WIRING CONTROL) =====
// Append ke fcsService.ts

export interface KomponenSwapOptionOrang {
  raw_id: number
  wo_id: number
  wo_number: string
  wo_target: string
  panel_id: number
  panel_nama: string
  wp: string
  kode_komponen: string
  nama_komponen: string
  jumlah_orang: number
  progress: number
}

export async function checkKuotaOrangDanKomponenSwap(params: {
  tanggal: string
  jenisPekerjaan: string
  orangDibutuhkan: number
  excludeRawId?: number
  excludeWp?: string
}): Promise<{
  cukup: boolean
  kuotaHari: number
  terpakaiSaatIni: number
  sisaKuota: number
  opsiSwap: KomponenSwapOptionOrang[]
  error?: string
}> {
  const { tanggal, jenisPekerjaan, orangDibutuhkan } = params

  const { data: overrideRow } = await supabase
    .from('fcs_kapasitas_override')
    .select('jumlah_orang')
    .eq('tanggal', tanggal)
    .eq('jenis_pekerjaan', jenisPekerjaan)
    .eq('tipe_kapasitas', 'orang')
    .maybeSingle()

  if (!overrideRow) {
    return {
      cukup: false, kuotaHari: 0, terpakaiSaatIni: 0, sisaKuota: 0, opsiSwap: [],
      error: `Kuota orang ${jenisPekerjaan} untuk tanggal ${tanggal} belum diatur di Override Tanggal.`
    }
  }
  const kuotaHari = Number(overrideRow.jumlah_orang)

  const { data: rawRows } = await supabase
    .from('raw_schedule')
    .select('id, wo_id, panel_id, schedule, bobot_komponen')
    .eq('proses', jenisPekerjaan)

  const woIds = [...new Set((rawRows || []).map((r: any) => r.wo_id).filter(Boolean))]
  const { data: woRows } = await supabase
    .from('work_orders')
    .select('id, wo, target')
    .in('id', woIds.length > 0 ? woIds : [-1])
  const woMap: Record<number, string> = {}
  const woTargetMap: Record<number, string> = {}
  ;(woRows || []).forEach((w: any) => { woMap[w.id] = w.wo; woTargetMap[w.id] = w.target || '' })

  const panelIds = [...new Set((rawRows || []).map((r: any) => r.panel_id).filter(Boolean))]
  const { data: panelRows } = await supabase
    .from('panels')
    .select('id, nama, tipe, checklist')
    .in('id', panelIds.length > 0 ? panelIds : [-1])
  const panelMap: Record<number, any> = {}
  ;(panelRows || []).forEach((p: any) => { panelMap[p.id] = p })

  const { data: ptData } = await supabase
    .from('fcs_process_time')
    .select('tipe_panel, kode_komponen, nama_komponen')
    .eq('jenis_pekerjaan', jenisPekerjaan)
    .eq('is_active', true)
  const ptNamaMap: Record<string, string> = {}
  ;(ptData || []).forEach((pt: any) => { ptNamaMap[`${pt.tipe_panel}|${pt.kode_komponen}`] = pt.nama_komponen })

  // REVISI (12 Agu 2026): kebutuhan orang wiring sekarang PER KOMPONEN, dinamis dari bobot
  // (raw_schedule.bobot_komponen, level row) + hari kerja aktual (histori fcs_timer_kerja) -
  // bukan lagi angka tetap dari orangPerKomponen/token. Lihat panelHelpers.ts WIRING_BOBOT_TABLE.
  const hariKerjaMap = await fetchWiringHariKerjaMap(panelIds)

  let terpakaiSaatIni = 0
  const opsiSwap: KomponenSwapOptionOrang[] = []

  for (const row of rawRows || []) {
    const entries = row.schedule?.[tanggal] || []
    const panel = panelMap[row.panel_id]
    if (!panel) continue

    for (const entry of entries) {
      if (params.excludeRawId && row.id === params.excludeRawId && params.excludeWp && entry.wp === params.excludeWp) continue
      for (const kode of (entry.komponen || [])) {
        // Token lama __wiring_{orang}org_{bobot} (data lama) bukan komponen asli - dilewati.
        if (kode.startsWith('__wiring_')) continue
        // Jejak (entry.digeserKe[kode] keisi) itu histori read-only - GAK dihitung kuota (kode
        // itu udah dipindah aksinya ke tanggal lain) dan gak ditawarkan buat kandidat swap.
        if (entry.digeserKe && entry.digeserKe[kode]) continue
        const progress = panel.checklist?.[kode]?.progress?.[jenisPekerjaan] || 0
        // Komponen yang sudah 100% selesai TIDAK lagi memakai kuota orang
        if (progress >= 100) continue
        const bobot = (row as any).bobot_komponen?.[kode]
        const hariKeN = hariKeNFromMap(hariKerjaMap, row.panel_id, kode, jenisPekerjaan, tanggal)
        const orang = kebutuhanOrangWiring(bobot, hariKeN)
        terpakaiSaatIni += orang

        opsiSwap.push({
          raw_id: row.id,
          wo_id: row.wo_id,
          wo_number: woMap[row.wo_id] || '',
          wo_target: woTargetMap[row.wo_id] || '',
          panel_id: row.panel_id,
          panel_nama: panel.nama,
          wp: entry.wp,
          kode_komponen: kode,
          nama_komponen: ptNamaMap[`${panel.tipe}|${kode}`] || kode,
          jumlah_orang: orang,
          progress,
        })
      }
    }
  }

  const sisaKuota = kuotaHari - terpakaiSaatIni

  if (sisaKuota >= orangDibutuhkan) {
    return { cukup: true, kuotaHari, terpakaiSaatIni, sisaKuota, opsiSwap: [] }
  }

  opsiSwap.sort((a, b) => {
    const targetCompare = (b.wo_target || '9999-99-99').localeCompare(a.wo_target || '9999-99-99')
    if (targetCompare !== 0) return targetCompare
    return a.progress - b.progress
  })

  return { cukup: false, kuotaHari, terpakaiSaatIni, sisaKuota, opsiSwap }
}

async function hitungTerpakaiOrangRawSchedule(tanggal: string, jenisPekerjaan: string): Promise<number> {
  const { data: rawRows } = await supabase
    .from('raw_schedule')
    .select('panel_id, schedule, bobot_komponen')
    .eq('proses', jenisPekerjaan)

  const panelIds = [...new Set((rawRows || []).map((r: any) => r.panel_id).filter(Boolean))]
  const hariKerjaMap = await fetchWiringHariKerjaMap(panelIds)

  let total = 0
  for (const row of rawRows || []) {
    const entries = row.schedule?.[tanggal] || []
    for (const entry of entries) {
      for (const kode of (entry.komponen || [])) {
        if (kode.startsWith('__wiring_')) continue
        // Jejak (digeserKe) itu histori read-only - gak dihitung kuota.
        if (entry.digeserKe && entry.digeserKe[kode]) continue
        const bobot = (row as any).bobot_komponen?.[kode]
        const hariKeN = hariKeNFromMap(hariKerjaMap, row.panel_id, kode, jenisPekerjaan, tanggal)
        total += kebutuhanOrangWiring(bobot, hariKeN)
      }
    }
  }
  return total
}

export async function executeSwapKomponenOrang(params: {
  items: Array<{ raw_id: number; wp: string; kode_komponen: string; jumlah_orang: number; progress?: number }>
  jenisPekerjaan: string
  tanggalAsal: string
}): Promise<{ success: boolean; error?: string }> {
  const { items, jenisPekerjaan, tanggalAsal } = params

  try {
    const orangTotalDipindah = items.reduce((s, it) => s + it.jumlah_orang, 0)

    let tanggalTujuan = addDays(tanggalAsal, 1)
    let found = false
    for (let i = 0; i < 60; i++) {
      const { data: ov } = await supabase
        .from('fcs_kapasitas_override')
        .select('jumlah_orang')
        .eq('tanggal', tanggalTujuan)
        .eq('jenis_pekerjaan', jenisPekerjaan)
        .eq('tipe_kapasitas', 'orang')
        .maybeSingle()

      if (ov) {
        const kuota = Number(ov.jumlah_orang)
        const terpakai = await hitungTerpakaiOrangRawSchedule(tanggalTujuan, jenisPekerjaan)
        if (kuota - terpakai >= orangTotalDipindah) {
          found = true
          break
        }
      }
      tanggalTujuan = addDays(tanggalTujuan, 1)
    }

    if (!found) {
      return { success: false, error: 'Tidak ada tanggal dengan kuota orang cukup dalam 60 hari ke depan' }
    }

    const byRawId: Record<number, Array<{ wp: string; kode_komponen: string; jumlah_orang: number; progress: number }>> = {}
    items.forEach(it => {
      if (!byRawId[it.raw_id]) byRawId[it.raw_id] = []
      byRawId[it.raw_id].push({ wp: it.wp, kode_komponen: it.kode_komponen, jumlah_orang: it.jumlah_orang, progress: it.progress || 0 })
    })

    for (const [rawIdStr, komponenList] of Object.entries(byRawId)) {
      const rawId = Number(rawIdStr)
      const { data: row } = await supabase
        .from('raw_schedule')
        .select('id, panel_id, proses, schedule')
        .eq('id', rawId)
        .single()

      if (!row) continue

      // REVISI (10 Agu 2026): jejak (digeserKe) cuma ditinggalkan kalau BENERAN ADA pengerjaan
      // (fcs_timer_kerja) di tanggalAsal - kalau enggak, pindah senyap tanpa jejak. Sama skema
      // dengan RawSchedule.tsx/auto-geser-harian/Outstanding.
      const kodeUnik = [...new Set(komponenList.map((k) => k.kode_komponen))]
      const { data: timerRows } = kodeUnik.length > 0 ? await supabase.from('fcs_timer_kerja').select('kode_komponen')
        .eq('panel_id', row.panel_id).eq('proses', row.proses).eq('tanggal', tanggalAsal).in('kode_komponen', kodeUnik) : { data: [] }
      const adaPengerjaanSet = new Set((timerRows || []).map((t: any) => t.kode_komponen))

      const schedule: Record<string, any> = { ...(row.schedule as any) }
      const entriesAsal = [...(schedule[tanggalAsal] || [])]

      for (const { wp, kode_komponen } of komponenList) {
        const idxAsal = entriesAsal.findIndex((e: any) => e.wp === wp)
        if (idxAsal === -1) continue
        if (adaPengerjaanSet.has(kode_komponen)) {
          entriesAsal[idxAsal] = { ...entriesAsal[idxAsal], digeserKe: { ...(entriesAsal[idxAsal].digeserKe || {}), [kode_komponen]: tanggalTujuan } }
        } else {
          const komponenBaru = entriesAsal[idxAsal].komponen.filter((k: string) => k !== kode_komponen)
          const orangPerKomponenBaru = entriesAsal[idxAsal].orangPerKomponen ? { ...entriesAsal[idxAsal].orangPerKomponen } : undefined
          if (orangPerKomponenBaru) delete orangPerKomponenBaru[kode_komponen]
          entriesAsal[idxAsal] = { ...entriesAsal[idxAsal], komponen: komponenBaru, ...(orangPerKomponenBaru ? { orangPerKomponen: orangPerKomponenBaru } : {}) }
        }
      }
      schedule[tanggalAsal] = entriesAsal.filter((e: any) => e.komponen.length > 0)

      if (!schedule[tanggalTujuan]) schedule[tanggalTujuan] = []
      for (const { wp, kode_komponen, jumlah_orang } of komponenList) {
        let entryTujuan = schedule[tanggalTujuan].find((e: any) => e.wp === wp)
        if (!entryTujuan) {
          entryTujuan = { wp, komponen: [], orangPerKomponen: {} }
          schedule[tanggalTujuan].push(entryTujuan)
        }
        if (!entryTujuan.komponen.includes(kode_komponen)) entryTujuan.komponen.push(kode_komponen)
        if (!entryTujuan.orangPerKomponen) entryTujuan.orangPerKomponen = {}
        entryTujuan.orangPerKomponen[kode_komponen] = jumlah_orang
      }

      await supabase.from('raw_schedule').update({ schedule }).eq('id', rawId)
      // FIX bug "row renhar lama nyangkut" (sama akar masalah dengan reschedule Outstanding) -
      // fungsi ini SEBELUMNYA cuma nulis raw_schedule, gak pernah bersihin renhar sama sekali buat
      // komponen yang ke-swap-geser - row renhar lama di tanggalAsal tetap nganggep komponen itu
      // aktif/released selamanya. Bersihin di sini juga (row TETAP ada buat histori, cuma gak
      // dianggap aktif lagi).
      await bersihkanRenharSetelahGeser(rawId, komponenList.map((k) => ({ wp: k.wp, kode: k.kode_komponen })), tanggalAsal)
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// Bersihin komponen yang ke-geser dari row renhar di tanggal asal (dipakai executeSwapKomponenV2 &
// executeSwapKomponenOrang - dua-duanya cuma nulis raw_schedule sebelumnya, renhar dibiarkan basi).
// Reuse prinsip cleanup yang sama dengan tulisReschedule kasus2 di OutstandingView.tsx.
async function bersihkanRenharSetelahGeser(rawId: number, items: Array<{ wp: string; kode: string }>, tanggalAsal: string) {
  const { data: rows } = await supabase.from('renhar').select('id,wp,komponen,komponen_released,pekerja_per_komponen')
    .eq('raw_id', rawId).eq('tanggal', tanggalAsal)
  if (!rows) return
  for (const { wp, kode } of items) {
    const rh = rows.find((r: any) => r.wp === wp)
    if (!rh || !((rh.komponen as any) || []).includes(kode)) continue
    const sisaKomp = ((rh.komponen as any) || []).filter((k: string) => k !== kode)
    const sisaReleased = ((rh.komponen_released as any) || []).filter((k: string) => k !== kode)
    const sisaPpk: Record<string, any> = { ...((rh.pekerja_per_komponen as any) || {}) }
    delete sisaPpk[kode]
    await supabase.from('renhar').update({ komponen: sisaKomp, komponen_released: sisaReleased, pekerja_per_komponen: sisaPpk }).eq('id', rh.id)
  }
}

const PROSES_ORANG_LIST = ['WIRING CONTROL', 'WIRING POWER']

export interface RebalanceShiftResult {
  kodeKomponen: string
  namaKomponen: string
  panelNama: string
  proyek: string
  woNumber: string
  dariTanggal: string
  keTanggal: string
  overflow: boolean
}

export async function setOverrideAndRebalance(params: {
  tanggal: string
  jenisPekerjaan: string
  kapasitasMenit?: number
  jumlahOrang?: number
  createdBy: string
}): Promise<{ success: boolean; shifted: RebalanceShiftResult[]; error?: string }> {
  try {
    const { tanggal, jenisPekerjaan, kapasitasMenit, jumlahOrang, createdBy } = params
    const isOrang = PROSES_ORANG_LIST.includes(jenisPekerjaan)

    const { data: existingOv, error: existingOvErr } = await supabase.from('fcs_kapasitas_override')
      .select('id').eq('tanggal', tanggal).eq('jenis_pekerjaan', jenisPekerjaan).maybeSingle()
    if (existingOvErr) throw new Error('Gagal cek kapasitas existing: ' + existingOvErr.message)
    const ovPayload: any = isOrang
      ? { tanggal, jenis_pekerjaan: jenisPekerjaan, tipe_kapasitas: 'orang', jumlah_orang: Number(jumlahOrang) || 0, created_by: createdBy }
      : { tanggal, jenis_pekerjaan: jenisPekerjaan, tipe_kapasitas: 'jam', jam_kerja: (Number(kapasitasMenit) || 0) / 60, efektivitas_pct: 100, created_by: createdBy }
    // AUDIT FIX (21 Sep 2026, investigasi "WIRING CONTROL 22 Sep gagal diatur") - dulu hasil
    // insert/update ini SAMA SEKALI gak dicek (CLAUDE.md A.2) - kalau gagal (RLS/constraint/
    // network), fungsi ini tetap lanjut ke rebalance & akhirnya balikin {success:true} seolah
    // tersimpan. Root cause insiden asli TERNYATA bukan ini (baris kapasitasnya beneran
    // tersimpan - bug aslinya di fetchCap() RawSchedule.tsx yang kena batas 1000 baris), tapi
    // celah ini tetap nyata & perlu ditutup buat kasus serupa ke depan.
    if (existingOv) {
      const { error: updErr } = await supabase.from('fcs_kapasitas_override').update(ovPayload).eq('id', existingOv.id)
      if (updErr) throw new Error('Gagal update kapasitas: ' + updErr.message)
    } else {
      const { error: insErr } = await supabase.from('fcs_kapasitas_override').insert(ovPayload)
      if (insErr) throw new Error('Gagal simpan kapasitas: ' + insErr.message)
    }
    const kapasitasBaru = isOrang ? (Number(jumlahOrang) || 0) : (Number(kapasitasMenit) || 0)

    const tanggalBatas = addDays(tanggal, 60)
    const { data: overrideRows } = await supabase.from('fcs_kapasitas_override')
      .select('tanggal, kapasitas_menit, jumlah_orang')
      .eq('jenis_pekerjaan', jenisPekerjaan)
      .gte('tanggal', tanggal).lte('tanggal', tanggalBatas)
    const kapasitasMap: Record<string, number> = {}
    ;(overrideRows || []).forEach((r: any) => {
      kapasitasMap[r.tanggal] = isOrang ? Number(r.jumlah_orang || 0) : Number(r.kapasitas_menit || 0)
    })
    kapasitasMap[tanggal] = kapasitasBaru

    const { data: rawRows } = await supabase.from('raw_schedule')
      .select('id, wo_id, panel_id, panel, proyek, proses, schedule, bobot_komponen')
      .eq('proses', jenisPekerjaan)

    const panelIds = [...new Set((rawRows || []).map((r: any) => r.panel_id).filter(Boolean))]
    const { data: panelRows } = await supabase.from('panels')
      .select('id, nama, tipe, checklist').in('id', panelIds.length > 0 ? panelIds : [-1])
    const panelMap: Record<number, any> = {}
    ;(panelRows || []).forEach((p: any) => { panelMap[p.id] = p })
    // REVISI (12 Agu 2026): kebutuhan orang wiring dinamis per komponen (bobot row-level + hari
    // kerja aktual) - lihat panelHelpers.ts WIRING_BOBOT_TABLE.
    const hariKerjaMap = isOrang ? await fetchWiringHariKerjaMap(panelIds) : {}

    const woIds = [...new Set((rawRows || []).map((r: any) => r.wo_id).filter(Boolean))]
    const { data: woRows } = await supabase.from('work_orders').select('id, wo, target').in('id', woIds.length > 0 ? woIds : [-1])
    const woMap: Record<number, { wo: string; target: string }> = {}
    ;(woRows || []).forEach((w: any) => { woMap[w.id] = { wo: w.wo, target: w.target || '' } })

    const { data: ptData } = await supabase.from('fcs_process_time')
      .select('tipe_panel, kode_komponen, nama_komponen, menit_per_pcs')
      .eq('jenis_pekerjaan', jenisPekerjaan).eq('is_active', true)
    const ptMap: Record<string, any> = {}
    ;(ptData || []).forEach((pt: any) => { ptMap[pt.tipe_panel + '|' + pt.kode_komponen] = pt })

    type Item = {
      rawId: number; wp: string; kode: string; beban: number
      namaKomponen: string; panelNama: string; proyek: string; woNumber: string; woTarget: string
      orangPerKomponen?: number
    }
    const itemsHariIni: Item[] = []
    let bebanTotal = 0
    for (const row of rawRows || []) {
      const entries = row.schedule?.[tanggal] || []
      const panel = panelMap[row.panel_id]
      if (!panel) continue
      const woInfo = woMap[row.wo_id] || { wo: '', target: '' }
      for (const entry of entries) {
        if (isOrang) {
          for (const kode of (entry.komponen || [])) {
            if (kode.startsWith('__wiring_')) continue
            // Jejak (digeserKe) itu histori read-only - gak dihitung beban dan gak boleh ikut
            // digeser lagi lewat rebalance ini.
            if (entry.digeserKe && entry.digeserKe[kode]) continue
            const progress = panel.checklist?.[kode]?.progress?.[jenisPekerjaan] || 0
            if (progress >= 100) continue
            const bobot = (row as any).bobot_komponen?.[kode]
            const hariKeN = hariKeNFromMap(hariKerjaMap, row.panel_id, kode, jenisPekerjaan, tanggal)
            const orang = kebutuhanOrangWiring(bobot, hariKeN)
            bebanTotal += orang
            itemsHariIni.push({
              rawId: row.id, wp: entry.wp, kode, beban: orang,
              namaKomponen: kode, panelNama: panel.nama, proyek: row.proyek, woNumber: woInfo.wo, woTarget: woInfo.target,
              orangPerKomponen: orang,
            })
          }
        } else {
          for (const kode of (entry.komponen || [])) {
            // Jejak (digeserKe) itu histori read-only - gak dihitung beban dan gak boleh ikut
            // digeser lagi lewat rebalance ini.
            if (entry.digeserKe && entry.digeserKe[kode]) continue
            const qty = panel.checklist?.[kode]?.qty || 0
            const pt = ptMap[panel.tipe + '|' + kode]
            const menitPcs = pt ? Number(pt.menit_per_pcs) : 0
            const totalMenit = qty * menitPcs
            if (totalMenit <= 0) continue
            bebanTotal += totalMenit
            itemsHariIni.push({
              rawId: row.id, wp: entry.wp, kode, beban: totalMenit,
              namaKomponen: pt?.nama_komponen || kode, panelNama: panel.nama, proyek: row.proyek, woNumber: woInfo.wo, woTarget: woInfo.target,
            })
          }
        }
      }
    }

    const shifted: RebalanceShiftResult[] = []
    if (bebanTotal <= kapasitasBaru) {
      return { success: true, shifted: [] }
    }

    itemsHariIni.sort((a, b) => (b.woTarget || '9999-99-99').localeCompare(a.woTarget || '9999-99-99'))

    let sisaLebih = bebanTotal - kapasitasBaru
    const toShift: Item[] = []
    for (const item of itemsHariIni) {
      if (sisaLebih <= 0) break
      toShift.push(item)
      sisaLebih -= item.beban
    }

    const bebanTerpakaiTujuan: Record<string, number> = {}
    const getBebanTerpakai = async (tgl: string): Promise<number> => {
      if (bebanTerpakaiTujuan[tgl] !== undefined) return bebanTerpakaiTujuan[tgl]
      let total = 0
      for (const row of rawRows || []) {
        const entries = row.schedule?.[tgl] || []
        const panel = panelMap[row.panel_id]
        if (!panel) continue
        for (const entry of entries) {
          if (isOrang) {
            for (const kode of (entry.komponen || [])) {
              if (kode.startsWith('__wiring_')) continue
              // Jejak (digeserKe) itu histori read-only - gak dihitung beban.
              if (entry.digeserKe && entry.digeserKe[kode]) continue
              const bobot = (row as any).bobot_komponen?.[kode]
              const hariKeN = hariKeNFromMap(hariKerjaMap, row.panel_id, kode, jenisPekerjaan, tgl)
              total += kebutuhanOrangWiring(bobot, hariKeN)
            }
          } else {
            for (const kode of (entry.komponen || [])) {
              // Jejak (digeserKe) itu histori read-only - gak dihitung beban.
              if (entry.digeserKe && entry.digeserKe[kode]) continue
              const qty = panel.checklist?.[kode]?.qty || 0
              const pt = ptMap[panel.tipe + '|' + kode]
              total += qty * (pt ? Number(pt.menit_per_pcs) : 0)
            }
          }
        }
      }
      bebanTerpakaiTujuan[tgl] = total
      return total
    }

    const mutasi: Record<number, any> = {}
    const getScheduleMutable = (rawId: number) => {
      if (!mutasi[rawId]) {
        const row = (rawRows || []).find((r: any) => r.id === rawId)
        mutasi[rawId] = JSON.parse(JSON.stringify(row?.schedule || {}))
      }
      return mutasi[rawId]
    }

    for (const item of toShift) {
      let tujuan: string | null = null
      let cur = addDays(tanggal, 1)
      let attempts = 0
      while (attempts < 60) {
        const kap = kapasitasMap[cur]
        if (kap !== undefined && kap > 0) {
          const terpakai = await getBebanTerpakai(cur)
          if (kap - terpakai >= item.beban) {
            tujuan = cur
            break
          }
        }
        cur = addDays(cur, 1)
        attempts++
      }

      if (!tujuan) {
        // FIX (13 Agu 2026): SEBELUMNYA di sini maksa tujuan=addDays(tanggal,60) - komponen
        // "hilang" diam-diam ke 2 bulan ke depan tanpa jejak jelas begitu 60 hari ke depan
        // gak ada kapasitas terkonfigurasi sama sekali (insiden nyata: WM_SS.2/P-SWP 04
        // GODREJ BOROBUDUR loncat ke Oktober, akar sama dengan kasus FS.13/STEL sebelumnya).
        // Sekarang disamakan dengan prinsip no-displacement WIRING di auto-geser-harian: kalau
        // gak ketemu slot kosong dalam 60 hari, JANGAN dipindah sama sekali - biarin di
        // tanggal asal (overbook di situ, kelihatan jelas), cuma dicatat overflow buat
        // direview manual (activity_log di bawah).
        shifted.push({
          kodeKomponen: item.kode,
          namaKomponen: item.namaKomponen,
          panelNama: item.panelNama,
          proyek: item.proyek,
          woNumber: item.woNumber,
          dariTanggal: tanggal,
          keTanggal: tanggal,
          overflow: true,
        })
        continue
      }

      bebanTerpakaiTujuan[tujuan] = (bebanTerpakaiTujuan[tujuan] || 0) + item.beban

      const schedSrc = getScheduleMutable(item.rawId)
      const entrySrc = (schedSrc[tanggal] || []).find((e: any) => e.wp === item.wp)
      if (entrySrc) {
        entrySrc.komponen = (entrySrc.komponen || []).filter((k: string) => k !== item.kode)
        if (isOrang && entrySrc.orangPerKomponen) delete entrySrc.orangPerKomponen[item.kode]
      }
      schedSrc[tanggal] = (schedSrc[tanggal] || []).filter((e: any) => (e.komponen || []).length > 0)

      if (!schedSrc[tujuan]) schedSrc[tujuan] = []
      let entryTuj = schedSrc[tujuan].find((e: any) => e.wp === item.wp)
      if (!entryTuj) {
        entryTuj = { wp: item.wp, komponen: [], orangPerKomponen: {} }
        schedSrc[tujuan].push(entryTuj)
      }
      if (!entryTuj.komponen.includes(item.kode)) entryTuj.komponen.push(item.kode)
      if (isOrang) {
        if (!entryTuj.orangPerKomponen) entryTuj.orangPerKomponen = {}
        entryTuj.orangPerKomponen[item.kode] = item.orangPerKomponen || 1
      }

      shifted.push({
        kodeKomponen: item.kode,
        namaKomponen: item.namaKomponen,
        panelNama: item.panelNama,
        proyek: item.proyek,
        woNumber: item.woNumber,
        dariTanggal: tanggal,
        keTanggal: tujuan,
        overflow: false,
      })
    }

    for (const rawIdStr of Object.keys(mutasi)) {
      const rawId = Number(rawIdStr)
      await supabase.from('raw_schedule').update({ schedule: mutasi[rawId] }).eq('id', rawId)
    }

    // FIX (12-13 Agu 2026): overflow (gak ketemu slot kapasitas dalam 60 hari) SEBELUMNYA
    // ditampilkan sekali di modal saat itu juga lalu komponennya di-dump ke tanggal+60 (silent
    // overbook 2 bulan ke depan) - begitu modal ditutup, gak ada jejak lagi di manapun. Insiden
    // nyata: FS.13 (Pintu) LVMDP-FINNS RESORT dan WM_SS.2 (Groundplate) P-SWP 04-GODREJ
    // BOROBUDUR sama-sama ke-dump lewat jalur ini, gak ketauan sampai digali manual jauh
    // setelahnya. Sekarang (13 Agu) komponen overflow TIDAK dipindah sama sekali (tetap di
    // tanggal asal, overbook di situ - bukan hilang ke tanggal acak), dan overflow-nya ditulis
    // ke activity_log, sama pola dengan overbook warning auto-geser-harian.
    const overflowItems = shifted.filter((s) => s.overflow)
    if (overflowItems.length > 0) {
      await activityLogService.insert({
        user_name: createdBy || 'System',
        action: 'REBALANCE KAPASITAS: PERLU REVIEW MANUAL',
        description: `Set kapasitas ${jenisPekerjaan} (${tanggal}) gak nemu slot kosong dalam 60 hari buat ${overflowItems.length} komponen - TIDAK dipindah (tetap overbook di tanggal asal, isi kapasitas ke depan buat proses ini): ` +
          overflowItems.map((s) => `${s.namaKomponen} (${s.panelNama}/${s.proyek}) @ ${s.dariTanggal}`).join(', '),
        module: 'raw', halaman: 'Raw Schedule',
      })
    }

    return { success: true, shifted }
  } catch (e: any) {
    return { success: false, shifted: [], error: e?.message || 'Error tidak diketahui' }
  }
}


// ============================================================
// GENERATE LANGSUNG KE RAW SCHEDULE (skip fcs_schedule sebagai staging)
// Dipanggil dari tombol "FCS" di card WO - Manajemen WO
// ============================================================
async function upsertRawScheduleEntry(
  wo: any, panel: any, proses: string, tanggal: string, wp: string, komponenList: string[], qtyPerKomponen?: Record<string, number>, generatedBy?: string
) {
  const { data: existing } = await supabase
    .from('raw_schedule')
    .select('id, schedule')
    .eq('wo_id', wo.id)
    .eq('panel_id', panel.id)
    .eq('proses', proses)
    .maybeSingle()

  // Anti-duplikat (proses qty-based): kalau qty kode ini utk wp yg sama udah TERCATAT PENUH
  // di tanggal LAIN (bukan tanggal yg lagi ditulis), jangan tulis lagi - cegah kode yg sama
  // nempel di 2+ tanggal buat qty yg sama (root cause 128 kelompok duplikat yg pernah
  // ditemukan). Split multi-hari yg SAH (qty beda tiap hari, dari sisaQtyBerikutnya di
  // generateAndSaveToRawSchedule) TETAP aman krn totalnya gak pernah melebihi qty asli di
  // checklist panel - jadi gak pernah ke-skip di sini.
  const checklist = panel.checklist || {}
  const scheduleUtkCek = existing?.schedule || {}
  let komponenFinal = [...komponenList]
  let qtyFinal: Record<string, number> | undefined = qtyPerKomponen ? { ...qtyPerKomponen } : undefined
  if (qtyFinal) {
    for (const kode of komponenList) {
      const totalQtyKode = checklist[kode]?.qty || 0
      if (totalQtyKode <= 0) continue
      let sudahAda = 0
      Object.entries(scheduleUtkCek).forEach(([tgl, entries]: any) => {
        if (tgl === tanggal) return
        ;(entries as any[]).forEach((e: any) => {
          if (e.wp !== wp || !(e.komponen || []).includes(kode)) return
          sudahAda += e.qtyPerKomponen?.[kode] ?? totalQtyKode
        })
      })
      const sisaBoleh = totalQtyKode - sudahAda
      if (sisaBoleh <= 0) {
        komponenFinal = komponenFinal.filter((k) => k !== kode)
        delete qtyFinal[kode]
      } else if (qtyFinal[kode] > sisaBoleh) {
        qtyFinal[kode] = sisaBoleh
      }
    }
    if (komponenFinal.length === 0) return // semua kode di panggilan ini udah full terjadwal di tanggal lain
  }

  if (existing) {
    const schedule = existing.schedule || {}
    if (!schedule[tanggal]) schedule[tanggal] = []
    const existingEntry = schedule[tanggal].find((e: any) => e.wp === wp)
    if (existingEntry) {
      const setKomp = new Set([...existingEntry.komponen, ...komponenFinal])
      existingEntry.komponen = Array.from(setKomp)
      if (qtyFinal) {
        existingEntry.qtyPerKomponen = { ...(existingEntry.qtyPerKomponen || {}), ...qtyFinal }
      }
    } else {
      schedule[tanggal].push({ wp, komponen: komponenFinal, ...(qtyFinal ? { qtyPerKomponen: qtyFinal } : {}), ...(generatedBy ? { createdBy: generatedBy, createdAt: new Date().toISOString() } : {}) })
    }
    await supabase.from('raw_schedule').update({ schedule }).eq('id', existing.id)
  } else {
    await supabase.from('raw_schedule').insert({
      wo_id: wo.id,
      panel_id: panel.id,
      proyek: wo.proyek,
      panel: panel.nama,
      proses,
      prioritas: 'Sedang',
      schedule: { [tanggal]: [{ wp, komponen: komponenFinal, ...(qtyFinal ? { qtyPerKomponen: qtyFinal } : {}), ...(generatedBy ? { createdBy: generatedBy, createdAt: new Date().toISOString() } : {}) }] },
    })
  }
}

async function ensureSkeletonRow(wo: any, panel: any, proses: string) {
  const { data: existing } = await supabase
    .from('raw_schedule')
    .select('id')
    .eq('wo_id', wo.id)
    .eq('panel_id', panel.id)
    .eq('proses', proses)
    .maybeSingle()
  if (!existing) {
    await supabase.from('raw_schedule').insert({
      wo_id: wo.id,
      panel_id: panel.id,
      proyek: wo.proyek,
      panel: panel.nama,
      proses,
      prioritas: 'Sedang',
      schedule: {},
    })
  }
}

export async function generateAndSaveToRawSchedule(
  woId: number,
  tanggalMulai: string,
  generatedBy: string,
  panelIds?: number[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const { data: wo } = await supabase.from('work_orders').select('*').eq('id', woId).single()
    if (!wo) return { success: false, count: 0, error: 'WO tidak ditemukan' }
    const { data: panelsAll } = await supabase.from('panels').select('*').eq('wo_id', woId)
    if (!panelsAll || panelsAll.length === 0) return { success: false, count: 0, error: 'Tidak ada panel di WO ini' }
    // panelIds opsional - kalau diisi, HANYA panel-panel itu yang diproses/ditulis (panel lain
    // di WO yang sama sama sekali gak di-fetch/disentuh dari sini). Hampir semua bagian di bawah
    // (cek duplikat, sudahTerjadwalQtyMap, qtyProsesSelesaiMap, dua loop penulis utama) udah
    // otomatis ngikutin isi `panels` - jadi filter di SATU titik ini cukup. terpakaiTracker
    // (kapasitas harian) SENGAJA TETAP dihitung dari raw_schedule GLOBAL (bukan cuma panel
    // terpilih) - kapasitas itu resource bersama lintas panel/WO, kalau ikut difilter hasilnya
    // salah (kapasitas yang udah kepakai panel lain jadi gak kehitung, bisa over-alokasi).
    const panels = (panelIds && panelIds.length > 0) ? panelsAll.filter((p: any) => panelIds.includes(p.id)) : panelsAll
    if (panels.length === 0) return { success: false, count: 0, error: 'Tidak ada panel yang dipilih' }

    const panelIdsForCheck = panels.map((p: any) => p.id)
    const { data: existingCheck } = await supabase.from('raw_schedule').select('id').in('panel_id', panelIdsForCheck).limit(1)
    if (existingCheck && existingCheck.length > 0 && !generatedBy.startsWith('__force__')) {
      return { success: false, count: 0, error: '__ALREADY_EXISTS__' }
    }

    const tipeSet = [...new Set(panels.map((p: any) => p.tipe))]

    const { data: bomRows } = await supabase.from('bom_master').select('*').in('tipe_panel', tipeSet)
    const kodeToWp: Record<string, string> = {}
    ;(bomRows || []).forEach((b: any) => { kodeToWp[b.tipe_panel + '|' + b.kode_komponen] = b.wp })

    const { data: relevanRows } = await supabase.from('bom_proses_relevan').select('*')
    const relevanSet = new Set<string>()
    const hasMappingSet = new Set<string>()
    ;(relevanRows || []).forEach((r: any) => {
      relevanSet.add(r.kode_komponen + '|' + r.tipe_panel + '|' + r.jenis_pekerjaan)
      hasMappingSet.add(r.kode_komponen + '|' + r.tipe_panel)
    })

    const { data: ptRows } = await supabase.from('fcs_process_time').select('*').in('tipe_panel', tipeSet)
    const menitMap: Record<string, number> = {}
    ;(ptRows || []).forEach((p: any) => {
      menitMap[p.tipe_panel + '|' + p.kode_komponen + '|' + p.jenis_pekerjaan] = Number(p.menit_per_pcs) || 0
    })

    const { data: kapRows } = await supabase.from('fcs_kapasitas_override').select('*')
    const kapMap: Record<string, any> = {}
    ;(kapRows || []).forEach((k: any) => { kapMap[k.tanggal + '|' + k.jenis_pekerjaan] = k })

    // BUG FIX (Sprint 3, 5 Agu 2026): dulu .select('*') tanpa .range() - raw_schedule sengaja
    // dibaca GLOBAL di sini (lihat komentar di atas soal terpakaiTracker), dan tabelnya sudah
    // ~800-900+ baris (dekat cap 1000 default Supabase) - begitu lewat, existingRaw kepotong
    // diam-diam, sudahAdaJadwalSet/qtyProsesSelesaiMap yang dibangun dari sini jadi gak lengkap,
    // dan komponen yang sebenarnya sudah terjadwal bisa lolos ke-generate ulang lagi - persis
    // kelas bug yang barusan diperbaiki (skip generate utk komponen yang udah ada jadwalnya).
    let existingRaw: any[] = []
    {
      let from = 0
      const step = 1000
      while (true) {
        const { data } = await supabase.from('raw_schedule').select('*').range(from, from + step - 1)
        if (!data) break
        existingRaw = existingRaw.concat(data)
        if (data.length < step) break
        from += step
      }
    }

    const WIRING_LIST = ["WIRING CONTROL","WIRING POWER"]
    // QC TEST/PACKING itu proses whole-panel (penanda), bukan proses per-komponen - jangan
    // digantungkan ke mapping bom_proses_relevan per kode komponen (komponen/tipe_panel baru
    // yang belum di-setup lewat wizard proses-relevan bakal diam-diam gak pernah dapet baris
    // QC TEST/PACKING kalau digantungkan ke situ - ini akar bug yang kejadian di Magonia Lombok).
    const PROSES_TANPA_MAPPING_KOMPONEN = ["QC TEST","PACKING"]

    const addDaysStr = (date: string, n: number) => {
      const d = new Date(date); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10)
    }

    const terpakaiTracker: Record<string, number> = {}
    ;(existingRaw || []).forEach((row: any) => {
      if (WIRING_LIST.includes(row.proses)) return
      const schedule = row.schedule || {}
      Object.entries(schedule).forEach(([tgl, entries]: any) => {
        ;(entries as any[]).forEach((e: any) => {
          ;(e.komponen || []).forEach((kode: string) => {
            // Jejak (digeserKe) itu histori read-only - gak dihitung kapasitas terpakai.
            if (e.digeserKe && e.digeserKe[kode]) return
            const p = (panels as any[]).find((pp: any) => pp.id === row.panel_id)
            const tipe = p ? p.tipe : tipeSet[0]
            const qtyKomp = p?.checklist?.[kode]?.qty || 0
            const menit = (menitMap[tipe + '|' + kode + '|' + row.proses] || 0) * qtyKomp
            const key = tgl + '|' + row.proses
            terpakaiTracker[key] = (terpakaiTracker[key] || 0) + menit
          })
        })
      })
    })

    // FIX (5 Agu 2026): kode yang UDAH PUNYA baris di raw_schedule (live ATAU jejak, qty
    // berapapun, di tanggal manapun) buat panel+proses ini - dipakai SKIP TOTAL, bukan cuma
    // top-up qty. Insiden nyata: SDP-PASTEURIZER yang udah lengkap terjadwal (histori sejak 29
    // Juli) di-generate-ulang (force) dan SEMUA komponennya kebuat ulang dari nol qty penuh -
    // top-up qty-based (sudahTerjadwalQtyMap di bawah) semestinya nyegah ini tapi ternyata gak
    // reliable buat kasus itu. Set ini jadi pengaman lebih sederhana & pasti: gak peduli hasil
    // hitungan sisa-qty-nya, kalau kode itu SUDAH PERNAH muncul di jadwal, jangan disentuh lagi
    // sama sekali oleh generate ulang - biar "Generate ulang cuma nambahin yang kosong" beneran
    // gak pernah bisa nimpa yang udah ada, sesuai janji di dialog konfirmasi.
    const sudahAdaJadwalSet = new Set<string>()
    ;(existingRaw || []).forEach((row: any) => {
      if (WIRING_LIST.includes(row.proses)) return
      const schedule = row.schedule || {}
      Object.values(schedule).forEach((entries: any) => {
        ;(entries as any[]).forEach((e: any) => {
          ;(e.komponen || []).forEach((kode: string) => {
            sudahAdaJadwalSet.add(row.panel_id + '|' + row.proses + '|' + kode)
          })
        })
      })
    })

    // Qty yang sudah terjadwal sebelumnya per panel+proses+kode - biar generate ulang/force
    // cuma nambahin kekurangannya (top-up), bukan qty penuh lagi (mencegah dobel).
    const sudahTerjadwalQtyMap: Record<string, number> = {}
    ;(existingRaw || []).forEach((row: any) => {
      if (WIRING_LIST.includes(row.proses)) return
      const panelRow = (panels as any[]).find((pp: any) => pp.id === row.panel_id)
      if (!panelRow) return
      const checklistPanel = panelRow.checklist || {}
      const schedule = row.schedule || {}
      Object.values(schedule).forEach((entries: any) => {
        ;(entries as any[]).forEach((e: any) => {
          // Entry hasil auto-geser (carriedOverFrom) itu representasi ULANG qty yang SAMA
          // dari tanggal asalnya (belum selesai, cuma dipindah tampil ke hari berikutnya) -
          // bukan kebutuhan qty tambahan. Kalau ikut dijumlah di sini, qty yang sama kehitung
          // 2x (sekali di tanggal asal, sekali lagi di entry carry-over-nya).
          if (e.carriedOverFrom) return
          ;(e.komponen || []).forEach((kode: string) => {
            const qty = e.qtyPerKomponen?.[kode] ?? (checklistPanel[kode]?.qty || 0)
            const key = row.panel_id + '|' + row.proses + '|' + kode
            sudahTerjadwalQtyMap[key] = (sudahTerjadwalQtyMap[key] || 0) + qty
          })
        })
      })
    })

    // Qty yang SUDAH BENAR-BENAR DIKERJAKAN (progress asli operator dari panels.checklist),
    // beda dari sudahTerjadwalQtyMap yang cuma nandain "sudah masuk jadwal" - dua-duanya dipakai
    // bareng (ambil yang lebih besar) biar gak minta jadwalin ulang qty yang udah kelar, DAN
    // tetap gak dobel-jadwal qty yang udah di-assign ke hari lain tapi belum dikerjakan.
    const qtyProsesSelesaiMap: Record<string, number> = {}
    ;(panels as any[]).forEach((panelRow: any) => {
      const checklistPanel = panelRow.checklist || {}
      Object.entries(checklistPanel).forEach(([kode, cl]: any) => {
        Object.entries(cl?.qtyProses || {}).forEach(([proses, qty]: any) => {
          const key = panelRow.id + '|' + proses + '|' + kode
          qtyProsesSelesaiMap[key] = Number(qty) || 0
        })
      })
    })

    let count = 0
    const scheduledOk = new Set<string>()
    const getRelevantProsesUrut = (kode: string, tipe: string) => ALL_PROSES.filter((pr) => {
      if (PROSES_TANPA_MAPPING_KOMPONEN.includes(pr)) return true
      const mapKey = kode + '|' + tipe
      if (hasMappingSet.has(mapKey)) return relevanSet.has(kode + '|' + tipe + '|' + pr)
      return false
    })
    const isEstafetOk = (panelId: number, kode: string, tipe: string, proses: string) => {
      const urutan = getRelevantProsesUrut(kode, tipe)
      const idx = urutan.indexOf(proses)
      if (idx <= 0) return true
      const prosesSebelum = urutan[idx - 1]
      return scheduledOk.has(panelId + '|' + kode + '|' + prosesSebelum)
    }

    for (const panel of panels as any[]) {
      const checklist = panel.checklist || {}
      const activeKodes = Object.entries(checklist).filter(([, v]: any) => (v?.qty || 0) > 0).map(([k]) => k)
      if (activeKodes.length === 0) continue

      for (const prosesSkeleton of ALL_PROSES) {
        // BUSBAR SENGAJA di-skip di sini, jangan digantungkan ke bom_proses_relevan - lihat
        // commit 4c464e1 (10 Sep 2026, "hapus badge BUSBAR hantu di komponen mekanikal"): tabel
        // itu isinya pemetaan komponen BOM MEKANIKAL (Groundplate/Dudukan dkk pernah salah
        // ke-tandai "relevan" ke BUSBAR di situ, sumber badge hantu). Efek samping yang gak
        // disadari waktu itu: skeleton row BUSBAR di Raw Schedule jadi PERMANEN gak pernah
        // kebuat lagi buat panel baru manapun sejak fix itu (adaRelevan-nya selalu false,
        // BUSBAR bukan proses komponen mekanikal, gak ada baris bom_proses_relevan yang valid
        // buat itu). Skeleton BUSBAR yang benar dibuat terpisah di bawah (getBusbarKomponen).
        if (prosesSkeleton === 'BUSBAR') continue
        const adaRelevan = PROSES_TANPA_MAPPING_KOMPONEN.includes(prosesSkeleton) || activeKodes.some((kode) => {
          const mapKey = kode + '|' + panel.tipe
          if (hasMappingSet.has(mapKey)) return relevanSet.has(kode + '|' + panel.tipe + '|' + prosesSkeleton)
          return false
        })
        if (adaRelevan) await ensureSkeletonRow(wo, panel, prosesSkeleton)
      }

      // BUSBAR skeleton row (16 Sep 2026) - syarat yang BENAR: tipe panel ini emang punya daftar
      // komponen busbar (getBusbarKomponen - H-BUS/INCOMING/OUTGOING/NETRAL/GROUND/COUPLER dst),
      // SAMA PERSIS sumber yang dipakai Detail Progres/Task Monitoring buat nentuin baris BUSBAR
      // relevan atau enggak - BUKAN bom_proses_relevan (itu buat komponen mekanikal, konsep
      // beda total, lihat komentar di atas). Semua 4 tipe panel yang ada (FS/F3B/WM_MS/WM_POLY)
      // punya daftar busbar sendiri jadi ini pasti true buat semua panel saat ini - ditulis
      // eksplisit (bukan asumsi "selalu true") biar kalau ada tipe baru kelak yang beneran gak
      // punya busbar, otomatis gak dikasih baris kosong yang gak berguna.
      if (getBusbarKomponen(panel.tipe).length > 0) await ensureSkeletonRow(wo, panel, 'BUSBAR')

      for (const proses of ALL_PROSES) {
        // BUSBAR gak pernah dijadwalin lewat mekanisme WP generik ini - modelnya beda total
        // (lihat busbar_schedule/BUSBAR_KOMPONEN, list tetap H-BUS/INCOMING/OUTGOING/NETRAL/
        // GROUND/COUPLER, gak ada WP). bom_proses_relevan sering nandain komponen macam
        // Groundplate/Tulangan Support Busbar "relevan" ke BUSBAR (bener secara fisik, part
        // busbar emang dipasang bareng), tapi kalau lolos ke sini bikin schedule[d] row BUSBAR
        // keisi entry ber-wp yang gak pernah dipahami di manapun - nyasar/bocor sebagai badge WP
        // di Rencana Harian & modal detail Raw Schedule. Kode ini SUDAH kejadwal lewat proses
        // aslinya masing2 (WIRING CONTROL/POWER, POTONG, dst) - BUSBAR gak perlu jadwal WP sendiri.
        if (WIRING_LIST.includes(proses) || proses === 'BUSBAR') continue

        const relevantKodes = (PROSES_TANPA_MAPPING_KOMPONEN.includes(proses) ? activeKodes : activeKodes.filter((kode) => {
          const mapKey = kode + '|' + panel.tipe
          if (hasMappingSet.has(mapKey)) return relevanSet.has(kode + '|' + panel.tipe + '|' + proses)
          return false
        })).filter((kode) => isEstafetOk(panel.id, kode, panel.tipe, proses))
        if (relevantKodes.length === 0) continue

        const wpGroups: Record<string, string[]> = {}
        relevantKodes.forEach((kode) => {
          const wp = kodeToWp[panel.tipe + '|' + kode] || 'WP1'
          if (!wpGroups[wp]) wpGroups[wp] = []
          wpGroups[wp].push(kode)
        })

        for (const [wp, kodes] of Object.entries(wpGroups)) {
          const getKapasitas = (tgl: string) => {
            const k = kapMap[tgl + '|' + proses]
            return k ? Number(k.kapasitas_menit) || 0 : 0
          }
          let cur = tanggalMulai
          let attempts = 0
          while (attempts < 21 && getKapasitas(cur) <= 0) { cur = addDaysStr(cur, 1); attempts++ }

          let sisaQty: Record<string, number> = {}
          kodes.forEach((kode) => {
            const key = panel.id + '|' + proses + '|' + kode
            if (sudahAdaJadwalSet.has(key)) { scheduledOk.add(panel.id + '|' + kode + '|' + proses); return }
            const totalQty = checklist[kode]?.qty || 0
            const sudahQty = Math.max(sudahTerjadwalQtyMap[key] || 0, qtyProsesSelesaiMap[key] || 0)
            const sisa = Math.max(0, totalQty - sudahQty)
            if (sisa > 0) sisaQty[kode] = sisa
            else scheduledOk.add(panel.id + '|' + kode + '|' + proses)
          })

          let dayAttempts = 0
          while (Object.keys(sisaQty).length > 0 && dayAttempts < 21) {
            const kap = getKapasitas(cur)
            const terpakai = terpakaiTracker[cur + '|' + proses] || 0
            let sisaKap = kap - terpakai
            const kodeHariIni: string[] = []
            const qtyHariIni: Record<string, number> = {}
            const sisaQtyBerikutnya: Record<string, number> = {}

            for (const kode of Object.keys(sisaQty)) {
              const menitPerPcs = menitMap[panel.tipe + '|' + kode + '|' + proses] || 0
              const qtySisa = sisaQty[kode]
              if (menitPerPcs <= 0) {
                // FIX: sebelumnya komponen tanpa data fcs_process_time DIDIAMKAN gak pernah
                // kejadwal (didorong "sisaQtyBerikutnya" terus tiap hari, sampai 21 percobaan
                // habis lalu cuma di-console.warn - efeknya komponen/proses itu HILANG TOTAL
                // dari raw_schedule, gak ada bekasnya sama sekali). Sekarang: tetap tempatkan
                // LANGSUNG di tanggal ini, TANPA ikut kompetisi kapasitas (gak ada cara ngitung
                // demand-nya) - sama prinsip kayak BUSBAR/proses-tanpa-data yang sudah ada.
                kodeHariIni.push(kode)
                qtyHariIni[kode] = qtySisa
                continue
              }
              const menitTotal = qtySisa * menitPerPcs
              if (sisaKap >= menitTotal) {
                kodeHariIni.push(kode)
                qtyHariIni[kode] = qtySisa
                sisaKap -= menitTotal
                terpakaiTracker[cur + '|' + proses] = (terpakaiTracker[cur + '|' + proses] || 0) + menitTotal
              } else {
                const qtyMuat = Math.floor(sisaKap / menitPerPcs)
                if (qtyMuat > 0) {
                  kodeHariIni.push(kode)
                  qtyHariIni[kode] = qtyMuat
                  const menitDipakai = qtyMuat * menitPerPcs
                  sisaKap -= menitDipakai
                  terpakaiTracker[cur + '|' + proses] = (terpakaiTracker[cur + '|' + proses] || 0) + menitDipakai
                  const sisaBelumKejadwal = qtySisa - qtyMuat
                  if (sisaBelumKejadwal > 0) sisaQtyBerikutnya[kode] = sisaBelumKejadwal
                } else {
                  sisaQtyBerikutnya[kode] = qtySisa
                }
              }
            }

            if (kodeHariIni.length > 0) {
              await upsertRawScheduleEntry(wo, panel, proses, cur, wp, kodeHariIni, qtyHariIni, generatedBy)
              kodeHariIni.forEach((kd) => {
                if (!sisaQtyBerikutnya[kd]) scheduledOk.add(panel.id + '|' + kd + '|' + proses)
              })
              count++
            }
            sisaQty = sisaQtyBerikutnya
            if (Object.keys(sisaQty).length > 0) {
              cur = addDaysStr(cur, 1)
              let skip = 0
              while (skip < 14 && getKapasitas(cur) <= 0) { cur = addDaysStr(cur, 1); skip++ }
            }
            dayAttempts++
          }
          if (Object.keys(sisaQty).length > 0) {
            console.warn(`Kapasitas ${proses} penuh terus dalam 21 hari, ${Object.keys(sisaQty).length} komponen di WP ${wp} panel ${panel.nama} belum full kejadwal - atur manual lewat klik cell.`)
          }
        }
      }
    }

    // REVISI TOTAL (12 Agu 2026): WIRING CONTROL/POWER sekarang ikut model cascading standar
    // sama seperti proses lain (kebutuhan orang dihitung dinamis per komponen dari bobot +
    // hari kerja aktual, lihat panelHelpers.ts WIRING_BOBOT_TABLE) - jadi di sini gak perlu lagi
    // nebak "berapa hari"/token bobot/tracking kapasitas manual. Cukup taruh komponen yang BELUM
    // pernah muncul di jadwal manapun buat panel+proses ini langsung di tanggalMulai; auto-geser
    // (cascading engine) yang urus spread ke hari berikutnya kalau kapasitas hari itu gak cukup.
    // bobot_komponen dibiarkan kosong (default MEDIUM saat dibaca) - planner isi belakangan lewat
    // UI Raw Schedule kalau perlu dikoreksi.
    for (const panel of panels as any[]) {
      const checklist = panel.checklist || {}
      const activeKodes = Object.entries(checklist).filter(([, v]: any) => (v?.qty || 0) > 0).map(([k]) => k)
      if (activeKodes.length === 0) continue

      for (const proses of WIRING_LIST) {
        const relevantKodes = activeKodes.filter((kode) => {
          const mapKey = kode + '|' + panel.tipe
          if (hasMappingSet.has(mapKey)) return relevanSet.has(kode + '|' + panel.tipe + '|' + proses)
          return false
        }).filter((kode) => isEstafetOk(panel.id, kode, panel.tipe, proses))
        if (relevantKodes.length === 0) continue

        const wpGroups: Record<string, string[]> = {}
        relevantKodes.forEach((kode) => {
          const wp = kodeToWp[panel.tipe + '|' + kode] || 'WP1'
          if (!wpGroups[wp]) wpGroups[wp] = []
          wpGroups[wp].push(kode)
        })

        const rowWiringExisting = (existingRaw || []).find((r: any) => r.panel_id === panel.id && r.proses === proses)
        const kodeSudahAda = new Set<string>()
        if (rowWiringExisting) {
          Object.values(rowWiringExisting.schedule || {}).forEach((entries: any) => {
            ;(entries as any[]).forEach((e: any) => {
              ;(e.komponen || []).forEach((k: string) => { if (!k.startsWith('__wiring_')) kodeSudahAda.add(k) })
            })
          })
        }

        for (const [wp, kodes] of Object.entries(wpGroups)) {
          const kodeBaru = kodes.filter((k) => !kodeSudahAda.has(k))
          if (kodeBaru.length === 0) continue
          await upsertRawScheduleEntry(wo, panel, proses, tanggalMulai, wp, kodeBaru, undefined, generatedBy)
          kodeBaru.forEach((kd) => scheduledOk.add(panel.id + '|' + kd + '|' + proses))
          count++
        }
      }
    }

    return { success: true, count }
  } catch (err: any) {
    return { success: false, count: 0, error: err.message }
  }
}
