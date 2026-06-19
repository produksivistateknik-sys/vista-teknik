file_path = r"C:\Users\User\vista-teknik\src\services\fcsService.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_sync_wajib_manual", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = """      let finalRawRow = rawRow

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

NEW = """      const finalRawRow = rawRow

      if (!finalRawRow) {
        // Panel ini belum ditambahkan ke Raw Schedule (planner belum klik "+ Tambah Panel")
        // JANGAN auto-create dan JANGAN hapus data FCS - biarkan tetap di FCS Schedule untuk sync ulang nanti
        const sampleFcsRow = fcsData.find((r: any) => r.panel_id === panelId)
        skippedPanels.push(sampleFcsRow?.panel_nama || `panel_id ${panelId}`)
        continue
      }"""

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

# Tambah deklarasi skippedPanels di awal fungsi (setelah let updatedCount = 0)
OLD_INIT = "    let updatedCount = 0"
NEW_INIT = "    let updatedCount = 0\n    const skippedPanels: string[] = []"
count_init = content.count(OLD_INIT)
print(f"  INIT occurrences: {count_init}")

# Update return value untuk include info skipped
OLD_RETURN = "    return { success: true, updated: updatedCount }"
NEW_RETURN = """    if (skippedPanels.length > 0 && updatedCount === 0) {
      return { success: false, updated: 0, error: `Panel belum ditambahkan ke Raw Schedule: ${skippedPanels.join(', ')}. Klik "+ Tambah Panel" dulu sebelum sync.` }
    }
    if (skippedPanels.length > 0) {
      return { success: true, updated: updatedCount, error: `Sebagian berhasil. Panel yang dilewati (belum di Tambah Panel): ${skippedPanels.join(', ')}` }
    }
    return { success: true, updated: updatedCount }"""
count_return = content.count(OLD_RETURN)
print(f"  RETURN occurrences: {count_return}")

if count == 1 and count_init == 1 and count_return == 1:
    content = content.replace(OLD, NEW, 1)
    content = content.replace(OLD_INIT, NEW_INIT, 1)
    content = content.replace(OLD_RETURN, NEW_RETURN, 1)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Sync sekarang WAJIB raw_schedule sudah ada (tidak auto-create), data FCS aman jika panel belum ditambah manual")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Ada pattern yang tidak sesuai ekspektasi, TIDAK menyimpan apapun")
