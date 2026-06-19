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
    if (params.excludeRawId && row.id === params.excludeRawId) continue
    const entries = row.schedule?.[tanggal] || []
    const panel = panelMap[row.panel_id]
    if (!panel) continue

    for (const entry of entries) {
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
