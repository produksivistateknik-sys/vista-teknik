// ─────────────────────────────────────────────────────────────────────────────
// PANEL TYPES
// ─────────────────────────────────────────────────────────────────────────────
export const PANEL_TYPES = {
  FS: {
    label:"FS", color:"#f59e0b",
    wps:[
      { wp:"WP1", range:"FS.1-10", color:"#f59e0b", bg:"#fffbeb", items:[
        {kode:"FS.1",nama:"Frame (include ambang)"},{kode:"FS.2",nama:"Tulangan Kedalaman"},
        {kode:"FS.3",nama:"Tulangan Tegak"},{kode:"FS.4",nama:"Groundplate"},
        {kode:"FS.5",nama:"Box Control"},{kode:"FS.6",nama:"Dudukan ACB"},
        {kode:"FS.7",nama:"Tulangan Support Busbar"},{kode:"FS.8",nama:"UNP"},
        {kode:"FS.9",nama:"Dudukan Capacitor/Detuned"},{kode:"FS.10",nama:"Tulangan Dudukan Capacitor"},
      ]},
      { wp:"WP2", range:"FS.11-15", color:"#22c55e", bg:"#f0fdf4", items:[
        {kode:"FS.11",nama:"Pintu"},{kode:"FS.12",nama:"Sekatan Pintu"},
        {kode:"FS.13",nama:"Hanger"},{kode:"FS.14",nama:"Tutup Atas"},{kode:"FS.15",nama:"Topi"},
      ]},
      { wp:"WP3", range:"FS.16-21", color:"#06b6d4", bg:"#ecfeff", items:[
        {kode:"FS.16",nama:"Sekatan Samping"},{kode:"FS.17",nama:"Sekatan Belakang"},
        {kode:"FS.18",nama:"Bingkai Lantai"},{kode:"FS.19",nama:"Lantai Dasar"},
        {kode:"FS.20",nama:"Tutup Samping"},{kode:"FS.21",nama:"Tutup Belakang"},
      ]},
      { wp:"WP4", range:"FS.22-24", color:"#f97316", bg:"#fff7ed", items:[
        {kode:"FS.22",nama:"Cover Komponen"},{kode:"FS.23",nama:"Tulangan Cover"},{kode:"FS.24",nama:"Sekatan Capacitor"},
      ]},
    ]
  },
  F3B: {
    label:"Form 3B", color:"#0ea5e9",
    wps:[
      { wp:"WP1", range:"F3B.1-12", color:"#f59e0b", bg:"#fffbeb", items:[
        {kode:"F3B.1",nama:"Frame (include ambang)"},
        {kode:"F3B.2",nama:"Kompartemen"},
        {kode:"F3B.3",nama:"Sekatan Kompartemen"},
        {kode:"F3B.4",nama:"Tulangan Kedalaman"},
        {kode:"F3B.5",nama:"Tulangan Tegak"},{kode:"F3B.6",nama:"Groundplate"},
        {kode:"F3B.7",nama:"Box Control"},{kode:"F3B.8",nama:"Dudukan ACB"},
        {kode:"F3B.9",nama:"Tulangan Support Busbar"},{kode:"F3B.10",nama:"UNP"},
        {kode:"F3B.11",nama:"Dudukan Capacitor/Detuned"},{kode:"F3B.12",nama:"Tulangan Dudukan Capacitor"},
      ]},
      { wp:"WP2", range:"F3B.13-17", color:"#22c55e", bg:"#f0fdf4", items:[
        {kode:"F3B.13",nama:"Pintu"},{kode:"F3B.14",nama:"Sekatan Pintu"},
        {kode:"F3B.15",nama:"Hanger"},{kode:"F3B.16",nama:"Tutup Atas"},{kode:"F3B.17",nama:"Topi"},
      ]},
      { wp:"WP3", range:"F3B.18-23", color:"#06b6d4", bg:"#ecfeff", items:[
        {kode:"F3B.18",nama:"Sekatan Samping"},{kode:"F3B.19",nama:"Sekatan Belakang"},
        {kode:"F3B.20",nama:"Bingkai Lantai"},{kode:"F3B.21",nama:"Lantai Dasar"},
        {kode:"F3B.22",nama:"Tutup Samping"},{kode:"F3B.23",nama:"Tutup Belakang"},
      ]},
      { wp:"WP4", range:"F3B.24-26", color:"#f97316", bg:"#fff7ed", items:[
        {kode:"F3B.24",nama:"Cover Komponen"},{kode:"F3B.25",nama:"Tulangan Cover"},{kode:"F3B.26",nama:"Sekatan Capacitor"},
      ]},
    ]
  },
  WM_MS: {
    label:"WM Mild Steel", color:"#8b5cf6",
    wps:[
      { wp:"WP1", range:"WM.1-2", color:"#f59e0b", bg:"#fffbeb", items:[{kode:"WM.1",nama:"Tulangan Groundplate"},{kode:"WM.2",nama:"Groundplate"}]},
      { wp:"WP2", range:"WM.3-4", color:"#22c55e", bg:"#f0fdf4", items:[{kode:"WM.3",nama:"Box (include ambang)"},{kode:"WM.4",nama:"Pintu"}]},
      { wp:"WP3", range:"WM.5-6,9-10", color:"#06b6d4", bg:"#ecfeff", items:[{kode:"WM.5",nama:"Tulangan Cover"},{kode:"WM.6",nama:"Cover Komponen"},{kode:"WM.9",nama:"Tulangan Pintu Dalam"},{kode:"WM.10",nama:"Pintu Dalam"}]},
      { wp:"WP4", range:"WM.7-8", color:"#f97316", bg:"#fff7ed", items:[{kode:"WM.7",nama:"Tutup Atas Bawah"},{kode:"WM.8",nama:"Topi"}]},
    ]
  },
  WM_POLY: {
    label:"WM Poly", color:"#ec4899",
    wps:[
      { wp:"WP1", range:"WM.1-2", color:"#f59e0b", bg:"#fffbeb", items:[{kode:"WM.1",nama:"Tulangan Groundplate"},{kode:"WM.2",nama:"Groundplate"}]},
      { wp:"WP2", range:"WM.3-4", color:"#22c55e", bg:"#f0fdf4", items:[{kode:"WM.3",nama:"Box (include ambang)"},{kode:"WM.4",nama:"Pintu"}]},
      { wp:"WP3", range:"WM.5-6,9-10", color:"#06b6d4", bg:"#ecfeff", items:[{kode:"WM.5",nama:"Tulangan Cover"},{kode:"WM.6",nama:"Cover Komponen"},{kode:"WM.9",nama:"Tulangan Pintu Dalam"},{kode:"WM.10",nama:"Pintu Dalam"}]},
      { wp:"WP4", range:"WM.7-8", color:"#f97316", bg:"#fff7ed", items:[{kode:"WM.7",nama:"Tutup Atas Bawah"},{kode:"WM.8",nama:"Topi"}]},
    ]
  },
};

export const ALL_PROSES = ["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"];
export const WP_LIST    = ["WP1","WP2","WP3","WP4"];
export const PCT_STEPS  = [25,50,75,90,100];
export const PCT_MANUAL = [10,20,30,40,50,60,70,80,90,100];
export const PRIORITAS  = ["Tinggi","Sedang","Rendah"];

export const PROSES_COLOR = {
  "POTONG":"#f59e0b","BENDING":"#10b981","STEL":"#3b82f6","FINISHING":"#0891b2","RENDAM":"#0ea5e9","PAINTING":"#8b5cf6",
  "RAKIT":"#ec4899","PASANG KOMPONEN":"#f97316","BUSBAR":"#06b6d4",
  "WIRING CONTROL":"#6366f1","WIRING POWER":"#ef4444","QC TEST":"#14b8a6","PACKING":"#84cc16",
};
export const WP_COLOR = {"WP1":"#f59e0b","WP2":"#22c55e","WP3":"#06b6d4","WP4":"#f97316","WP5":"#a78bfa","WP6":"#f472b6"};
export const PRIORITAS_COLOR = {"Tinggi":"#dc2626","Sedang":"#f59e0b","Rendah":"#22c55e"};

export const DIVISI_PROSES = {
  mekanik:    ["POTONG","BENDING","STEL"],
  painting:   ["RENDAM","PAINTING"],
  assembling: ["RAKIT","PASANG KOMPONEN","BUSBAR"],
  wiring_ctrl:["WIRING CONTROL"],
  wiring_pwr: ["WIRING POWER"],
  qc:         ["QC TEST","PACKING"],
};
// reverse map: proses → array of proses in same divisi
export const DIVISI_PROSES_MAP=Object.fromEntries(
  Object.entries(DIVISI_PROSES).flatMap(([,ps])=>ps.map(p=>[p,ps]))
);
export const QTY_DIVISI = ["mekanik","painting"];

// ─────────────────────────────────────────────────────────────────────────────
// MAPPING: KODE KOMPONEN → PROSES YANG RELEVAN
// ─────────────────────────────────────────────────────────────────────────────
export const KOMPONEN_PROSES_MAP: Record<string, string[]> = {
  // FS (hasil rekonsiliasi otomatis ke Master Data BOM terkini)
  "FS.1": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  "FS.2": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.3": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.4": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  "FS.5": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.8": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.9": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","BUSBAR"],
  "FS.10": ["POTONG","STEL","RENDAM","PAINTING","RAKIT"],
  "FS.11": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  "FS.12": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","WIRING POWER"],
  "FS.13": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.17": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.19": ["POTONG","RENDAM","PAINTING","RAKIT"],
  "FS.20": ["POTONG","RENDAM","PAINTING","RAKIT"],
  "FS.21": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  "FS.22": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.23": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.27": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.28": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.29": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  "FS.30": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  "FS.31": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.32": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.33": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  // F3B (hasil rekonsiliasi otomatis ke Master Data BOM terkini)
  "F3B.1": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  "F3B.2": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  "F3B.3": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","BUSBAR"],
  "F3B.4": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.5": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.8": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  "F3B.9": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "F3B.10": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "F3B.11": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","BUSBAR"],
  "F3B.12": ["POTONG","STEL","RENDAM","PAINTING","RAKIT"],
  "F3B.13": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  "F3B.14": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","WIRING POWER"],
  "F3B.15": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "F3B.20": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.21": ["POTONG","RENDAM","PAINTING","RAKIT"],
  "F3B.22": ["POTONG","RENDAM","PAINTING","RAKIT"],
  "F3B.23": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  "F3B.24": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.25": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.29": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.30": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.31": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  "F3B.32": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  "F3B.33": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.35": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.36": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  // WM_MS & WM_POLY (hasil rekonsiliasi otomatis ke Master Data BOM terkini)
  "WM.1": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","BUSBAR"],
  "WM.2": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  "WM.3": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  "WM.4": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  "WM.5": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "WM.6": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "WM.7": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "WM.8": ["POTONG","RENDAM","PAINTING","RAKIT"],
  "WM.9": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "WM.10": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "WM.11": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
};

// ─────────────────────────────────────────────────────────────────────────────
// BUSBAR KOMPONEN per tipe panel
// ─────────────────────────────────────────────────────────────────────────────
export const BUSBAR_KOMPONEN:Record<string,string[]> = {
  FS:      ["H-BUS","INCOMING","OUTGOING","NETRAL","GROUND","COUPLER"],
  F3B:     ["H-BUS","INCOMING","OUTGOING","NETRAL","GROUND","COUPLER"],
  WM_MS:   ["LINE","INCOMING","OUTGOING","NETRAL","GROUND"],
  WM_POLY: ["LINE","INCOMING","OUTGOING","NETRAL","GROUND"],
};

export const BUSBAR_COLORS:Record<string,string>={
  "H-BUS":"#f59e0b","LINE":"#f59e0b",
  "INCOMING":"#ef4444","OUTGOING":"#3b82f6",
  "NETRAL":"#8b5cf6","GROUND":"#16a34a",
  "COUPLER":"#f97316",
};

export const DIVISI_CONFIG = {
  admin:      {label:"Admin",         icon:"⚙️", color:"#dc2626",bg:"#fef2f2",   proses:null},
  mekanik:    {label:"Mekanik",       icon:"🔧", color:"#d97706",bg:"#fffbeb", proses:["POTONG","BENDING","STEL"]},
  painting:   {label:"Painting",      icon:"🎨", color:"#7c3aed",bg:"#f5f3ff",proses:["PAINTING"]},
  assembling: {label:"Assembling",    icon:"⚙️", color:"#059669",bg:"#ecfdf5",proses:["RAKIT","PASANG KOMPONEN","BUSBAR"]},
  wiring_ctrl:{label:"Wiring Control",icon:"⚡", color:"#6366f1",bg:"#eef2ff",  proses:["WIRING CONTROL"]},
  wiring_pwr: {label:"Wiring Power",  icon:"🔌", color:"#be185d",bg:"#fdf2f8", proses:["WIRING POWER"]},
  qc:         {label:"QC",            icon:"🔍", color:"#16a34a",bg:"#f0fdf4",      proses:["QC TEST","PACKING"]},
  nameplate:  {label:"Nameplate",     icon:"🏷️", color:"#0891b2",bg:"#ecfeff",     proses:null},
};
export const OPERATOR_ROLES = ["mekanik","painting","assembling","wiring_ctrl","wiring_pwr","qc","nameplate","komponen"];

export const PROSES_ORANG_RAW_GLOBAL=["WIRING POWER","WIRING CONTROL"];

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────────────────────────
export const WO_SEED=[];
export const RAW_SEED=[];
export const RENHAR_SEED=[];
