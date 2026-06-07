from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Cek semua supabase.from yang tidak ada realtime listener
import re

# Tabel yang ada di queries
tables_queried = set(re.findall(r'supabase\.from\("(\w+)"\)', content))

# Tabel yang ada realtime listener
hooks_dir = Path(r"C:\Users\User\vista-teknik\src\hooks")
services_dir = Path(r"C:\Users\User\vista-teknik\src\services")

tables_realtime = set()
for f in list(hooks_dir.glob("*.ts")) + list(hooks_dir.glob("*.tsx")):
    fc = f.read_text(encoding="utf-8")
    tables_realtime.update(re.findall(r"table:\s*['\"](\w+)['\"]", fc))

# Tambah dari App.tsx
tables_realtime.update(re.findall(r"table:\s*['\"](\w+)['\"]", content))

print("=== TABEL YANG DI-QUERY ===")
for t in sorted(tables_queried):
    rt = "✅ REALTIME" if t in tables_realtime else "❌ NO REALTIME"
    print(f"  {rt}: {t}")

print(f"\nTotal tabel: {len(tables_queried)}")
print(f"Dengan realtime: {len(tables_queried & tables_realtime)}")
print(f"Tanpa realtime: {len(tables_queried - tables_realtime)}")
