// ATURAN KODE TIDAK VALID UTK AUTO-GESER (6 Nov 2026). Edge Function tidak bisa import src/, jadi ini CERMIN dari
// src/lib/relevansiJadwal.ts alasanKomponenDilewati + src/lib/panelHelpers.ts isKomponenRelevant + konstanta
// src/constants/panelTypes.ts KOMPONEN_PROSES_MAP. Kalau salah satunya berubah, ubah di sini juga dan ulangi uji setara.
export type AlasanTakValid = 'tidak_relevan' | 'tidak_ada_di_panel' | 'qty_0'
export type DataRelevan = { set: Set<string>; adaMapping: Set<string> }

export const PROSES_TANPA_SARING = ['BUSBAR', 'QC TEST', 'PACKING', 'NAMEPLATE', 'YELLOWMARK']
const PROSES_TANPA_MAPPING_KOMPONEN = ['QC TEST', 'PACKING', 'NAMEPLATE', 'YELLOWMARK']
const TIPE_PANEL_BUSBAR_SAJA = new Set<string>(['BUSBAR'])

export const KOMPONEN_PROSES_MAP: Record<string, string[]> = {
  // FS (hasil rekonsiliasi otomatis ke Master Data BOM terkini)
  "FS.1": ["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT"],
  "FS.2": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.3": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.4": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  "FS.5": ["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.8": ["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.9": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.10": ["POTONG","STEL","FINISHING","RENDAM","PAINTING","RAKIT"],
  "FS.11": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  "FS.12": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","WIRING POWER"],
  "FS.13": ["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.17": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.19": ["POTONG","PAINTING","RAKIT"],
  "FS.20": ["POTONG","RENDAM","PAINTING","RAKIT"],
  "FS.21": ["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT"],
  "FS.22": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.23": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.27": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.28": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.29": ["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT"],
  "FS.30": ["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT"],
  "FS.31": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.32": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.33": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  // F3B (hasil rekonsiliasi otomatis ke Master Data BOM terkini)
  "F3B.1": ["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT"],
  "F3B.2": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  "F3B.3": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.4": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.5": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.8": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  "F3B.9": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "F3B.10": ["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "F3B.11": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.12": ["POTONG","STEL","FINISHING","PAINTING","RAKIT"],
  "F3B.13": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  "F3B.14": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","WIRING POWER"],
  "F3B.15": ["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "F3B.20": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.21": ["POTONG","PAINTING","RAKIT"],
  "F3B.22": ["POTONG","RENDAM","PAINTING","RAKIT"],
  "F3B.23": ["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT"],
  "F3B.24": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.25": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.29": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.30": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.31": ["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT"],
  "F3B.32": ["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT"],
  "F3B.33": ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.35": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.36": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  // WM_MS & WM_POLY (hasil rekonsiliasi otomatis ke Master Data BOM terkini)
  "WM.1": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "WM.2": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  "WM.3": ["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT"],
  "WM.4": ["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  "WM.5": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "WM.6": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "WM.7": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "WM.8": ["POTONG","RENDAM","PAINTING","RAKIT"],
  "WM.9": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "WM.10": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "WM.11": ["POTONG","BENDING","STEL","FINISHING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
};

export function bangunDataRelevan(rows: { kode_komponen: string; tipe_panel: string; jenis_pekerjaan: string }[]): DataRelevan {
  const set = new Set<string>(), adaMapping = new Set<string>()
  rows.forEach((r) => {
    set.add(r.kode_komponen + '|' + r.tipe_panel + '|' + r.jenis_pekerjaan)
    adaMapping.add(r.kode_komponen + '|' + r.tipe_panel)
  })
  return { set, adaMapping }
}

function kodeRelevan(kode: string, tipe: string, proses: string, rel: DataRelevan): boolean {
  if (proses === 'BUSBAR') return false
  if (TIPE_PANEL_BUSBAR_SAJA.has(tipe)) return false
  if (PROSES_TANPA_MAPPING_KOMPONEN.includes(proses)) return true
  if (rel.adaMapping.has(kode + '|' + tipe)) return rel.set.has(kode + '|' + tipe + '|' + proses)
  const relevanProses = KOMPONEN_PROSES_MAP[kode]
  if (!relevanProses) return true
  return relevanProses.includes(proses)
}

// null = kode boleh berada di sel proses ini. Relevansi kosong (gagal/belum termuat) -> tidak menilai apa pun.
export function alasanKodeTakValid(kode: string, panel: { tipe?: string; checklist?: any } | undefined, proses: string, rel: DataRelevan | null): AlasanTakValid | null {
  if (!kode || kode.startsWith('__') || PROSES_TANPA_SARING.includes(proses)) return null
  if (!rel || rel.set.size === 0 || !panel) return null
  const cl = panel.checklist?.[kode]
  if (!cl || typeof cl !== 'object') return 'tidak_ada_di_panel'
  if (!(Number(cl.qty) > 0)) return 'qty_0'
  return kodeRelevan(kode, panel.tipe || '', proses, rel) ? null : 'tidak_relevan'
}
