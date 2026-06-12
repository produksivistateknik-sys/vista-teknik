target = r"C:\Users\User\vista-teknik\src\services\fcsService.ts"

with open(target, "r", encoding="utf-8") as f:
    content = f.read()

OLD = """      const { error } = await supabase
        .from('raw_schedule')
        .update({
          schedule: newSchedule,
          updated_by: syncBy,
        })
        .eq('id', rawRow.id)"""

NEW = """      const { error } = await supabase
        .from('raw_schedule')
        .update({
          schedule: newSchedule,
        })
        .eq('id', rawRow.id)"""

if OLD in content:
    content = content.replace(OLD, NEW)
    with open(target, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] updated_by dihapus dari sync function")
else:
    print("[MISSING] Pattern tidak ditemukan")
