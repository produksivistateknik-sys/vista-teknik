from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Hapus semua kemungkinan import MasterPekerjaInline
lines = content.splitlines(keepends=True)
new_lines = [l for l in lines if "MasterPekerjaInline" not in l or "function MasterPekerjaInline" in l]
new_content = "".join(new_lines)

APP_PATH.write_text(new_content, encoding="utf-8")
print("Done! Import MasterPekerjaInline dihapus.")
print(f"Baris dihapus: {len(lines) - len(new_lines)}")
