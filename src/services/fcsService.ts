import { supabase } from '../lib/supabase'

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

function addDays(tanggal: string, n: number): string {
  const d = new Date(tanggal)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// Cari tanggal berikutnya (setelah `dari`, exclusive) yang ADA di kapasitasMap dan masih > 0
function nextTanggalDenganKapasitas(dari: string, kapasitasMap: Record<string, number>, batasHari = 60): string | null {
  let cur = dari
  for (let i = 0; i < batasHari; i++) {
    if (kapasitasMap[cur] !== undefined && kapasitasMap[cur] > 0) return cur
    cur = addDays(cur, 1)
  }
  return null
}

// CORE: FCS dengan in-memory capacity tracking, kapasitas dari override per tanggal
function generateFCSBatch(
  komponenList: KomponenKebutuhan[],
  tanggalMulai: string,
  jenisPekerjaan: string,
  kapasitasMap: Record<string, number>, // {tanggal: kapasitas_menit} dari override
  kapasitasTerpakaiAwal: Record<string, number>, // dari DB sebelum generate (WO lain)
  woInfo: { wo_id: number; wo_number: string; proyek: string; panel_id: number; panel_nama: string; tipe_panel: string },
  generatedBy: string
): { items: FCSScheduleItem[]; tanggalHabis: boolean } {
  const result: FCSScheduleItem[] = []
  const kapTracker: Record<string, number> = { ...kapasitasTerpakaiAwal }
  let tanggalHabis = false

  const getKapTerpakai = (tgl: string) => kapTracker[tgl] || 0
  const addKap = (tgl: string, menit: number) => {
    kapTracker[tgl] = (kapTracker[tgl] || 0) + menit
  }

  // Cari tanggal mulai yang valid (ada kapasitas)
  const tanggalAwalValid = kapasitasMap[tanggalMulai] !== undefined && kapasitasMap[tanggalMulai] > 0
    ? tanggalMulai
    : nextTanggalDenganKapasitas(addDays(tanggalMulai, 1), kapasitasMap)

  if (!tanggalAwalValid) {
    return { items: [], tanggalHabis: true }
  }

  // Kelompokkan komponen per WP dan urutkan WP (WP1 -> WP2 -> WP3 -> dst)
  const wpGroups: Record<string, KomponenKebutuhan[]> = {}
  for (const k of komponenList) {
    if (!wpGroups[k.wp]) wpGroups[k.wp] = []
    wpGroups[k.wp].push(k)
  }
  const wpUrutan = Object.keys(wpGroups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  // Setiap WP mulai setelah WP sebelumnya selesai semua
  let tanggalMulaiWP = tanggalAwalValid

  for (const wp of wpUrutan) {
    const komponenWP = wpGroups[wp]
    let tanggalSelesaiWP = tanggalMulaiWP // track tanggal terakhir WP ini dipakai

    for (const komponen of komponenWP) {
      let sisaQty = komponen.qty_total
      let tanggal: string | null = tanggalMulaiWP
      let lastTanggalDipakai: string = tanggalMulaiWP
      let urutan = 1

    while (sisaQty > 0 && tanggal) {
      const kapasitasHari = kapasitasMap[tanggal] || 0
      const terpakai = getKapTerpakai(tanggal)
      const sisaKapasitas = kapasitasHari - terpakai

      if (sisaKapasitas < komponen.menit_per_pcs) {
        const tanggalBerikutnya = nextTanggalDenganKapasitas(addDays(tanggal, 1), kapasitasMap)
        if (!tanggalBerikutnya) {
          // Kapasitas habis di 60 hari ke depan: JANGAN buang sisa qty.
          // Paksa masukkan semua sisa qty ke tanggal terakhir yang sempat dipakai (overflow),
          // supaya komponen tetap muncul di Raw Schedule dan bisa diatur manual oleh planner.
          tanggalHabis = true
          const totalMenitOverflow = sisaQty * komponen.menit_per_pcs
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
            jenis_pekerjaan: jenisPekerjaan,
            tanggal: lastTanggalDipakai,
            qty_total: komponen.qty_total,
            qty_hari: sisaQty,
            menit_per_pcs: komponen.menit_per_pcs,
            total_menit: totalMenitOverflow,
            status: 'planning',
            urutan,
            generated_by: generatedBy,
          })
          addKap(lastTanggalDipakai, totalMenitOverflow)
          sisaQty = 0
          break
        }
        tanggal = tanggalBerikutnya
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
        jenis_pekerjaan: jenisPekerjaan,
        tanggal,
        qty_total: komponen.qty_total,
        qty_hari: qtyHariIni,
        menit_per_pcs: komponen.menit_per_pcs,
        total_menit: totalMenitHariIni,
        status: 'planning',
        urutan,
        generated_by: generatedBy,
      })

      addKap(tanggal, totalMenitHariIni)
      lastTanggalDipakai = tanggal
      // Track tanggal terakhir yang dipakai untuk seluruh WP ini
      if (tanggal > tanggalSelesaiWP) tanggalSelesaiWP = tanggal
      sisaQty -= qtyHariIni
      urutan++

      if (sisaQty > 0) {
        const tanggalBerikutnya = nextTanggalDenganKapasitas(addDays(tanggal, 1), kapasitasMap)
        if (!tanggalBerikutnya) {
          // Sama seperti di atas: kapasitas habis, paksa masukkan sisa qty ke tanggal terakhir
          tanggalHabis = true
          const totalMenitOverflow = sisaQty * komponen.menit_per_pcs
          urutan++
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
            jenis_pekerjaan: jenisPekerjaan,
            tanggal: lastTanggalDipakai,
            qty_total: komponen.qty_total,
            qty_hari: sisaQty,
            menit_per_pcs: komponen.menit_per_pcs,
            total_menit: totalMenitOverflow,
            status: 'planning',
            urutan,
            generated_by: generatedBy,
          })
          addKap(lastTanggalDipakai, totalMenitOverflow)
          if (lastTanggalDipakai > tanggalSelesaiWP) tanggalSelesaiWP = lastTanggalDipakai
          sisaQty = 0
          break
        }
        tanggal = tanggalBerikutnya
      }

      if (urutan > 90) break
    }
    }

    // WP berikutnya mulai di hari SETELAH WP ini selesai semua
    // Cari tanggal valid berikutnya setelah tanggalSelesaiWP
    const tanggalMulaiWPBerikutnya = nextTanggalDenganKapasitas(addDays(tanggalSelesaiWP, 1), kapasitasMap)
    tanggalMulaiWP = tanggalMulaiWPBerikutnya || addDays(tanggalSelesaiWP, 1)
  }

  return { items: result, tanggalHabis }
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
}): Promise<{ success: boolean; count: number; error?: string; tanggalHabis?: boolean }> {
  try {
    const { woId, woNumber, proyek, panelId, panelNama, tipePanel, checklist, jenisPekerjaan, tanggalMulai, generatedBy, selectedKomponen } = params

    // 1. Ambil process time
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

    // 2. Hapus SEMUA schedule lama untuk panel+proses ini (semua status, termasuk completed)
    // Generate ulang dianggap sumber kebenaran baru - qty/komponen terbaru menggantikan total
    await supabase
      .from('fcs_schedule')
      .delete()
      .eq('wo_id', woId)
      .eq('panel_id', panelId)
      .eq('jenis_pekerjaan', jenisPekerjaan)

    // 3. Ambil kapasitas dari OVERRIDE (bukan default lagi), 60 hari ke depan
    const tanggalAkhirCari = addDays(tanggalMulai, 60)
    const { data: overrideData } = await supabase
      .from('fcs_kapasitas_override')
      .select('tanggal, kapasitas_menit')
      .eq('jenis_pekerjaan', jenisPekerjaan)
      .gte('tanggal', tanggalMulai)
      .lte('tanggal', tanggalAkhirCari)

    const kapasitasMap: Record<string, number> = {}
    ;(overrideData || []).forEach((row: any) => {
      kapasitasMap[row.tanggal] = Number(row.kapasitas_menit)
    })

    if (Object.keys(kapasitasMap).length === 0) {
      return {
        success: false, count: 0,
        error: `Tidak ada kapasitas ${jenisPekerjaan} yang diatur dalam 60 hari ke depan dari ${tanggalMulai}. Silakan isi Override Tanggal dulu di System > Kapasitas Pekerjaan.`
      }
    }

    // 4. Ambil kapasitas yang sudah terpakai dari DB (WO lain) di rentang tanggal yang sama
    const { data: existingData } = await supabase
      .from('fcs_schedule')
      .select('tanggal, total_menit')
      .eq('jenis_pekerjaan', jenisPekerjaan)
      .gte('tanggal', tanggalMulai)
      .lte('tanggal', tanggalAkhirCari)
      .neq('status', 'cancelled')

    const kapasitasTerpakaiAwal: Record<string, number> = {}
    if (existingData) {
      existingData.forEach((row: any) => {
        kapasitasTerpakaiAwal[row.tanggal] = (kapasitasTerpakaiAwal[row.tanggal] || 0) + Number(row.total_menit)
      })
    }

    // 5. Hitung kebutuhan komponen (filter berdasarkan selectedKomponen kalau ada)
    const kebutuhan: KomponenKebutuhan[] = []
    for (const [kode, cl] of Object.entries(checklist)) {
      const qty = cl.qty || 0
      if (qty <= 0) continue
      if (selectedKomponen && selectedKomponen.length > 0 && !selectedKomponen.includes(kode)) continue
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

    kebutuhan.sort((a, b) => a.wp.localeCompare(b.wp) || a.kode_komponen.localeCompare(b.kode_komponen))

    // 6. Generate FCS dengan kapasitas dari override
    const woInfo = { wo_id: woId, wo_number: woNumber, proyek, panel_id: panelId, panel_nama: panelNama, tipe_panel: tipePanel }
    const { items: allItems, tanggalHabis } = generateFCSBatch(
      kebutuhan, tanggalMulai, jenisPekerjaan, kapasitasMap, kapasitasTerpakaiAwal, woInfo, generatedBy
    )

    if (allItems.length === 0) {
      return { success: false, count: 0, error: 'Tidak ada jadwal yang berhasil digenerate. Kapasitas mungkin sudah penuh untuk semua tanggal yang diatur.' }
    }

    const { error: insertError } = await supabase.from('fcs_schedule').insert(allItems)
    if (insertError) return { success: false, count: 0, error: insertError.message }

    // Tandai panel ini sudah pernah generate FCS untuk proses ini (untuk filter dropdown Tambah Panel)
    const { data: panelRow } = await supabase
      .from('panels')
      .select('synced_proses')
      .eq('id', panelId)
      .single()
    const currentSynced: string[] = panelRow?.synced_proses || []
    if (!currentSynced.includes(jenisPekerjaan)) {
      await supabase
        .from('panels')
        .update({ synced_proses: [...currentSynced, jenisPekerjaan] })
        .eq('id', panelId)
    }

    if (tanggalHabis) {
      return {
        success: true, count: allItems.length, tanggalHabis: true,
        error: `Sebagian komponen belum terjadwal sepenuhnya - kapasitas ${jenisPekerjaan} belum diatur untuk tanggal setelah jadwal terakhir. Tambahkan Override Tanggal lebih lanjut.`
      }
    }

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
  const [{ data: schedData }, { data: overrideData }] = await Promise.all([
    supabase.from('fcs_schedule').select('tanggal, total_menit').eq('jenis_pekerjaan', jenisPekerjaan).gte('tanggal', tanggalMulai).lte('tanggal', tanggalAkhir).neq('status', 'cancelled'),
    supabase.from('fcs_kapasitas_override').select('tanggal, kapasitas_menit').eq('jenis_pekerjaan', jenisPekerjaan).gte('tanggal', tanggalMulai).lte('tanggal', tanggalAkhir)
  ])

  const kapasitasPerTanggal: Record<string, number> = {}
  ;(overrideData || []).forEach((row: any) => { kapasitasPerTanggal[row.tanggal] = Number(row.kapasitas_menit) })

  const summary: Record<string, { terpakai: number; kapasitas: number; pct: number }> = {}
  if (schedData) {
    schedData.forEach((row: any) => {
      const kap = kapasitasPerTanggal[row.tanggal] || 0
      if (!summary[row.tanggal]) summary[row.tanggal] = { terpakai: 0, kapasitas: kap, pct: 0 }
      summary[row.tanggal].terpakai += Number(row.total_menit)
    })
    Object.keys(summary).forEach(tgl => {
      summary[tgl].pct = summary[tgl].kapasitas > 0 ? Math.round((summary[tgl].terpakai / summary[tgl].kapasitas) * 100) : 0
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
  syncBy: string,
  panelNama?: string | null,
  selectedWP?: string[] | null
): Promise<{ success: boolean; updated: number; error?: string }> {
  try {
    let fcsQuery = supabase
      .from('fcs_schedule')
      .select('*')
      .eq('wo_number', woNumber)
      .eq('jenis_pekerjaan', jenisPekerjaan)
      .neq('status', 'cancelled')
      .order('tanggal', { ascending: true })
    if (panelNama) fcsQuery = (fcsQuery as any).eq('panel_nama', panelNama)
    const { data: fcsData } = await fcsQuery

    if (!fcsData || fcsData.length === 0) {
      return { success: false, updated: 0, error: 'Tidak ada FCS schedule untuk WO ini' }
    }

    const panelScheduleMap: Record<number, Record<string, Record<string, string[]>>> = {}

    fcsData.forEach((row: any) => {
      if (selectedWP && selectedWP.length > 0 && !selectedWP.includes(row.wp)) return
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
    const skippedPanels: string[] = []

    for (const [panelIdStr, tanggalMap] of Object.entries(panelScheduleMap)) {
      const panelId = Number(panelIdStr)

      const { data: woRow } = await supabase
        .from('work_orders')
        .select('id')
        .eq('wo', woNumber)
        .single()

      if (!woRow) continue

      const { data: rawRow } = await supabase
        .from('raw_schedule')
        .select('id, schedule')
        .eq('wo_id', woRow.id)
        .eq('panel_id', panelId)
        .eq('proses', jenisPekerjaan)
        .maybeSingle()

      const finalRawRow = rawRow

      if (!finalRawRow) {
        // Panel ini belum ditambahkan ke Raw Schedule (planner belum klik "+ Tambah Panel")
        // JANGAN auto-create dan JANGAN hapus data FCS - biarkan tetap di FCS Schedule untuk sync ulang nanti
        const sampleFcsRow = fcsData.find((r: any) => r.panel_id === panelId)
        skippedPanels.push(sampleFcsRow?.panel_nama || `panel_id ${panelId}`)
        continue
      }

      // Merge dengan schedule existing (jangan timpa total, gabung unik per WP per tanggal)
      const existingSchedule: Record<string, Array<{ wp: string; komponen: string[] }>> = finalRawRow.schedule || {}
      const mergedSchedule: Record<string, Array<{ wp: string; komponen: string[] }>> = {}

      // Mulai dari existing (deep copy)
      for (const [tgl, entries] of Object.entries(existingSchedule)) {
        mergedSchedule[tgl] = entries.map(e => ({ wp: e.wp, komponen: [...e.komponen] }))
      }

      // Gabung data baru dari FCS
      for (const [tanggal, wpMap] of Object.entries(tanggalMap)) {
        if (!mergedSchedule[tanggal]) mergedSchedule[tanggal] = []
        for (const [wp, komponenBaru] of Object.entries(wpMap)) {
          const existingEntry = mergedSchedule[tanggal].find(e => e.wp === wp)
          if (existingEntry) {
            // Set union: tambah komponen baru yang belum ada
            const setKomponen = new Set([...existingEntry.komponen, ...komponenBaru])
            existingEntry.komponen = Array.from(setKomponen)
          } else {
            mergedSchedule[tanggal].push({ wp, komponen: [...komponenBaru] })
          }
        }
      }

      const { error } = await supabase
        .from('raw_schedule')
        .update({ schedule: mergedSchedule })
        .eq('id', finalRawRow.id)

      if (!error) {
        updatedCount++
        // Hapus data FCS untuk panel ini setelah berhasil sync - Raw Schedule jadi sumber kebenaran
        await supabase
          .from('fcs_schedule')
          .delete()
          .eq('wo_number', woNumber)
          .eq('panel_id', panelId)
          .eq('jenis_pekerjaan', jenisPekerjaan)

      }
    }

    if (skippedPanels.length > 0 && updatedCount === 0) {
      return { success: false, updated: 0, error: `Panel belum ditambahkan ke Raw Schedule: ${skippedPanels.join(', ')}. Klik "+ Tambah Panel" dulu sebelum sync.` }
    }
    if (skippedPanels.length > 0) {
      return { success: true, updated: updatedCount, error: `Sebagian berhasil. Panel yang dilewati (belum di Tambah Panel): ${skippedPanels.join(', ')}` }
    }
    return { success: true, updated: updatedCount }
  } catch (err: any) {
    return { success: false, updated: 0, error: err.message }
  }
}




// ===== v2 FINAL - Swap functions berbasis Raw Schedule (bukan fcs_schedule) =====
// Append ke fcsService.ts, TIDAK menimpa fungsi v1 yang lama

export interface KomponenSwapOptionV2 {
  raw_id: number
  wo_id: number
  wo_number: string
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
    .select('id, wo')
    .in('id', woIds.length > 0 ? woIds : [-1])

  const panelMap: Record<number, any> = {}
  ;(panelRows || []).forEach((p: any) => { panelMap[p.id] = p })

  const woMap: Record<number, string> = {}
  ;(woRows || []).forEach((w: any) => { woMap[w.id] = w.wo })

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

  opsiSwap.sort((a, b) => a.progress - b.progress)

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
        const qty = panel.checklist?.[kode]?.qty || 0
        const menitPcs = ptMap[`${panel.tipe}|${kode}`] || 0
        total += qty * menitPcs
      }
    }
  }
  return total
}

export async function executeSwapKomponenV2(params: {
  items: Array<{ raw_id: number; wp: string; kode_komponen: string; total_menit: number }>
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

    const byRawId: Record<number, Array<{ wp: string; kode_komponen: string }>> = {}
    items.forEach(it => {
      if (!byRawId[it.raw_id]) byRawId[it.raw_id] = []
      byRawId[it.raw_id].push({ wp: it.wp, kode_komponen: it.kode_komponen })
    })

    for (const [rawIdStr, komponenList] of Object.entries(byRawId)) {
      const rawId = Number(rawIdStr)
      const { data: row } = await supabase
        .from('raw_schedule')
        .select('id, schedule')
        .eq('id', rawId)
        .single()

      if (!row) continue

      const schedule = { ...row.schedule }
      const entriesAsal = [...(schedule[tanggalAsal] || [])]

      for (const { wp, kode_komponen } of komponenList) {
        const entryAsal = entriesAsal.find((e: any) => e.wp === wp)
        if (entryAsal) {
          entryAsal.komponen = entryAsal.komponen.filter((k: string) => k !== kode_komponen)
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
    .select('id, wo_id, panel_id, schedule')
    .eq('proses', jenisPekerjaan)

  const woIds = [...new Set((rawRows || []).map((r: any) => r.wo_id).filter(Boolean))]
  const { data: woRows } = await supabase
    .from('work_orders')
    .select('id, wo')
    .in('id', woIds.length > 0 ? woIds : [-1])
  const woMap: Record<number, string> = {}
  ;(woRows || []).forEach((w: any) => { woMap[w.id] = w.wo })

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

  let terpakaiSaatIni = 0
  const opsiSwap: KomponenSwapOptionOrang[] = []

  for (const row of rawRows || []) {
    const entries = row.schedule?.[tanggal] || []
    const panel = panelMap[row.panel_id]
    if (!panel) continue

    for (const entry of entries) {
      if (params.excludeRawId && row.id === params.excludeRawId && params.excludeWp && entry.wp === params.excludeWp) continue
      const orangMap: Record<string, number> = entry.orangPerKomponen || {}
      for (const kode of (entry.komponen || [])) {
        const orang = orangMap[kode] !== undefined ? orangMap[kode] : 1
        const progress = panel.checklist?.[kode]?.progress?.[jenisPekerjaan] || 0
        // Komponen yang sudah 100% selesai TIDAK lagi memakai kuota orang
        if (progress >= 100) continue
        terpakaiSaatIni += orang

        opsiSwap.push({
          raw_id: row.id,
          wo_id: row.wo_id,
          wo_number: woMap[row.wo_id] || '',
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

  opsiSwap.sort((a, b) => a.progress - b.progress)

  return { cukup: false, kuotaHari, terpakaiSaatIni, sisaKuota, opsiSwap }
}

async function hitungTerpakaiOrangRawSchedule(tanggal: string, jenisPekerjaan: string): Promise<number> {
  const { data: rawRows } = await supabase
    .from('raw_schedule')
    .select('schedule')
    .eq('proses', jenisPekerjaan)

  let total = 0
  for (const row of rawRows || []) {
    const entries = row.schedule?.[tanggal] || []
    for (const entry of entries) {
      const orangMap: Record<string, number> = entry.orangPerKomponen || {}
      for (const kode of (entry.komponen || [])) {
        total += (orangMap[kode] !== undefined ? orangMap[kode] : 1)
      }
    }
  }
  return total
}

export async function executeSwapKomponenOrang(params: {
  items: Array<{ raw_id: number; wp: string; kode_komponen: string; jumlah_orang: number }>
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

    const byRawId: Record<number, Array<{ wp: string; kode_komponen: string; jumlah_orang: number }>> = {}
    items.forEach(it => {
      if (!byRawId[it.raw_id]) byRawId[it.raw_id] = []
      byRawId[it.raw_id].push({ wp: it.wp, kode_komponen: it.kode_komponen, jumlah_orang: it.jumlah_orang })
    })

    for (const [rawIdStr, komponenList] of Object.entries(byRawId)) {
      const rawId = Number(rawIdStr)
      const { data: row } = await supabase
        .from('raw_schedule')
        .select('id, schedule')
        .eq('id', rawId)
        .single()

      if (!row) continue

      const schedule = { ...row.schedule }
      const entriesAsal = [...(schedule[tanggalAsal] || [])]

      for (const { wp, kode_komponen } of komponenList) {
        const entryAsal = entriesAsal.find((e: any) => e.wp === wp)
        if (entryAsal) {
          entryAsal.komponen = entryAsal.komponen.filter((k: string) => k !== kode_komponen)
          if (entryAsal.orangPerKomponen) delete entryAsal.orangPerKomponen[kode_komponen]
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
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
