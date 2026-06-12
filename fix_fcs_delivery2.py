file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_fcs_delivery3", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix: Tambah woData sebagai dependency useEffect fetchAll
OLD_EFFECT = "  useEffect(()=>{fetchAll();},[filterPekerjaan]);"
NEW_EFFECT = "  useEffect(()=>{fetchAll();},[filterPekerjaan,woData]);"

ok = OLD_EFFECT in content
print(f"  EFFECT: {'FOUND' if ok else 'MISSING'}")

if ok:
    content = content.replace(OLD_EFFECT, NEW_EFFECT)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] woData ditambah sebagai dependency useEffect")
    print("[INFO] Jalankan: npm run build")
else:
    lines = content.split("\n")
    for i,l in enumerate(lines):
        if 'fetchAll' in l and 'useEffect' in l and 'filterPekerjaan' in l:
            print(f"EFFECT baris {i+1}: {repr(l)}")
