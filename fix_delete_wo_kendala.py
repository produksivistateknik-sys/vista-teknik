file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_del_kendala", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = """  // 1. Ambil panel ids
  const panelIds=(woToDelete?.panels||[]).map((p:any)=>p.id);
  // 2. Hapus kendala terkait panel
  if(panelIds.length){
    await supabase.from('kendala').delete().in('panel_id',panelIds);
  }
  // 3. Hapus renhar terkait wo"""

NEW = """  // 1. Ambil panel ids
  const panelIds=(woToDelete?.panels||[]).map((p:any)=>p.id);
  // 2. (kendala tidak terikat panel_id, skip)
  // 3. Hapus renhar terkait wo"""

ok = OLD in content
print(f"  PATTERN: {'FOUND' if ok else 'MISSING'}")

if ok:
    content = content.replace(OLD, NEW)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Query kendala panel_id yang error dihapus")
    print("[INFO] Jalankan: npm run build")
