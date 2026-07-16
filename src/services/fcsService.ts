import { supabase } from '../lib/supabase'
import { KOMPONEN_PROSES_MAP } from '../App'

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

// ===== WIRING CONTROL/WIRING POWER: Register panel tanpa bobot (bobot diatur di FCS Schedule) =====
export async function generateFCSWiring(params: {
  woId: number
  woNumber: string
  proyek: string
  panelId: number
  panelNama: string
  tipePanel: string
  jenisPekerjaan: string
  wp?: string
  tanggalMulai: string
  generatedBy: string
}): Promise<{ success: boolean; count: number; error?: string }> {
  const { woId, woNumber, proyek, panelId, panelNama, tipePanel, jenisPekerjaan, tanggalMulai, generatedBy } = params
  const wpTarget = params.wp || 'WP1'
  try {
    await supabase
      .from('fcs_schedule')
      .delete()
      .eq('wo_id', woId)
      .eq('panel_id', panelId)
      .eq('jenis_pekerjaan', jenisPekerjaan)
      .eq('wp', wpTarget)
    const { error } = await supabase.from('fcs_schedule').insert([{
      wo_id: woId,
      wo_number: woNumber,
      proyek,
      panel_id: panelId,
      panel_nama: panelNama,
      tipe_panel: tipePanel,
      kode_komponen: 'MEDIUM',
      nama_komponen: 'Wiring (belum dijadwalkan)',
      wp: wpTarget,
      jenis_pekerjaan: jenisPekerjaan,
      tanggal: tanggalMulai,
      qty_total: 1,
      qty_hari: 1,
      menit_per_pcs: 0,
      total_menit: 1,
      status: 'planning',
      urutan: 1,
      generated_by: generatedBy,
    }])
    if (error) return { success: false, count: 0, error: error.message }
    return { success: true, count: 1 }
  } catch (err: any) {
    return { success: false, count: 0, error: err.message }
  }
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

    // Deteksi apakah proses ini wiring (satuan orang, bukan komponen)
    const isWiringProses = ['WIRING CONTROL', 'WIRING POWER'].includes(jenisPekerjaan)

    // Untuk wiring: ambil checklist tiap panel biar bisa sisipin komponen REAL (filter KOMPONEN_PROSES_MAP)
    // di samping token bobot - biar operator bisa milih & tracking progress per-komponen asli.
    let panelChecklistMap: Record<number, any> = {}
    if (isWiringProses) {
      const wiringPanelIds = [...new Set(fcsData.map((r: any) => r.panel_id))]
      const { data: panelsData } = await supabase
        .from('panels')
        .select('id, checklist')
        .in('id', wiringPanelIds)
      ;(panelsData || []).forEach((p: any) => {
        panelChecklistMap[p.id] = p.checklist || {}
      })
    }

    let prosesRelevanSet = new Set<string>()
    let prosesRelevanHasMapping = new Set<string>()
    if (isWiringProses) {
      const { data: relevanData } = await supabase.from('bom_proses_relevan').select('*')
      ;(relevanData || []).forEach((r: any) => {
        prosesRelevanSet.add(r.kode_komponen + '|' + r.tipe_panel + '|' + r.jenis_pekerjaan)
        prosesRelevanHasMapping.add(r.kode_komponen + '|' + r.tipe_panel)
      })
    }

    fcsData.forEach((row: any) => {
      if (selectedWP && selectedWP.length > 0 && !selectedWP.includes(row.wp)) return
      const panelId = row.panel_id
      const tanggal = row.tanggal
      const wp = row.wp
      // Untuk wiring: simpan sebagai token khusus __wiring_{org}org_{bobot}
      const kode = isWiringProses
        ? `__wiring_${row.qty_hari}org_${row.kode_komponen}`
        : row.kode_komponen

      if (!panelScheduleMap[panelId]) panelScheduleMap[panelId] = {}
      if (!panelScheduleMap[panelId][tanggal]) panelScheduleMap[panelId][tanggal] = {}
      if (!panelScheduleMap[panelId][tanggal][wp]) panelScheduleMap[panelId][tanggal][wp] = []
      panelScheduleMap[panelId][tanggal][wp].push(kode)

      // Untuk wiring: ikutan push komponen REAL (bukan cuma token) biar operator bisa
      // milih & tracking progress per-komponen di Vista Pekerja
      if (isWiringProses) {
        const checklist = panelChecklistMap[panelId] || {}
        const tipePanelBaris = row.tipe_panel || ''
        Object.entries(checklist).forEach(([kodeKomp, clVal]: any) => {
          const mapKey = kodeKomp + '|' + tipePanelBaris
          let isRelevantKomp: boolean
          if (prosesRelevanHasMapping.has(mapKey)) {
            isRelevantKomp = prosesRelevanSet.has(kodeKomp + '|' + tipePanelBaris + '|' + jenisPekerjaan)
          } else {
            const prosesKomp = KOMPONEN_PROSES_MAP[kodeKomp] || []
            isRelevantKomp = prosesKomp.includes(jenisPekerjaan)
          }
          if (!isRelevantKomp) return
          if ((clVal?.qty || 0) <= 0) return
          if (!panelScheduleMap[panelId][tanggal][wp].includes(kodeKomp)) {
            panelScheduleMap[panelId][tanggal][wp].push(kodeKomp)
          }
        })
      }
    })

    let updatedCount = 0
    const skippedPanels: string[] = []

    for (const [panelIdStr, tanggalMap] of Object.entries(panelScheduleMap)) {
      const panelId = Number(panelIdStr)

      const { data: panelRowForSync } = await supabase
        .from('panels')
        .select('wo_id')
        .eq('id', panelId)
        .single()
      if (!panelRowForSync) continue
      const { data: woRow } = await supabase
        .from('work_orders')
        .select('id, proyek')
        .eq('id', panelRowForSync.wo_id)
        .single()
      if (!woRow) continue

      const { data: rawRow } = await supabase
        .from('raw_schedule')
        .select('id, schedule')
        .eq('wo_id', woRow.id)
        .eq('panel_id', panelId)
        .eq('proses', jenisPekerjaan)
        .maybeSingle()

      let finalRawRow = rawRow
      if (!finalRawRow) {
        const sampleFcsRow = fcsData.find((r: any) => r.panel_id === panelId)
        const initSchedule: Record<string, Array<{ wp: string; komponen: string[] }>> = {}
        for (const [tglInit, wpMapInit] of Object.entries(tanggalMap)) {
          initSchedule[tglInit] = Object.entries(wpMapInit).map(([wp, komp]) => ({ wp, komponen: [...(komp as string[])] }))
        }
        const { data: newRawRow, error: createErr } = await supabase
          .from('raw_schedule')
          .insert({
            wo_id: woRow.id,
            panel_id: panelId,
            proyek: (woRow as any).proyek || '',
            panel: sampleFcsRow?.panel_nama || '',
            proses: jenisPekerjaan,
            prioritas: 'Sedang',
            schedule: initSchedule,
          })
          .select('id, schedule')
          .single()
        if (createErr || !newRawRow) {
          skippedPanels.push(sampleFcsRow?.panel_nama || `panel_id ${panelId}`)
          continue
        }
        updatedCount++
        await supabase
          .from('fcs_schedule')
          .update({ status: 'synced' })
          .eq('wo_number', woNumber)
          .eq('panel_id', panelId)
          .eq('jenis_pekerjaan', jenisPekerjaan)
        continue
      }

      // Merge dengan schedule existing (jangan timpa total, gabung unik per WP per tanggal)
      const existingSchedule: Record<string, Array<{ wp: string; komponen: string[] }>> = finalRawRow.schedule || {}
      const mergedSchedule: Record<string, Array<{ wp: string; komponen: string[] }>> = {}
      for (const [tgl, entries] of Object.entries(existingSchedule)) {
        mergedSchedule[tgl] = entries.map(e => ({ wp: e.wp, komponen: [...e.komponen] }))
      }
      const wpYangDiSync = new Set<string>()
      for (const wpMap of Object.values(tanggalMap)) {
        Object.keys(wpMap).forEach(wp => wpYangDiSync.add(wp))
      }
      for (const tgl of Object.keys(mergedSchedule)) {
        mergedSchedule[tgl] = mergedSchedule[tgl].filter(e => !wpYangDiSync.has(e.wp))
      }
      for (const [tanggal, wpMap] of Object.entries(tanggalMap)) {
        if (!mergedSchedule[tanggal]) mergedSchedule[tanggal] = []
        for (const [wp, komponenBaru] of Object.entries(wpMap)) {
          const existingEntry = mergedSchedule[tanggal].find(e => e.wp === wp)
          if (existingEntry) {
            const setKomponen = new Set([...existingEntry.komponen, ...komponenBaru])
            existingEntry.komponen = Array.from(setKomponen)
          } else {
            mergedSchedule[tanggal].push({ wp, komponen: [...komponenBaru] })
          }
        }
      }
      for (const tgl of Object.keys(mergedSchedule)) {
        if (mergedSchedule[tgl].length === 0) delete mergedSchedule[tgl]
      }

      const { error } = await supabase
        .from('raw_schedule')
        .update({ schedule: mergedSchedule })
        .eq('id', finalRawRow.id)

      if (!error) {
        updatedCount++
        // Update status FCS jadi 'synced' setelah berhasil sync ke Raw Schedule
        // TIDAK dihapus supaya panel tetap muncul di FCS Schedule sebagai tanda sudah di-sync
        await supabase
          .from('fcs_schedule')
          .update({ status: 'synced' })
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
    .select('id, wo_id, panel_id, schedule')
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

    const { data: existingOv } = await supabase.from('fcs_kapasitas_override')
      .select('id').eq('tanggal', tanggal).eq('jenis_pekerjaan', jenisPekerjaan).maybeSingle()
    const ovPayload: any = isOrang
      ? { tanggal, jenis_pekerjaan: jenisPekerjaan, tipe_kapasitas: 'orang', jumlah_orang: Number(jumlahOrang) || 0, created_by: createdBy }
      : { tanggal, jenis_pekerjaan: jenisPekerjaan, tipe_kapasitas: 'jam', jam_kerja: (Number(kapasitasMenit) || 0) / 60, efektivitas_pct: 100, created_by: createdBy }
    if (existingOv) {
      await supabase.from('fcs_kapasitas_override').update(ovPayload).eq('id', existingOv.id)
    } else {
      await supabase.from('fcs_kapasitas_override').insert(ovPayload)
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
      .select('id, wo_id, panel_id, panel, proyek, proses, schedule')
      .eq('proses', jenisPekerjaan)

    const panelIds = [...new Set((rawRows || []).map((r: any) => r.panel_id).filter(Boolean))]
    const { data: panelRows } = await supabase.from('panels')
      .select('id, nama, tipe, checklist').in('id', panelIds.length > 0 ? panelIds : [-1])
    const panelMap: Record<number, any> = {}
    ;(panelRows || []).forEach((p: any) => { panelMap[p.id] = p })

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
          const orangMap: Record<string, number> = entry.orangPerKomponen || {}
          for (const kode of (entry.komponen || [])) {
            const orang = orangMap[kode] !== undefined ? orangMap[kode] : 1
            const progress = panel.checklist?.[kode]?.progress?.[jenisPekerjaan] || 0
            if (progress >= 100) continue
            bebanTotal += orang
            itemsHariIni.push({
              rawId: row.id, wp: entry.wp, kode, beban: orang,
              namaKomponen: kode, panelNama: panel.nama, proyek: row.proyek, woNumber: woInfo.wo, woTarget: woInfo.target,
              orangPerKomponen: orang,
            })
          }
        } else {
          for (const kode of (entry.komponen || [])) {
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
            const orangMap: Record<string, number> = entry.orangPerKomponen || {}
            for (const kode of (entry.komponen || [])) {
              total += orangMap[kode] !== undefined ? orangMap[kode] : 1
            }
          } else {
            for (const kode of (entry.komponen || [])) {
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
      let overflow = false
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
        tujuan = addDays(tanggal, 60)
        overflow = true
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
        overflow,
      })
    }

    for (const rawIdStr of Object.keys(mutasi)) {
      const rawId = Number(rawIdStr)
      await supabase.from('raw_schedule').update({ schedule: mutasi[rawId] }).eq('id', rawId)
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
  wo: any, panel: any, proses: string, tanggal: string, wp: string, komponenList: string[]
) {
  const { data: existing } = await supabase
    .from('raw_schedule')
    .select('id, schedule')
    .eq('wo_id', wo.id)
    .eq('panel_id', panel.id)
    .eq('proses', proses)
    .maybeSingle()
  if (existing) {
    const schedule = existing.schedule || {}
    if (!schedule[tanggal]) schedule[tanggal] = []
    const existingEntry = schedule[tanggal].find((e: any) => e.wp === wp)
    if (existingEntry) {
      const setKomp = new Set([...existingEntry.komponen, ...komponenList])
      existingEntry.komponen = Array.from(setKomp)
    } else {
      schedule[tanggal].push({ wp, komponen: komponenList })
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
      schedule: { [tanggal]: [{ wp, komponen: komponenList }] },
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
  _generatedBy: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const { data: wo } = await supabase.from('work_orders').select('*').eq('id', woId).single()
    if (!wo) return { success: false, count: 0, error: 'WO tidak ditemukan' }
    const { data: panels } = await supabase.from('panels').select('*').eq('wo_id', woId)
    if (!panels || panels.length === 0) return { success: false, count: 0, error: 'Tidak ada panel di WO ini' }

    const panelIdsForCheck = panels.map((p: any) => p.id)
    const { data: existingCheck } = await supabase.from('raw_schedule').select('id').in('panel_id', panelIdsForCheck).limit(1)
    if (existingCheck && existingCheck.length > 0 && !_generatedBy.startsWith('__force__')) {
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

    const { data: existingRaw } = await supabase.from('raw_schedule').select('*')

    const ALL_PROSES_LIST = ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"]
    const WIRING_LIST = ["WIRING CONTROL","WIRING POWER"]

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
            const p = (panels as any[]).find((pp: any) => pp.id === row.panel_id)
            const tipe = p ? p.tipe : tipeSet[0]
            const menit = menitMap[tipe + '|' + kode + '|' + row.proses] || 0
            const key = tgl + '|' + row.proses
            terpakaiTracker[key] = (terpakaiTracker[key] || 0) + menit
          })
        })
      })
    })

    let count = 0
    const scheduledOk = new Set<string>()
    const getRelevantProsesUrut = (kode: string, tipe: string) => ALL_PROSES_LIST.filter((pr) => {
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

      for (const prosesSkeleton of ALL_PROSES_LIST) {
        const adaRelevan = activeKodes.some((kode) => {
          const mapKey = kode + '|' + panel.tipe
          if (hasMappingSet.has(mapKey)) return relevanSet.has(kode + '|' + panel.tipe + '|' + prosesSkeleton)
          return false
        })
        if (adaRelevan) await ensureSkeletonRow(wo, panel, prosesSkeleton)
      }

      for (const proses of ALL_PROSES_LIST) {
        if (WIRING_LIST.includes(proses)) continue

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

        for (const [wp, kodes] of Object.entries(wpGroups)) {
          const getKapasitas = (tgl: string) => {
            const k = kapMap[tgl + '|' + proses]
            return k ? Number(k.kapasitas_menit) || 0 : 0
          }
          let cur = tanggalMulai
          let attempts = 0
          while (attempts < 21 && getKapasitas(cur) <= 0) { cur = addDaysStr(cur, 1); attempts++ }

          let sisaKodes = [...kodes]
          let dayAttempts = 0
          while (sisaKodes.length > 0 && dayAttempts < 21) {
            const kap = getKapasitas(cur)
            const terpakai = terpakaiTracker[cur + '|' + proses] || 0
            let sisaKap = kap - terpakai
            const kodeHariIni: string[] = []
            const sisaBerikutnya: string[] = []
            for (const kode of sisaKodes) {
              const menit = menitMap[panel.tipe + '|' + kode + '|' + proses] || 0
              if (menit > 0 && sisaKap >= menit) {
                kodeHariIni.push(kode)
                sisaKap -= menit
                terpakaiTracker[cur + '|' + proses] = (terpakaiTracker[cur + '|' + proses] || 0) + menit
              } else {
                sisaBerikutnya.push(kode)
              }
            }
            if (kodeHariIni.length > 0) {
              await upsertRawScheduleEntry(wo, panel, proses, cur, wp, kodeHariIni)
              kodeHariIni.forEach((kd) => scheduledOk.add(panel.id + '|' + kd + '|' + proses))
              count++
            }
            sisaKodes = sisaBerikutnya
            if (sisaKodes.length > 0) {
              cur = addDaysStr(cur, 1)
              let skip = 0
              while (skip < 14 && getKapasitas(cur) <= 0) { cur = addDaysStr(cur, 1); skip++ }
            }
            dayAttempts++
          }
          if (sisaKodes.length > 0) {
            console.warn(`Kapasitas ${proses} penuh terus dalam 21 hari, ${sisaKodes.length} komponen di WP ${wp} panel ${panel.nama} belum kejadwal - atur manual lewat klik cell.`)
          }
        }
      }
    }

    const terpakaiOrangTracker: Record<string, number> = {}
    ;(existingRaw || []).forEach((row: any) => {
      if (!WIRING_LIST.includes(row.proses)) return
      const schedule = row.schedule || {}
      Object.entries(schedule).forEach(([tgl, entries]: any) => {
        ;(entries as any[]).forEach((e: any) => {
          const token = (e.komponen || []).find((k: string) => k.startsWith('__wiring_'))
          if (token) {
            const m = token.match(/^__wiring_(\d+)org_/)
            const orang = m ? parseInt(m[1], 10) : 0
            const key = tgl + '|' + row.proses
            terpakaiOrangTracker[key] = (terpakaiOrangTracker[key] || 0) + orang
          }
        })
      })
    })

    const getKapOrang = (tgl: string, proses: string) => {
      const k = kapMap[tgl + '|' + proses]
      return k ? Number(k.jumlah_orang) || 0 : 0
    }

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

        for (const [wp, kodes] of Object.entries(wpGroups)) {
          const jumlahOrang = 1
          const bobotHariDefault = 2
          const totalHari = Math.ceil(bobotHariDefault / jumlahOrang)

          let cur = tanggalMulai
          let attempts = 0
          while (attempts < 21) {
            const sisaAwal = getKapOrang(cur, proses) - (terpakaiOrangTracker[cur + '|' + proses] || 0)
            if (sisaAwal >= jumlahOrang) break
            cur = addDaysStr(cur, 1)
            attempts++
          }

          let hariTerisi = 0
          let dayAttempts = 0
          while (hariTerisi < totalHari && dayAttempts < 21) {
            const sisa = getKapOrang(cur, proses) - (terpakaiOrangTracker[cur + '|' + proses] || 0)
            if (sisa >= jumlahOrang) {
              const token = `__wiring_${jumlahOrang}org_MEDIUM`
              await upsertRawScheduleEntry(wo, panel, proses, cur, wp, [token, ...kodes])
              terpakaiOrangTracker[cur + '|' + proses] = (terpakaiOrangTracker[cur + '|' + proses] || 0) + jumlahOrang
              kodes.forEach((kd) => scheduledOk.add(panel.id + '|' + kd + '|' + proses))
              hariTerisi++
              count++
            }
            cur = addDaysStr(cur, 1)
            dayAttempts++
          }
        }
      }
    }

    return { success: true, count }
  } catch (err: any) {
    return { success: false, count: 0, error: err.message }
  }
}
