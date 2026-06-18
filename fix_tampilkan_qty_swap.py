file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_qty_swap", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''                    <div style={{fontSize:10,color:"#94a3b8"}}>WO {o.wo_number} \u00b7 {o.panel_nama} \u00b7 progress {o.progress}% \u00b7 {Math.round(o.total_menit)} menit</div>'''

NEW = '''                    <div style={{fontSize:10,color:"#94a3b8"}}>WO {o.wo_number} \u00b7 {o.panel_nama} \u00b7 {o.qty_hari} pcs \u00b7 progress {o.progress}% \u00b7 {Math.round(o.total_menit)} menit</div>'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Info qty (pcs) berhasil ditambah di modal swap")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
