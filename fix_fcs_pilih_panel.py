file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_fcs_pilih_panel", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: Tambah state selectedPanelIds
OLD_STATE = '  const [fcsForm,setFcsForm]=useState({tanggalMulai:new Date().toISOString().slice(0,10),jenisPekerjaan:"POTONG"});'
NEW_STATE = '''  const [fcsForm,setFcsForm]=useState({tanggalMulai:new Date().toISOString().slice(0,10),jenisPekerjaan:"POTONG"});
  const [selectedPanelIds,setSelectedPanelIds]=useState<number[]>([]);'''

# Fix 2: Saat tombol FCS diklik, set selectedPanelIds ke semua panel WO itu (default semua tercentang)
OLD_OPEN = '                <button onClick={()=>{setFcsModal(wo);setFcsResult(null);setFcsForm({tanggalMulai:new Date().toISOString().slice(0,10),jenisPekerjaan:"POTONG"});}}'
NEW_OPEN = '                <button onClick={()=>{setFcsModal(wo);setFcsResult(null);setFcsForm({tanggalMulai:new Date().toISOString().slice(0,10),jenisPekerjaan:"POTONG"});setSelectedPanelIds((wo.panels||[]).map((p:any)=>p.id));}}'

ok1 = OLD_STATE in content
ok2 = OLD_OPEN in content

print(f"  STATE: {'FOUND' if ok1 else 'MISSING'}")
print(f"  OPEN:  {'FOUND' if ok2 else 'MISSING'}")

if ok1 and ok2:
    content = content.replace(OLD_STATE, NEW_STATE)
    content = content.replace(OLD_OPEN, NEW_OPEN)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] State selectedPanelIds berhasil ditambah, default semua panel tercentang saat modal dibuka")
    print("[INFO] Lanjut step 2 untuk UI checkbox dan filter saat generate")
