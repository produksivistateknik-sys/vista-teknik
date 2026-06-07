from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")
lines = content.splitlines()

# Cek MaintenancePageTab (4234-4426)
start, end = 4233, 4425
whites = []
for i, l in enumerate(lines[start:end], start+1):
    if any(x in l for x in ['"#fff"','"#ffffff"','"#f8fafc"','"#f1f5f9"','"#fef2f2"','"#f0fdf4"','"#fffbeb"']) and 'var(--' not in l:
        whites.append(f'{i}: {l.strip()[:90]}')
    if any(x in l for x in ['"#1e293b"','"#0f172a"','"#374151"','"#111827"']) and 'color' in l and 'var(--' not in l:
        whites.append(f'{i}: {l.strip()[:90]}')

print(f"MaintenancePageTab issues: {len(whites)}")
for w in whites[:20]:
    print(w)
