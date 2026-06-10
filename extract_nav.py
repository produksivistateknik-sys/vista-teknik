file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

keywords = [
    "PRODUKSI", "SYSTEM", "MONITORING",
    "Tracking Pekerja", "Activity Log", "Kendala", "Maintenance",
    "Dashboard", "Raw Schedule", "Rencana Harian", "Manajemen WO",
    "activeTab", "setActiveTab", "setTab", "tab==", "nav-grp",
    "erp-nav", "erp-sidebar", "Stok Komponen", "KomponenStok",
    "menu", "Menu", "sidebar", "Sidebar",
]

found = []
for i, line in enumerate(lines):
    for kw in keywords:
        if kw in line:
            found.append((i+1, line.rstrip()))
            break

out_path = r"C:\Users\User\vista-teknik\extract_nav.txt"
with open(out_path, "w", encoding="utf-8") as f:
    for lineno, line in found:
        f.write(f"{lineno:5d}\t{line}\n")

print(f"[OK] {len(found)} baris → {out_path}")
