file_path = r"C:\Users\User\vista-teknik\src\services\fcsService.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_hapus_fcs_sync", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = """      const { error } = await supabase
        .from('raw_schedule')
        .update({ schedule: mergedSchedule })
        .eq('id', finalRawRow.id)

      if (!error) updatedCount++
    }

    return { success: true, updated: updatedCount }"""

NEW = """      const { error } = await supabase
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

    return { success: true, updated: updatedCount }"""

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Data FCS dihapus per-panel setelah berhasil sync ke Raw Schedule")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
