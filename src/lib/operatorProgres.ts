// NAMA OPERATOR di tooltip detail progres (12 Okt 2026, permintaan user). SATU sumber logika (CLAUDE.md B.1)
// utk Raw Schedule per WP, Detail Progres, Rencana Harian & Task Monitoring.
// Sumber: fcs_timer_kerja (1 timer per orang; pekerja_id -> master pekerja) - satu-satunya data operator yang
// punya tahap BUSBAR & durasi. Menit = WAKTU KERJA NYATA (gabungan rentang waktu timer), bukan jumlah
// orang-menit: 2 orang kerja bersamaan 20 mnt = "20 mnt", bukan 40.
// REVISI (12 Okt 2026, lanjutan): dikelompokkan per TANGGAL PENGERJAAN = tanggal jam MULAI timer dalam WIB
// (keputusan user "tanggal dari realtime" - BUKAN kolom `tanggal`, yang ±1% sesi berisi tanggal tugas kemarin),
// terbaru di atas, maks 6 tanggal + "+N tanggal lagi", lalu "Total X mnt". Timer yang tidak pernah ditutup
// (selesai kosong) dari HARI SEBELUMNYA dihitung 0 menit + ditandai - dulu dihitung "sampai sekarang"
// sehingga timer basi tampil ratusan jam (14 timer basi live, umur s/d 223 jam).
import { getBusbarTahapBreakdown, BUSBAR_TAHAP_LABEL, formatBusbarTahapTooltip } from './panelHelpers'

export type TimerOperator = { pekerja_id: any; mulai?: string | null; selesai?: string | null; durasi_menit?: number | null; tahap?: string | null }
export type RingkasOperator = { nama: string[]; menit: number; basi: number }

const MENIT = 60000
const WIB = 7 * 3600000
export const MAKS_TANGGAL = 6

export const tanggalWib = (iso: string | number) => new Date((typeof iso === 'number' ? iso : Date.parse(iso)) + WIB).toISOString().slice(0, 10)
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export const fmtTanggalPendek = (tgl: string) => `${Number(tgl.slice(8, 10))} ${BULAN[Number(tgl.slice(5, 7)) - 1] || ''}`

// Rentang [mulai, akhir] satu timer. null = tidak dihitung menitnya; basi = timer lama yang tidak pernah ditutup.
function rentang(t: TimerOperator, kini: number): { r: [number, number] | null; basi: boolean } {
  const a = t.mulai ? Date.parse(t.mulai) : NaN
  if (!Number.isFinite(a)) return { r: null, basi: false }
  let b = t.selesai ? Date.parse(t.selesai) : NaN
  if (!Number.isFinite(b)) {
    if (t.durasi_menit != null) b = a + Number(t.durasi_menit) * MENIT
    else if (tanggalWib(a) === tanggalWib(kini)) b = kini // timer hari ini yang masih jalan
    else return { r: null, basi: true }               // tidak ditutup sejak hari sebelumnya - jangan dihitung
  }
  return { r: b >= a ? [a, b] : null, basi: false }
}

function gabungMenit(r: [number, number][]): number {
  r.sort((x, y) => x[0] - y[0])
  let total = 0, s = -1, e = -1
  for (const [a, b] of r) {
    if (a > e) { if (e > s) total += e - s; s = a; e = b } else if (b > e) e = b
  }
  if (e > s) total += e - s
  return total / MENIT
}

// Nama operator (urut sesuai pertama kali mulai, tanpa dobel) + menit kerja nyata dari sekumpulan timer.
export function ringkasOperator(timers: TimerOperator[], namaPekerja: (id: any) => string | undefined, kini = Date.now()): RingkasOperator {
  const urut = [...timers].sort((x, y) => String(x.mulai || '').localeCompare(String(y.mulai || '')))
  const nama: string[] = []
  const r: [number, number][] = []
  let basi = 0
  for (const t of urut) {
    const n = namaPekerja(t.pekerja_id)
    if (n && !nama.includes(n)) nama.push(n)
    const x = rentang(t, kini)
    if (x.r) r.push(x.r)
    if (x.basi) basi++
  }
  return { nama, menit: gabungMenit(r), basi }
}

const fmtMenit = (m: number) => m <= 0 ? '' : m < 1 ? '<1 mnt' : `${Math.round(m)} mnt`

// "ARI OKTA, ABDULLAH KAFABI · 51 mnt" | "BAYU · <1 mnt" | "—" (tidak ada data operator, mis. data lama)
export function formatOperator(r: RingkasOperator | null | undefined): string {
  if (!r || r.nama.length === 0) return '—'
  const m = fmtMenit(r.menit)
  return r.nama.join(', ') + (m ? ' · ' + m : '') + (r.basi ? ' (timer tidak ditutup)' : '')
}

export type BarisTanggal = { tanggal: string; tahap: string | null; ringkas: RingkasOperator }
export type RingkasTanggal = { baris: BarisTanggal[]; sisaTanggal: number; total: RingkasOperator }

// Kelompok per tanggal pengerjaan (WIB jam mulai) [+ tahap bila pakaiTahap], terbaru di atas; maks MAKS_TANGGAL
// tanggal (sisanya dihitung di sisaTanggal). total = seluruh timer (bukan cuma yang tampil).
export function ringkasPerTanggal(timers: TimerOperator[], namaPekerja: (id: any) => string | undefined, pakaiTahap = false, kini = Date.now()): RingkasTanggal {
  const grup = new Map<string, { tanggal: string; tahap: string | null; t: TimerOperator[]; akhir: string }>()
  for (const t of timers) {
    if (!t.mulai) continue
    const tanggal = tanggalWib(t.mulai)
    const tahap = pakaiTahap ? (t.tahap || null) : null
    const k = tanggal + '|' + (tahap || '')
    const g = grup.get(k) || { tanggal, tahap, t: [], akhir: '' }
    g.t.push(t); if (String(t.mulai) > g.akhir) g.akhir = String(t.mulai)
    grup.set(k, g)
  }
  const semua = [...grup.values()].sort((a, b) => b.akhir.localeCompare(a.akhir)) // terbaru di atas
  const tanggalUrut = [...new Set(semua.map(g => g.tanggal))]
  const tampil = new Set(tanggalUrut.slice(0, MAKS_TANGGAL))
  return {
    baris: semua.filter(g => tampil.has(g.tanggal)).map(g => ({ tanggal: g.tanggal, tahap: g.tahap, ringkas: ringkasOperator(g.t, namaPekerja, kini) })),
    sisaTanggal: Math.max(0, tanggalUrut.length - MAKS_TANGGAL),
    total: ringkasOperator(timers, namaPekerja, kini),
  }
}

const labelTahap = (k: string | null) => k ? (BUSBAR_TAHAP_LABEL[k] || k) : null

// Teks multi-baris utk tooltip title="" (dan dipakai juga oleh tooltip HTML lewat ringkasPerTanggal):
// "9 Okt · Pasang · BAYU · <1 mnt\n8 Okt · Heat-Shrink · ABDULLAH KAFABI, ADE · 1 mnt\n...\nTotal 53 mnt"
export function teksOperatorPerTanggal(timers: TimerOperator[], namaPekerja: (id: any) => string | undefined, pakaiTahap = false): string {
  const r = ringkasPerTanggal(timers, namaPekerja, pakaiTahap)
  if (r.baris.length === 0) return 'Operator: —'
  const baris = r.baris.map(b => [fmtTanggalPendek(b.tanggal), labelTahap(b.tahap), formatOperator(b.ringkas)].filter(Boolean).join(' · '))
  if (r.sisaTanggal > 0) baris.push(`+${r.sisaTanggal} tanggal lagi`)
  const tm = fmtMenit(r.total.menit)
  baris.push(`Total ${tm || '0 mnt'}${r.total.basi ? ` (${r.total.basi} timer tidak ditutup)` : ''}`)
  return baris.join('\n')
}

// Indeks timer per panel|kode|proses (1x lintasan, lookup O(1) per tooltip - tanpa query per tooltip).
export const kunciTimer = (panelId: any, kode: string, proses: string) => `${panelId}|${kode}|${proses}`
export function indeksTimer<T extends { panel_id: any; kode_komponen: string; proses: string }>(timers: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const t of timers) {
    const k = kunciTimer(t.panel_id, t.kode_komponen, t.proses)
    const a = m.get(k); if (a) a.push(t); else m.set(k, [t])
  }
  return m
}

// Tooltip BUSBAR: ringkasan % per tahap (1 baris) + riwayat per tanggal dgn tahap & operator + Total.
// undefined kalau busbarTahap belum pernah ditulis DAN tidak ada timer (pemanggil fallback ke tampilan lama).
export function formatBusbarTahapOperator(cl: any, timersKomponen: TimerOperator[], namaPekerja: (id: any) => string | undefined): string | undefined {
  const adaTahap = !!getBusbarTahapBreakdown(cl)
  if (!adaTahap && timersKomponen.length === 0) return undefined
  return [adaTahap ? formatBusbarTahapTooltip(cl) : null, teksOperatorPerTanggal(timersKomponen, namaPekerja, true)].filter(Boolean).join('\n')
}
