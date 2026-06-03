# Script untuk cek nama fungsi yang ada di App.tsx
import re
from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Cari semua nama fungsi
functions = re.findall(r'function\s+(\w+)\s*\(', content)

print("=== SEMUA FUNGSI DI App.tsx ===")
for f in functions:
    print(f"  function {f}")

print()
print("=== FUNGSI YANG MENGANDUNG 'Pekerja' atau 'Master' atau 'User' ===")
for f in functions:
    if any(k in f for k in ['Pekerja', 'Master', 'User', 'Inline', 'pekerja']):
        print(f"  >> function {f}")
