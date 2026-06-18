file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_wo_edit2", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = "setForm({wo:wo.wo,proyek:wo.proyek,target:wo.target});setPanels(wo.panels.map(p=>({noPnl:p.noPnl,nama:p.nama,tipe:p.tipe,qty:p.qty})));setEditId(wo.id);setOpen(true);"
NEW = "setForm({wo:wo.wo,proyek:wo.proyek,target:wo.target});setPanels((wo.panels||[]).map(p=>({noPnl:p.noPnl,nama:p.nama,tipe:p.tipe,qty:p.qty})));setEditId(wo.id);setOpen(true);"

ok = OLD in content
print(f"  PATTERN: {'FOUND' if ok else 'MISSING'}")

if ok:
    content = content.replace(OLD, NEW)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Fix wo.panels||[] berhasil diterapkan ulang")
    print("[INFO] Jalankan: npm run build")
