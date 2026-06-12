import { supabase } from '../lib/supabase'

interface FCSKapasitas {
  jenis_pekerjaan: string
  kapasitas_menit_hari: number
  hari_kerja: number[]
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

interface KomponenKebutuhan {
  kode_komponen: string
  nama_komponen: string
  wp: string
  qty_total: number
  menit_per_pcs: number
}

function isHariKerja(tanggal: string, hariKerja: number[]): boolean {
  const d = new Date(tanggal)
  const hari = d.getDay() === 0 ? 7 : d.getDay()
  return hariKerja.includes(hari)
}

function addDays(tanggal: string, n: number): string {
  const d = new Date(tanggal)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function nextHariKerja(tanggal: string, hariKerja: number[]): string {
  let next = addDays(tanggal, 1)
  let safety = 0
  while (!isHariKerja(next, hariKerja) && safety < 14) {
    next = addDays(next, 1)
    safety++
  }
  return next
}

// Hitung kapasitas terpakai dari DB (untuk tanggal yang sudah ada sebelum generate)
async function getKapasitasTerpakaiDB(
  tanggal: string,
  jenisPekerjaan: string
): Promise<number> {
  const { data } = await supabase
    .from('fcs_schedule')
    .select('total_menit')
    .eq('tanggal', tanggal)
    .eq('jenis_pekerjaan', jenisPekerjaan)
    .neq('status', 'cancelled')
  if (!data || data.length === 0) return 0
  return data.reduce((sum: number, row: any) => sum + Number(row.total_menit), 0)
}

// CORE: FCS dengan in-memory capacity tracking
function generateFCSBatch(
  komponenList: KomponenKebutuhan[],
  tanggalMulai: string,
  kapasitas: FCSKapasitas,
  kapasitasTerpakaiAwal: Record<string, number>, // dari DB sebelum generate
  woInfo: { wo_id: number; wo_number: string; proyek: string; panel_id: number; panel_nama: string; tipe_panel: string },
  generatedBy: string
): FCSScheduleItem[] {
  const result: FCSScheduleItem[] = []
  
  // In-memory tracker kapasitas - mulai dari yang sudah ada di DB
  const kapTracker: Record<string, number> = { ...kapasitasTerpakaiAwal }

  const getKapTerpakai = (tgl: string) => kapTracker[tgl] || 0
  const addKap = (tgl: string, menit: number) => {
    kapTracker[tgl] = (kapTracker[tgl] || 0) + menit
  }

  // Skip ke hari kerja pertama
  let tanggalMulaiKerja = tanggalMulai
  while (!isHariKerja(tanggalMulaiKerja, kapasitas.hari_kerja)) {
    tanggalMulaiKerja = nextHariKerja(tanggalMulaiKerja, kapasitas.hari_kerja)
  }

  for (const komponen of komponenList) {
    let sisaQty = komponen.qty_total
    let tanggal = tanggalMulaiKerja
    let urutan = 1

    while (sisaQty > 0) {
      const terpakai = getKapTerpakai(tanggal)
      const sisaKapasitas = kapasitas.kapasitas_menit_hari - terpakai

      if (sisaKapasitas < komponen.menit_per_pcs) {
        // Kapasitas tidak cukup untuk 1 pcs - geser hari berikutnya
        tanggal = nextHariKerja(tanggal, kapasitas.hari_kerja)
        continue
      }

      const maxQtyHariIni = Math.floor(sisaKapasitas / komponen.menit_per_pcs)
      const qtyHariIni = Math.min(sisaQty, maxQtyHariIni)
      const totalMenitHariIni = qtyHariIni * komponen.menit_per_pcs

      result.push({
        wo_id: woInfo.wo_id,
        wo_number: woInfo.wo_number,
        proyek: woInfo.proyek,
        panel_id: woInfo.panel_id,
        panel_nama: woInfo.panel_nama,
        tipe_panel: woInfo.tipe_panel,
        kode_komponen: komponen.kode_komponen,
        nama_komponen: komponen.nama_komponen,
        wp: komponen.wp,
        jenis_pekerjaan: kapasitas.jenis_pekerjaan,
        tanggal,
        qty_total: komponen.qty_total,
        qty_hari: qtyHariIni,
        menit_per_pcs: komponen.menit_per_pcs,
        total_menit: totalMenitHariIni,
        status: 'planning',
        urutan,
        generated_by: generatedBy,
      })

      // Update in-memory tracker
      addKap(tanggal, totalMenitHariIni)

      sisaQty -= qtyHariIni
      urutan++

      if (sisaQty > 0) {
        tanggal = nextHariKerja(tanggal, kapasitas.hari_kerja)
      }

      if (urutan > 90) break
    }
  }

  return result
}

export async function generateFCSSchedule(params: {
  woId: number
  woNumber: string
  proyek: string
  panelId: number
  panelNama: string
  tipePanel: string
  checklist: Record<string, { qty: number }>
  jenisPekerjaan: string
  tanggalMulai: string
  generatedBy: string
}): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const { woId, woNumber, proyek, panelId, panelNama, tipePanel, checklist, jenisPekerjaan, tanggalMulai, generatedBy } = params

    // 1. Ambil kapasitas
    const { data: kapData } = await supabase
      .from('fcs_kapasitas_pekerjaan')
      .select('*')
      .eq('jenis_pekerjaan', jenisPekerjaan)
      .eq('is_active', true)
      .single()

    if (!kapData) return { success: false, count: 0, error: 'Kapasitas pekerjaan tidak ditemukan' }

    // 2. Ambil process time
    const { data: ptData } = await supabase
      .from('fcs_process_time')
      .select('*')
      .eq('tipe_panel', tipePanel)
      .eq('jenis_pekerjaan', jenisPekerjaan)
      .eq('is_active', true)

    if (!ptData || ptData.length === 0) {
      return { success: false, count: 0, error: `Process time untuk ${tipePanel} - ${jenisPekerjaan} belum ada` }
    }

    const processTimeMap: Record<string, FCSProcessTime> = {}
    ptData.forEach((pt: FCSProcessTime) => { processTimeMap[pt.kode_komponen] = pt })

    // 3. Hapus schedule lama (hanya planning)
    await supabase
      .from('fcs_schedule')
      .delete()
      .eq('wo_id', woId)
      .eq('panel_id', panelId)
      .eq('jenis_pekerjaan', jenisPekerjaan)
      .eq('status', 'planning')

    // 4. Ambil kapasitas yang sudah terpakai dari DB (WO lain)
    // Query semua tanggal yang mungkin dipakai (30 hari ke depan)
    const tanggalAkhir = addDays(tanggalMulai, 60)
    const { data: existingData } = await supabase
      .from('fcs_schedule')
      .select('tanggal, total_menit')
      .eq('jenis_pekerjaan', jenisPekerjaan)
      .gte('tanggal', tanggalMulai)
      .lte('tanggal', tanggalAkhir)
      .neq('status', 'cancelled')

    // Build kapasitas terpakai dari DB
    const kapasitasTerpakaiAwal: Record<string, number> = {}
    if (existingData) {
      existingData.forEach((row: any) => {
        kapasitasTerpakaiAwal[row.tanggal] = (kapasitasTerpakaiAwal[row.tanggal] || 0) + Number(row.total_menit)
      })
    }

    // 5. Hitung kebutuhan komponen
    const kebutuhan: KomponenKebutuhan[] = []
    for (const [kode, cl] of Object.entries(checklist)) {
      const qty = cl.qty || 0
      if (qty <= 0) continue
      const pt = processTimeMap[kode]
      if (!pt || pt.menit_per_pcs <= 0) continue
      kebutuhan.push({
        kode_komponen: kode,
        nama_komponen: pt.nama_komponen,
        wp: pt.wp,
        qty_total: qty,
        menit_per_pcs: pt.menit_per_pcs,
      })
    }

    if (kebutuhan.length === 0) {
      return { success: false, count: 0, error: 'Tidak ada komponen dengan qty > 0 dan process time terdefinisi' }
    }

    // Sort WP1 dulu
    kebutuhan.sort((a, b) => a.wp.localeCompare(b.wp) || a.kode_komponen.localeCompare(b.kode_komponen))

    // 6. Generate FCS dengan in-memory tracking
    const woInfo = { wo_id: woId, wo_number: woNumber, proyek, panel_id: panelId, panel_nama: panelNama, tipe_panel: tipePanel }
    const allItems = generateFCSBatch(kebutuhan, tanggalMulai, kapData, kapasitasTerpakaiAwal, woInfo, generatedBy)

    if (allItems.length === 0) return { success: false, count: 0, error: 'Tidak ada jadwal yang berhasil digenerate' }

    // 7. Insert ke DB
    const { error: insertError } = await supabase.from('fcs_schedule').insert(allItems)
    if (insertError) return { success: false, count: 0, error: insertError.message }

    return { success: true, count: allItems.length }
  } catch (err: any) {
    return { success: false, count: 0, error: err.message }
  }
}

export async function getKapasitasSummary(
  jenisPekerjaan: string,
  tanggalMulai: string,
  tanggalAkhir: string
): Promise<Record<string, { terpakai: number; kapasitas: number; pct: number }>> {
  const [{ data: schedData }, { data: kapData }] = await Promise.all([
    supabase.from('fcs_schedule').select('tanggal, total_menit').eq('jenis_pekerjaan', jenisPekerjaan).gte('tanggal', tanggalMulai).lte('tanggal', tanggalAkhir).neq('status', 'cancelled'),
    supabase.from('fcs_kapasitas_pekerjaan').select('kapasitas_menit_hari').eq('jenis_pekerjaan', jenisPekerjaan).single()
  ])
  const kapasitas = kapData?.kapasitas_menit_hari || 420
  const summary: Record<string, { terpakai: number; kapasitas: number; pct: number }> = {}
  if (schedData) {
    schedData.forEach((row: any) => {
      if (!summary[row.tanggal]) summary[row.tanggal] = { terpakai: 0, kapasitas, pct: 0 }
      summary[row.tanggal].terpakai += Number(row.total_menit)
    })
    Object.keys(summary).forEach(tgl => {
      summary[tgl].pct = Math.round((summary[tgl].terpakai / kapasitas) * 100)
    })
  }
  return summary
}

export async function getFCSScheduleByWO(woId: number) {
  const { data, error } = await supabase
    .from('fcs_schedule')
    .select('*')
    .eq('wo_id', woId)
    .order('tanggal', { ascending: true })
    .order('wp', { ascending: true })
    .order('kode_komponen', { ascending: true })
  return { data: data ?? [], error }
}

export async function updateFCSStatus(id: number, status: string, approvedBy?: string) {
  const updateData: any = { status }
  if (approvedBy) {
    updateData.approved_by = approvedBy
    updateData.approved_at = new Date().toISOString()
  }
  const { error } = await supabase.from('fcs_schedule').update(updateData).eq('id', id)
  return { success: !error, error }
}


export async function syncFCSToRawSchedule(
  woNumber: string,
  jenisPekerjaan: string,
  syncBy: string
): Promise<{ success: boolean; updated: number; error?: string }> {
  try {
    // 1. Ambil semua FCS schedule untuk WO + pekerjaan ini
    const { data: fcsData } = await supabase
      .from('fcs_schedule')
      .select('*')
      .eq('wo_number', woNumber)
      .eq('jenis_pekerjaan', jenisPekerjaan)
      .neq('status', 'cancelled')
      .order('tanggal', { ascending: true })

    if (!fcsData || fcsData.length === 0) {
      return { success: false, updated: 0, error: 'Tidak ada FCS schedule untuk WO ini' }
    }

    // 2. Group by panel_id -> tanggal -> wp -> komponen
    const panelScheduleMap: Record<number, Record<string, Record<string, string[]>>> = {}

    fcsData.forEach((row: any) => {
      const panelId = row.panel_id
      const tanggal = row.tanggal
      const wp = row.wp
      const kode = row.kode_komponen

      if (!panelScheduleMap[panelId]) panelScheduleMap[panelId] = {}
      if (!panelScheduleMap[panelId][tanggal]) panelScheduleMap[panelId][tanggal] = {}
      if (!panelScheduleMap[panelId][tanggal][wp]) panelScheduleMap[panelId][tanggal][wp] = []
      panelScheduleMap[panelId][tanggal][wp].push(kode)
    })

    let updatedCount = 0

    // 3. Update raw_schedule per panel per pekerjaan
    for (const [panelIdStr, tanggalMap] of Object.entries(panelScheduleMap)) {
      const panelId = Number(panelIdStr)

      // Cari raw_schedule yang sesuai
      const { data: rawRow } = await supabase
        .from('raw_schedule')
        .select('id, schedule')
        .eq('panel_id', panelId)
        .eq('proses', jenisPekerjaan)
        .single()

      if (!rawRow) continue

      // Build schedule JSON baru
      const newSchedule: Record<string, Array<{ wp: string; komponen: string[] }>> = {}

      for (const [tanggal, wpMap] of Object.entries(tanggalMap)) {
        newSchedule[tanggal] = []
        for (const [wp, komponen] of Object.entries(wpMap)) {
          newSchedule[tanggal].push({ wp, komponen })
        }
      }

      // Update ke DB
      const { error } = await supabase
        .from('raw_schedule')
        .update({
          schedule: newSchedule,
          updated_by: syncBy,
        })
        .eq('id', rawRow.id)

      if (!error) updatedCount++
    }

    return { success: true, updated: updatedCount }
  } catch (err: any) {
    return { success: false, updated: 0, error: err.message }
  }
}
