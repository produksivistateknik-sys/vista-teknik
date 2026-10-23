// LAPORAN OUTSTANDING PEKERJAAN (Tahap A, 23 Okt 2026) - laporan harian planner ke grup WhatsApp "Perencanaan Vista".
// SATU struktur data (DrafLaporan: proyek > panel > pekerjaan/kendala, + catatan & prioritas minggu ini) menjadi sumber
// tunggal teks WhatsApp (formatTeksWhatsApp) dan nanti PDF berkop (Tahap B) - tidak ada jalur data kedua.
// Sumber tiap proyek/panel: 'otomatis' (WO aktif), 'arsip' (panel arsip pilihan admin), 'manual' (diketik admin).
// Penanda sumber HANYA utk layar penyusun - formatTeksWhatsApp tidak menuliskannya.
// Fitur ini TIDAK menulis apa pun ke WO/panel/progress/kendala: semua fungsi di sini hanya membaca (select) atau murni.
// Draf disimpan di localStorage perangkat (keputusan user: tanpa tabel baru) - lihat components/LaporanOutstanding.tsx.
//
// ATURAN PEKERJAAN (turunkanPekerjaanPanel - SATU fungsi utk panel aktif & panel arsip):
// - Dasar: jadwal Raw Schedule panel itu s.d. HARI INI (hari kerja WIB) - pekerjaan yang semestinya sudah dikerjakan.
//   Kode jejak (digeserKe) & token __wiring_ dilewati (aturan sama kodeJadwalAktif), qty 0 dilewati.
// - Status dari checklist (progress per proses), QC dari qc_checklist._global, PACKING dari packing_done,
//   BUSBAR dari checklist pseudo-komponen (getBusbarProgress), NAMEPLATE/YELLOWMARK dari kolom panel-nya.
// - Belum 100% -> pekerjaan outstanding ("(PROSES)" bila sudah mulai). 100% dan selesai TEPAT hari ini
//   (selesaiTepatTanggal / waktu penanda) -> baris ✅. 100% sebelum hari ini -> tidak ditulis (basi, CLAUDE.md B.3).
// - Satu baris per proses: nama proses saja bila semua WP yang terjadwal ikut, selain itu "PROSES WP-1, WP-2".
/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchAllPaged, UKURAN_POTONGAN_ID } from './fetchAllPaged'
import { selesaiTepatTanggal } from './kodeJadwalAktif'
import { getBusbarProgress, prosesBerlakuUntukTipe, statusPenandaPanel } from './panelHelpers'
import { hariKerjaDari, hariKerjaWib } from './tanggalWib'
import { ALL_PROSES } from '../constants/panelTypes'

export type Sumber = 'otomatis' | 'arsip' | 'manual'
export type Pekerjaan = { id: string; teks: string; selesai: boolean }
export type PanelLap = { id: string; src: Sumber; nama: string; panelId: number | null; pekerjaan: Pekerjaan[]; kendala: string[] }
// ringkas = satu baris pendek pengganti daftar panel (mis. WO baru turun belum ada planning).
export type ProyekLap = { id: string; src: Sumber; nama: string; deadline: string; ringkas: string; kendalaUmum: string[]; panels: PanelLap[] }
export type PrioritasLap = { id: string; nama: string; deadline: string; panels: string[] }
export type DrafLaporan = {
  versi: 1
  tanggal: string // YYYY-MM-DD (hari kerja WIB laporan)
  jam: string // "16.00"
  dibuatPada: string // ISO saat tombol Buat laporan diklik
  proyek: ProyekLap[]
  catatan: string[] // NOTE di luar proyek (urut)
  prioritas: PrioritasLap[]
}

let seq = 0
export const idBaru = () => `${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`

// ---------- format tanggal ----------
const HARI = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']
const BLN3 = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES']
const tglUtc = (iso: string) => new Date(`${iso}T00:00:00Z`)
// "2026-10-23" -> "23-OKT-2026" (format laporan manual)
export function fmtTglLaporan(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}-${BLN3[Number(m) - 1]}-${y}`
}
export function judulLaporan(tanggal: string, jam: string): string {
  const d = tglUtc(tanggal)
  const [y, m, dd] = tanggal.split('-')
  return `OUTSTANDING PEKERJAAN HARI ${HARI[d.getUTCDay()]} ${dd}/${m}/${y} ${jam}`.trim()
}
export const jamSekarangWib = (ms = Date.now()) => new Date(ms + 7 * 3600e3).toISOString().slice(11, 16).replace(':', '.')
const tambahHari = (iso: string, n: number) => { const d = tglUtc(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
// Senin-Sabtu minggu berjalan; hari Minggu -> minggu berikutnya.
export function rentangMingguIni(hariIni: string): { dari: string; sampai: string } {
  const dow = tglUtc(hariIni).getUTCDay()
  const senin = dow === 0 ? tambahHari(hariIni, 1) : tambahHari(hariIni, 1 - dow)
  return { dari: senin, sampai: tambahHari(senin, 5) }
}

// ---------- pekerjaan per panel (satu fungsi utk aktif & arsip) ----------
const PROSES_LAP = [...ALL_PROSES, 'NAMEPLATE', 'YELLOWMARK']
const LABEL_PROSES: Record<string, string> = { 'QC TEST': 'QC' }
const labelWp = (wp: string) => String(wp || '').replace(/^WP\s*(\d+)$/i, 'WP-$1')
const urutWp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })

type Unit = { label: string; status: 'outstanding' | 'mulai' | 'selesaiHariIni' | 'basi' }
function barisDariUnit(proses: string, units: Unit[], semuaLabel: string[]): Pekerjaan[] {
  const nama = LABEL_PROSES[proses] || proses
  const out: Pekerjaan[] = []
  const tulis = (dipilih: Unit[], selesai: boolean) => {
    if (!dipilih.length) return
    const labels = dipilih.map((u) => u.label).filter(Boolean)
    const semua = labels.length === 0 || labels.length >= semuaLabel.length
    const mulai = !selesai && dipilih.some((u) => u.status === 'mulai')
    out.push({ id: idBaru(), teks: `${nama}${semua ? '' : ' ' + labels.join(', ')}${mulai ? ' (PROSES)' : ''}`, selesai })
  }
  tulis(units.filter((u) => u.status === 'outstanding' || u.status === 'mulai'), false)
  tulis(units.filter((u) => u.status === 'selesaiHariIni'), true)
  return out
}
const jadwalSampai = (sch: Record<string, any> | null | undefined, hariIni: string) =>
  Object.entries(sch || {}).filter(([t]) => t <= hariIni)
const statusPct = (pct: number): Unit['status'] => (pct >= 100 ? 'basi' : pct > 0 ? 'mulai' : 'outstanding')
const hariIniDari = (waktu: any, hariIni: string) => !!waktu && hariKerjaDari(waktu) === hariIni

export function turunkanPekerjaanPanel(panel: any, rawRows: any[], hariIni: string): Pekerjaan[] {
  const rows = (rawRows || []).filter((r) => Number(r.panel_id ?? r.panelId) === Number(panel?.id))
  const cl = panel?.checklist || {}
  const hasil: Pekerjaan[] = []
  for (const proses of PROSES_LAP) {
    if (!prosesBerlakuUntukTipe(panel?.tipe, proses)) continue
    const prow = rows.filter((r) => r.proses === proses)
    if (!prow.length) continue
    if (proses === 'BUSBAR') {
      const semua = new Set<string>(), due = new Set<string>()
      prow.forEach((r) => Object.entries(r.busbar_schedule || {}).forEach(([t, ks]: [string, any]) => (ks || []).forEach((k: string) => { semua.add(k); if (t <= hariIni) due.add(k) })))
      const units: Unit[] = [...due].map((k) => {
        const pct = getBusbarProgress(panel, k)
        return { label: k, status: pct >= 100 ? (selesaiTepatTanggal(cl[k], 'BUSBAR', hariIni) ? 'selesaiHariIni' : 'basi') : statusPct(pct) }
      })
      hasil.push(...barisDariUnit(proses, units, [...semua]))
      continue
    }
    if (['QC TEST', 'PACKING', 'NAMEPLATE', 'YELLOWMARK'].includes(proses)) {
      // penanda per panel (komponen ["MARKED"]) - cukup "terjadwal s.d. hari ini"
      if (!prow.some((r) => jadwalSampai(r.schedule, hariIni).some(([, es]) => (es || []).length > 0))) continue
      let st: Unit['status']
      if (proses === 'QC TEST' || proses === 'PACKING') {
        const s = statusPenandaPanel(panel, proses)
        const waktu = proses === 'QC TEST' ? (panel?.qc_checklist?._global?.complete_at || panel?.qc_checklist?._global?.updated_at) : panel?.packing_done_at
        st = s === 'DONE' ? (hariIniDari(waktu, hariIni) ? 'selesaiHariIni' : 'basi') : s === 'IN PROGRESS' ? 'mulai' : 'outstanding'
      } else {
        const pre = proses === 'NAMEPLATE' ? 'nameplate' : 'yellowmark'
        const pct = Number(panel?.[`${pre}_progress`]) || 0
        st = pct >= 100 ? (hariIniDari(panel?.[`${pre}_updated_at`], hariIni) ? 'selesaiHariIni' : 'basi') : statusPct(pct)
      }
      hasil.push(...barisDariUnit(proses, [{ label: '', status: st }], ['']))
      continue
    }
    // proses komponen: per WP
    const semuaWp = new Set<string>(), perWp = new Map<string, Set<string>>()
    prow.forEach((r) => Object.entries(r.schedule || {}).forEach(([t, es]: [string, any]) => (es || []).forEach((e: any) => {
      const kodes = (e?.komponen || []).filter((k: string) => k && !k.startsWith('__wiring_') && !e?.digeserKe?.[k] && (Number(cl[k]?.qty) || 0) > 0)
      if (!kodes.length) return
      const wp = labelWp(e.wp)
      semuaWp.add(wp)
      if (t > hariIni) return
      if (!perWp.has(wp)) perWp.set(wp, new Set())
      kodes.forEach((k: string) => perWp.get(wp)!.add(k))
    })))
    const units: Unit[] = [...perWp.entries()].sort(([a], [b]) => urutWp(a, b)).map(([wp, ks]) => {
      const pcts = [...ks].map((k) => Number(cl[k]?.progress?.[proses]) || 0)
      if (pcts.every((p) => p >= 100)) return { label: wp, status: [...ks].some((k) => selesaiTepatTanggal(cl[k], proses, hariIni)) ? 'selesaiHariIni' : 'basi' }
      return { label: wp, status: pcts.some((p) => p > 0) ? 'mulai' : 'outstanding' }
    })
    hasil.push(...barisDariUnit(proses, units, [...semuaWp]))
  }
  return hasil
}

// tanggal jadwal paling awal panel (semua proses) - '' bila belum ada jadwal sama sekali
function jadwalAwal(rows: any[]): string {
  let min = ''
  rows.forEach((r) => {
    Object.entries(r.schedule || {}).forEach(([t, es]: [string, any]) => { if ((es || []).length && (!min || t < min)) min = t })
    Object.entries(r.busbar_schedule || {}).forEach(([t, ks]: [string, any]) => { if ((ks || []).length && (!min || t < min)) min = t })
  })
  return min
}

const upper = (s: string) => String(s || '').trim().toUpperCase()
const kunciProyek = (nama: string, target: string) => `${upper(nama)}|${target || ''}`

// ---------- susun draf otomatis ----------
export type BahanLaporan = {
  woAktif: any[] // work_orders (+ panels) aktif
  raw: any[] // raw_schedule (WO aktif)
  kendalaTerbuka: { proyek: string; panel_id: number | null; teks: string }[]
  hariIni?: string
  jam?: string
}
export function buatLaporanOutstanding(b: BahanLaporan, lama?: DrafLaporan | null): DrafLaporan {
  const hariIni = b.hariIni || hariKerjaWib()
  const rawPer = new Map<number, any[]>()
  b.raw.forEach((r) => { const id = Number(r.panel_id ?? r.panelId); if (!rawPer.has(id)) rawPer.set(id, []); rawPer.get(id)!.push(r) })
  const kendalaPanel = new Map<number, string[]>(), kendalaUmum = new Map<string, string[]>()
  b.kendalaTerbuka.forEach((k) => {
    if (k.panel_id == null) { const n = upper(k.proyek); kendalaUmum.set(n, [...(kendalaUmum.get(n) || []), upper(k.teks)]) }
    else kendalaPanel.set(Number(k.panel_id), [...(kendalaPanel.get(Number(k.panel_id)) || []), upper(k.teks)])
  })
  // kelompok per (nama proyek, deadline) - WO bernomor sama / proyek sama dgn deadline sama digabung
  const grup = new Map<string, { nama: string; target: string; woDibuat: string; panels: any[] }>()
  b.woAktif.forEach((w) => {
    const k = kunciProyek(w.proyek, w.target)
    const g = grup.get(k) || { nama: upper(w.proyek), target: w.target || '', woDibuat: w.created_at || '', panels: [] }
    if (w.created_at && (!g.woDibuat || w.created_at < g.woDibuat)) g.woDibuat = w.created_at
    g.panels.push(...[...(w.panels || [])].sort((a: any, c: any) => (Number(a.no_pnl) || 0) - (Number(c.no_pnl) || 0)))
    grup.set(k, g)
  })
  const umumTerpakai = new Set<string>()
  const proyek: ProyekLap[] = []
  ;[...grup.values()].sort((a, c) => (a.target || '9999').localeCompare(c.target || '9999') || a.nama.localeCompare(c.nama)).forEach((g) => {
    const umum = umumTerpakai.has(g.nama) ? [] : (kendalaUmum.get(g.nama) || [])
    if (umum.length) umumTerpakai.add(g.nama)
    const panels: PanelLap[] = []
    let awal = ''
    g.panels.forEach((p) => {
      const rows = rawPer.get(Number(p.id)) || []
      const a = jadwalAwal(rows); if (a && (!awal || a < awal)) awal = a
      const pekerjaan = turunkanPekerjaanPanel(p, rows, hariIni)
      const kd = kendalaPanel.get(Number(p.id)) || []
      if (pekerjaan.length || kd.length) panels.push({ id: idBaru(), src: 'otomatis', nama: String(p.nama || '').trim(), panelId: Number(p.id), pekerjaan, kendala: kd })
    })
    let ringkas = ''
    if (!panels.length) {
      if (!awal) ringkas = `WO TURUN TGL ${fmtTglLaporan(hariKerjaDari(g.woDibuat))}, BELUM START PENGERJAAN`
      else if (awal > hariIni) ringkas = `BELUM START, JADWAL MULAI TGL ${fmtTglLaporan(awal)}`
      else if (!umum.length) return // semua sudah selesai sebelum hari ini & tanpa kendala -> tidak ditulis
    }
    proyek.push({ id: idBaru(), src: 'otomatis', nama: g.nama, deadline: g.target, ringkas, kendalaUmum: umum, panels: ringkas ? [] : panels })
  })
  // pertahankan entri arsip & manual + catatan dari draf lama (Buat ulang hanya mengganti bagian otomatis)
  const tetap = (lama?.proyek || []).filter((p) => p.src !== 'otomatis')
  return {
    versi: 1, tanggal: hariIni, jam: b.jam || jamSekarangWib(), dibuatPada: new Date().toISOString(),
    proyek: [...proyek, ...tetap], catatan: lama?.catatan ? [...lama.catatan] : [],
    prioritas: buatPrioritasMingguIni(b.woAktif, b.raw, hariIni),
  }
}

// "Prioritas Pengerjaan Minggu Ini" - draf dari Raw Schedule Senin-Sabtu minggu berjalan: panel yang punya pekerjaan
// belum selesai terjadwal di rentang itu, per proyek, urut deadline terdekat. Bisa diedit di penyusun.
export function buatPrioritasMingguIni(woAktif: any[], raw: any[], hariIni: string): PrioritasLap[] {
  const { dari, sampai } = rentangMingguIni(hariIni)
  const dalam = (t: string) => t >= dari && t <= sampai
  const panelById = new Map<number, any>()
  woAktif.forEach((w) => (w.panels || []).forEach((p: any) => panelById.set(Number(p.id), { ...p, _wo: w })))
  const aktif = new Set<number>()
  raw.forEach((r) => {
    const id = Number(r.panel_id ?? r.panelId), p = panelById.get(id)
    if (!p || aktif.has(id) || !prosesBerlakuUntukTipe(p.tipe, r.proses)) return
    const cl = p.checklist || {}
    if (r.proses === 'BUSBAR') {
      if (Object.entries(r.busbar_schedule || {}).some(([t, ks]: [string, any]) => dalam(t) && (ks || []).some((k: string) => getBusbarProgress(p, k) < 100))) aktif.add(id)
      return
    }
    const ada = Object.entries(r.schedule || {}).some(([t, es]: [string, any]) => dalam(t) && (es || []).some((e: any) => {
      if (r.proses === 'QC TEST' || r.proses === 'PACKING') return statusPenandaPanel(p, r.proses) !== 'DONE'
      if (r.proses === 'NAMEPLATE' || r.proses === 'YELLOWMARK') return (Number(p[`${r.proses.toLowerCase()}_progress`]) || 0) < 100
      return (e?.komponen || []).some((k: string) => k && !k.startsWith('__wiring_') && !e?.digeserKe?.[k] && (Number(cl[k]?.qty) || 0) > 0 && (Number(cl[k]?.progress?.[r.proses]) || 0) < 100)
    }))
    if (ada) aktif.add(id)
  })
  const grup = new Map<string, PrioritasLap & { _p: any[] }>()
  aktif.forEach((id) => {
    const p = panelById.get(id), w = p._wo, k = kunciProyek(w.proyek, w.target)
    const g = grup.get(k) || { id: idBaru(), nama: upper(w.proyek), deadline: w.target || '', panels: [], _p: [] }
    g._p.push(p); grup.set(k, g)
  })
  return [...grup.values()].sort((a, c) => (a.deadline || '9999').localeCompare(c.deadline || '9999') || a.nama.localeCompare(c.nama))
    .map(({ _p, ...g }) => ({ ...g, panels: _p.sort((a, c) => (Number(a.no_pnl) || 0) - (Number(c.no_pnl) || 0)).map((p) => String(p.nama || '').trim()) }))
}

// ---------- teks WhatsApp (satu-satunya pembentuk teks) ----------
export function formatTeksWhatsApp(d: DrafLaporan): string {
  const L: string[] = [judulLaporan(d.tanggal, d.jam), '']
  d.proyek.forEach((p) => {
    L.push(`${p.nama.trim() || 'PROYEK'}${p.deadline ? ` (${fmtTglLaporan(p.deadline)})` : ''}`)
    if (p.ringkas.trim()) L.push(`* ${p.ringkas.trim()}`)
    p.kendalaUmum.filter((k) => k.trim()).forEach((k) => L.push(`- ${k.trim()}`))
    if (!p.ringkas.trim()) {
      let no = 0
      p.panels.forEach((pn) => {
        if (pn.nama.trim()) L.push(`${++no}. ${pn.nama.trim()}`)
        pn.pekerjaan.filter((j) => j.teks.trim()).forEach((j) => L.push(`* ${j.teks.trim()}${j.selesai ? ' ✅' : ''}`))
        pn.kendala.filter((k) => k.trim()).forEach((k) => L.push(`- ${k.trim()}`))
      })
    }
    L.push('')
  })
  const cat = d.catatan.map((c) => c.trim()).filter(Boolean)
  if (cat.length) { L.push('NOTE :'); cat.forEach((c, i) => L.push(`${i + 1}. ${c}`)); L.push('') }
  const prio = d.prioritas.filter((p) => p.nama.trim() || p.panels.some((x) => x.trim()))
  if (prio.length) {
    L.push('PRIORITAS PENGERJAAN MINGGU INI', '')
    prio.forEach((p) => {
      L.push(`${p.nama.trim()}${p.deadline ? ` (${fmtTglLaporan(p.deadline)})` : ''}`)
      p.panels.map((x) => x.trim()).filter(Boolean).forEach((x, i) => L.push(`${i + 1}. ${x}`))
      L.push('')
    })
  }
  return L.join('\n').replace(/\n+$/, '\n')
}

// ---------- muat data (baca saja; paginasi .range + urutan stabil, error dilempar) ----------

export async function muatBahanOtomatis(db: any): Promise<Pick<BahanLaporan, 'woAktif' | 'raw'>> {
  const wo = await fetchAllPaged((a, z) => db.from('work_orders').select('id,wo,proyek,target,created_at').is('deleted_at', null).or('is_archived.is.null,is_archived.eq.false').order('id').range(a, z))
  const ids = wo.map((w: any) => w.id)
  const panels = await muatPerPotongan(ids, (pot, a, z) => db.from('panels').select('*').in('wo_id', pot).is('deleted_at', null).order('id').range(a, z))
  const raw = await muatPerPotongan(ids, (pot, a, z) => db.from('raw_schedule').select('id,wo_id,panel_id,proyek,panel,proses,schedule,busbar_schedule').in('wo_id', pot).is('deleted_at', null).order('id').range(a, z))
  const per = new Map<number, any[]>()
  panels.forEach((p: any) => { if (!per.has(p.wo_id)) per.set(p.wo_id, []); per.get(p.wo_id)!.push(p) })
  return { woAktif: wo.map((w: any) => ({ ...w, panels: per.get(w.id) || [] })), raw }
}
async function muatPerPotongan(ids: any[], build: (pot: any[], a: number, z: number) => any): Promise<any[]> {
  const out: any[] = []
  for (let i = 0; i < ids.length; i += UKURAN_POTONGAN_ID) {
    const pot = ids.slice(i, i + UKURAN_POTONGAN_ID)
    out.push(...await fetchAllPaged((a, z) => build(pot, a, z)))
  }
  return out
}

// ---------- arsip ----------
export type PanelArsip = { id: number; nama: string; tipe: string; woId: number; target: string; diarsipkanPada: string; snapshot: number; pekerjaan: Pekerjaan[]; belumTuntas: boolean }
export type GrupArsip = { kunci: string; wo: string; proyek: string; targets: string[]; panels: PanelArsip[] }
export async function muatPilihanArsip(db: any, o: { hari?: number; kecualiPanelIds?: Set<number> } = {}): Promise<GrupArsip[]> {
  const batas = new Date(Date.now() - (o.hari ?? 60) * 864e5).toISOString()
  const pa = await fetchAllPaged((a, z) => db.from('panels_archived').select('*').gte('diarsipkan_pada', batas).order('id').range(a, z))
  const ids = pa.map((p: any) => p.id)
  const raw = await muatPerPotongan(ids, (pot, a, z) => db.from('raw_schedule_archived').select('id,wo_id,panel_id,proses,schedule,busbar_schedule').in('panel_id', pot).order('id').range(a, z))
  const woIds = [...new Set(pa.map((p: any) => p.wo_id))]
  const wo = await muatPerPotongan(woIds, (pot, a, z) => db.from('work_orders').select('id,wo,proyek,target').in('id', pot).order('id').range(a, z))
  const woMap = new Map<number, any>(wo.map((w: any) => [w.id, w]))
  const hariIni = hariKerjaWib()
  const grup = new Map<string, GrupArsip>()
  pa.forEach((p: any) => {
    if (o.kecualiPanelIds?.has(Number(p.id))) return // panel yg sudah ada sbg otomatis (mis. batal arsip) tidak dobel
    const w = woMap.get(p.wo_id) || {}
    const woNo = String(p.wo_number_snapshot ?? w.wo ?? '').trim(), nama = upper(p.proyek_snapshot || w.proyek || '')
    const k = `${woNo}|${nama}`
    const pekerjaan = turunkanPekerjaanPanel(p, raw, hariIni)
    const item: PanelArsip = {
      id: Number(p.id), nama: String(p.nama || '').trim(), tipe: p.tipe, woId: p.wo_id, target: w.target || '',
      diarsipkanPada: p.diarsipkan_pada, snapshot: Number(p.progress_snapshot) || 0, pekerjaan,
      belumTuntas: pekerjaan.some((j) => !j.selesai) || (Number(p.progress_snapshot) || 0) < 100,
    }
    const g = grup.get(k) || { kunci: k, wo: woNo, proyek: nama, targets: [], panels: [] }
    if (item.target && !g.targets.includes(item.target)) g.targets.push(item.target)
    g.panels.push(item); grup.set(k, g)
  })
  const terakhir = (g: GrupArsip) => g.panels.reduce((m, p) => (p.diarsipkanPada > m ? p.diarsipkanPada : m), '')
  return [...grup.values()].map((g) => ({ ...g, targets: g.targets.sort() })).sort((a, b) => terakhir(b).localeCompare(terakhir(a)))
}
// panel arsip terpilih -> entri proyek 'arsip' (per nomor WO / proyek); pekerjaan = sisa (yang belum selesai)
export function proyekDariArsip(g: GrupArsip, pilih: PanelArsip[], kendalaTerbuka: { panel_id: number | null; teks: string }[]): ProyekLap {
  const kd = (id: number) => kendalaTerbuka.filter((k) => Number(k.panel_id) === id).map((k) => upper(k.teks))
  const targets = pilih.map((p) => p.target).filter(Boolean).sort()
  return {
    id: idBaru(), src: 'arsip', nama: g.proyek, deadline: targets[0] || '', ringkas: '', kendalaUmum: [],
    panels: pilih.map((p) => ({ id: idBaru(), src: 'arsip', nama: p.nama, panelId: p.id, pekerjaan: p.pekerjaan.filter((j) => !j.selesai).map((j) => ({ ...j, id: idBaru() })), kendala: kd(p.id) })),
  }
}
export const panelIdsDalamDraf = (d: DrafLaporan | null) => new Set<number>((d?.proyek || []).flatMap((p) => p.panels.map((x) => x.panelId)).filter((x): x is number => x != null))
export const proyekManualBaru = (): ProyekLap => ({ id: idBaru(), src: 'manual', nama: '', deadline: '', ringkas: '', kendalaUmum: [], panels: [panelManualBaru()] })
export const panelManualBaru = (): PanelLap => ({ id: idBaru(), src: 'manual', nama: '', panelId: null, pekerjaan: [{ id: idBaru(), teks: '', selesai: false }], kendala: [] })

// ---------- simpan draf di perangkat (localStorage; gagal -> tetap jalan tanpa simpan) ----------
export type SimpananLaporan = { draf: DrafLaporan; teksWa: string; teksSistem: string }
const kunciSimpan = (user: string) => `vt_laporan_outstanding_v1:${user || 'admin'}`
export function bacaSimpanan(user: string): SimpananLaporan | null {
  try {
    const s = localStorage.getItem(kunciSimpan(user)); if (!s) return null
    const j = JSON.parse(s)
    return j?.draf?.versi === 1 && Array.isArray(j.draf.proyek) ? j : null
  } catch { return null }
}
export function tulisSimpanan(user: string, s: SimpananLaporan): boolean {
  try { localStorage.setItem(kunciSimpan(user), JSON.stringify(s)); return true } catch { return false }
}
