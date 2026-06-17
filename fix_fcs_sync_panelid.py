target = r"C:\Users\User\vista-teknik\src\services\fcsService.ts"

with open(target, "r", encoding="utf-8") as f:
    content = f.read()

OLD = """      // Cari raw_schedule yang sesuai
      const { data: rawRow } = await supabase
        .from('raw_schedule')
        .select('id, schedule')
        .eq('panel_id', panelId)
        .eq('proses', jenisPekerjaan)
        .single()"""

NEW = """      // Cari raw_schedule yang sesuai - cari by wo_id + proses
      const { data: woRow } = await supabase
        .from('work_orders')
        .select('id')
        .eq('wo', woNumber)
        .single()
      
      if (!woRow) continue

      const { data: rawRow } = await supabase
        .from('raw_schedule')
        .select('id, schedule')
        .eq('wo_id', woRow.id)
        .eq('panel_id', panelId)
        .eq('proses', jenisPekerjaan)
        .maybeSingle()
      
      // Kalau tidak ketemu by panel_id, coba cari by wo_id + proses saja
      const finalRawRow = rawRow || (await supabase
        .from('raw_schedule')
        .select('id, schedule')
        .eq('wo_id', woRow.id)
        .eq('proses', jenisPekerjaan)
        .maybeSingle()
      ).data"""

ok = OLD in content
print(f"  PATTERN: {'FOUND' if ok else 'MISSING'}")

if ok:
    content = content.replace(OLD, NEW)
    # Fix juga rawRow reference setelahnya
    content = content.replace(
        "      if (!rawRow) continue",
        "      if (!finalRawRow) continue"
    )
    content = content.replace(
        "        .eq('id', rawRow.id)",
        "        .eq('id', finalRawRow.id)"
    )
    with open(target, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Fix panel_id mismatch di syncFCSToRawSchedule")
else:
    # Debug
    lines = content.split("\n")
    for i,l in enumerate(lines):
        if 'panel_id' in l and 'raw_schedule' in l:
            print(f"  baris {i+1}: {repr(l[:80])}")
