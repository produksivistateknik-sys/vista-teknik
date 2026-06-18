file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_exclude_komponen", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = '''  const wpItemsAll=panelCfg?.wps.find(w=>w.wp===modalWp)?.items||[];
  const wpItems=wpItemsAll.filter(it=>isKomponenRelevant(it.kode,rawRow?.proses||""));'''

NEW = '''  const wpItemsAll=panelCfg?.wps.find(w=>w.wp===modalWp)?.items||[];
  const komponenSudahAda=cellEntries.find(e=>e.wp===modalWp)?.komponen||[];
  const wpItems=wpItemsAll.filter(it=>isKomponenRelevant(it.kode,rawRow?.proses||"")&&!komponenSudahAda.includes(it.kode));'''

count = content.count(OLD)
print(f"  PATTERN occurrences: {count}")

if count == 1:
    content = content.replace(OLD, NEW, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Komponen yang sudah terjadwal di WP ini sekarang di-exclude dari pilihan, tidak bisa dobel")
    print("[INFO] Jalankan: npm run build")
else:
    print(f"[FAIL] PATTERN occurrences = {count}, bukan 1. TIDAK menyimpan apapun")
