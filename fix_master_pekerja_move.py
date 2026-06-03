from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Cek context baris 4134 - tab di SystemTab
lines = content.splitlines()
print("=== Baris sekitar 4134 (System subTabs) ===")
for i, l in enumerate(lines[4128:4145], 4129):
    print(f"{i}: {l}")

print("\n=== Baris sekitar 4964 (sidebar) ===")
for i, l in enumerate(lines[4958:4970], 4959):
    print(f"{i}: {l}")

print("\n=== Baris sekitar 5066 (render) ===")
for i, l in enumerate(lines[5060:5072], 5061):
    print(f"{i}: {l}")
