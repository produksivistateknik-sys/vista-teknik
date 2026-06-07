from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old_map = '''const KOMPONEN_PROSES_MAP: Record<string, string[]> = {
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
  "FS.12": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
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
  "F3B.14": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "F3B.15": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "F3B.16": ["POTONG","BENDING","PAINTING","RAKIT"],
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
};'''

new_map = '''const KOMPONEN_PROSES_MAP: Record<string, string[]> = {
  // FS - WP1
  "FS.1":  ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "FS.2":  ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.3":  ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.4":  ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  "FS.5":  ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.6":  ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.7":  ["POTONG","BENDING","PAINTING","RAKIT","BUSBAR"],
  "FS.8":  ["POTONG","STEL","PAINTING","RAKIT"],
  "FS.9":  ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  "FS.10": ["POTONG","BENDING","PAINTING","RAKIT","WIRING POWER"],
  // FS - WP2
  "FS.11": ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.12": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.13": ["POTONG","PAINTING","RAKIT"],
  "FS.14": ["POTONG","PAINTING","RAKIT"],
  "FS.15": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  // FS - WP3
  "FS.16": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.17": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.18": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.19": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.20": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "FS.21": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  // FS - WP4
  "FS.22": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.23": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.24": ["POTONG","BENDING","PAINTING","RAKIT"],
  // F3B - WP1
  "F3B.1":  ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "F3B.2":  ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  "F3B.3":  ["POTONG","BENDING","PAINTING","RAKIT","BUSBAR"],
  "F3B.4":  ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.5":  ["POTONG","BENDING","PAINTING","RAKIT"],
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
  "WM.1": ["POTONG","BENDING","PAINTING","RAKIT","BUSBAR"],
  "WM.2": ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  // WM - WP2
  "WM.3": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "WM.4": ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  // WM - WP3
  "WM.5": ["POTONG","BENDING","PAINTING","RAKIT"],
  "WM.6": ["POTONG","BENDING","PAINTING","RAKIT"],
  "WM.9": ["POTONG","BENDING","PAINTING","RAKIT"],
  "WM.10":["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  // WM - WP4
  "WM.7": ["POTONG","PAINTING","RAKIT"],
  "WM.8": ["POTONG","BENDING","PAINTING","RAKIT"],
};'''

if old_map in content:
    content = content.replace(old_map, new_map)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ KOMPONEN_PROSES_MAP updated!")
else:
    print("❌ Not found!")

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Update WM_MS - gabungkan WP5/WP6 ke WP3
old_wm_ms = '''      { wp:"WP3", range:"WM.5-6", color:"#06b6d4", bg:"#ecfeff", items:[{kode:"WM.5",nama:"Tulangan Cover"},{kode:"WM.6",nama:"Cover Komponen"}]},
      { wp:"WP4", range:"WM.7-8", color:"#f97316", bg:"#fff7ed", items:[{kode:"WM.7",nama:"Tutup Atas Bawah"},{kode:"WM.8",nama:"Topi"}]},
      { wp:"WP5", range:"WM.9",   color:"#a78bfa", bg:"#f5f3ff", items:[{kode:"WM.9",nama:"Tulangan Pintu Dalam"}]},
      { wp:"WP6", range:"WM.10",  color:"#f472b6", bg:"#fdf2f8", items:[{kode:"WM.10",nama:"Pintu Dalam"}]},
    ]
  },
  WM_POLY: {'''

new_wm_ms = '''      { wp:"WP3", range:"WM.5-6,9-10", color:"#06b6d4", bg:"#ecfeff", items:[{kode:"WM.5",nama:"Tulangan Cover"},{kode:"WM.6",nama:"Cover Komponen"},{kode:"WM.9",nama:"Tulangan Pintu Dalam"},{kode:"WM.10",nama:"Pintu Dalam"}]},
      { wp:"WP4", range:"WM.7-8", color:"#f97316", bg:"#fff7ed", items:[{kode:"WM.7",nama:"Tutup Atas Bawah"},{kode:"WM.8",nama:"Topi"}]},
    ]
  },
  WM_POLY: {'''

if old_wm_ms in content:
    content = content.replace(old_wm_ms, new_wm_ms)
    print("✅ WM_MS WP3 updated (WM.9 & WM.10 merged)")
else:
    print("❌ WM_MS not found")

# Update WM_POLY juga
old_wm_poly = '''      { wp:"WP3", range:"WM.5-6", color:"#06b6d4", bg:"#ecfeff", items:[{kode:"WM.5",nama:"Tulangan Cover"},{kode:"WM.6",nama:"Cover Komponen"}]},
      { wp:"WP4", range:"WM.7-8", color:"#f97316", bg:"#fff7ed", items:[{kode:"WM.7",nama:"Tutup Atas Bawah"},{kode:"WM.8",nama:"Topi"}]},
      { wp:"WP5", range:"WM.9",   color:"#a78bfa", bg:"#f5f3ff", items:[{kode:"WM.9",nama:"Tulangan Pintu Dalam"}]},
      { wp:"WP6", range:"WM.10",  color:"#f472b6", bg:"#fdf2f8", items:[{kode:"WM.10",nama:"Pintu Dalam"}]},
    ]
  },
};'''

new_wm_poly = '''      { wp:"WP3", range:"WM.5-6,9-10", color:"#06b6d4", bg:"#ecfeff", items:[{kode:"WM.5",nama:"Tulangan Cover"},{kode:"WM.6",nama:"Cover Komponen"},{kode:"WM.9",nama:"Tulangan Pintu Dalam"},{kode:"WM.10",nama:"Pintu Dalam"}]},
      { wp:"WP4", range:"WM.7-8", color:"#f97316", bg:"#fff7ed", items:[{kode:"WM.7",nama:"Tutup Atas Bawah"},{kode:"WM.8",nama:"Topi"}]},
    ]
  },
};'''

if old_wm_poly in content:
    content = content.replace(old_wm_poly, new_wm_poly)
    print("✅ WM_POLY WP3 updated")
else:
    print("❌ WM_POLY not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
