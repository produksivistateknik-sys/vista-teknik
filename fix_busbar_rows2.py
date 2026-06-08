from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Cek exact content dari baris 3073-3130
lines = content.splitlines()
print("Current busbar section:")
for i, l in enumerate(lines[3072:3130], 3073):
    print(f"{i}: {l}")
