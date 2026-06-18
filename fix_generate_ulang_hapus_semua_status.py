file_path = r"C:\Users\User\vista-teknik\src\services\fcsService.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_fix_hapus_semua_status", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = """    // 2. Hapus schedule lama (hanya planning)
    await supabase
      .from('fcs_schedule')
      .delete()
      .eq('wo_id', woId)
      .eq('panel_id', panelId)
      .eq('jenis_pekerjaan', jenisPekerjaan)
      .eq('status', 'planning')"""

NEW = """    // 2. Hapus SEMUA schedule lama untuk panel+proses ini (semua status, termasuk completed)
    // Generate ulang dianggap sumber kebenaran baru - qty/komponen terbaru menggantikan total
    await supabase
      .from('fcs_schedule')
      .delete()
      .eq('wo_id', woId)
      .eq('panel_id', panelId)
      .eq('jenis_pekerjaan', jenisPekerjaan)"""

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Generate ulang sekarang menghapus SEMUA status lama (planning/released/in_progress/completed)")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
