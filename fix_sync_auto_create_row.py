file_path = r"C:\Users\User\vista-teknik\src\services\fcsService.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_sync_auto_create", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = """      const { data: rawRow } = await supabase
        .from('raw_schedule')
        .select('id, schedule')
        .eq('wo_id', woRow.id)
        .eq('panel_id', panelId)
        .eq('proses', jenisPekerjaan)
        .maybeSingle()

      const finalRawRow = rawRow || (await supabase
        .from('raw_schedule')
        .select('id, schedule')
        .eq('wo_id', woRow.id)
        .eq('proses', jenisPekerjaan)
        .maybeSingle()
      ).data

      if (!finalRawRow) continue"""

NEW = """      const { data: rawRow } = await supabase
        .from('raw_schedule')
        .select('id, schedule')
        .eq('wo_id', woRow.id)
        .eq('panel_id', panelId)
        .eq('proses', jenisPekerjaan)
        .maybeSingle()

      let finalRawRow = rawRow

      if (!finalRawRow) {
        // Baris raw_schedule belum ada untuk panel+proses ini - buat baru otomatis
        // Ambil info proyek dan nama panel dari fcs_schedule yang sedang disync
        const sampleFcsRow = fcsData.find((r: any) => r.panel_id === panelId)
        const { data: created, error: createError } = await supabase
          .from('raw_schedule')
          .insert({
            wo_id: woRow.id,
            panel_id: panelId,
            proyek: sampleFcsRow?.proyek || '',
            panel: sampleFcsRow?.panel_nama || '',
            proses: jenisPekerjaan,
            prioritas: 'Sedang',
            schedule: {},
          })
          .select('id, schedule')
          .single()

        if (createError || !created) continue
        finalRawRow = created
      }

      if (!finalRawRow) continue"""

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Sync sekarang otomatis buat baris raw_schedule baru kalau belum ada (tidak akan kehilangan data lagi)")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
