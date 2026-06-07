from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Replace per baris - lebih reliable
changes = {
    # FS fixes
    '"FS.2":  ["POTONG","BENDING","STEL","PAINTING","RAKIT"],':
    '"FS.2":  ["POTONG","BENDING","PAINTING","RAKIT"],',
    
    '"FS.3":  ["POTONG","BENDING","STEL","PAINTING","RAKIT"],':
    '"FS.3":  ["POTONG","BENDING","PAINTING","RAKIT"],',
    
    '"FS.12": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],':
    '"FS.12": ["POTONG","BENDING","PAINTING","RAKIT"],',
    
    '"FS.13": ["POTONG","PAINTING","RAKIT"],':
    '"FS.13": ["POTONG","PAINTING","RAKIT"],',  # sudah benar

    '"FS.14": ["POTONG","PAINTING","RAKIT"],':
    '"FS.14": ["POTONG","PAINTING","RAKIT"],',  # sudah benar

    # F3B fixes
    '"F3B.3":  ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],':
    '"F3B.3":  ["POTONG","BENDING","PAINTING","RAKIT","BUSBAR"],',

    '"F3B.4":  ["POTONG","BENDING","STEL","PAINTING","RAKIT"],':
    '"F3B.4":  ["POTONG","BENDING","PAINTING","RAKIT"],',

    '"F3B.5":  ["POTONG","BENDING","STEL","PAINTING","RAKIT"],':
    '"F3B.5":  ["POTONG","BENDING","PAINTING","RAKIT"],',

    '"F3B.14": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],':
    '"F3B.14": ["POTONG","BENDING","PAINTING","RAKIT"],',

    '"F3B.15": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],':
    '"F3B.15": ["POTONG","PAINTING","RAKIT"],',

    '"F3B.16": ["POTONG","PAINTING","RAKIT"],':
    '"F3B.16": ["POTONG","PAINTING","RAKIT"],',  # sudah benar

    # WM fixes
    '"WM.1": ["POTONG","BENDING","PAINTING","RAKIT","WIRING POWER","BUSBAR"],':
    '"WM.1": ["POTONG","BENDING","PAINTING","RAKIT","BUSBAR"],',

    '"WM.2": ["POTONG","BENDING","PAINTING","RAKIT","BUSBAR"],':
    '"WM.2": ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],',

    '"WM.3": ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],':
    '"WM.3": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],',

    '"WM.4": ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN"],':
    '"WM.4": ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],',

    '"WM.7": ["POTONG","BENDING","PAINTING","RAKIT"],':
    '"WM.7": ["POTONG","PAINTING","RAKIT"],',

    '"WM.9":  ["POTONG","BENDING","PAINTING","RAKIT"],':
    '"WM.9":  ["POTONG","BENDING","PAINTING","RAKIT"],',  # sudah benar

    '"WM.10": ["POTONG","BENDING","PAINTING","RAKIT"],':
    '"WM.10": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],',
}

count = 0
for old, new in changes.items():
    if old != new and old in content:
        content = content.replace(old, new)
        print(f"✅ {old[:60]}")
        count += 1

APP_PATH.write_text(content, encoding="utf-8")
print(f"\n✅ {count} perubahan diterapkan!")
