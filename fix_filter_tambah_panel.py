file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_filter_tambah_panel", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: panelOpts - filter panel yang punya synced_proses tapi belum ada row raw_schedule sama sekali
OLD_PANELOPTS = "  const panelOpts=addForm.woId?woData.find(w=>w.id===Number(addForm.woId))?.panels||[]:[];"

NEW_PANELOPTS = '''  const panelOpts=addForm.woId?(woData.find(w=>w.id===Number(addForm.woId))?.panels||[]).filter((p:any)=>{
    const sudahPunyaRaw=rawData.some((r:any)=>(r.panel_id||r.panelId)===p.id);
    const sudahSyncFCS=(p.synced_proses||[]).length>0;
    return sudahSyncFCS&&!sudahPunyaRaw;
  }):[];'''

ok1 = OLD_PANELOPTS in content
print(f"  PANELOPTS: {'FOUND' if ok1 else 'MISSING'}")

# Fix 2: dropdown WO - filter WO yang punya minimal 1 panel valid (sesuai kriteria panelOpts di atas)
OLD_WO_DROPDOWN = '''                {woData.map(w=><option key={w.id} value={w.id}>WO {w.wo} \u2014 {w.proyek}</option>)}'''

NEW_WO_DROPDOWN = '''                {woData.filter((w:any)=>(w.panels||[]).some((p:any)=>{
                  const sudahPunyaRaw=rawData.some((r:any)=>(r.panel_id||r.panelId)===p.id);
                  const sudahSyncFCS=(p.synced_proses||[]).length>0;
                  return sudahSyncFCS&&!sudahPunyaRaw;
                })).map((w:any)=><option key={w.id} value={w.id}>WO {w.wo} \u2014 {w.proyek}</option>)}'''

ok2 = OLD_WO_DROPDOWN in content
print(f"  WO_DROPDOWN: {'FOUND' if ok2 else 'MISSING'}")

if ok1 and ok2:
    content = content.replace(OLD_PANELOPTS, NEW_PANELOPTS)
    content = content.replace(OLD_WO_DROPDOWN, NEW_WO_DROPDOWN)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Dropdown WO dan Panel sekarang hanya tampilkan yang sudah sync FCS tapi belum ditambah ke Raw Schedule")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Ada pattern MISSING, TIDAK menyimpan apapun")
