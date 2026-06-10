file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

keywords = [
    "read-only", "Read-only", "readonly", "read_only",
    "on_track", "ontrack", "OnTrack",
    "terlambat", "Terlambat",
    "mendesak", "Mendesak", 
    "selesai", "Selesai",
    "semua", "Semua",
    "statusFil", "filterSt", "woFilter", "woFil",
    "setFilter", "filterWo", "filterPanel",
    "select value", "onChange",
]

found = []
for i, line in enumerate(lines):
    ll = line.lower()
    for kw in keywords:
        if kw.lower() in ll:
            found.append((i+1, line.rstrip()))
            break

# Tulis ke file
out_path = r"C:\Users\User\vista-teknik\extract_filter_status.txt"
with open(out_path, "w", encoding="utf-8") as f:
    for lineno, line in found:
        f.write(f"{lineno:5d}\t{line}\n")

print(f"[OK] {len(found)} baris ditemukan → {out_path}")
