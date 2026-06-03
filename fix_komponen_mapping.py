from pathlib import Path
import re

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# ── 1. Tambah KOMPONEN_PROSES_MAP setelah DIVISI_PROSES_MAP ──
MAPPING_CODE = r"""
// ─────────────────────────────────────────────────────────────────────────────
// MAPPING: KODE KOMPONEN → PROSES YANG RELEVAN
// ─────────────────────────────────────────────────────────────────────────────
const KOMPONEN_PROSES_MAP: Record<string, string[]> = {
  // FS & F3B - WP1
  "FS.1":  ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "FS.2":  ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "FS.3":  ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "FS.4":  ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  "FS.5":  ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.6":  ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.7":  ["POTONG","BENDING","PAINTING","RAKIT","BUSBAR"],
  "FS.8":  ["POTONG","STEL","PAINTING","RAKIT"],
  "FS.9":  ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  "FS.10": ["POTONG","BENDING","PAINTING","RAKIT","WIRING POWER"],
  // FS & F3B - WP2
  "FS.11": ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.12": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.13": ["POTONG","PAINTING","RAKIT"],
  "FS.14": ["POTONG","PAINTING","RAKIT"],
  "FS.15": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  // FS & F3B - WP3
  "FS.16": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.17": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.18": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.19": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.20": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "FS.21": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  // FS & F3B - WP4
  "FS.22": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.23": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.24": ["POTONG","BENDING","PAINTING","RAKIT"],
  // F3B tambahan - WP1
  "F3B.1":  ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "F3B.2":  ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  "F3B.3":  ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  "F3B.4":  ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "F3B.5":  ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "F3B.6":  ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  "F3B.7":  ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "F3B.8":  ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "F3B.9":  ["POTONG","BENDING","PAINTING","RAKIT","BUSBAR"],
  "F3B.10": ["POTONG","STEL","PAINTING","RAKIT"],
  "F3B.11": ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  "F3B.12": ["POTONG","BENDING","PAINTING","RAKIT","WIRING POWER"],
  // F3B - WP2
  "F3B.13": ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "F3B.14": ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.15": ["POTONG","PAINTING","RAKIT"],
  "F3B.16": ["POTONG","PAINTING","RAKIT"],
  "F3B.17": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  // F3B - WP3
  "F3B.18": ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.19": ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.20": ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.21": ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.22": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "F3B.23": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  // F3B - WP4
  "F3B.24": ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.25": ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.26": ["POTONG","BENDING","PAINTING","RAKIT"],
  // WM_MS & WM_POLY - WP1
  "WM.1": ["POTONG","BENDING","PAINTING","RAKIT","WIRING POWER","BUSBAR"],
  "WM.2": ["POTONG","BENDING","PAINTING","RAKIT","BUSBAR"],
  // WM_MS - WP2
  "WM.3": ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "WM.4": ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN"],
  // WM - WP3
  "WM.5": ["POTONG","BENDING","PAINTING","RAKIT"],
  "WM.6": ["POTONG","BENDING","PAINTING","RAKIT"],
  // WM - WP4
  "WM.7": ["POTONG","BENDING","PAINTING","RAKIT"],
  "WM.8": ["POTONG","BENDING","PAINTING","RAKIT"],
  // WM_POLY - WP5 & WP6 (sama seperti WP4)
  "WM.9":  ["POTONG","BENDING","PAINTING","RAKIT"],
  "WM.10": ["POTONG","BENDING","PAINTING","RAKIT"],
};

// Helper: cek apakah komponen relevan dengan proses tertentu
const isKomponenRelevant=(kode:string, proses:string):boolean=>{
  const relevanProses=KOMPONEN_PROSES_MAP[kode];
  if(!relevanProses) return true; // kalau tidak ada mapping, tampilkan semua
  return relevanProses.includes(proses);
};
"""

# Sisipkan setelah DIVISI_PROSES_MAP
old_anchor = "const QTY_DIVISI = [\"mekanik\",\"painting\"];"
new_anchor = old_anchor + "\n" + MAPPING_CODE

if old_anchor in content:
    content = content.replace(old_anchor, new_anchor)
    print("✅ KOMPONEN_PROSES_MAP ditambahkan")
else:
    print("❌ Anchor tidak ditemukan!")

# ── 2. Filter komponen di modal cell Raw Schedule ──
# Cari wpItems yang dirender sebagai tombol komponen
old_filter = """const wpItems=panelCfg?.wps.find(w=>w.wp===modalWp)?.items||[];"""
new_filter = """const wpItemsAll=panelCfg?.wps.find(w=>w.wp===modalWp)?.items||[];
  const wpItems=wpItemsAll.filter(it=>isKomponenRelevant(it.kode,rawRow?.proses||""));"""

if old_filter in content:
    content = content.replace(old_filter, new_filter)
    print("✅ Filter komponen di modal ditambahkan")
else:
    print("❌ wpItems filter tidak ditemukan!")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai! Jalankan: npm run dev")
