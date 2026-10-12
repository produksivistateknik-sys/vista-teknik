// NAMA OPERATOR di tooltip detail progres (12 Okt 2026, permintaan user). SATU sumber logika (CLAUDE.md B.1)
// utk Raw Schedule per WP, Detail Progres, Rencana Harian & Task Monitoring.
// Sumber: fcs_timer_kerja (1 timer per orang; pekerja_id -> master pekerja) - satu-satunya data operator yang
// punya tahap BUSBAR & durasi. Menit = WAKTU KERJA NYATA (gabungan rentang waktu timer), bukan jumlah
// orang-menit: 2 orang kerja bersamaan 20 mnt = "20 mnt", bukan 40.
import { getBusbarTahapBreakdown } from './panelHelpers'

export type TimerOperator = { pekerja_id: any; mulai?: string | null; selesai?: string | null; durasi_menit?: number | null; tahap?: string | null }
export type RingkasOperator = { nama: string[]; menit: number }

const MENIT = 60000

function rentang(t: TimerOperator, kini: number): [number, number] | null {
  const a = t.mulai ? Date.parse(t.mulai) : NaN
  if (!Number.isFinite(a)) return null
  let b = t.selesai ? Date.parse(t.selesai) : NaN
  if (!Number.isFinite(b)) b = t.durasi_menit != null ? a + Number(t.durasi_menit) * MENIT : kini // timer masih jalan
  return b >= a ? [a, b] : null
}

// Nama operator (urut sesuai pertama kali mulai, tanpa dobel) + menit kerja nyata dari sekumpulan timer.
export function ringkasOperator(timers: TimerOperator[], namaPekerja: (id: any) => string | undefined, kini = Date.now()): RingkasOperator {
  const urut = [...timers].sort((x, y) => String(x.mulai || '').localeCompare(String(y.mulai || '')))
  const nama: string[] = []
  const r: [number, number][] = []
  for (const t of urut) {
    const n = namaPekerja(t.pekerja_id)
    if (n && !nama.includes(n)) nama.push(n)
    const x = rentang(t, kini)
    if (x) r.push(x)
  }
  r.sort((x, y) => x[0] - y[0])
  let total = 0, s = -1, e = -1
  for (const [a, b] of r) {
    if (a > e) { if (e > s) total += e - s; s = a; e = b } else if (b > e) e = b
  }
  if (e > s) total += e - s
  return { nama, menit: total / MENIT }
}

// "ARI OKTA, ABDULLAH KAFABI · 51 mnt" | "BAYU · <1 mnt" | "—" (tidak ada data operator, mis. data lama)
export function formatOperator(r: RingkasOperator | null | undefined): string {
  if (!r || r.nama.length === 0) return '—'
  const m = r.menit
  const teks = m <= 0 ? '' : m < 1 ? ' · <1 mnt' : ` · ${Math.round(m)} mnt`
  return r.nama.join(', ') + teks
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

// Tooltip BUSBAR per tahap + operatornya, mis.
// "Fabrikasi 100% · ARI OKTA, ABDULLAH KAFABI · 51 mnt\nPlating 100% · M.TOHA · <1 mnt"
// timersKomponen = timer BUSBAR komponen ini (semua tahap). undefined kalau busbarTahap belum pernah ditulis
// (pemanggil fallback ke tampilan lama, sama spt formatBusbarTahapTooltip).
export function formatBusbarTahapOperator(cl: any, timersKomponen: TimerOperator[], namaPekerja: (id: any) => string | undefined): string | undefined {
  const bd = getBusbarTahapBreakdown(cl)
  if (!bd) return undefined
  return bd.map(x => `${x.label} ${Math.round(x.pct)}% · ${formatOperator(ringkasOperator(timersKomponen.filter(t => t.tahap === x.key), namaPekerja))}`).join('\n')
}
