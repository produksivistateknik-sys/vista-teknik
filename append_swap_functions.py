file_path = r"C:\Users\User\vista-teknik\src\services\fcsService.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_before_swap_functions", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Pastikan tidak ada fungsi dengan nama sama sebelum append (cegah duplikat kalau script dijalankan 2x)
if "checkKapasitasDanKomponenSwap" in content:
    print("[SKIP] Fungsi checkKapasitasDanKomponenSwap sudah ada di file, tidak menambah lagi")
else:
    APPEND_CODE = '''

export interface KomponenSwapOption {
  fcs_id: number
  wo_number: string
  panel_nama: string
  kode_komponen: string
  nama_komponen: string
  qty_hari: number
  total_menit: number
  progress: number
}

export async function checkKapasitasDanKomponenSwap(params: {
  tanggal: string
  jenisPekerjaan: string
  menitDibutuhkan: number
  panelChecklistMap?: Record<number, Record<string, { progress?: Record<string, number> }>>
}): Promise<{
  cukup: boolean
  kapasitasHari: number
  terpakaiSaatIni: number
  sisaKapasitas: number
  opsiSwap: KomponenSwapOption[]
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

  const { data: fcsRows } = await supabase
    .from('fcs_schedule')
    .select('id, wo_number, panel_id, panel_nama, kode_komponen, nama_komponen, qty_hari, total_menit')
    .eq('tanggal', tanggal)
    .eq('jenis_pekerjaan', jenisPekerjaan)
    .neq('status', 'cancelled')

  const rows = fcsRows || []
  const terpakaiSaatIni = rows.reduce((sum, r: any) => sum + Number(r.total_menit), 0)
  const sisaKapasitas = kapasitasHari - terpakaiSaatIni

  if (sisaKapasitas >= menitDibutuhkan) {
    return { cukup: true, kapasitasHari, terpakaiSaatIni, sisaKapasitas, opsiSwap: [] }
  }

  const opsiSwap: KomponenSwapOption[] = rows.map((r: any) => {
    let progress = 0
    const panelCl = params.panelChecklistMap?.[r.panel_id]
    if (panelCl) {
      const cl = panelCl[r.kode_komponen]
      if (cl?.progress) {
        progress = cl.progress[jenisPekerjaan] || 0
      }
    }
    return {
      fcs_id: r.id,
      wo_number: r.wo_number,
      panel_nama: r.panel_nama,
      kode_komponen: r.kode_komponen,
      nama_komponen: r.nama_komponen,
      qty_hari: r.qty_hari,
      total_menit: Number(r.total_menit),
      progress,
    }
  }).sort((a, b) => a.progress - b.progress)

  return { cukup: false, kapasitasHari, terpakaiSaatIni, sisaKapasitas, opsiSwap }
}

export async function executeSwapKomponen(params: {
  fcsIdsToMove: number[]
  jenisPekerjaan: string
  tanggalAsal: string
  generatedBy: string
}): Promise<{ success: boolean; tanggalTujuan: Record<number, string>; error?: string }> {
  const { fcsIdsToMove, jenisPekerjaan, tanggalAsal, generatedBy } = params
  const tanggalTujuan: Record<number, string> = {}

  try {
    for (const fcsId of fcsIdsToMove) {
      const { data: row } = await supabase
        .from('fcs_schedule')
        .select('*')
        .eq('id', fcsId)
        .single()

      if (!row) continue

      let cur = addDays(row.tanggal, 1)
      let found = false
      for (let i = 0; i < 60; i++) {
        const { data: overrideRow } = await supabase
          .from('fcs_kapasitas_override')
          .select('kapasitas_menit')
          .eq('tanggal', cur)
          .eq('jenis_pekerjaan', jenisPekerjaan)
          .maybeSingle()

        if (overrideRow) {
          const kap = Number(overrideRow.kapasitas_menit)
          const { data: existingAtCur } = await supabase
            .from('fcs_schedule')
            .select('total_menit')
            .eq('tanggal', cur)
            .eq('jenis_pekerjaan', jenisPekerjaan)
            .neq('status', 'cancelled')

          const terpakai = (existingAtCur || []).reduce((sum: number, r: any) => sum + Number(r.total_menit), 0)
          if (kap - terpakai >= Number(row.total_menit)) {
            found = true
            break
          }
        }
        cur = addDays(cur, 1)
      }

      if (!found) {
        return { success: false, tanggalTujuan, error: `Tidak ada tanggal tersedia dalam 60 hari untuk memindahkan ${row.nama_komponen}` }
      }

      await supabase
        .from('fcs_schedule')
        .update({ tanggal: cur, generated_by: generatedBy })
        .eq('id', fcsId)

      tanggalTujuan[fcsId] = cur
    }

    return { success: true, tanggalTujuan }
  } catch (err: any) {
    return { success: false, tanggalTujuan, error: err.message }
  }
}
'''
    content = content + APPEND_CODE
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Fungsi checkKapasitasDanKomponenSwap dan executeSwapKomponen berhasil ditambah (append, tidak menimpa apapun)")
    print("[INFO] Jalankan: npm run build")
