file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix: tambah <> fragment setelah opening ( dan </> sebelum closing )
OLD = """      {invTab===\"data\"&&(

      {/* Form tambah/edit */}
      <Card style={{marginBottom:14}}>"""

NEW = """      {invTab===\"data\"&&(<>
      {/* Form tambah/edit */}
      <Card style={{marginBottom:14}}>"""

# Cari closing form - ada )}\n setelah </Card>
OLD_CLOSE = """      </Card>
      )}"""

NEW_CLOSE = """      </Card>
      </>)}"""

ok1 = OLD in content
ok2 = OLD_CLOSE in content
print(f"  OPEN:  {'FOUND' if ok1 else 'MISSING'}")
print(f"  CLOSE: {'FOUND' if ok2 else 'MISSING'}")

if ok1:
    content = content.replace(OLD, NEW)
    print("[OK] Opening fragment ditambah")

if ok2:
    # Hanya replace yang pertama (di KomponenStokTab)
    # Cari posisi KomponenStokTab dulu
    idx = content.find("function KomponenStokTab(")
    close_idx = content.find(OLD_CLOSE, idx)
    if close_idx > 0:
        content = content[:close_idx] + NEW_CLOSE + content[close_idx+len(OLD_CLOSE):]
        print("[OK] Closing fragment ditambah")
    else:
        print("[WARN] Close tidak ditemukan setelah KomponenStokTab")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("[INFO] Jalankan: npm run build")
