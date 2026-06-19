file_path = r"C:\Users\User\vista-teknik\src\services\fcsService.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_mark_synced", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = """      if (!error) {
        updatedCount++
        // Hapus data FCS untuk panel ini setelah berhasil sync - Raw Schedule jadi sumber kebenaran
        await supabase
          .from('fcs_schedule')
          .delete()
          .eq('wo_number', woNumber)
          .eq('panel_id', panelId)
          .eq('jenis_pekerjaan', jenisPekerjaan)
      }"""

NEW = """      if (!error) {
        updatedCount++
        // Hapus data FCS untuk panel ini setelah berhasil sync - Raw Schedule jadi sumber kebenaran
        await supabase
          .from('fcs_schedule')
          .delete()
          .eq('wo_number', woNumber)
          .eq('panel_id', panelId)
          .eq('jenis_pekerjaan', jenisPekerjaan)

        // Tandai bahwa panel+proses ini sudah pernah lewat FCS (untuk filter dropdown Tambah Panel)
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
      }"""

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Panel ditandai synced_proses setelah berhasil sync")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
