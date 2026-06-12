import os

target = r"C:\Users\User\vista-teknik\src\services\fcsService.ts"

content = r"""import { supabase } from '../lib/supabase'

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

async function getKapasitasTerpakai(tanggal: string, jenisPekerjaan: string): Promise<number> {
  const { data } = await supabase
    .from('fcs_schedule')
    .select('total_menit')
    .eq('tanggal', tanggal)
    .eq('jenis_pekerjaan', jenisPekerjaan)
    .neq('status', 'cancelled')
  if (!data || data.length === 0) return 0
  return data.reduce((sum: number, row: any) => sum + Number(row.total_menit), 0)
}

async function generateFCSForKomponen(
  komponen: KomponenKebutuhan,
  tanggalMulai: string,
  kapasitas: FCSKapasitas,
  woInfo: { wo_id: number; wo_number: string; proyek: string; panel_id: number; panel_nama: string; tipe_panel: string },
  generatedBy: string
): Promise<FCSScheduleItem[]> {
  const result: FCSScheduleItem[] = []
  let sisaQty = komponen.qty_total
  let tanggal = tanggalMulai
  let urutan = 1

  while (!isHariKerja(tanggal, kapasitas.hari_kerja)) {
    tanggal = nextHariKerja(tanggal, kapasitas.hari_kerja)
  }

  while (sisaQty > 0) {
    const terpakai = await getKapasitasTerpakai(tanggal, kapasitas.jenis_pekerjaan)
    const sisaKapasitas = kapasitas.kapasitas_menit_hari - terpakai

    if (sisaKapasitas <= 0) {
      tanggal = nextHariKerja(tanggal, kapasitas.hari_kerja)
      continue
    }

    const maxQtyHariIni = Math.floor(sisaKapasitas / komponen.menit_per_pcs)

    if (maxQtyHariIni <= 0) {
      tanggal = nextHariKerja(tanggal, kapasitas.hari_kerja)
      continue
    }

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

    sisaQty -= qtyHariIni
    urutan++

    if (sisaQty > 0) {
      tanggal = nextHariKerja(tanggal, kapasitas.hari_kerja)
    }

    if (urutan > 60) break
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

    const { data: kapData } = await supabase
      .from('fcs_kapasitas_pekerjaan')
      .select('*')
      .eq('jenis_pekerjaan', jenisPekerjaan)
      .eq('is_active', true)
      .single()

    if (!kapData) return { success: false, count: 0, error: 'Kapasitas pekerjaan tidak ditemukan' }

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

    await supabase
      .from('fcs_schedule')
      .delete()
      .eq('wo_id', woId)
      .eq('panel_id', panelId)
      .eq('jenis_pekerjaan', jenisPekerjaan)
      .eq('status', 'planning')

    const kebutuhan: KomponenKebutuhan[] = []
    for (const [kode, cl] of Object.entries(checklist)) {
      const qty = cl.qty || 0
      if (qty <= 0) continue
      const pt = processTimeMap[kode]
      if (!pt || pt.menit_per_pcs <= 0) continue
      kebutuhan.push({ kode_komponen: kode, nama_komponen: pt.nama_komponen, wp: pt.wp, qty_total: qty, menit_per_pcs: pt.menit_per_pcs })
    }

    if (kebutuhan.length === 0) return { success: false, count: 0, error: 'Tidak ada komponen dengan qty > 0 dan process time terdefinisi' }

    kebutuhan.sort((a, b) => a.wp.localeCompare(b.wp) || a.kode_komponen.localeCompare(b.kode_komponen))

    const allItems: FCSScheduleItem[] = []
    const woInfo = { wo_id: woId, wo_number: woNumber, proyek, panel_id: panelId, panel_nama: panelNama, tipe_panel: tipePanel }

    for (const komp of kebutuhan) {
      const items = await generateFCSForKomponen(komp, tanggalMulai, kapData, woInfo, generatedBy)
      allItems.push(...items)
    }

    if (allItems.length === 0) return { success: false, count: 0, error: 'Tidak ada jadwal yang berhasil digenerate' }

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
"""

with open(target, "w", encoding="utf-8") as f:
    f.write(content)

print(f"[OK] fcsService.ts berhasil dibuat di: {target}")
