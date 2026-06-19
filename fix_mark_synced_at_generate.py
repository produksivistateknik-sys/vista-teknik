file_path = r"C:\Users\User\vista-teknik\src\services\fcsService.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_mark_at_generate", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: Tambah penandaan synced_proses di generateFCSSchedule, setelah insert berhasil
OLD_GEN = """    const { error: insertError } = await supabase.from('fcs_schedule').insert(allItems)
    if (insertError) return { success: false, count: 0, error: insertError.message }

    if (tanggalHabis) {"""

NEW_GEN = """    const { error: insertError } = await supabase.from('fcs_schedule').insert(allItems)
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

    if (tanggalHabis) {"""

ok1 = OLD_GEN in content
print(f"  GENERATE_MARK: {'FOUND' if ok1 else 'MISSING'}")

# Fix 2: Hapus logic synced_proses yang lama di syncFCSToRawSchedule (sekarang sudah ditandai di generate, tidak perlu di sync lagi)
OLD_SYNC_MARK = """        // Tandai bahwa panel+proses ini sudah pernah lewat FCS (untuk filter dropdown Tambah Panel)
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

NEW_SYNC_MARK = """      }"""

ok2 = OLD_SYNC_MARK in content
print(f"  SYNC_MARK_REMOVE: {'FOUND' if ok2 else 'MISSING'}")

if ok1 and ok2:
    content = content.replace(OLD_GEN, NEW_GEN, 1)
    content = content.replace(OLD_SYNC_MARK, NEW_SYNC_MARK, 1)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Penandaan synced_proses dipindah ke saat Generate FCS berhasil")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Ada pattern MISSING, TIDAK menyimpan apapun")
