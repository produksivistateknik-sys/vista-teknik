from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")
lines = content.splitlines()

whites = []
for i, l in enumerate(lines):
    if any(x in l for x in ['background:"#fff"','background:"#ffffff"','background:"#f8fafc"','background:"#f1f5f9"']):
        whites.append(f'{i+1}: {l.strip()[:80]}')

print(f'Total: {len(whites)} baris')
for w in whites[:30]:
    print(w)
