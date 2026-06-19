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
    .select('id, nama, checklist')
    .in('id', panelIds.length > 0 ? panelIds : [-1])
  const panelMap: Record<number, any> = {}
  ;(panelRows || []).forEach((p: any) => { panelMap[p.id] = p })

  let terpakaiSaatIni = 0
  const opsiSwap: KomponenSwapOptionOrang[] = []

  for (const row of rawRows || []) {
    if (params.excludeRawId && row.id === params.excludeRawId) continue
    const entries = row.schedule?.[tanggal] || []
    const panel = panelMap[row.panel_id]
    if (!panel) continue

    for (const entry of entries) {
      const orangMap: Record<string, number> = entry.orangPerKomponen || {}
      for (const kode of (entry.komponen || [])) {
        const orang = orangMap[kode] || 0
        if (orang <= 0) continue
        terpakaiSaatIni += orang
        const progress = panel.checklist?.[kode]?.progress?.[jenisPekerjaan] || 0

        opsiSwap.push({
          raw_id: row.id,
          wo_id: row.wo_id,
          wo_number: woMap[row.wo_id] || '',
          panel_id: row.panel_id,
          panel_nama: panel.nama,
          wp: entry.wp,
          kode_komponen: kode,
          nama_komponen: kode,
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
        total += orangMap[kode] || 0
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
