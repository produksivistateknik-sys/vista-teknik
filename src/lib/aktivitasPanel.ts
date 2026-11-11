// AKTIVITAS PANEL HARIAN (5 Nov 2026, permintaan Pak Indra) - isi tab Aktivitas Panel di Dashboard: panel apa yang aktif
// pada SATU HARI KERJA WIB (pergantian 07.00, lib/tanggalWib) dan apa yang dikerjakan. Fungsi murni (tanpa query/React):
// semua data diberikan pemanggil (hooks/useAktivitasPanel). Tanpa tabel baru.
// Satu SEL = panel + kode komponen + proses. Dengan a = getProgressAsOfDate hari D dan b = D-1 (fungsi kolom Status
// Rencana Harian, carry-forward):
// - Sel AKTIF = ada timer hari D, atau a berbeda dari b. Entri riwayat/checkpoint saja TIDAK cukup: simpanan ulang nilai
//   sama (Simpan Section menyimpan komponen yang tidak berubah) bukan aktivitas.
// - Berjalan: timer belum ditutup (hanya hari ini; di hari lampau tidak diberi label berjalan).
// - Selesai: mencapai 100% hari itu (a>=100, b<100). Menghentikan timer BUKAN selesai. Checkpoint juga bukan sumber
//   selesai: log mencatat 100% yang lalu dikoreksi (580/FS.23/POTONG). selesaiTepatTanggal tidak dipakai: ikut menghitung
//   simpanan ulang komponen yang sudah 100% sebelumnya.
// - Dikerjakan lagi: ada timer pada komponen yang SUDAH 100% sebelum hari itu; tidak dihitung selesai (keputusan user).
// - In progress: status IN PROGRESS (progres > 0 dan belum 100%).
// - Dimulai ("Timer dimulai, belum ada progres"): timer sudah berhenti tapi status masih TO DO/NOT YET (kasus AGIS
//   580/FS.14/POTONG). Bukan in progress; punya pil sendiri (ada timer berjam-jam yang progresnya baru diisi belakangan).
// Status memakai computeProsesStatus, fungsi yang SAMA dgn Rencana Harian. HARI INI angkanya getCcpAwarePipelineProgressMap;
// HARI LAMPAU angka per tanggal itu (getProgressAsOfDate), karena ccp hanya tahu kondisi TERKINI.
// Berjalan didahulukan: sel dgn timer berjalan hanya dihitung di Berjalan, tidak ganda.
// PROSES SPESIAL (CLAUDE.md B.2): BUSBAR ikut jalur sel (pseudo-komponen di checklist; ccp tidak dipakai, lewat
// getCcpAwareValue). QC TEST/PACKING/NAMEPLATE/YELLOWMARK = baris satu panel dari waktu TERAKHIR yang tersimpan di tabel panels:
// tampil di hari yang memuat waktu itu, tanpa riwayat per hari ("berdasarkan waktu terakhir", keputusan user).
// Hanya panel aktif (woData): panel arsip tidak ikut (keputusan user versi pertama), layar memberi catatan.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ALL_PROSES } from '../constants/panelTypes'
import {
  computeProsesStatus, getCcpAwarePipelineProgressMap, type ProsesStatus, getEffCfgGlobal, getProgressAsOfDate, getQtyProsesAsOfDate, getRelevantProsesForKode,
  panelOverallCcpAware, PROSES_QTY_GRANULAR, PROSES_TANPA_MAPPING_KOMPONEN, statusPenandaPanel,
} from './panelHelpers'
import { daftarOperatorHarian, namaDariCheckpoint } from './operatorHarian'
import { menitGabungan, type TimerJejak } from './jejakPengerjaan'
import { hariKerjaDari } from './tanggalWib'
import { petaShiftHari, kelompokPerShift, type InfoShift, type Shift, type SumberShift } from './shiftSesi'

export type KategoriAktivitas = 'berjalan' | 'selesai' | 'progres' | 'lagi' | 'dimulai'
export type TimerJalan = { nama: string; mulai: string; tahap: string | null }
// Operator per shift (8 Nov 2026, estafet Shift 1/2; lib/shiftSesi). shift null = tidak diketahui ("Shift ?"). menit = gabungan
// rentang sesi shift itu (tidak menjumlah orang). Kosong bila sel tanpa timer (nama dari checkpoint saja).
export type OperatorShift = { shift: Shift | null; nama: string[]; menit: number; berjalan: boolean; dariSesiLain: boolean; sumber: SumberShift[] }
export type BarisAktivitas = {
  kunci: string; proses: string; kode: string; namaKomponen: string; kategori: KategoriAktivitas
  pct: number | null; qty: string | null; operator: string[]; perShift: OperatorShift[]; jalan: TimerJalan[]; menit: number
  tahapTimer: string[]; catatan: string[]; basi: boolean; waktuTerakhir: string | null; satuPanel: boolean; statusPipeline: ProsesStatus | null
}
export type TahapAktivitas = { proses: string; baris: BarisAktivitas[] }
export type JumlahAktivitas = { berjalan: number; selesai: number; progres: number; lagi: number; dimulai: number }
export type KartuAktivitas = { panelId: number; nama: string; wo: string; proyek: string; progres: number; jumlah: JumlahAktivitas; tahap: TahapAktivitas[] }
export type HasilAktivitas = { kartu: KartuAktivitas[]; jumlah: JumlahAktivitas; timerDiLuar: number }
// Warna kartu (hanya tampilan): status terpenting berjalan > in progress > selesai > belum ada progres.
// 'Dikerjakan lagi' dihitung in progress: pekerjaan berlangsung tanpa hasil selesai baru hari itu.
export type NadaKartu = 'berjalan' | 'progres' | 'selesai' | 'netral'
export const nadaKartu = (j: JumlahAktivitas): NadaKartu =>
  j.berjalan > 0 ? 'berjalan' : j.progres + j.lagi > 0 ? 'progres' : j.selesai > 0 ? 'selesai' : 'netral'

const SELISIH_MIN = 0.001
const BATAS_BASI_MS = 12 * 3600000 // sama dgn tutup_timer_kelewat_12jam
const URUTAN_TAHAP = [...ALL_PROSES, 'NAMEPLATE', 'YELLOWMARK']
const URUTAN_KATEGORI: Record<KategoriAktivitas, number> = { berjalan: 0, progres: 1, dimulai: 2, lagi: 3, selesai: 4 }
const KET_WAKTU_TERAKHIR = 'berdasarkan waktu terakhir'

export const tanggalSebelum = (tanggal: string) => new Date(Date.parse(tanggal + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10)
const kunciSel = (panelId: any, kode: any, proses: any) => `${panelId}|${kode}|${proses}`
const nol = (): JumlahAktivitas => ({ berjalan: 0, selesai: 0, progres: 0, lagi: 0, dimulai: 0 })
function indeks(rows: any[]): Map<string, any[]> {
  const m = new Map<string, any[]>()
  rows.forEach((r) => { const k = kunciSel(r.panel_id, r.kode_komponen, r.proses); const a = m.get(k); if (a) a.push(r); else m.set(k, [r]) })
  return m
}
const asOf = (cl: any, proses: string, tanggal: string) => Number(getProgressAsOfDate(cl, proses, tanggal)) || 0

// Kategori satu sel; null = tidak aktif hari itu.
export function nilaiSel(o: { panel: any; kode: string; proses: string; tanggal: string; hariIni: string; timer: any[]; ccpMap: Record<string, number> }) {
  const { panel, kode, proses, tanggal, hariIni, timer, ccpMap } = o
  const cl = panel?.checklist?.[kode]
  const a = asOf(cl, proses, tanggal)
  const b = asOf(cl, proses, tanggalSebelum(tanggal))
  const adaTimer = timer.length > 0
  if (!adaTimer && Math.abs(a - b) <= SELISIH_MIN) return null
  const hariIniDilihat = tanggal === hariIni
  const peta = hariIniDilihat ? getCcpAwarePipelineProgressMap(ccpMap, panel.id, kode, cl)
    : Object.fromEntries(ALL_PROSES.map((pr) => [pr, asOf(cl, pr, tanggal)]))
  const pct = Number(peta[proses]) || 0
  const statusPipeline = computeProsesStatus(peta, proses, getRelevantProsesForKode(kode, panel.tipe))
  const berjalan = hariIniDilihat && timer.some((t) => !t.selesai)
  const kategori: KategoriAktivitas = berjalan ? 'berjalan'
    : statusPipeline === 'DONE' ? (b >= 100 ? 'lagi' : 'selesai')
      : statusPipeline === 'IN PROGRESS' || !adaTimer ? 'progres' : 'dimulai'
  return { kategori, pct, statusPipeline, dikoreksiTurun: a < b - SELISIH_MIN }
}

function barisSel(o: { panel: any; kode: string; proses: string; tanggal: string; hariIni: string; timer: any[]; checkpoint: any[]; ccpMap: Record<string, number>; namaById: (id: any) => string | undefined; sekarangMs: number; petaShift: Map<string, InfoShift> }): BarisAktivitas | null {
  const { panel, kode, proses, tanggal, hariIni, timer, checkpoint, namaById, sekarangMs, petaShift } = o
  const n = nilaiSel(o)
  if (!n) return null
  const cl = panel.checklist?.[kode]
  const hariIniDilihat = tanggal === hariIni
  const berjalan = hariIniDilihat ? timer.filter((t) => !t.selesai) : []
  const belumDitutup = !hariIniDilihat && timer.some((t) => !t.selesai)
  // Sesi selesai saja di hari lampau: timer yang masih terbuka tidak dihitung sampai "sekarang".
  const menit = menitGabungan((hariIniDilihat ? timer : timer.filter((t) => t.selesai)) as TimerJejak[], sekarangMs)
  const op = daftarOperatorHarian({ timer, rencanaIds: [], checkpointNama: namaDariCheckpoint(checkpoint), namaById, tanggal, hariIni, sekarangMs })
  const item = getEffCfgGlobal(panel.tipe)?.wps?.flatMap((w: any) => w.items).find((it: any) => it.kode === kode)
  const total = Number(cl?.qty) || 0
  const basi = berjalan.some((t) => sekarangMs - Date.parse(t.mulai) > BATAS_BASI_MS)
  const catatan: string[] = []
  if (n.kategori === 'lagi') catatan.push('sudah 100% sebelum hari ini')
  if (n.kategori === 'dimulai') catatan.push('Timer dimulai, belum ada progres')
  if (n.dikoreksiTurun) catatan.push('dikoreksi turun')
  if (belumDitutup) catatan.push('timer belum ditutup')
  if (basi) catatan.push('timer lebih dari 12 jam')
  return {
    kunci: kunciSel(panel.id, kode, proses), proses, kode, namaKomponen: item?.nama || '', kategori: n.kategori, pct: n.pct,
    qty: PROSES_QTY_GRANULAR.includes(proses) && total > 0 ? `${Number(getQtyProsesAsOfDate(cl, proses, tanggal)) || 0}/${total}` : null,
    operator: op.pengerja.map((e) => e.nama),
    perShift: kelompokPerShift(timer, petaShift).map((g) => ({
      shift: g.shift, dariSesiLain: g.dariSesiLain, sumber: g.sumber,
      nama: [...new Set(g.sesi.map((t: any) => namaById(t.pekerja_id) || `#${t.pekerja_id}`))],
      menit: menitGabungan((hariIniDilihat ? g.sesi : g.sesi.filter((t: any) => t.selesai)) as TimerJejak[], sekarangMs),
      berjalan: hariIniDilihat && g.sesi.some((t: any) => !t.selesai),
    })),
    jalan: berjalan.map((t) => ({ nama: namaById(t.pekerja_id) || `#${t.pekerja_id}`, mulai: t.mulai, tahap: t.tahap || null })),
    menit, tahapTimer: [...new Set(timer.map((t) => t.tahap).filter(Boolean))] as string[], catatan, basi, waktuTerakhir: null, satuPanel: false, statusPipeline: n.statusPipeline,
  }
}

// Baris satu panel: QC TEST/PACKING/NAMEPLATE/YELLOWMARK (tidak punya timer maupun checkpoint). Status QC 'to_do' bukan
// pekerjaan (hanya penanda antrean) -> tidak tampil.
export function barisPenandaPanel(panel: any, tanggal: string): BarisAktivitas[] {
  const hasil: BarisAktivitas[] = []
  const tambah = (proses: string, kategori: KategoriAktivitas, pct: number | null, waktu: string, oleh: any) => hasil.push({
    kunci: kunciSel(panel.id, 'PANEL', proses), proses, kode: 'Satu panel', namaKomponen: '', kategori, pct, qty: null,
    operator: oleh ? [String(oleh)] : [], perShift: [], jalan: [], menit: 0, tahapTimer: [], catatan: [KET_WAKTU_TERAKHIR], basi: false, waktuTerakhir: waktu, satuPanel: true, statusPipeline: null,
  })
  const g = panel?.qc_checklist?._global
  const statusQc = statusPenandaPanel(panel, 'QC TEST')
  const waktuQc = statusQc === 'DONE' ? g?.complete_at || g?.updated_at : g?.updated_at
  if (statusQc !== 'TO DO' && hariKerjaDari(waktuQc) === tanggal) tambah('QC TEST', statusQc === 'DONE' ? 'selesai' : 'progres', statusQc === 'DONE' ? 100 : null, waktuQc, g?.updated_by)
  if (statusPenandaPanel(panel, 'PACKING') === 'DONE' && hariKerjaDari(panel.packing_done_at) === tanggal) tambah('PACKING', 'selesai', 100, panel.packing_done_at, panel.packing_done_by)
  for (const [proses, awalan] of [['NAMEPLATE', 'nameplate'], ['YELLOWMARK', 'yellowmark']]) {
    const pct = Number(panel?.[awalan + '_progress']) || 0, waktu = panel?.[awalan + '_updated_at']
    if (pct > 0 && hariKerjaDari(waktu) === tanggal) tambah(proses, pct >= 100 ? 'selesai' : 'progres', pct, waktu, panel[awalan + '_updated_by'])
  }
  return hasil
}

export function susunAktivitasHari(o: {
  woData: any[]
  timer: any[]        // timer tanggal D + (bila D hari ini) semua yang masih berjalan: operatorHistoryData useTimerHariRencana
  checkpoint: any[]   // progress_checkpoint_log tanggal D (hanya nama cadangan)
  tanggal: string; hariIni: string; ccpMap: Record<string, number>; namaById: (id: any) => string | undefined; sekarangMs?: number
}): HasilAktivitas {
  const { tanggal, hariIni, ccpMap, namaById } = o
  const sekarangMs = o.sekarangMs ?? Date.now()
  const idxTimer = indeks((o.timer || []).filter((t) => !String(t.kode_komponen).startsWith('__wiring_')))
  const idxCp = indeks(o.checkpoint || [])
  // Shift tiap sesi timer hari itu (lib/shiftSesi): history sel yang sama, lalu sesi lain operator itu hari itu.
  const panelById = new Map<number, any>()
  for (const w of o.woData || []) for (const p of w.panels || []) panelById.set(Number(p.id), p)
  const timerHari = (o.timer || []).filter((t) => !String(t.kode_komponen).startsWith('__wiring_'))
  const petaShift = petaShiftHari(timerHari, (t: any) => panelById.get(Number(t.panel_id))?.checklist?.[t.kode_komponen]?.history?.[t.proses], sekarangMs)
  const idDaftar = new Set<number>()
  const kartu: KartuAktivitas[] = []
  for (const w of o.woData || []) for (const panel of w.panels || []) {
    idDaftar.add(Number(panel.id))
    const sel = new Map<string, [string, string]>()
    for (const [kode, cl] of Object.entries<any>(panel.checklist || {})) {
      if (kode.startsWith('__wiring_')) continue
      for (const proses of new Set([...Object.keys(cl?.progressByDate || {}), ...Object.keys(cl?.history || {}), ...Object.keys(cl?.progress || {})])) {
        if (!PROSES_TANPA_MAPPING_KOMPONEN.includes(proses)) sel.set(kunciSel(panel.id, kode, proses), [kode, proses])
      }
    }
    for (const t of idxTimer.keys()) {
      const [pid, kode, proses] = t.split('|')
      if (Number(pid) === Number(panel.id) && !sel.has(t)) sel.set(t, [kode, proses])
    }
    const baris: BarisAktivitas[] = barisPenandaPanel(panel, tanggal)
    for (const [k, [kode, proses]] of sel) {
      const b = barisSel({ panel, kode, proses, tanggal, hariIni, timer: idxTimer.get(k) || [], checkpoint: idxCp.get(k) || [], ccpMap, namaById, sekarangMs, petaShift })
      if (b) baris.push(b)
    }
    if (!baris.length) continue
    const jumlah = nol()
    baris.forEach((b) => { jumlah[b.kategori]++ })
    const prosesAda = [...new Set(baris.map((b) => b.proses))].sort((x, y) => URUTAN_TAHAP.indexOf(x) - URUTAN_TAHAP.indexOf(y))
    kartu.push({
      panelId: panel.id, nama: panel.nama, wo: w.wo, proyek: w.proyek, progres: panelOverallCcpAware(panel, undefined, ccpMap), jumlah,
      tahap: prosesAda.map((proses) => ({
        proses,
        baris: baris.filter((b) => b.proses === proses).sort((x, y) => URUTAN_KATEGORI[x.kategori] - URUTAN_KATEGORI[y.kategori] || x.kode.localeCompare(y.kode, undefined, { numeric: true })),
      })),
    })
  }
  kartu.sort((a, b) => Number(b.jumlah.berjalan > 0) - Number(a.jumlah.berjalan > 0))
  const jumlah = nol()
  kartu.forEach((k) => { (Object.keys(jumlah) as KategoriAktivitas[]).forEach((x) => { jumlah[x] += k.jumlah[x] }) })
  return { kartu, jumlah, timerDiLuar: (o.timer || []).filter((t) => !idDaftar.has(Number(t.panel_id))).length }
}
