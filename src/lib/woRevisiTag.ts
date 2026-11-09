// TAG JENIS REVISI WO (9 Nov 2026, permintaan user) - lencana REVISI Manajemen WO menyebut APA yang berubah. Fungsi murni.
// Sumber: wo_revisi_log (satu baris per revisi, migration 20261024010000) - kolom `rincian` (jsonb, migration 20261109010000)
// bila ada, kalau tidak teks `ringkas` yang dibuat aplikasi sendiri (lib/woDilihat ringkasRevisiEdit & useWoDigitalDocs revisi
// gambar; 58/58 baris 26 Okt - 9 Nov terbaca). Tidak ada riwayat yang dikarang: teks kosong/tak dikenal -> "rincian tidak tercatat".
// Ditumpuk: semua baris log WO itu yang LEBIH BARU dari saat admin terakhir membuka WO (wo_dilihat_admin); setelah dibuka hilang.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type JenisRevisi = 'deadline' | 'proyek' | 'qty' | 'panel_tambah' | 'panel_hapus' | 'gambar' | 'tak_tercatat'
export type RincianRevisi = { jenis: JenisRevisi; lama?: string; baru?: string; panel?: string; jumlah?: number; catatan?: string; teks?: string }
export type LogRevisi = { id: number; wo_id: number; oleh: string; ringkas: string | null; rincian?: any; waktu: string }
export type LangkahRevisi = { r: RincianRevisi; oleh: string; waktu: string }
export type TagRevisi = { jenis: JenisRevisi; label: string; langkah: LangkahRevisi[] }

const URUT: JenisRevisi[] = ['deadline', 'proyek', 'qty', 'panel_tambah', 'panel_hapus', 'gambar', 'tak_tercatat']
const LABEL: Record<JenisRevisi, string> = {
  deadline: 'Deadline', proyek: 'Nama proyek', qty: 'Qty panel', panel_tambah: 'Panel ditambah', panel_hapus: 'Panel dihapus',
  gambar: 'WO revisi', tak_tercatat: 'Revisi (rincian tidak tercatat)',
}
export const MAKS_TAG = 4

// Teks lama (format 23 Okt) satu rincian - dipakai ringkasRevisiEdit; JANGAN diubah (dibaca bacaRingkas utk log lama).
export function teksRingkas(r: RincianRevisi): string {
  switch (r.jenis) {
    case 'deadline': return `deadline ${r.lama} -> ${r.baru}`
    case 'proyek': return `proyek "${r.lama}" -> "${r.baru}"`
    case 'panel_tambah': return `+${r.jumlah} panel (${r.panel})`
    case 'panel_hapus': return `-${r.jumlah} panel (${r.panel})`
    case 'qty': return `qty ${r.panel} ${r.lama} -> ${r.baru}`
    case 'gambar': return `revisi gambar ${r.panel} rev ${String(r.baru || '').replace(/^rev /, '')}${r.catatan ? ': ' + r.catatan : ''}`
    default: return r.teks || ''
  }
}

// Teks ringkas -> rincian. Dipotong per "; " HANYA di depan awalan segmen yang dikenal (nama panel/proyek boleh berisi "; ").
export function bacaRingkas(teks: string | null | undefined): RincianRevisi[] {
  const t = String(teks || '').trim()
  if (!t) return [{ jenis: 'tak_tercatat' }]
  const g = t.match(/^revisi gambar (.+?)\s+rev (\d+)(?::\s*([\s\S]*))?$/)
  if (g) return [{ jenis: 'gambar', panel: g[1].trim(), baru: 'rev ' + g[2], catatan: (g[3] || '').trim() }]
  return t.split(/; (?=deadline |proyek "|\+\d+ panel \(|-\d+ panel \(|qty )/).map((s): RincianRevisi => {
    let m: RegExpMatchArray | null
    if ((m = s.match(/^deadline (\S+) -> (\S+)$/))) return { jenis: 'deadline', lama: m[1], baru: m[2] }
    if ((m = s.match(/^proyek "([\s\S]*)" -> "([\s\S]*)"$/))) return { jenis: 'proyek', lama: m[1], baru: m[2] }
    if ((m = s.match(/^\+(\d+) panel \(([\s\S]*)\)$/))) return { jenis: 'panel_tambah', jumlah: Number(m[1]), panel: m[2] }
    if ((m = s.match(/^-(\d+) panel \(([\s\S]*)\)$/))) return { jenis: 'panel_hapus', jumlah: Number(m[1]), panel: m[2] }
    if ((m = s.match(/^qty ([\s\S]+) (\S+) -> (\S+)$/))) return { jenis: 'qty', panel: m[1], lama: m[2], baru: m[3] }
    return { jenis: 'tak_tercatat', teks: s }
  })
}

const sahRincian = (x: any): x is RincianRevisi[] => Array.isArray(x) && x.length > 0 && x.every((r) => r && URUT.includes(r.jenis))
export const rincianLog = (l: LogRevisi): RincianRevisi[] => (sahRincian(l.rincian) ? l.rincian : bacaRingkas(l.ringkas))

// Baris log yang belum dilihat admin ini (lebih baru dari dilihat_pada; belum pernah membuka = semua), urut waktu.
export function logBelumDilihat(log: LogRevisi[], dilihatPada: string | undefined): LogRevisi[] {
  const batas = dilihatPada ? Date.parse(dilihatPada) : -Infinity
  return log.filter((l) => Date.parse(l.waktu) > batas).sort((a, b) => Date.parse(a.waktu) - Date.parse(b.waktu) || a.id - b.id)
}

// Tag per jenis (urutan tetap). Deadline/nama proyek yang berakhir sama dgn awalnya -> "(kembali seperti semula)".
export function tagRevisi(log: LogRevisi[]): TagRevisi[] {
  const per = new Map<JenisRevisi, LangkahRevisi[]>()
  for (const l of log) for (const r of rincianLog(l)) (per.get(r.jenis) || per.set(r.jenis, []).get(r.jenis)!).push({ r, oleh: l.oleh, waktu: l.waktu })
  return URUT.filter((j) => per.has(j)).map((j) => {
    const langkah = per.get(j)!
    const kembali = (j === 'deadline' || j === 'proyek') && langkah.length > 1 && langkah[0].r.lama === langkah[langkah.length - 1].r.baru
    return { jenis: j, label: LABEL[j] + (kembali ? ' (kembali seperti semula)' : ''), langkah }
  })
}

const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
// "2026-11-28" -> "28 Nov 2026" (teks lain apa adanya)
export const fmtTgl = (s?: string) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${Number(m[3])} ${BLN[Number(m[2]) - 1]} ${m[1]}` : String(s ?? '-') }
// "9 Nov 2026 10.56 WIB"
export const fmtWaktuWib = (iso: string) => { const d = new Date(Date.parse(iso) + 7 * 3600e3); return `${d.getUTCDate()} ${BLN[d.getUTCMonth()]} ${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, '0')}.${String(d.getUTCMinutes()).padStart(2, '0')} WIB` }

// Satu baris kotak "Yang diubah": "Deadline: 28 Nov 2026 → 4 Des 2026"
export function teksLangkah(r: RincianRevisi): string {
  switch (r.jenis) {
    case 'deadline': return `Deadline: ${fmtTgl(r.lama)} → ${fmtTgl(r.baru)}`
    case 'proyek': return `Nama proyek: "${r.lama}" → "${r.baru}"`
    case 'qty': return `Qty ${r.panel}: ${r.lama} → ${r.baru}`
    case 'panel_tambah': return `Panel ditambah (${r.jumlah}): ${r.panel}`
    case 'panel_hapus': return `Panel dihapus (${r.jumlah}): ${r.panel}`
    case 'gambar': return `WO revisi: gambar ${r.panel} ${r.baru}${r.catatan ? ` - ${r.catatan}` : ''}`
    default: return r.teks ? `Revisi: ${r.teks}` : 'Revisi (rincian tidak tercatat)'
  }
}
