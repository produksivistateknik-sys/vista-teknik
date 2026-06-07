from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Cari function ManajemenWO
lines = content.splitlines()
start = next(i for i, l in enumerate(lines) if 'function ManajemenWO' in l or 'function WOManagement' in l or 'function Manajemen' in l)
end = next((i for i, l in enumerate(lines[start+1:], start+1) if l.startswith('function ')), start+300)

print(f"ManajemenWO: baris {start+1} - {end+1}")

whites = []
for i, l in enumerate(lines[start:end], start+1):
    if any(x in l for x in ['"#1e293b"', '"#0f172a"', '"#1a1d23"', '"#374151"', '"#111827"']) and 'color' in l and 'var(--' not in l:
        whites.append(f'{i}: {l.strip()[:90]}')

print(f"Total text color issues: {len(whites)}")
for w in whites[:20]:
    print(w)
