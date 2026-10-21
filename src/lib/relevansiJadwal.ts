// SARINGAN RELEVANSI KOMPONEN SAAT MENEMPEL / MEMINDAH JADWAL (22 Okt 2026, keputusan user) - SATU fungsi bersama
// (CLAUDE.md B.1) utk semua jalur yang menaruh kode komponen ke sel jadwal proses: salin-tempel, potong-tempel,
// multi-pindah, Pindahin, modal sel, dan fitur pindah per WP. Acuan = bom_proses_relevan lewat isKomponenRelevant
// (helper yang sama dgn modal Tambah WP, generator FCS, Detail Progres & peringatan urutan proses).
// - Penyaringan DIBERITAHUKAN (teksDilewati + tombol "Tambahkan juga" di pemanggil), tidak diam-diam.
// - Relevansi belum termuat lengkap (GLOBAL_PROSES_RELEVAN_TERMUAT false) -> TIDAK menyaring apa pun (aman).
// - Kode tanpa baris bom_proses_relevan -> perilaku isKomponenRelevant (cadangan KOMPONEN_PROSES_MAP; kode yang
//   tidak dikenal = relevan) -> tidak disaring.
// - BUSBAR (busbar_schedule), QC TEST/PACKING/NAMEPLATE/YELLOWMARK (penanda panel) & token __wiring_ tidak disaring.
// - Undo TIDAK memakai saringan (memulihkan persis keadaan sebelum aksi).
import { isKomponenRelevant } from './panelHelpers'
import { GLOBAL_PROSES_RELEVAN_TERMUAT } from './globalState'

export const PROSES_TANPA_SARING = ['BUSBAR', 'QC TEST', 'PACKING', 'NAMEPLATE', 'YELLOWMARK']
export type AlasanDilewati = 'tidak_relevan' | 'tidak_ada_di_panel' | 'qty_0'
export type KomponenDilewati = { kode: string; wp: string; alasan: AlasanDilewati }

// null = boleh ditaruh di sel proses ini.
export function alasanKomponenDilewati(kode: string, panel: { tipe?: string; checklist?: any } | undefined, proses: string): AlasanDilewati | null {
  if (!kode || kode.startsWith('__') || PROSES_TANPA_SARING.includes(proses)) return null
  if (!GLOBAL_PROSES_RELEVAN_TERMUAT || !panel) return null
  const cl = panel.checklist?.[kode]
  if (!cl || typeof cl !== 'object') return 'tidak_ada_di_panel'
  if (!(Number(cl.qty) > 0)) return 'qty_0'
  return isKomponenRelevant(kode, panel.tipe || '', proses) ? null : 'tidak_relevan'
}

// Saring entri jadwal (bentuk {wp, komponen[], ...}) utk sel proses `proses` panel `panel`. Entri yang komponennya
// habis disaring dibuang; token __wiring_ ikut entri yang masih punya komponen asli.
export function saringKomponenRelevan(entries: any[], panel: { tipe?: string; checklist?: any } | undefined, proses: string): { entri: any[]; dilewati: KomponenDilewati[] } {
  const dilewati: KomponenDilewati[] = []
  const entri = (entries || []).map((e: any) => {
    const komponen = (e.komponen || []).filter((k: string) => {
      const a = alasanKomponenDilewati(k, panel, proses)
      if (a) dilewati.push({ kode: k, wp: e.wp, alasan: a })
      return !a
    })
    if (komponen.length === (e.komponen || []).length) return e
    if (!komponen.some((k: string) => !k.startsWith('__'))) return null
    return { ...e, komponen }
  }).filter(Boolean)
  return { entri, dilewati }
}

const LABEL_ALASAN: Record<AlasanDilewati, string> = { tidak_relevan: 'tidak relevan untuk', tidak_ada_di_panel: 'tidak ada di panel tujuan', qty_0: 'qty 0 di panel tujuan' }
// Teks pemberitahuan, mis. "8 komponen dilewati (tidak relevan untuk PASANG KOMPONEN): Sekatan Samping, ...".
export function teksDilewati(dilewati: KomponenDilewati[], proses: string, nama: (kode: string) => string): string {
  const per = new Map<AlasanDilewati, string[]>()
  for (const d of dilewati) per.set(d.alasan, [...new Set([...(per.get(d.alasan) || []), nama(d.kode)])])
  return [...per.entries()].map(([a, ns]) => `${ns.length} komponen dilewati (${LABEL_ALASAN[a]}${a === 'tidak_relevan' ? ' ' + proses : ''}): ${ns.join(', ')}`).join('\n')
}
