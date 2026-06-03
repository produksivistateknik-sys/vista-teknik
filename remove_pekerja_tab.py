from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Hapus tab Master Pekerja dari subTabs di SystemTab (baris 3585)
lines = content.splitlines(keepends=True)

new_lines = []
for l in lines:
    # skip baris tab Master Pekerja di subTabs SystemTab
    if '{id:"pekerja",label:"\U0001f465 Master Pekerja"}' in l:
        print(f"Hapus baris: {l.strip()}")
        continue
    new_lines.append(l)

new_content = "".join(new_lines)
APP_PATH.write_text(new_content, encoding="utf-8")
print("Done! Tab Master Pekerja dihapus dari SystemTab.")
