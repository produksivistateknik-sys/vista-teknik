// CEK SEBELUM ARSIP PANEL (12 Nov 2026, keputusan user - lapis 3, NONBLOKIR). Dipakai Manajemen WO sebelum RPC
// arsip_panel_aman: bila ada proses relevan < 100% atau timer yang masih menyala, admin diberi dialog
// "Tetap arsipkan" / "Batal". Tidak mengubah RPC arsip dan tidak menulis apa pun (hanya membaca).
// Proses & persen memakai rumus yang SAMA dgn persen panel/snapshot arsip (calcPanelProgressCcpAware +
// isProsesApplicableForPanel) - satu sumber, tidak menghitung sendiri.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { calcPanelProgressCcpAware, isProsesApplicableForPanel } from './panelHelpers'
import { fetchAllPagedPerPotongan } from './fetchAllPaged'

export type TimerTerbuka = { panelId: number; proses: string; kode: string | null; tahap: string | null; pekerja: string; mulai: string }
export type CekPanelArsip = { id: number; nama: string; prosesBelum: { proses: string; pct: number }[]; timer: TimerTerbuka[] }

// Proses yang berlaku utk panel ini dan persennya < 100 (urutan ALL_PROSES).
export function prosesBelumSelesai(panel: any, ccpMap: Record<string, number>): { proses: string; pct: number }[] {
  const prog = calcPanelProgressCcpAware(panel, undefined, ccpMap)
  return Object.entries(prog).filter(([pr, v]) => isProsesApplicableForPanel(panel, pr) && v < 100).map(([proses, pct]) => ({ proses, pct }))
}

// Timer yang masih menyala (selesai null) utk panel-panel ini, beserta nama pekerjanya. Error dilempar.
export async function timerTerbukaPanel(db: any, panelIds: number[]): Promise<TimerTerbuka[]> {
  if (!panelIds.length) return []
  const rows = await fetchAllPagedPerPotongan(panelIds, (b, f, t) => db.from('fcs_timer_kerja')
    .select('id,panel_id,proses,kode_komponen,tahap,pekerja_id,mulai').in('panel_id', b).is('selesai', null).order('id').range(f, t))
  const pids = [...new Set(rows.map((r: any) => r.pekerja_id).filter((x: any) => x != null))]
  const nama = new Map<number, string>()
  if (pids.length) {
    const pk = await fetchAllPagedPerPotongan(pids, (b, f, t) => db.from('pekerja').select('id,nama').in('id', b).order('id').range(f, t))
    pk.forEach((p: any) => nama.set(Number(p.id), p.nama))
  }
  return rows.map((r: any) => ({ panelId: Number(r.panel_id), proses: r.proses, kode: r.kode_komponen, tahap: r.tahap,
    pekerja: nama.get(Number(r.pekerja_id)) || (r.pekerja_id != null ? '#' + r.pekerja_id : '-'), mulai: r.mulai }))
}

// Gabungan per panel; hanya panel yang punya temuan. Bila baca timer gagal, galat dikembalikan (dialog tetap tampil).
export async function cekSebelumArsip(db: any, panels: any[], ccpMap: Record<string, number>): Promise<{ temuan: CekPanelArsip[]; galat: string | null }> {
  let timer: TimerTerbuka[] = []
  let galat: string | null = null
  try { timer = await timerTerbukaPanel(db, panels.map((p) => Number(p.id))) } catch (e: any) { galat = e?.message || String(e) }
  const temuan = panels.map((p) => ({ id: Number(p.id), nama: p.nama, prosesBelum: prosesBelumSelesai(p, ccpMap), timer: timer.filter((t) => t.panelId === Number(p.id)) }))
    .filter((x) => x.prosesBelum.length > 0 || x.timer.length > 0)
  return { temuan, galat }
}

// Ringkas utk dialog: timer dikelompokkan per proses + komponen + tahap, nama operator digabung, waktu mulai paling awal.
export function ringkasTimer(timer: TimerTerbuka[]): string[] {
  const grup = new Map<string, { label: string; nama: Set<string>; mulai: string }>()
  for (const t of timer) {
    const k = `${t.proses}|${t.kode || ''}|${t.tahap || ''}`
    const g = grup.get(k) || { label: `${t.proses}${t.kode ? ' ' + t.kode : ''}${t.tahap ? ' (' + t.tahap + ')' : ''}`, nama: new Set<string>(), mulai: t.mulai }
    g.nama.add(t.pekerja); if (t.mulai < g.mulai) g.mulai = t.mulai; grup.set(k, g)
  }
  return [...grup.values()].map((g) => `${g.label} - ${[...g.nama].join(', ')}, sejak ${new Date(g.mulai).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`)
}
