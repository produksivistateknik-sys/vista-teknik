file_path = r"C:\Users\User\vista-teknik\src\services\fcsService.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_sync_merge", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = """      if (!finalRawRow) continue

      const newSchedule: Record<string, Array<{ wp: string; komponen: string[] }>> = {}

      for (const [tanggal, wpMap] of Object.entries(tanggalMap)) {
        newSchedule[tanggal] = []
        for (const [wp, komponen] of Object.entries(wpMap)) {
          newSchedule[tanggal].push({ wp, komponen })
        }
      }

      const { error } = await supabase
        .from('raw_schedule')
        .update({ schedule: newSchedule })
        .eq('id', finalRawRow.id)"""

NEW = """      if (!finalRawRow) continue

      // Merge dengan schedule existing (jangan timpa total, gabung unik per WP per tanggal)
      const existingSchedule: Record<string, Array<{ wp: string; komponen: string[] }>> = finalRawRow.schedule || {}
      const mergedSchedule: Record<string, Array<{ wp: string; komponen: string[] }>> = {}

      // Mulai dari existing (deep copy)
      for (const [tgl, entries] of Object.entries(existingSchedule)) {
        mergedSchedule[tgl] = entries.map(e => ({ wp: e.wp, komponen: [...e.komponen] }))
      }

      // Gabung data baru dari FCS
      for (const [tanggal, wpMap] of Object.entries(tanggalMap)) {
        if (!mergedSchedule[tanggal]) mergedSchedule[tanggal] = []
        for (const [wp, komponenBaru] of Object.entries(wpMap)) {
          const existingEntry = mergedSchedule[tanggal].find(e => e.wp === wp)
          if (existingEntry) {
            // Set union: tambah komponen baru yang belum ada
            const setKomponen = new Set([...existingEntry.komponen, ...komponenBaru])
            existingEntry.komponen = Array.from(setKomponen)
          } else {
            mergedSchedule[tanggal].push({ wp, komponen: [...komponenBaru] })
          }
        }
      }

      const { error } = await supabase
        .from('raw_schedule')
        .update({ schedule: mergedSchedule })
        .eq('id', finalRawRow.id)"""

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Sync sekarang MERGE dengan data existing (set union per WP per tanggal), tidak timpa total lagi")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
