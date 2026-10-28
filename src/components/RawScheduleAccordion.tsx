import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { ALL_PROSES, PANEL_TYPES, PROSES_COLOR, PRIORITAS_COLOR, PROSES_ORANG_RAW_GLOBAL, PRIORITAS } from '../constants/panelTypes'
import { TODAY, addDays, getDayLabel } from '../lib/dateHelpers'
import { formatBusbarTahapTooltip, isKomponenRelevant, getRelevantProsesForKode } from '../lib/panelHelpers'
import { cariPelanggaranUrutan, petaTandaUrutan, useVersiAturanUrutan, type KonteksUrutan, type PelanggaranUrutan } from '../lib/urutanProses'
import { useKonfirmasiUrutan, TombolDaftarUrutan } from './KonfirmasiUrutanProses'
import { teksOperatorPerTanggal, formatBusbarTahapOperator, indeksTimer, kunciTimer } from '../lib/operatorProgres'
import { bandingkanBarisRaw, zonaDari, hitungTargetDrop, type Zona, type TargetDrop } from '../lib/rawPanelOrder'
import { menitPerPcs, kapasitasPada, hitungTerpakaiHari } from '../lib/kapasitasHari'
import { buatPetaDeadlinePanel, petaDeadlinePerTanggal, infoDeadline } from '../lib/deadlineRaw'
import { PROSES_ORANG_RAW, entriesTanpaSelesai } from '../lib/isiSelJadwal'
import { kodeBusbarBisaDipindah, togglePenanda } from '../lib/jadwalPindah'
import { withRetry } from '../lib/withRetry'
import { rencanakanPindahAccordion, pecahKunci, kunciChip, teksRingkasHeader, type HasilPindahAcc } from '../lib/pindahAccordion'
import { teksDilewati } from '../lib/relevansiJadwal'
import { konfirmasiTimerBerjalan } from '../lib/timerBerjalan'
import { usePindahMulti } from '../hooks/usePindahMulti'
import { useModalJadwalSel } from './ModalJadwalSel'
import { useUrutanPanel } from '../hooks/useUrutanPanel'
import { useAturKapasitas } from './ModalAturKapasitas'
import { useTambahPanelRaw } from './ModalTambahPanelRaw'
import { useRiwayatQty } from './RiwayatQty'
import { useNotifAvailable } from './NotifAvailable'
import { useKartuHari } from './KartuHari'
import type { IoJadwalRaw } from '../lib/ioJadwalRaw'
import type { RepoJadwalRaw } from '../lib/repoJadwalRaw'
import { buatSupabaseRepo } from '../lib/supabaseRepoJadwalRaw'
import { buatPenjagaUji, WO_UJI_RAW_PERWP } from '../lib/penjagaUjiWo'
import { fetchPanelOrderMap } from '../lib/rawPanelOrder'
import { supabase } from '../lib/supabase'
import { susunPivot, type BlokPanel, type GrupKomponen, type BarisKomponen, type Penanda, type ChipProses, type RingkasanProses } from '../lib/rawPivot'

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// RAW SCHEDULE ACCORDION PER WP (Tahap 1 migrasi, 9 Okt 2026) - tampilan per WP dari data produksi.
// Tahap 2 (9 Okt 2026): pilih & PINDAH (Ctrl/Alt/Shift+klik, lasso, drag grup, Ctrl+X/V, Ctrl+Z) lewat jalur
// yang SAMA dgn tampilan lama (lib/pindahAccordion -> hooks/usePindahMulti -> RPC v2 + Undo). Masa SANDBOX memori
// (10-28 Okt 2026) selesai: sejak Tahap A penukaran (28 Okt 2026) memakai data & fungsi simpan ASLI App, dibatasi
// saklar MODE_RAW_PER_WP (pembungkus di bawah): 'uji' = hanya WO uji yang tampil & boleh ditulis (lib/penjagaUjiWo).
// Tahap 3a: klik penanda
// QC/PACKING = toggle, salin-GABUNG (Copy di modal drag / Ctrl+C -> Ctrl+V), menu klik kanan.
// Tahap 3b: klik sel -> pilih proses -> modal edit BERSAMA tampilan lama (components/ModalJadwalSel.tsx: tambah/
// edit/hapus WP & komponen, BUSBAR, bobot WIRING, cek kapasitas/kuota + swap) ; menu klik kanan Edit & Hapus WP.
// Tahap 3c: prioritas (dropdown) & urutan panel (menu ⋮), Atur Kapasitas (klik kartu kapasitas), Tambah Panel,
// Riwayat Perubahan Qty, notifikasi komponen available - semuanya bagian BERSAMA dgn tampilan lama.
// Tahap 3d: klik header tanggal = kartu hari (bersama, baca-saja), geser urutan panel dgn drag ⠿ (target dihitung
// hitungTargetDrop yang sama dgn tampilan lama, posisi blok dari DATA), tombol Delete = Hapus WP sel terpilih.
// Menggantikan maket dummy RawScheduleSandbox (keputusan user). Raw Schedule asli TETAP jalan berdampingan
// sampai paritas tercapai; semua aksi tulis (pindah/edit/hapus) dibawa di Tahap 2-3.
//
// Satu sumber logika dgn tampilan lama: susunan data lib/rawPivot.ts, urutan panel lib/rawPanelOrder.ts,
// kapasitas lib/kapasitasHari.ts, deadline lib/deadlineRaw.ts. Tanpa request per baris/komponen - semua
// dihitung dari data yang sudah dimuat.
//
// Per panel: WP1..WPn (accordion) -> BUSBAR (accordion) -> QC TEST & PACKING (penanda, tanpa accordion).
// Header tertutup = ringkasan chip "PROSES n" (✓ bila semua selesai); terbuka = baris komponen. Default
// semua tertutup; status buka-tutup diingat per pengguna (localStorage, aman bila gagal). Baris
// divirtualisasi berdasarkan DATA (bukan DOM): hanya baris di jendela scroll yang dirender, komponen hanya
// ada saat grupnya dibuka (lazy) - semua terbuka bisa ±1.400 baris.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const LEBAR = { proyek: 80, panel: 150, deadline: 96, komponen: 190 }
const KIRI = { proyek: 0, panel: 80, deadline: 230, komponen: 326 }
const LEBAR_KIRI = LEBAR.proyek + LEBAR.panel + LEBAR.deadline + LEBAR.komponen
const LEBAR_TGL = 124
const RENTANG_HARI = 400 // kanvas tanggal TODAY +-400 hari (kolom divirtualisasi)
const TOTAL_KOLOM = RENTANG_HARI * 2 + 1
const BUFFER_KOLOM = 6
const TINGGI = { grup: 40, komp: 36, penanda: 30 }
// Tinggi baris = TINGGI (minimum) atau lebih bila isi chip-nya butuh (19 Okt 2026, permintaan user: semua chip tampil,
// tanpa "+N", nama lengkap). Tinggi dihitung dari DATA (isi terbanyak di SEMUA tanggal baris itu) - bukan diukur dari DOM -
// supaya virtualisasi/lasso/seret panel (semua lewat `offset`) tetap tepat & baris tidak melompat saat digeser kiri-kanan.
const CHIP = { padX: 3, gapDalam: 2, badgePadX: 2, gap: 2, tinggi: 16, font: 8.5 }
const LEBAR_ISI_SEL = LEBAR_TGL - 8 // padding sel 4px kiri-kanan
const tinggiIsi = (garis: number) => garis * CHIP.tinggi + (garis - 1) * CHIP.gap + 6
// Pengukur lebar teks (canvas, font halaman) - di-cache per teks.
function buatPengukur(): (teks: string, spasi?: number) => number {
  let ctx: CanvasRenderingContext2D | null = null
  let fam = 'sans-serif'
  try { ctx = document.createElement('canvas').getContext('2d'); fam = getComputedStyle(document.body).fontFamily || fam } catch { /* tanpa canvas: perkiraan */ }
  const cache = new Map<string, number>()
  return (teks, spasi = 0) => {
    const k = teks + '|' + spasi
    let w = cache.get(k)
    if (w == null) {
      if (ctx) { ctx.font = `800 ${CHIP.font}px ${fam}`; w = ctx.measureText(teks).width } else w = teks.length * 6.5
      w += spasi * [...teks].length
      cache.set(k, w)
    }
    return w
  }
}
// Lebar chip ringkasan header WP / chip komponen - rumus mengikuti gaya chip di bawah (padding, jarak, badge, border).
const lebarChipRingkas = (u: ReturnType<typeof buatPengukur>, x: RingkasanProses) =>
  CHIP.padX * 2 + u(x.proses) + CHIP.gapDalam + CHIP.badgePadX * 2 + u(String(x.n)) + (x.selesai ? CHIP.gapDalam + u('✓') : 0) + 2
const lebarChipKomp = (u: ReturnType<typeof buatPengukur>, c: ChipProses) => {
  const jejak = !!c.jejakKe
  return 2 + CHIP.padX * 2 + u(c.proses, .2)
    + (c.orang != null && !jejak ? CHIP.gapDalam + u('👥' + Number(c.orang.toFixed(1)), .2) : 0)
    + (c.selesai && !jejak ? CHIP.gapDalam + u('✓', .2) : 0) + (jejak ? CHIP.gapDalam + u('➡️', .2) : 0) + 2
}
// Jumlah garis chip dalam satu sel (flex-wrap, kiri ke kanan). Chip yang lebih lebar dari sel membungkus namanya di dalam
// chip -> dihitung 2 garis sendiri.
function garisChip(lebar: number[]): number {
  let n = 0, x = 0
  for (const w of lebar) {
    if (w > LEBAR_ISI_SEL) { n += 2; x = 0; continue }
    if (x > 0 && x + CHIP.gap + w <= LEBAR_ISI_SEL) x += CHIP.gap + w
    else { n++; x = w }
  }
  return n
}
const BUFFER_BARIS = 12
const PROSES_KARTU = ['POTONG', 'BENDING', 'STEL', 'FINISHING', 'PAINTING', 'WIRING CONTROL', 'WIRING POWER']

const idxKeTanggal = (i: number) => addDays(TODAY, i - RENTANG_HARI)
const tanggalKeIdx = (d: string) => { const [y, m, dd] = d.split('-').map(Number); const [y0, m0, d0] = TODAY.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, dd) - Date.UTC(y0, m0 - 1, d0)) / 86400000) + RENTANG_HARI }
const isMinggu = (d: string) => new Date(d + 'T00:00:00').getDay() === 0
const fmtTglPendek = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

// kb = kunci baris utk pilihan (lib/pindahAccordion): g:<panel>:<grup> | k:<panel>:<grup>:<kode> | p:<panel>:<proses>
type Baris =
  | { t: 'grup'; blok: BlokPanel; g: GrupKomponen; pertama: boolean; kunci: string; buka: boolean; kb: string }
  | { t: 'komp'; blok: BlokPanel; g: GrupKomponen; k: BarisKomponen; pertama: boolean; kb: string }
  | { t: 'penanda'; blok: BlokPanel; p: Penanda; pertama: boolean; kb: string }

const kunciStorage = (user: any) => 'vt_raw_accordion_buka_v1:' + (user?.id ?? user?.username ?? user?.nama ?? 'anon')
function bacaBuka(user: any): Set<string> {
  try { const v = localStorage.getItem(kunciStorage(user)); const a = v ? JSON.parse(v) : []; return new Set(Array.isArray(a) ? a.map(String) : []) } catch { return new Set() }
}
function simpanBuka(user: any, s: Set<string>) {
  try { localStorage.setItem(kunciStorage(user), JSON.stringify([...s])) } catch { /* privat/penuh - abaikan, tampilan tetap jalan */ }
}

// Operator per chip (12 Okt 2026): timer komponen+proses ini & peta nama pekerja (dari snapshot memori).
type OpChip = { timers: any[]; nama: (id: any) => string | undefined } | null
// PILIH PER CHIP (B1, 28 Okt 2026): chip = satuan pilihan (1 proses x 1 komponen x 1 tanggal; chip header = proses itu di WP itu).
// ev = handler + data-chip (kunci pilihan, dibaca lasso) + data-bisa; gaya pilih/potong/salin di chip, bukan di sel.
type PilihChip = { bisa: boolean; dipilih: boolean; dipotong: boolean; disalin: boolean; ev: any }
const gayaPilih = (p?: PilihChip): any => !p ? {} : {
  cursor: p.bisa ? 'grab' : 'pointer',
  ...(p.dipilih ? { boxShadow: 'inset 0 0 0 1.5px #fff, 0 0 0 2px #1e3a8a' } : {}),
  ...(p.disalin ? { outline: '2px dashed #1d4ed8', outlineOffset: 1 } : {}),
  ...(p.dipotong ? { opacity: .4 } : {}),
}
// peringatan (21 Okt 2026): teks pelanggaran urutan proses utk chip ini (lib/urutanProses) -> bingkai merah + tooltip.
function Chip({ c, kode, checklist, op, peringatan, pilih }: { c: ChipProses; kode: string; checklist: any; op?: OpChip; peringatan?: string[]; pilih?: PilihChip }) {
  const warna = (PROSES_COLOR as any)[c.proses] || '#64748b'
  const opBusbar = c.proses === 'BUSBAR' && op ? formatBusbarTahapOperator(checklist?.[kode], op.timers, op.nama) : undefined
  const judul = [
    `${c.proses} · ${kode}`,
    c.selesai ? 'Selesai (100%)' : null,
    c.jejakKe ? `Sudah digeser ke ${fmtTglPendek(c.jejakKe)} (histori)` : null,
    c.pin ? 'Dipin manual (tidak ikut auto-geser)' : null,
    c.dariTanggal ? `Lanjutan dari ${fmtTglPendek(c.dariTanggal)}` : null,
    c.lanjutan ? 'Hari lanjutan sesuai durasi standar bobot wiring' : null,
    c.orang != null ? `Kebutuhan ${Number(c.orang.toFixed(1))} orang` : null,
    c.proses === 'BUSBAR' ? (opBusbar ?? formatBusbarTahapTooltip(checklist?.[kode])) : null,
    op && !opBusbar ? teksOperatorPerTanggal(op.timers, op.nama) : null,
    ...(peringatan || []).map(t => `⚠ Urutan terbalik: ${t}`),
  ].filter(Boolean).join('\n')
  const jejak = !!c.jejakKe
  return (
    <span title={judul} {...pilih?.ev} style={{
      display: 'inline-flex', alignItems: 'center', gap: CHIP.gapDalam, maxWidth: '100%', boxSizing: 'border-box',
      fontSize: CHIP.font, fontWeight: 800, letterSpacing: .2, lineHeight: 1.15, padding: `2px ${CHIP.padX}px`, borderRadius: 4,
      background: jejak ? 'transparent' : warna, color: jejak ? warna : '#fff',
      border: jejak ? `1px dashed ${warna}` : `1px solid ${warna}`, opacity: c.selesai && !jejak ? .55 : 1,
      ...(peringatan?.length ? { outline: '2px solid #dc2626', outlineOffset: 1 } : {}),
      ...gayaPilih(pilih),
    }}>
      {!!peringatan?.length && <span>⚠</span>}
      <span>{c.proses}</span>
      {c.orang != null && !jejak && <span style={{ fontWeight: 700, opacity: .9 }}>👥{Number(c.orang.toFixed(1))}</span>}
      {c.selesai && !jejak && <span>✓</span>}
      {jejak && <span>➡️</span>}
    </span>
  )
}

function MultiPilih({ label, opsi, nilai, setNilai }: { label: string; opsi: string[]; nilai: string[]; setNilai: (v: string[]) => void }) {
  const [buka, setBuka] = useState(false)
  const [cari, setCari] = useState('')
  const tampil = opsi.filter(o => o.toLowerCase().includes(cari.toLowerCase()))
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setBuka(!buka)} style={{ height: 28, padding: '0 10px', borderRadius: 6, border: `1px solid ${nilai.length ? '#1d4ed8' : '#d1d5db'}`, background: nilai.length ? '#eff6ff' : '#fff', color: nilai.length ? '#1d4ed8' : '#374151', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
        {label}{nilai.length ? ` (${nilai.length})` : ''} ▾
      </button>
      {buka && (
        <>
          <div onClick={() => setBuka(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', top: 32, left: 0, zIndex: 41, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: 8, width: 240, maxHeight: 320, overflow: 'auto' }}>
            <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari..." style={{ width: '100%', boxSizing: 'border-box', height: 26, border: '1px solid #e2e8f0', borderRadius: 6, padding: '0 8px', fontSize: 11, marginBottom: 6, fontFamily: 'inherit' }} />
            {nilai.length > 0 && <div onClick={() => setNilai([])} style={{ fontSize: 11, color: '#dc2626', cursor: 'pointer', padding: '3px 4px' }}>Hapus pilihan</div>}
            {tampil.map(o => (
              <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '3px 4px', cursor: 'pointer' }}>
                <input type="checkbox" checked={nilai.includes(o)} onChange={() => setNilai(nilai.includes(o) ? nilai.filter(x => x !== o) : [...nilai, o])} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function RawScheduleAccordionInti({ woData, rawData, setRawData, updateRaw, refetchRaw, refetchRenhar, livePanelTypes, user, setRenhar, createRenhar, updateRenhar, removeRenhar, withRenharQueue, renhar, createRaw, log, io, orderMap, setOrderMap, dengar, pekerja, panelTampil }: {
  woData: any[]; rawData: any[]; setRawData?: (f: (prev: any[]) => any[]) => void; updateRaw?: (id: number, data: any) => Promise<any>; refetchRaw?: () => void; refetchRenhar?: () => void; livePanelTypes?: any; user?: any
  // rencana harian - dipakai modal edit bersama (sinkron renhar sama persis dgn tampilan lama)
  setRenhar?: (f: any) => void; createRenhar?: (d: any) => Promise<any>; updateRenhar?: (id: any, d: any) => Promise<any>; removeRenhar?: (id: any) => Promise<any>; withRenharQueue?: (task: any, fn: (existing: any) => Promise<void>) => Promise<any>
  // Tahap 3c: renhar (snapshot rollback prioritas), createRaw + log (Tambah Panel) - sama dgn tampilan lama
  renhar?: any[]; createRaw?: (d: any) => Promise<any>; log?: any
  // sandbox: I/O logika bersama (MemoryRepo), urutan panel salinan, kabar perubahan salinan
  io: IoJadwalRaw; orderMap: Record<number, string>; setOrderMap: (f: any) => void; dengar: RepoJadwalRaw['dengar']
  // (28 Okt 2026, Tahap A) master pekerja (nama di peringatan timer) & saringan panel yang tampil (mode uji WO: panel WO uji saja;
  // hitungan kapasitas/Minggu/urutan tetap dari SEMUA jadwal di rawData)
  pekerja?: any[]; panelTampil?: (panelId: number) => boolean
}) {
  // ── nama operator utk tooltip chip (12 Okt 2026): timer & master pekerja dari salinan memori, dibaca SEKALI ──
  const [opData, setOpData] = useState<{ idx: Map<string, any[]>; nama: (id: any) => string | undefined } | null>(null)
  useEffect(() => {
    let batal = false
    const muat = async () => {
      // paginasi penuh (fcs_timer_kerja > 1000 baris)
      let timer: any[] = []
      for (let dari = 0; ; dari += 1000) {
        const t = await io.db.from('fcs_timer_kerja').select('id,panel_id,kode_komponen,proses,tahap,pekerja_id,mulai,selesai,durasi_menit').order('id').range(dari, dari + 999)
        if (t.error) { console.error('[Raw per WP] gagal baca timer operator (tooltip tanpa nama):', t.error); return }
        timer = timer.concat(t.data || []); if ((t.data || []).length < 1000) break
      }
      const p = await io.db.from('pekerja').select('id,nama').range(0, 9999)
      if (p.error) { console.error('[Raw per WP] gagal baca nama pekerja:', p.error); return }
      const peta = new Map<string, string>((p.data || []).map((x: any) => [String(x.id), x.nama]))
      if (!batal) setOpData({ idx: indeksTimer(timer), nama: (id: any) => peta.get(String(id)) })
    }
    muat()
    const lepas = dengar(t => { if (t === 'fcs_timer_kerja') muat() }) // realtime timer (sama dgn tampilan lama)
    return () => { batal = true; lepas() }
  }, [io]) // eslint-disable-line react-hooks/exhaustive-deps
  const namaPekerja = (id: any) => opData?.nama(id) ?? (pekerja || []).find((p: any) => Number(p.id) === Number(id))?.nama
  const opChip = (panelId: any, kode: string, proses: string): OpChip => opData ? { timers: opData.idx.get(kunciTimer(panelId, kode, proses)) || [], nama: opData.nama } : null

  // ── data pendukung (sama sumber dgn Raw Schedule lama) ──
  const [fcsKapasitas, setFcsKapasitas] = useState<any[]>([])
  const [processTimeList, setProcessTimeList] = useState<any[]>([])
  useEffect(() => {
    const fetchCap = async () => { const { kapasitas, processTime } = await io.kapasitas.muatDataKapasitas(); setFcsKapasitas(kapasitas); setProcessTimeList(processTime) }
    fetchCap()
    return dengar(t => { if (t === 'fcs_kapasitas_override' || t === 'fcs_process_time') fetchCap() }) // perubahan SALINAN (bukan realtime)
  }, [])
  const [wiringHariKerjaMap, setWiringHariKerjaMap] = useState<Record<string, string[]>>({})
  const wiringPanelIds = useMemo(() => [...new Set(rawData.filter((r: any) => PROSES_ORANG_RAW.includes(r.proses)).map((r: any) => Number(r.panel_id || r.panelId)))], [rawData])
  useEffect(() => {
    let batal = false
    const load = async () => {
      try { const map = await io.fcs.fetchWiringHariKerjaMap(wiringPanelIds as number[]); if (!batal) setWiringHariKerjaMap(map) }
      catch (err) { console.error('[Raw Schedule Accordion] gagal muat hari kerja wiring (pakai data lama):', err) }
    }
    load()
    const lepas = dengar(t => { if (t === 'fcs_timer_kerja') load() }) // realtime timer (sama dgn tampilan lama)
    return () => { batal = true; lepas() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(wiringPanelIds)])
  const orderMapError = null // urutan panel = salinan (props)

  const panelById = useMemo(() => {
    const m = new Map<number, any>()
    woData.forEach((w: any) => (w.panels || []).forEach((p: any) => { const k = Number(p.id); if (!m.has(k)) m.set(k, p) }))
    return m
  }, [woData])
  const cfgTipe = useCallback((tipe: string) => (livePanelTypes?.[tipe]?.wps?.length > 0) ? livePanelTypes[tipe] : (PANEL_TYPES as any)[tipe], [livePanelTypes])
  const deadlinePanel = useMemo(() => buatPetaDeadlinePanel(woData), [woData])

  // ── filter ──
  const [filterProses, setFilterProses] = useState<string[]>([])
  const [filterProyek, setFilterProyek] = useState<string[]>([])
  const [filterPanel, setFilterPanel] = useState<string[]>([])
  const rawTampil = useMemo(() => panelTampil ? rawData.filter((r: any) => panelTampil(Number(r.panel_id || r.panelId))) : rawData, [rawData, panelTampil])
  const opsiProyek = useMemo(() => [...new Set(rawTampil.map((r: any) => r.proyek).filter(Boolean))].sort(), [rawTampil])
  const opsiPanel = useMemo(() => [...new Set(rawTampil.filter((r: any) => filterProyek.length === 0 || filterProyek.includes(r.proyek)).map((r: any) => r.panel).filter(Boolean))].sort(), [rawTampil, filterProyek])
  const lolosPanel = useCallback((r: any) => (!panelTampil || panelTampil(Number(r.panel_id || r.panelId))) && (filterProyek.length === 0 || filterProyek.includes(r.proyek)) && (filterPanel.length === 0 || filterPanel.includes(r.panel)), [filterProyek, filterPanel, panelTampil])

  // ── susunan accordion (dari data yang sudah dimuat) ──
  const blokSemua = useMemo(() => {
    const rows = rawData.filter(lolosPanel).sort((a: any, b: any) => bandingkanBarisRaw(a, b, orderMap, ALL_PROSES))
    return susunPivot(rows, { panelById, cfgTipe, wiringHariKerjaMap })
  }, [rawData, lolosPanel, orderMap, panelById, cfgTipe, wiringHariKerjaMap])
  // Filter proses: chip proses lain disembunyikan; komponen/grup tanpa chip tersisa disembunyikan.
  const blokTampil = useMemo(() => {
    if (filterProses.length === 0) return blokSemua
    const pakai = (cs: ChipProses[]) => cs.filter(c => filterProses.includes(c.proses))
    return blokSemua.map(b => {
      const grup = b.grup.map(g => {
        const komponen = g.komponen.map(k => ({ ...k, sel: Object.fromEntries(Object.entries(k.sel).map(([d, cs]) => [d, pakai(cs)]).filter(([, cs]) => (cs as any[]).length)) })).filter(k => Object.keys(k.sel).length)
        const ringkasan = Object.fromEntries(Object.entries(g.ringkasan).map(([d, rs]) => [d, rs.filter(x => filterProses.includes(x.proses))]).filter(([, rs]) => (rs as any[]).length))
        return { ...g, komponen, ringkasan }
      }).filter(g => g.komponen.length)
      const penanda = b.penanda.filter(p => filterProses.includes(p.proses))
      return { ...b, grup, penanda }
    }).filter(b => b.grup.length || b.penanda.length)
  }, [blokSemua, filterProses])

  // ── buka/tutup (per pengguna) ──
  const [buka, setBuka] = useState<Set<string>>(() => bacaBuka(user))
  useEffect(() => { setBuka(bacaBuka(user)) }, [user?.id, user?.username])
  const ubahBuka = (s: Set<string>) => { setBuka(s); simpanBuka(user, s) }
  const toggle = (kunci: string) => { const s = new Set(buka); s.has(kunci) ? s.delete(kunci) : s.add(kunci); ubahBuka(s) }
  const bukaSemua = () => ubahBuka(new Set(blokTampil.flatMap(b => b.grup.map(g => b.panelId + ':' + g.key))))
  const tutupSemua = () => ubahBuka(new Set())

  // ── baris datar (data) + offset kumulatif utk virtualisasi ──
  const baris: Baris[] = useMemo(() => {
    const out: Baris[] = []
    for (const b of blokTampil) {
      let pertama = true
      for (const g of b.grup) {
        const kunci = b.panelId + ':' + g.key; const isBuka = buka.has(kunci)
        out.push({ t: 'grup', blok: b, g, pertama, kunci, buka: isBuka, kb: `g:${b.panelId}:${g.key}` }); pertama = false
        if (isBuka) for (const k of g.komponen) out.push({ t: 'komp', blok: b, g, k, pertama: false, kb: `k:${b.panelId}:${g.key}:${k.kode}` })
      }
      for (const p of b.penanda) { out.push({ t: 'penanda', blok: b, p, pertama, kb: `p:${b.panelId}:${p.proses}` }); pertama = false }
    }
    return out
  }, [blokTampil, buka])
  // Tinggi per baris dari isi chip terbanyak (semua tanggal) - dihitung ulang saat data/filter berubah atau font selesai dimuat.
  const [fontSiap, setFontSiap] = useState(0)
  useEffect(() => { let batal = false; try { (document as any).fonts?.ready?.then(() => { if (!batal) setFontSiap(x => x + 1) }) } catch { /* abaikan */ } return () => { batal = true } }, [])
  const tinggiPerKb = useMemo(() => {
    const u = buatPengukur(); const m = new Map<string, number>()
    for (const b of blokTampil) for (const g of b.grup) {
      let gMaks = 1
      for (const rs of Object.values(g.ringkasan) as RingkasanProses[][]) gMaks = Math.max(gMaks, garisChip(rs.map(x => lebarChipRingkas(u, x))))
      m.set(`g:${b.panelId}:${g.key}`, Math.max(TINGGI.grup, tinggiIsi(gMaks)))
      for (const k of g.komponen) {
        let kMaks = 1
        for (const cs of Object.values(k.sel) as ChipProses[][]) kMaks = Math.max(kMaks, garisChip(cs.map(c => lebarChipKomp(u, c))))
        m.set(`k:${b.panelId}:${g.key}:${k.kode}`, Math.max(TINGGI.komp, tinggiIsi(kMaks)))
      }
    }
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blokTampil, fontSiap])
  // header WP yang DIBUKA tidak menampilkan ringkasan -> tinggi minimum
  const tinggiBaris = (r: Baris) => r.t === 'penanda' || (r.t === 'grup' && r.buka) ? TINGGI[r.t] : (tinggiPerKb.get(r.kb) ?? TINGGI[r.t])
  const offset = useMemo(() => { const o = new Array(baris.length + 1); o[0] = 0; for (let i = 0; i < baris.length; i++) o[i + 1] = o[i] + tinggiBaris(baris[i]); return o }, [baris, tinggiPerKb]) // eslint-disable-line react-hooks/exhaustive-deps
  const totalTinggi = offset[baris.length] || 0

  // ── scroll (virtualisasi baris & kolom) ──
  const scrollRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, h: 600, w: 1200 })
  const rafRef = useRef(0)
  const ukur = () => { const el = scrollRef.current; if (!el) return; setPos({ top: el.scrollTop, left: el.scrollLeft, h: el.clientHeight, w: el.clientWidth }) }
  const onScroll = () => { if (rafRef.current) return; rafRef.current = requestAnimationFrame(() => { rafRef.current = 0; ukur() }) }
  const lompatKe = (d: string) => { const el = scrollRef.current; if (!el) return; el.scrollLeft = Math.max(0, (tanggalKeIdx(d) - 3) * LEBAR_TGL); ukur() }
  useEffect(() => { lompatKe(TODAY); const ro = new ResizeObserver(ukur); if (scrollRef.current) ro.observe(scrollRef.current); return () => ro.disconnect() }, [])
  const TINGGI_HEADER = 40
  const cariIdx = (y: number) => { let lo = 0, hi = baris.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (offset[mid + 1] <= y) lo = mid + 1; else hi = mid } return lo }
  const iAwal = Math.max(0, cariIdx(Math.max(0, pos.top - TINGGI_HEADER)) - BUFFER_BARIS)
  const iAkhir = Math.min(baris.length, cariIdx(pos.top + pos.h) + BUFFER_BARIS)
  const kAwal = Math.max(0, Math.floor(pos.left / LEBAR_TGL) - BUFFER_KOLOM)
  const kAkhir = Math.min(TOTAL_KOLOM - 1, Math.floor(pos.left / LEBAR_TGL) + Math.ceil(Math.max(0, pos.w - LEBAR_KIRI) / LEBAR_TGL) + BUFFER_KOLOM)
  const kolom: string[] = []; for (let i = kAwal; i <= kAkhir; i++) kolom.push(idxKeTanggal(i))
  const spasiKiri = kAwal * LEBAR_TGL, spasiKanan = (TOTAL_KOLOM - 1 - kAkhir) * LEBAR_TGL
  const labelRentang = `${getDayLabel(idxKeTanggal(Math.floor(pos.left / LEBAR_TGL)))} – ${getDayLabel(idxKeTanggal(Math.min(TOTAL_KOLOM - 1, Math.floor((pos.left + Math.max(0, pos.w - LEBAR_KIRI)) / LEBAR_TGL))))}`

  // ════════ PILIH & PINDAH (Tahap 2) ════════════════════════════════════════════════════════════
  const [toast, setToast] = useState<{ pesan: string; jenis: 'ok' | 'err'; aksi?: { label: string; fn: () => void }[] } | null>(null)
  const toastTimer = useRef<any>(0)
  const tampilToastAksi = (pesan: string, jenis: 'ok' | 'err', aksi?: { label: string; fn: () => void }[]) => {
    clearTimeout(toastTimer.current); setToast({ pesan, jenis, aksi })
    toastTimer.current = setTimeout(() => setToast(null), aksi?.length ? 12000 : 6000)
  }
  const [pilihan, setPilihan] = useState<Set<string>>(new Set()) // kunci "<kb>|<tanggal>"
  const [jangkar, setJangkar] = useState<{ i: number; d: string } | null>(null) // utk Shift+klik (indeks baris DATA)
  const [potongan, setPotongan] = useState<string[]>([])
  const [salinan, setSalinan] = useState<string[]>([]) // Ctrl+C (salin-gabung)
  const [izin, setIzin] = useState<{ pesan: string; jawab: (ok: boolean) => void; wajib?: boolean } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; r: Baris; d: string } | null>(null)
  // Konfirmasi yang TIDAK dilewati izin sesi (aksi hapus).
  const mintaIzinWajib = (pesan: string) => new Promise<boolean>(res => { setIzin({ pesan, jawab: res, wajib: true }) })
  const namaUser = () => user?.name || user?.nama || 'Admin'
  const [tujuanTempel, setTujuanTempel] = useState<string | null>(null)
  const [konfirmasi, setKonfirmasi] = useState<{ kunci: string[]; offset: number; header?: string } | null>(null)
  const blokById = useMemo(() => new Map(blokTampil.map(b => [b.panelId, b])), [blokTampil])
  const panelSemua = useMemo(() => woData.flatMap((w: any) => w.panels || []), [woData])
  const entriesTanpaSelesaiRow = (row: any, entries: any[]) => { const pid = row.panel_id || row.panelId; return entriesTanpaSelesai(row.proses, entries, panelSemua.find((p: any) => p.id === pid)) }
  const checklistPanel = (row: any) => panelById.get(Number(row.panel_id || row.panelId))?.checklist
  // ── URUTAN PROSES (21 Okt 2026): peringatan + tanda merah + daftar, satu sumber lib/urutanProses ──
  const rawDataRef = useRef(rawData); rawDataRef.current = rawData
  const konteksUrutan: KonteksUrutan = { panelById: (id: number) => panelById.get(id), prosesRelevan: getRelevantProsesForKode }
  const namaKomponenUrutan = (panelId: number, kode: string) => {
    const p = panelById.get(panelId)
    return cfgTipe(p?.tipe)?.wps?.flatMap((w: any) => w.items || []).find((it: any) => it.kode === kode)?.nama || kode
  }
  const urutan = useKonfirmasiUrutan(() => ({ ...konteksUrutan, rawData: rawDataRef.current, namaPanel: (id: number) => String(panelById.get(id)?.nama || id).trim(), namaKomponen: namaKomponenUrutan }))
  const versiAturanUrutan = useVersiAturanUrutan()
  const pelanggaranSemua = useMemo<PelanggaranUrutan[]>(() => {
    try { return cariPelanggaranUrutan(rawData, konteksUrutan) } catch (e) { console.error('[urutan proses] gagal menghitung tanda merah:', e); return [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawData, panelById, versiAturanUrutan])
  const tandaUrutan = useMemo(() => petaTandaUrutan(pelanggaranSemua), [pelanggaranSemua])
  // Modal edit sel menyimpan lewat updateRaw - jadwal baru dicek dulu. Batal -> tampilan optimistis modal dikembalikan.
  const updateRawCekUrutan = updateRaw ? async (id: number, data: any) => {
    if (data?.schedule !== undefined) {
      const sebelum = rawDataRef.current.find((r: any) => r.id === id)
      if (!(await urutan.tanya(new Map([[id, data]])))) {
        if (sebelum) setRawData?.((prev: any[]) => prev.map((r: any) => r.id === id ? sebelum : r))
        io.kotor.clearRaw(id)
        return { success: false, dibatalkan: true, error: 'Dibatalkan (urutan proses)' }
      }
    }
    return updateRaw(id, data)
  } : undefined
  // cekSebelumPindah (28 Okt 2026): peringatan timer berjalan - pemeriksa & aturan SAMA dgn tampilan lama (lib/timerBerjalan)
  const pindahMulti = usePindahMulti(() => ({ rawData, user, setRawData: setRawData || (() => {}), refetchRaw, refetchRenhar, tampilToastAksi, io, konfirmasiUrutan: urutan.tanya,
    cekSebelumPindah: (sel: any[]) => konfirmasiTimerBerjalan(sel.filter((s: any) => s.entries).map((s: any) => { const r = rawData.find((x: any) => x.id === s.rawId); return { panelId: Number(r?.panel_id || r?.panelId), proses: r?.proses, tanggal: s.dari, kode: s.entries.flatMap((e: any) => e.komponen || []), label: String(r?.panel || '').trim() } }), namaPekerja, 'pindah') }))
  const ctxPindah = () => ({
    rawData, blokById, checklistPanel, entriesTanpaSelesai: entriesTanpaSelesaiRow, tanggalKeIdx, idxKeTanggal, totalKolom: TOTAL_KOLOM,
    panelBaris: (row: any) => panelById.get(Number(row.panel_id || row.panelId)), // saringan relevansi (lib/relevansiJadwal)
    timerBusbar: pindahMulti.timerBusbarRef.current, kapasitasPada: (d: string, pr: string) => kapasitasPada(fcsKapasitas, d, pr),
    hitungTerpakaiHari: (rows: any[], d: string, pr: string) => hitungTerpakaiHari(rows, d, pr, ctxKap),
  })
  const kunciSel = (r: Baris, d: string) => r.kb + '|' + d
  // PILIH PER CHIP (B1, 28 Okt 2026). Chip yang BISA dipilih/dipindah (cek cepat utk tampilan; validasi pasti di
  // rencanakanPindahAccordion): bukan jejak, bukan hari lanjutan WIRING, bukan selesai (WP), BUSBAR = kodeBusbarBisaDipindah.
  const chipBisa = (r: Exclude<Baris, { t: 'penanda' }>, k: BarisKomponen, c: ChipProses, d: string) => !c.jejakKe && !c.lanjutan && !(r.g.jenis === 'wp' && c.selesai)
    && (r.g.jenis !== 'busbar' || kodeBusbarBisaDipindah(rawData.find((x: any) => x.id === c.rawId), panelById.get(r.blok.panelId)?.checklist, d).includes(k.kode))
  // Chip di 1 sel tampilan (urutan = urutan tampil): baris komponen = chip proses; header WP tertutup = chip ringkasan per proses
  // (bisa bila ada >=1 komponen proses itu yang bisa); header terbuka = tanpa chip; penanda = 1 chip.
  type ChipSel = { kunci: string; bisa: boolean }
  const chipSel = (r: Baris, d: string): ChipSel[] => {
    if (r.t === 'penanda') return r.p.sel[d] ? [{ kunci: kunciSel(r, d), bisa: true }] : []
    if (r.t === 'komp') return (r.k.sel[d] || []).map(c => ({ kunci: kunciChip(r.kb, c.proses, d), bisa: chipBisa(r, r.k, c, d) }))
    if (r.buka) return []
    return (r.g.ringkasan[d] || []).map(x => ({ kunci: kunciChip(r.kb, x.proses, d), bisa: r.g.komponen.some(k => (k.sel[d] || []).some(c => c.proses === x.proses && chipBisa(r, k, c, d))) }))
  }
  // Sandbox: semua aksi berjalan pada SALINAN di memori -> tanpa dialog konfirmasi data produksi.
  const bolehTulis = async (_pesan: string, _sudahDikonfirmasi = false) => {
    if (!setRawData) { tampilToastAksi('Tampilan ini belum tersambung ke penyimpanan.', 'err'); return false }
    return true
  }
  const muatTimerUntuk = (kunci: string[]) => {
    const cells = kunci.flatMap(k => { const x = pecahKunci(k); const b = blokById.get(x.panelId); const g = b?.grup.find(y => y.key === x.grup && y.jenis === 'busbar'); return g ? g.komponen.flatMap(km => (km.sel[x.tanggal] || []).map(c => ({ rawId: c.rawId, date: x.tanggal }))) : [] })
    return pindahMulti.muatTimerBusbar(cells)
  }
  // ── SARINGAN RELEVANSI (22 Okt 2026) - pemberitahuan "N komponen dilewati (...)" + "Tambahkan juga" (hanya utk yang
  // tidak relevan; kode yang tidak ada / qty 0 di panel tidak bisa ditambahkan). Satu fungsi saring: lib/relevansiJadwal.
  const teksDilewatiRencana = (r: HasilPindahAcc) => {
    const perProses = new Map<string, HasilPindahAcc['dilewati']>()
    r.dilewati.forEach(d => perProses.set(d.proses, [...(perProses.get(d.proses) || []), d]))
    return [...perProses.entries()].map(([pr, ds]) => teksDilewati(ds, pr, (k: string) => namaKomponenUrutan(ds[0].panelId, k))).join('\n')
  }
  const aksiDilewati = (r: HasilPindahAcc, offset: number, mode: 'pindah' | 'salin', tambahan: { label: string; fn: () => void }[] = []) => {
    const tr = r.dilewati.filter(d => d.alasan === 'tidak_relevan')
    const kunciTambah = [...new Set(tr.map(d => kunciChip(`k:${d.panelId}:${d.grup}:${d.kode}`, d.proses, d.dari)))] // grup pivot, bukan wp entri; proses itu saja
    return [...(kunciTambah.length ? [{ label: 'Tambahkan juga', fn: async () => {
      const ok = mode === 'pindah' ? await jalankanPindahRef.current(kunciTambah, offset, true, true) : await jalankanSalinRef.current(kunciTambah, offset, true, true)
      if (ok) {
        try {
          await io.log.insert({ user_name: namaUser(), action: 'TAMBAH WALAU TIDAK RELEVAN', module: 'raw', halaman: 'Raw Schedule per WP',
            description: `${mode === 'pindah' ? 'Pindah' : 'Salin'} ${kunciTambah.length} komponen walau tidak relevan (Atur Proses Relevan): ` + tr.map(d => `${d.kode} ${d.proses}`).join(', '),
            proyek: '', panel: String(panelById.get(tr[0].panelId)?.nama || '').trim() })
        } catch (err) { console.error('[Raw per WP] gagal catat activity_log tambah tidak relevan:', err) }
      }
    } }] : []), ...tambahan]
  }
  // Rincian per baris jadwal utk activity_log pindah & salin: "<panel> <proses> <dari>→<ke> [wp:kode, ...]"
  const rincianSel = (sel: HasilPindahAcc['sel']) => sel.map(s => {
    const r = rawData.find((x: any) => x.id === s.rawId)
    const kode = s.kodeBusbar || (s.entries || []).flatMap((e: any) => (e.komponen || []).filter((k: string) => !k.startsWith('__')).map((k: string) => `${e.wp}:${k}`))
    return `${String(r?.panel || '').trim()} ${r?.proses} ${s.dari}→${s.ke} [${kode.join(', ')}]`
  })
  // Chip header terpilih: "WP2 RAKIT 28 Okt: 5 komponen, 3 dipindah, 2 sudah selesai"
  const teksHeader = (r: HasilPindahAcc, kerja: string) => r.ringkasHeader.map(h => teksRingkasHeader(h, kerja, getDayLabel)).join('; ')
  const jalankanPindah = async (kunci: string[], offset: number, sudahDikonfirmasi = false, tanpaSaring = false) => {
    if (offset === 0) return false
    const rencana = rencanakanPindahAccordion(kunci, offset, ctxPindah(), 'pindah', { tanpaSaring })
    if (rencana.bentrok.length > 0) {
      tampilToastAksi(`Dibatalkan: ${rencana.bentrok.length} sel tidak bisa mendarat (${[...new Set(rencana.bentrok.map(b => b.alasan))].join(', ')}). Tidak ada yang dipindah.`, 'err')
      return false
    }
    if (rencana.sel.length === 0 && rencana.dilewati.length > 0) { tampilToastAksi('Tidak ada yang dipindah.\n' + teksDilewatiRencana(rencana), 'err', aksiDilewati(rencana, offset, 'pindah')); return false }
    if (!(await bolehTulis(`Pindah ${rencana.jumlahKomponen} komponen ${offset > 0 ? '+' : ''}${offset} hari di data produksi asli?`, sudahDikonfirmasi))) return false
    const hdr = teksHeader(rencana, 'dipindah')
    const okPindah = await pindahMulti.jalankanPindahSel(rencana.sel, rencana.jadwal, {
      jumlah: `${rencana.jumlahKomponen} komponen${hdr ? ` (${hdr})` : ''}`, offset,
      ulangi: () => { jalankanPindahRef.current(kunci, offset) },
      onSukses: () => {
        const geser = (k: string) => { const x = pecahKunci(k); const i = tanggalKeIdx(x.tanggal) + offset; return x.baris + '|' + idxKeTanggal(i) }
        setPilihan(prev => new Set([...prev].map(k => kunci.includes(k) ? geser(k) : k)))
        setJangkar(null)
      },
    })
    if (okPindah) {
      // (28 Okt 2026) log rinci per baris jadwal - log RPC pindah_multi_sel_v2 hanya berisi jumlah sel (tanpa panel/komponen)
      try {
        const rincian = rincianSel(rencana.sel)
        const b0 = blokById.get(pecahKunci(kunci[0]).panelId)
        await io.log.insert({ user_name: namaUser(), action: 'PINDAH JADWAL', module: 'raw', halaman: 'Raw Schedule per WP',
          description: `Pindah (tampilan per WP) ${rencana.jumlahKomponen} komponen ${offset > 0 ? '+' : ''}${offset} hari: ` + rincian.join('; '),
          proyek: b0?.proyek || '', panel: b0?.panel || '' })
      } catch (err) { console.error('[Raw per WP] gagal catat activity_log rincian pindah:', err) }
    }
    if (okPindah && rencana.dilewati.length > 0) {
      tampilToastAksi(`${rencana.jumlahKomponen} komponen dipindah ${offset > 0 ? '+' : ''}${offset} hari.\n` + teksDilewatiRencana(rencana), 'ok',
        aksiDilewati(rencana, offset, 'pindah', [{ label: 'Batalkan', fn: () => pindahMulti.batalkanPindahTerakhir() }]))
    }
    return okPindah
  }
  const jalankanPindahRef = useRef(jalankanPindah); jalankanPindahRef.current = jalankanPindah

  // SALIN-GABUNG (Tahap 3a): sama dgn salin 1 sel tampilan lama - tujuan digabung (+pin), asal tidak berubah,
  // rencana harian tidak ikut. Simpan per baris jadwal (updateRaw + retry + cek hasil); gagal -> baris itu
  // dikembalikan, jadwal dimuat ulang, toast + Ulangi.
  const sedangSalinRef = useRef(false)
  const jalankanSalin = async (kunci: string[], offset: number, sudahDikonfirmasi = false, tanpaSaring = false): Promise<boolean> => {
    if (offset === 0) return false
    if (sedangSalinRef.current || pindahMulti.sedangPindahRef.current) { tampilToastAksi('Masih memproses aksi sebelumnya - tunggu sebentar.', 'err'); return false }
    if (!updateRaw) { tampilToastAksi('Tampilan ini belum tersambung ke penyimpanan.', 'err'); return false }
    const rencana = rencanakanPindahAccordion(kunci, offset, ctxPindah(), 'salin', { tanpaSaring })
    if (rencana.bentrok.length > 0) {
      tampilToastAksi(`Dibatalkan: ${rencana.bentrok.length} sel tidak bisa mendarat (${[...new Set(rencana.bentrok.map(b => b.alasan))].join(', ')}). Tidak ada yang disalin.`, 'err')
      return false
    }
    const rows = rencana.rowsSalin || []
    if (rows.length === 0 && rencana.dilewati.length > 0) { tampilToastAksi('Tidak ada yang disalin.\n' + teksDilewatiRencana(rencana), 'err', aksiDilewati(rencana, offset, 'salin')); return false }
    if (rows.length === 0) { tampilToastAksi('Tidak ada pekerjaan yang bisa disalin di pilihan ini.', 'err'); return false }
    if (!(await bolehTulis(`Salin ${rencana.jumlahKomponen} komponen ${offset > 0 ? '+' : ''}${offset} hari (digabung ke tujuan) di data produksi asli?`, sudahDikonfirmasi))) return false
    if (!(await urutan.tanya(new Map(rows.map(r => [r.raw_id, r.sesudah]))))) { tampilToastAksi('Dibatalkan - jadwal tidak diubah.', 'ok'); return false }
    sedangSalinRef.current = true
    try {
      const perId = new Map(rows.map(r => [r.raw_id, r]))
      rows.forEach(r => io.kotor.markRaw(r.raw_id))
      setRawData!((prev: any[]) => prev.map((r: any) => perId.has(r.id) ? { ...r, ...perId.get(r.id)!.sesudah } : r))
      const gagal: number[] = []
      for (const r of rows) {
        try {
          await withRetry(async () => {
            const res = await updateRaw(r.raw_id, { schedule: r.sesudah.schedule, busbar_schedule: r.sesudah.busbar_schedule, busbar_manual_pin: r.sesudah.busbar_manual_pin })
            if (!res?.success) throw new Error(res?.error || 'Gagal menyimpan salinan jadwal')
            return res
          })
        } catch (err) { console.error('[Raw per WP] salin gagal, baris', r.raw_id, err); gagal.push(r.raw_id) }
        finally { io.kotor.clearRaw(r.raw_id) }
      }
      if (gagal.length) {
        setRawData!((prev: any[]) => prev.map((x: any) => gagal.includes(x.id) ? { ...x, ...perId.get(x.id)!.sebelum } : x))
        refetchRaw?.()
        tampilToastAksi(`Gagal menyimpan salinan di ${gagal.length} dari ${rows.length} baris jadwal (koneksi?). Jadwal dimuat ulang dari server - cek sebelum mengulang.`, 'err', [{ label: 'Ulangi', fn: () => { jalankanSalinRef.current(kunci, offset, true) } }])
        return false
      }
      const pid = pecahKunci(kunci[0]).panelId; const b0 = blokById.get(pid)
      try {
        await io.log.insert({ user_name: namaUser(), action: 'COPY JADWAL', module: 'raw', halaman: 'Raw Schedule per WP',
          description: `Copy jadwal (tampilan per WP) ${rencana.jumlahKomponen} komponen, ${rows.length} baris jadwal ${offset > 0 ? '+' : ''}${offset} hari: ` + rincianSel(rencana.sel).join('; '),
          proyek: b0?.proyek || '', panel: b0?.panel || '' })
      } catch (err) { console.error('[Raw per WP] gagal catat activity_log salin:', err) }
      const hdrSalin = teksHeader(rencana, 'disalin')
      tampilToastAksi(`${rencana.jumlahKomponen} komponen disalin ${offset > 0 ? '+' : ''}${offset} hari (digabung ke tujuan).` + (hdrSalin ? '\n' + hdrSalin : '') + (rencana.dilewati.length ? '\n' + teksDilewatiRencana(rencana) : ''), 'ok', aksiDilewati(rencana, offset, 'salin'))
      return true
    } finally { sedangSalinRef.current = false }
  }
  const jalankanSalinRef = useRef(jalankanSalin); jalankanSalinRef.current = jalankanSalin

  // TOGGLE PENANDA QC/PACKING (Tahap 3a): logika togglePenanda = tampilan lama; simpan dgn cek hasil (tampilan
  // lama belum mengecek hasil updateRaw - dicatat sbg bug lama, tidak diubah di sana).
  const togglePenandaSel = async (r: Baris, d: string) => {
    if (r.t !== 'penanda' || !updateRaw) return
    const row = rawData.find((x: any) => x.id === r.p.rawId); if (!row) return
    const ada = !!r.p.sel[d]
    if (!(await bolehTulis(`${ada ? 'Hapus' : 'Tambah'} penanda ${r.p.proses} ${r.blok.panel} pada ${getDayLabel(d)} di data produksi asli?`))) return
    const sebelum = row.schedule || {}
    const baru = togglePenanda(sebelum, d, row.proses)
    io.kotor.markRaw(row.id)
    setRawData!((prev: any[]) => prev.map((x: any) => x.id === row.id ? { ...x, schedule: baru } : x))
    try {
      await withRetry(async () => { const res = await updateRaw(row.id, { schedule: baru }); if (!res?.success) throw new Error(res?.error || 'Gagal menyimpan penanda'); return res })
      tampilToastAksi(`Penanda ${r.p.proses} ${ada ? 'dihapus dari' : 'ditambahkan ke'} ${getDayLabel(d)}.`, 'ok')
    } catch (err) {
      console.error('[Raw per WP] toggle penanda gagal:', err)
      setRawData!((prev: any[]) => prev.map((x: any) => x.id === row.id ? { ...x, schedule: sebelum } : x))
      refetchRaw?.()
      tampilToastAksi(`Gagal menyimpan penanda ${r.p.proses} (koneksi?). Tidak ada yang berubah.`, 'err', [{ label: 'Ulangi', fn: () => togglePenandaSel(r, d) }])
    } finally { io.kotor.clearRaw(row.id) }
  }
  // ════════ EDIT JADWAL (Tahap 3b) ═════════════════════════════════════════════════════════════
  // Modal edit = modal tampilan lama (useModalJadwalSel): tambah/edit/hapus WP & komponen, BUSBAR, bobot WIRING,
  // cek kapasitas menit / kuota orang + modal swap, sinkron renhar & activity_log - SATU sumber, tidak disalin.
  const modalJadwal = useModalJadwalSel({
    woData, rawData, user, wiringHariKerjaMap,
    setRawData: setRawData || (() => {}),
    updateRaw: updateRawCekUrutan || (async () => ({ success: false, error: 'Tampilan ini belum tersambung ke penyimpanan.' })),
    getEffCfg: cfgTipe, getMenitPerPcs: (t: string, p: string, k: string) => menitPerPcs(processTimeList, t, p, k),
    withRenharQueue: withRenharQueue || (async () => { throw new Error('Rencana harian belum tersambung ke tampilan ini.') }),
    createRenhar: createRenhar || (async () => ({ success: false, error: 'Rencana harian belum tersambung.' })),
    updateRenhar: updateRenhar || (async () => ({ success: false, error: 'Rencana harian belum tersambung.' })),
    removeRenhar: removeRenhar || (async () => ({ success: false, error: 'Rencana harian belum tersambung.' })),
    setRenhar: setRenhar || (() => {}),
    namaPekerja,
    io,
  })
  // ── Tahap 3c: bagian bersama tampilan lama ──
  const [menuUrutan, setMenuUrutan] = useState<{ panelId: number; x: number; y: number } | null>(null)
  const blokUrutRef = useRef<{ panelId: number; zona: Zona }[]>([])
  blokUrutRef.current = blokTampil.map(b => ({ panelId: b.panelId, zona: zonaDari(b.prioritas) })) // panel TERLIHAT, urut tampilan
  const urutanPanel = useUrutanPanel({
    rawData, setRawData: setRawData || (() => {}), effectiveRenhar: renhar || [], setRenhar: setRenhar || (() => {}),
    orderMap, setOrderMap, user, blokUrutRef, tampilToastUrutan: (m: string) => tampilToastAksi(m, 'ok'),
    setMenuUrutanPanel: (v: number | null) => { if (v == null) setMenuUrutan(null) },
    io,
  })
  const aturKapasitas = useAturKapasitas({ user, refetchRaw, io })
  const bukaAturKapasitas = (d: string, pr: string) => { aturKapasitas.setOverrideModal({ tanggalMulai: d, tanggalAkhir: d, proses: [pr] }); aturKapasitas.setOverrideValue(''); aturKapasitas.setOverrideResult(null) }
  const woTampil = useMemo(() => panelTampil ? woData.filter((w: any) => (w.panels || []).some((p: any) => panelTampil(Number(p.id)))) : woData, [woData, panelTampil])
  const tambahPanelRaw = useTambahPanelRaw({ woData: woTampil, rawData, createRaw: createRaw || (async () => ({ success: false, error: 'Tampilan ini belum tersambung.' })), refetchRaw: refetchRaw || (() => {}), log })
  const riwayatQty = useRiwayatQty({ setFilterProyek, setFilterPanel, db: io.db })
  const kartuHari = useKartuHari({ rawData, woData, getEffCfg: cfgTipe })
  // ── Drag ⠿ urutan panel (Tahap 3d): posisi blok panel dari offset DATA (aman utk baris yang tidak dirender),
  // target = hitungTargetDrop (sama dgn tampilan lama), simpan lewat urutanPanel.pindahPanel (RPC atomik + rollback).
  const rentangBlok = useMemo(() => {
    const m: { panelId: number; zona: Zona; i0: number; i1: number }[] = []
    baris.forEach((r, i) => { const last = m[m.length - 1]; if (last && last.panelId === r.blok.panelId) last.i1 = i + 1; else m.push({ panelId: r.blok.panelId, zona: zonaDari(r.blok.prioritas), i0: i, i1: i + 1 }) })
    return m
  }, [baris])
  const [dragPanel, setDragPanel] = useState<{ panelId: number; nama: string; target: TargetDrop | null; lintas: boolean; garisY: number } | null>(null)
  const dragPanelCtx = useRef<any>({}); dragPanelCtx.current = { rentangBlok, offset, pindahPanel: urutanPanel.pindahPanel }
  const mulaiDragPanel = (e: React.PointerEvent, panelId: number, nama: string, zonaAsal: Zona) => {
    if (e.button !== 0 || urutanPanel.savingUrutan) return
    e.preventDefault(); e.stopPropagation()
    const cont = scrollRef.current; if (!cont) return
    let y = e.clientY; let target: TargetDrop | null = null
    const hitung = () => {
      const C = dragPanelCtx.current; const cr = cont.getBoundingClientRect()
      const asal = cr.top + cont.clientTop - cont.scrollTop + TINGGI_HEADER
      const blok = C.rentangBlok.map((x: any) => ({ panelId: x.panelId, zona: x.zona, top: asal + C.offset[x.i0], bottom: asal + C.offset[x.i1] }))
      target = hitungTargetDrop(blok, [], y, panelId)
      setDragPanel({ panelId, nama, target, lintas: !!target && target.zona !== zonaAsal, garisY: target ? Math.max(cr.top + TINGGI_HEADER, Math.min(cr.bottom, target.indicatorY)) : -100 })
    }
    const onMove = (ev: PointerEvent) => { y = ev.clientY; hitung() }
    // auto-scroll di tepi bagian tabel yang TERLIHAT (tabel bisa sebagian di luar layar)
    const gulir = setInterval(() => { const cr = cont.getBoundingClientRect(); const atas = Math.max(cr.top, 0) + TINGGI_HEADER, bawah = Math.min(cr.bottom, window.innerHeight); const v = y < atas + 40 ? -24 : y > bawah - 40 ? 24 : 0; if (v) { cont.scrollTop += v; hitung() } }, 40)
    const onUp = () => {
      clearInterval(gulir); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = ''
      setDragPanel(null)
      if (target) dragPanelCtx.current.pindahPanel(panelId, { zona: target.zona, prevId: target.prevId, nextId: target.nextId })
    }
    document.body.style.cursor = 'grabbing'; document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
    hitung()
  }
  const notifAvailable = useNotifAvailable({ rawData, woData, getEffCfg: cfgTipe, openCellModal: modalJadwal.buka, setModalWp: modalJadwal.setModalWp, setModalKomponen: modalJadwal.setModalKomponen, setModalBobotPerKomponen: modalJadwal.setModalBobotPerKomponen, db: io.db })
  useEffect(() => {
    notifAvailable.fetchNotifAvailable()
    return dengar(t => { if (t === 'fcs_notifikasi') notifAvailable.fetchNotifAvailable() }) // perubahan SALINAN
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  type OpsiProses = { proses: string; rawId: number; terisi: boolean }
  const [popProses, setPopProses] = useState<{ x: number; y: number; r: Baris; d: string; opsi: OpsiProses[] } | null>(null)
  // Proses yang bisa diedit di sel ini (baris jadwal panel itu): grup BUSBAR -> baris BUSBAR; header WP -> semua
  // proses per-komponen; baris komponen -> proses yang relevan utk kode itu (isKomponenRelevant, sama dgn modal).
  // QC TEST/PACKING lewat baris penanda (klik = toggle). terisi = sel sudah memuat WP/komponen itu di proses tsb.
  const opsiProsesSel = (r: Baris, d: string): OpsiProses[] => {
    if (r.t === 'penanda') return []
    const pid = r.blok.panelId
    const rows = rawData.filter((x: any) => Number(x.panel_id || x.panelId) === pid)
    if (r.g.jenis === 'busbar') return rows.filter((x: any) => x.proses === 'BUSBAR').map((x: any) => ({ proses: 'BUSBAR', rawId: x.id, terisi: (x.busbar_schedule?.[d] || []).length > 0 }))
    const tipe = panelById.get(pid)?.tipe || ''
    return rows.filter((x: any) => !['QC TEST', 'PACKING', 'BUSBAR'].includes(x.proses) && (r.t !== 'komp' || isKomponenRelevant(r.k.kode, tipe, x.proses)))
      .sort((a: any, b: any) => ALL_PROSES.indexOf(a.proses) - ALL_PROSES.indexOf(b.proses))
      .map((x: any) => {
        const es = (x.schedule?.[d] || []).filter((e: any) => e.wp === r.g.key)
        return { proses: x.proses, rawId: x.id, terisi: r.t === 'komp' ? es.some((e: any) => (e.komponen || []).includes(r.k.kode)) : es.length > 0 }
      })
  }
  // Buka modal edit utk (baris jadwal, tanggal). Sel kosong di baris WP/komponen: WP (dan komponen) langsung
  // terpilih - sama dgn alur "Pilih Komponen Lain" tampilan lama (komponen lama WP itu ikut, utk hitung kapasitas).
  const bukaEdit = async (o: OpsiProses, r: Baris, d: string) => {
    setPopProses(null)
    if (r.t === 'penanda') return
    if (!(await bolehTulis(`Edit jadwal ${o.proses} ${r.blok.panel} pada ${getDayLabel(d)}`))) return
    modalJadwal.buka(o.rawId, d)
    if (o.terisi || r.g.jenis !== 'wp') return
    const wp = r.g.key
    modalJadwal.setModalWp(wp)
    if (r.t !== 'komp') return
    const kode = r.k.kode
    const row = rawData.find((x: any) => x.id === o.rawId)
    const entri = (row?.schedule?.[d] || []).find((e: any) => e.wp === wp)
    if (PROSES_ORANG_RAW.includes(o.proses)) {
      const cl = panelById.get(r.blok.panelId)?.checklist
      const lama = (entri?.komponen || []).filter((k: string) => !k.startsWith('__wiring_') && (cl?.[k]?.progress?.[o.proses] || 0) < 100)
      const pilih = [...new Set([...lama, kode])]
      modalJadwal.setModalKomponen(pilih)
      modalJadwal.setModalBobotPerKomponen((prev: any) => ({ ...prev, ...Object.fromEntries(pilih.map((k: string) => [k, prev[k] ?? row?.bobot_komponen?.[k] ?? 'MEDIUM'])) }))
    } else {
      modalJadwal.setModalKomponen([...new Set([...(entri?.komponen || []), kode])])
    }
  }
  // Klik biasa sel non-penanda: 1 pilihan proses / tepat 1 proses terisi -> langsung modal; selain itu pilih proses dulu.
  const klikEdit = (e: React.MouseEvent | null, r: Baris, d: string, paksaPilih = false, xy?: { x: number; y: number }) => {
    const opsi = opsiProsesSel(r, d)
    if (opsi.length === 0) { tampilToastAksi('Panel ini belum punya baris jadwal proses yang bisa diisi di sini.', 'err'); return }
    const terisi = opsi.filter(o => o.terisi)
    if (!paksaPilih && (opsi.length === 1 || terisi.length === 1)) { bukaEdit(opsi.length === 1 ? opsi[0] : terisi[0], r, d); return }
    setPopProses({ x: xy?.x ?? e?.clientX ?? 200, y: xy?.y ?? e?.clientY ?? 200, r, d, opsi })
  }
  // HAPUS WP: kunci header sel (g:, menu klik kanan header) -> WP itu dihapus dari SEMUA proses pada tanggal itu; chip header (h:,
  // Delete / menu) -> WP itu dihapus dari proses chip itu saja. Lewat fungsi hapus yang sama dgn tombol "✕ Hapus" di modal
  // (sinkron renhar + log per proses). Chip komponen/BUSBAR belum (hapus per chip = tahap berikut): klik chip -> Edit.
  const hapusWpKunci = async (kunci: string[]) => {
    const target: { rawId: number; proses: string; d: string; wp: string; panel: string; n: number }[] = []
    const sudah = new Set<string>()
    let dilewati = 0, adaSemua = false
    for (const k of kunci) {
      const x = pecahKunci(k)
      if (x.jenis !== 'g' && x.jenis !== 'h') { dilewati++; continue }
      const b = blokById.get(x.panelId); const g = b?.grup.find(y => y.key === x.grup)
      if (!b || !g || g.jenis !== 'wp') { dilewati++; continue }
      if (x.jenis === 'g') adaSemua = true
      rawData.filter((row: any) => Number(row.panel_id || row.panelId) === x.panelId && !['QC TEST', 'PACKING', 'BUSBAR'].includes(row.proses) && (x.jenis !== 'h' || row.proses === x.proses)).forEach((row: any) => {
        const e = (row.schedule?.[x.tanggal] || []).find((en: any) => en.wp === g.key)
        const kk = row.id + '|' + x.tanggal + '|' + g.key
        if (e && !sudah.has(kk)) { sudah.add(kk); target.push({ rawId: row.id, proses: row.proses, d: x.tanggal, wp: g.key, panel: b.panel, n: (e.komponen || []).filter((kd: string) => !kd.startsWith('__wiring_')).length }) }
      })
    }
    if (target.length === 0) { tampilToastAksi(dilewati ? 'Hapus di tampilan ini per chip header WP (baris tertutup). Untuk chip komponen/BUSBAR: klik chip lalu hapus di Edit.' : 'Tidak ada jadwal WP di sel ini.', 'err'); return }
    const rincian = target.slice(0, 8).map(t => `${t.panel} ${t.wp} ${t.proses} ${getDayLabel(t.d)} (${t.n} komponen)`).join('; ') + (target.length > 8 ? `; +${target.length - 8} lainnya` : '')
    if (!(await mintaIzinWajib(`Hapus ${target.length} jadwal WP (${adaSemua ? 'SEMUA proses pada tanggal itu' : 'proses chip terpilih saja'})? ${rincian}.${dilewati ? ` (${dilewati} chip komponen/BUSBAR dilewati - hapus lewat Edit.)` : ''} Sama seperti tombol Hapus di modal edit - tersimpan ke jadwal.`))) return
    let ok = 0
    for (const t of target) { if (await modalJadwal.hapusWpDariSel(t.rawId, t.d, t.wp)) ok++ }
    setPilihan(new Set()); setJangkar(null)
    tampilToastAksi(ok === target.length ? `${ok} jadwal WP dihapus.` : `${ok} dari ${target.length} jadwal WP dihapus - sisanya gagal (lihat pesan), cek lalu ulangi.`, ok === target.length ? 'ok' : 'err')
  }
  const batalkan = () => { setPilihan(new Set()); setJangkar(null); setPotongan([]); setSalinan([]); setTujuanTempel(null); setMenu(null) }
  const salin = () => {
    const isi = [...pilihan]
    if (isi.length === 0) { tampilToastAksi('Pilih chip dulu (Ctrl+klik / lasso), lalu Ctrl+C.', 'err'); return }
    setSalinan(isi); setPotongan([]); setTujuanTempel(null)
    tampilToastAksi(`${isi.length} chip disalin. Klik hari tujuan, lalu Ctrl+V (atau tombol Tempel).`, 'ok')
  }
  const potong = () => {
    const isi = [...pilihan]
    if (isi.length === 0) { tampilToastAksi('Pilih chip dulu (Ctrl+klik / lasso), lalu Ctrl+X.', 'err'); return }
    setPotongan(isi); setSalinan([]); setTujuanTempel(null); muatTimerUntuk(isi)
    tampilToastAksi(`${isi.length} chip dipotong. Klik hari tujuan, lalu Ctrl+V (atau tombol Tempel).`, 'ok')
  }
  // Tempel: potongan -> PINDAH; salinan -> SALIN (gabung). Sel PALING AWAL mendarat di hari tujuan.
  const tempel = async (tujuan?: string) => {
    const sumber = potongan.length ? potongan : salinan
    if (sumber.length === 0) return
    const t = tujuan || tujuanTempel
    if (!t) { tampilToastAksi('Klik hari tujuan di jadwal dulu, lalu Ctrl+V.', 'err'); return }
    const offset = tanggalKeIdx(t) - Math.min(...sumber.map(k => tanggalKeIdx(pecahKunci(k).tanggal)))
    if (offset === 0) { tampilToastAksi('Hari tujuan sama dengan posisi sekarang - tidak ada yang berubah.', 'err'); return }
    if (potongan.length) { const ok = await jalankanPindah(potongan, offset); if (ok) { setPotongan([]); setTujuanTempel(null) } }
    else { const ok = await jalankanSalin(salinan, offset); if (ok) setTujuanTempel(null) } // salinan tetap bisa ditempel lagi
  }
  const aksiRef = useRef<any>({}); aksiRef.current = { potong, salin, tempel, batalkan, undo: pindahMulti.batalkanPindahTerakhir, pilihan, potongan, salinan, hapus: () => hapusWpKunci([...pilihan]) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (!scrollRef.current || scrollRef.current.offsetParent === null) return // tab tidak tampil
      const mod = e.ctrlKey || e.metaKey; const k = e.key.toLowerCase()
      if (mod && k === 'x' && aksiRef.current.pilihan.size) { e.preventDefault(); aksiRef.current.potong() }
      else if (mod && k === 'c' && aksiRef.current.pilihan.size) { e.preventDefault(); aksiRef.current.salin() }
      else if (mod && k === 'v' && (aksiRef.current.potongan.length || aksiRef.current.salinan.length)) { e.preventDefault(); aksiRef.current.tempel() }
      else if (mod && k === 'z' && !e.shiftKey && pindahMulti.undoMultiRef.current.length) { e.preventDefault(); aksiRef.current.undo() }
      else if (e.key === 'Escape') aksiRef.current.batalkan()
      else if (e.key === 'Delete' && !mod && aksiRef.current.pilihan.size) { e.preventDefault(); aksiRef.current.hapus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Shift+klik (ada jangkar): semua chip yang bisa di persegi jangkar..sini (baris x tanggal) ikut dipilih.
  const pilihRentang = (i: number, d: string) => {
    if (!jangkar) return false
    const [a, b] = [Math.min(jangkar.i, i), Math.max(jangkar.i, i)]
    const [da, db] = [Math.min(tanggalKeIdx(jangkar.d), tanggalKeIdx(d)), Math.max(tanggalKeIdx(jangkar.d), tanggalKeIdx(d))]
    const s = new Set(pilihan)
    for (let x = a; x <= b; x++) for (let y = da; y <= db; y++) chipSel(baris[x], idxKeTanggal(y)).forEach(c => { if (c.bisa) s.add(c.kunci) })
    setPilihan(s); return true
  }
  // Klik AREA KOSONG sel (bukan chip): Ctrl/Alt = pilih/lepas semua chip sel itu; biasa = popup proses (penanda = toggle).
  const klikSel = (e: React.MouseEvent, r: Baris, d: string, i: number) => {
    if ((potongan.length || salinan.length) && !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) { setTujuanTempel(d); return }
    if (e.shiftKey && pilihRentang(i, d)) return
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
      const cs = chipSel(r, d).filter(c => c.bisa)
      if (cs.length === 0) { tampilToastAksi('Sel ini kosong / semua isinya sudah selesai atau sudah digeser - tidak ada chip yang bisa dipilih.', 'err'); return }
      const s = new Set(pilihan); const semua = cs.every(c => s.has(c.kunci))
      cs.forEach(c => { if (semua) s.delete(c.kunci); else s.add(c.kunci) })
      setPilihan(s); setJangkar({ i, d }); return
    }
    if (pilihan.size) { setPilihan(new Set()); setJangkar(null) }
    if (r.t === 'penanda') { togglePenandaSel(r, d); return }
    klikEdit(e, r, d, true)
  }
  // Klik CHIP: Ctrl/Alt/Shift = pilih/lepas chip itu; biasa = Edit Jadwal proses chip itu (penanda = toggle).
  // rawId: chip komponen = baris jadwal chip itu; chip header = baris proses itu di panel (opsiProsesSel).
  const klikChip = (e: React.MouseEvent, r: Baris, d: string, i: number, cs: ChipSel, proses: string, rawId: number | null) => {
    e.stopPropagation()
    if ((potongan.length || salinan.length) && !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) { setTujuanTempel(d); return }
    if (e.shiftKey && pilihRentang(i, d)) return
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
      const s = new Set(pilihan)
      if (s.has(cs.kunci)) s.delete(cs.kunci)
      else { if (!cs.bisa) { tampilToastAksi('Chip ini sudah selesai / histori (sudah digeser) / hari lanjutan WIRING - tidak bisa dipilih.', 'err'); return } s.add(cs.kunci) }
      setPilihan(s); setJangkar({ i, d }); return
    }
    if (pilihan.size) { setPilihan(new Set()); setJangkar(null) }
    if (r.t === 'penanda') { togglePenandaSel(r, d); return }
    const o = rawId != null ? { proses, rawId, terisi: true } : opsiProsesSel(r, d).find(x => x.proses === proses)
    if (!o) { tampilToastAksi(`Baris jadwal ${proses} panel ini tidak ditemukan.`, 'err'); return }
    bukaEdit({ ...o, terisi: true }, r, d)
  }

  // Lasso: tekan di area kosong sel tanggal lalu seret. Baris & kolom dihitung dari DATA (offset kumulatif +
  // lebar kolom tetap), bukan DOM - aman utk baris lazy & kolom yang divirtualisasi.
  const lassoRef = useRef<{ x: number; y: number; tambah: boolean; aktif: boolean } | null>(null)
  const kotakRef = useRef<HTMLDivElement | null>(null)
  const lassoCtx = useRef<any>({}); lassoCtx.current = { pilihan }
  useEffect(() => {
    const cont = scrollRef.current; if (!cont) return
    const kotak = document.createElement('div'); kotak.style.cssText = 'position:fixed;z-index:9000;pointer-events:none;border:1.5px solid #2563eb;background:rgba(37,99,235,.12);border-radius:3px;display:none'
    document.body.appendChild(kotak); kotakRef.current = kotak
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || e.shiftKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t.closest('[draggable="true"]') || !t.closest('td[data-tgl]')) return
      lassoRef.current = { x: e.clientX, y: e.clientY, tambah: e.ctrlKey || e.metaKey, aktif: false }
    }
    const onMove = (e: PointerEvent) => {
      const m = lassoRef.current; if (!m) return
      if (!m.aktif && Math.hypot(e.clientX - m.x, e.clientY - m.y) < 6) return
      m.aktif = true; document.body.style.userSelect = 'none'
      Object.assign(kotak.style, { display: 'block', left: Math.min(m.x, e.clientX) + 'px', top: Math.min(m.y, e.clientY) + 'px', width: Math.abs(e.clientX - m.x) + 'px', height: Math.abs(e.clientY - m.y) + 'px' })
    }
    const onUp = (e: PointerEvent) => {
      const m = lassoRef.current; lassoRef.current = null; if (!m || !m.aktif) return
      kotak.style.display = 'none'; document.body.style.userSelect = ''
      const telan = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault() }
      cont.addEventListener('click', telan, { capture: true, once: true }); setTimeout(() => cont.removeEventListener('click', telan, { capture: true }), 0)
      const cr = cont.getBoundingClientRect(); const L = lassoCtx.current
      const x1 = Math.max(Math.min(m.x, e.clientX), cr.left + LEBAR_KIRI), x2 = Math.max(m.x, e.clientX)
      const y1 = Math.max(Math.min(m.y, e.clientY), cr.top + TINGGI_HEADER), y2 = Math.max(m.y, e.clientY)
      if (x2 < x1 || y2 < y1) return
      // PER CHIP (B1): chip yang tersentuh kotak (bagian yang terlihat di selnya - chip yang meluap & terpotong sel tidak ikut).
      // Kotak hanya mencakup area yang tampil, jadi chip yang dirender (virtualisasi) sudah cukup.
      const s = new Set<string>(m.tambah ? L.pilihan : [])
      cont.querySelectorAll<HTMLElement>('[data-chip]').forEach(el => {
        if (el.dataset.bisa !== '1') return
        const a = el.getBoundingClientRect(); const td = el.closest('td')?.getBoundingClientRect()
        const l = Math.max(a.left, td?.left ?? a.left), rr = Math.min(a.right, td?.right ?? a.right)
        const t = Math.max(a.top, td?.top ?? a.top), bw = Math.min(a.bottom, td?.bottom ?? a.bottom)
        if (rr <= l || bw <= t) return
        if (rr >= x1 && l <= x2 && bw >= y1 && t <= y2) s.add(el.dataset.chip!)
      })
      setPilihan(s)
    }
    cont.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
    return () => { cont.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); kotak.remove() }
  }, [])

  // Drag grup: sel di dalam pilihan -> seluruh pilihan ikut (offset hari sama, baris tetap); sel di luar
  // pilihan -> sel itu saja. Bayangan tujuan lewat class CSS di DOM (tanpa setState per gerakan mouse).
  useEffect(() => {
    if (document.getElementById('rs-acc-css')) return
    const st = document.createElement('style'); st.id = 'rs-acc-css'
    st.textContent = '.rsa-ok{box-shadow:inset 0 0 0 2px #16a34a!important;background:#f0fdf4!important}.rsa-minggu{box-shadow:inset 0 0 0 2px #16a34a!important;background:#dcfce7!important}.rsa-bad{box-shadow:inset 0 0 0 2px #dc2626!important;background:#fef2f2!important}'
      + '.rsa-ok[data-lbl],.rsa-minggu[data-lbl],.rsa-bad[data-lbl]{position:relative}.rsa-minggu[data-lbl]::after,.rsa-bad[data-lbl]::after{content:attr(data-lbl);position:absolute;left:2px;right:2px;bottom:1px;font:700 7.5px system-ui,sans-serif;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}.rsa-minggu[data-lbl]::after{color:#15803d}.rsa-bad[data-lbl]::after{color:#b91c1c}'
    document.head.appendChild(st)
  }, [])
  const dragRef = useRef<{ kunci: string[]; jangkar: string; offset: number | null; ditandai: HTMLElement[]; badge: HTMLDivElement } | null>(null)
  const bersihkanDrag = () => { const m = dragRef.current; if (!m) return; m.ditandai.forEach(el => { el.classList.remove('rsa-ok', 'rsa-minggu', 'rsa-bad'); delete el.dataset.lbl }); m.badge.remove(); dragRef.current = null }
  // Seret CHIP: chip terpilih -> seluruh pilihan ikut; chip di luar pilihan -> chip itu saja.
  const onDragStart = (e: React.DragEvent, kunci: string, d: string) => {
    e.stopPropagation()
    const isi = pilihan.has(kunci) ? [...pilihan] : [kunci]
    if (!pilihan.has(kunci) && pilihan.size) { setPilihan(new Set()); setJangkar(null) }
    e.dataTransfer.effectAllowed = 'move'
    const badge = document.createElement('div')
    badge.style.cssText = 'position:fixed;z-index:10001;pointer-events:none;padding:5px 11px;border-radius:99px;background:#2563eb;color:#fff;font:700 12px system-ui,sans-serif;white-space:nowrap;left:-1000px;top:-1000px'
    badge.textContent = isi.length + ' chip'; document.body.appendChild(badge)
    try { e.dataTransfer.setDragImage(badge, 12, 12) } catch { /* browser lama */ }
    dragRef.current = { kunci: isi, jangkar: d, offset: null, ditandai: [], badge }
    muatTimerUntuk(isi).then(() => { if (dragRef.current) dragRef.current.offset = null })
  }
  const onDragOver = (e: React.DragEvent, d: string) => {
    const m = dragRef.current; if (!m) return
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
    m.badge.style.left = (e.clientX + 16) + 'px'; m.badge.style.top = (e.clientY + 16) + 'px'
    const offset = tanggalKeIdx(d) - tanggalKeIdx(m.jangkar)
    if (offset === m.offset) return
    m.offset = offset
    m.ditandai.forEach(el => { el.classList.remove('rsa-ok', 'rsa-minggu', 'rsa-bad'); delete el.dataset.lbl }); m.ditandai = []
    if (offset === 0) { m.badge.textContent = m.kunci.length + ' chip'; m.badge.style.background = '#2563eb'; return }
    const rencana = rencanakanPindahAccordion(m.kunci, offset, ctxPindah())
    const cont = scrollRef.current
    rencana.tujuan.forEach((st, t) => {
      const i = t.lastIndexOf('|'); const kb = t.slice(0, i), tgl = t.slice(i + 1)
      const td = cont?.querySelector(`tr[data-kb="${kb}"] td[data-tgl="${tgl}"]`) as HTMLElement | null
      if (!td) return
      td.classList.add(st === 'bad' ? 'rsa-bad' : st === 'minggu' ? 'rsa-minggu' : 'rsa-ok')
      if (st === 'minggu') td.dataset.lbl = 'Minggu · kapasitas tersedia'; else if (st === 'bad') td.dataset.lbl = rencana.alasanTujuan.get(t) || 'bentrok'
      m.ditandai.push(td)
    })
    const nb = rencana.bentrok.length
    m.badge.textContent = `${m.kunci.length} chip · ${offset > 0 ? '+' : ''}${offset} hari${nb ? ` · ${nb} bentrok` : ''}`
    m.badge.style.background = nb ? '#dc2626' : '#2563eb'
  }
  const onDrop = (e: React.DragEvent, d: string) => {
    const m = dragRef.current; if (!m) return
    e.preventDefault()
    const offset = tanggalKeIdx(d) - tanggalKeIdx(m.jangkar); const kunci = m.kunci
    bersihkanDrag()
    if (offset === 0) return
    const rencana = rencanakanPindahAccordion(kunci, offset, ctxPindah())
    if (rencana.bentrok.length) { tampilToastAksi(`Dibatalkan: ${rencana.bentrok.length} sel tidak bisa mendarat (${[...new Set(rencana.bentrok.map(b => b.alasan))].join(', ')}). Tidak ada yang dipindah.`, 'err'); return }
    if (rencana.sel.length === 0) { if (rencana.ringkasHeader.length) tampilToastAksi('Tidak ada yang bisa dipindah.\n' + teksHeader(rencana, 'bisa dipindah'), 'err'); return }
    setKonfirmasi({ kunci, offset, header: teksHeader(rencana, 'ikut') })
  }

  // 🚩 deadline per tanggal (panel yang tampil)
  const deadlinePerTanggal = useMemo(() => {
    const pids = new Set(blokTampil.map(b => b.panelId))
    return petaDeadlinePerTanggal(rawData, deadlinePanel, (r: any) => pids.has(Number(r.panel_id || r.panelId)))
  }, [rawData, deadlinePanel, blokTampil])

  // ── kartu Capacity Utilization (rumus lib/kapasitasHari.ts, sama dgn tampilan lama) ──
  const [kartuTutup, setKartuTutup] = useState(false)
  const SENIN_INI = useMemo(() => { const d = new Date(TODAY + 'T00:00:00'); const g = (d.getDay() + 6) % 7; return addDays(TODAY, -g) }, [])
  const [senin, setSenin] = useState(SENIN_INI)
  const minggu = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(senin, i)), [senin])
  const ctxKap = useMemo(() => ({ panelById, menitPerPcs: (t: string, p: string, k: string) => menitPerPcs(processTimeList, t, p, k), wiringHariKerjaMap }), [panelById, processTimeList, wiringHariKerjaMap])

  const thS: any = { background: '#1e3a8a', color: '#fff', padding: '4px 6px', fontWeight: 700, fontSize: 9, whiteSpace: 'nowrap', letterSpacing: .3, textAlign: 'center', borderRight: '1px solid #ffffff18', position: 'sticky', top: 0, zIndex: 3, textTransform: 'uppercase', height: TINGGI_HEADER, boxSizing: 'border-box' }
  const stickyKiri = (kol: keyof typeof KIRI, extra: any = {}) => ({ position: 'sticky' as const, left: KIRI[kol], width: LEBAR[kol], minWidth: LEBAR[kol], maxWidth: LEBAR[kol], zIndex: 2, boxSizing: 'border-box' as const, ...extra })
  const bgSel = (d: string, dasar: string) => d === TODAY ? '#eff6ff' : isMinggu(d) ? '#fff1f2' : dasar

  const renderSelKiri = (r: Baris, bg: string) => {
    const b = r.blok; const pri = (PRIORITAS_COLOR as any)[b.prioritas] || '#64748b'
    const dl = deadlinePanel.get(b.panelId); const info = dl ? infoDeadline(dl.target, TODAY) : null
    const garis = r.pertama ? '2px solid #cbd5e1' : '1px solid transparent'
    const td: any = { borderTop: garis, borderRight: '1px solid #f1f5f9', background: '#fff', padding: '2px 6px', verticalAlign: 'top', fontSize: 9, overflow: 'hidden' }
    const batas = (isi: any) => <div style={{ maxHeight: tinggiBaris(r) - 6, overflow: 'hidden' }}>{isi}</div>
    return (
      <>
        <td style={stickyKiri('proyek', { ...td, color: '#475569', fontWeight: 600 })}>{r.pertama && batas(<div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.proyek}>{b.proyek}</div>)}</td>
        <td style={stickyKiri('panel', { ...td, color: '#1e293b', fontWeight: 700 })}>{r.pertama && batas(
          <div title={`${b.panel} · ${b.tipe}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span role="button" aria-label={`Seret untuk ubah urutan ${b.panel}`} title={urutanPanel.savingUrutan ? 'Sedang menyimpan urutan...' : 'Seret untuk ubah urutan panel (lintas kelompok = prioritas ikut berubah)'}
                onPointerDown={(e: any) => mulaiDragPanel(e, b.panelId, b.panel, zonaDari(b.prioritas))}
                style={{ cursor: urutanPanel.savingUrutan ? 'not-allowed' : 'grab', touchAction: 'none', color: '#94a3b8', fontSize: 12, lineHeight: 1, padding: '1px 1px', userSelect: 'none', flexShrink: 0 }}>⠿</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.panel}</span>
              <button title="Pindah urutan panel" aria-label="Pindah urutan panel" disabled={urutanPanel.savingUrutan}
                onClick={(e: any) => { const rc = e.currentTarget.getBoundingClientRect(); setMenuUrutan(m => m?.panelId === b.panelId ? null : { panelId: b.panelId, x: rc.right, y: rc.bottom }) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 12, fontWeight: 800, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>⋮</button>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 1 }}>
              <select aria-label={`Prioritas ${b.panel}`} value={zonaDari(b.prioritas)} disabled={urutanPanel.savingUrutan} onChange={e => urutanPanel.updatePrioritasPanel(b.panelId, e.target.value)}
                title="Ubah prioritas panel (semua proses + rencana harian)"
                style={{ height: 15, padding: '0 2px', borderRadius: 3, border: `1px solid ${pri}`, color: pri, background: pri + '14', fontSize: 8, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                {PRIORITAS.map((x: string) => <option key={x} value={x}>{x}</option>)}
              </select>
              <span style={{ fontSize: 8, color: '#94a3b8', fontWeight: 600 }}>{b.tipe}</span>
            </div>
          </div>)}
        </td>
        <td style={stickyKiri('deadline', { ...td })}>{r.pertama && batas(info ? (
          <div title={`Deadline = target WO ${dl!.wo}`} style={{ lineHeight: 1.25 }}>
            <div style={{ color: info.warna.tgl, fontWeight: info.warna.tebal ? 800 : 600 }}>{info.tgl}</div>
            <div style={{ color: info.warna.ket, fontWeight: info.warna.tebal ? 800 : 500, fontSize: 8.5 }}>{info.label}</div>
          </div>) : <span style={{ color: '#cbd5e1' }}>—</span>)}
        </td>
        {r.t === 'grup' ? (
          <td role="button" tabIndex={0} aria-expanded={r.buka} onClick={() => toggle(r.kunci)} onKeyDown={(e: any) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(r.kunci) } }}
            style={stickyKiri('komponen', { borderTop: r.pertama ? '2px solid #cbd5e1' : '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', background: r.buka ? '#e7edfa' : '#f1f4fb', padding: '0 8px', cursor: 'pointer', userSelect: 'none' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', width: 10, fontSize: 9, color: '#64748b', transform: r.buka ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}>▸</span>
              <b style={{ fontSize: 10.5, color: '#1e293b' }}>{r.g.key}</b>
              <span style={{ marginLeft: 'auto', fontSize: 8.5, color: '#64748b', whiteSpace: 'nowrap' }}>{r.g.komponen.length} komponen</span>
            </div>
          </td>
        ) : r.t === 'komp' ? (
          <td style={stickyKiri('komponen', { borderTop: '1px solid #f1f5f9', borderRight: '1px solid #e2e8f0', background: bg, padding: '0 8px 0 22px', fontSize: 9, fontWeight: 600, color: '#1e293b' })}>
            <div title={`${r.k.kode} - ${r.k.nama}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.g.jenis === 'wp' ? <><span style={{ color: '#64748b', fontWeight: 700 }}>{r.k.kode}</span> {r.k.nama}</> : r.k.kode}
            </div>
          </td>
        ) : (
          <td style={stickyKiri('komponen', { borderTop: r.pertama ? '2px solid #cbd5e1' : '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', background: '#fff', padding: '0 8px', fontSize: 10, fontWeight: 800, color: '#1e293b' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: (PROSES_COLOR as any)[r.p.proses] || '#64748b', flex: '0 0 auto' }} />
              {r.p.proses}
              <span style={{ marginLeft: 'auto', fontSize: 8, color: '#94a3b8', fontWeight: 500 }}>penanda</span>
            </div>
          </td>
        )}
      </>
    )
  }

  const renderSelTanggal = (r: Baris, d: string, bgDasar: string, nomor: number) => {
    const garisAtas = r.pertama ? '2px solid #cbd5e1' : r.t === 'komp' ? '1px solid #f1f5f9' : '1px solid #e2e8f0'
    // PER CHIP (B1): sel = area klik (popup) & tujuan drop; chip = satuan pilih/seret/edit.
    const chips = chipSel(r, d)
    const adaPilih = chips.some(c => pilihan.has(c.kunci))
    const td: any = { borderTop: garisAtas, borderRight: '1px solid #f1f5f9', padding: '2px 4px', verticalAlign: 'middle', background: adaPilih ? '#eff6ff' : bgSel(d, bgDasar), width: LEBAR_TGL, minWidth: LEBAR_TGL, maxWidth: LEBAR_TGL, boxSizing: 'border-box', overflow: 'hidden',
      cursor: (potongan.length || salinan.length) ? 'crosshair' : 'pointer' }
    const ev = {
      onClick: (e: any) => klikSel(e, r, d, nomor),
      onContextMenu: (e: any) => {
        e.preventDefault()
        if (!adaPilih) { const bs = chips.filter(c => c.bisa).map(c => c.kunci); if (bs.length) { setPilihan(new Set(bs)); setJangkar({ i: nomor, d }) } }
        setMenu({ x: e.clientX, y: e.clientY, r, d })
      },
      onDragOver: (e: any) => onDragOver(e, d), onDrop: (e: any) => onDrop(e, d),
    }
    const pilihChip = (cs: ChipSel | undefined, proses: string, rawId: number | null): PilihChip | undefined => cs && {
      bisa: cs.bisa, dipilih: pilihan.has(cs.kunci), dipotong: potongan.includes(cs.kunci), disalin: salinan.includes(cs.kunci),
      ev: {
        'data-chip': cs.kunci, 'data-bisa': cs.bisa ? '1' : '0',
        onClick: (e: any) => klikChip(e, r, d, nomor, cs, proses, rawId),
        onContextMenu: (e: any) => { e.preventDefault(); e.stopPropagation(); if (!pilihan.has(cs.kunci) && cs.bisa) { setPilihan(new Set([cs.kunci])); setJangkar({ i: nomor, d }) } setMenu({ x: e.clientX, y: e.clientY, r, d }) },
        draggable: cs.bisa && !potongan.length, onDragStart: (e: any) => onDragStart(e, cs.kunci, d), onDragEnd: () => bersihkanDrag(),
      },
    }
    // Semua chip tampil (urut proses dari rawPivot), membungkus ke bawah; tinggi baris sudah disiapkan tinggiPerKb.
    const wadah = (isi: any) => (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'center', gap: CHIP.gap, maxHeight: tinggiBaris(r) - 4, overflow: 'hidden' }}>{isi}</div>
    )
    if (r.t === 'grup') {
      const rs = r.buka ? [] : (r.g.ringkasan[d] || [])
      return <td key={d} data-tgl={d} style={td} {...ev}>{wadah(
        rs.map((x, i) => { const w = (PROSES_COLOR as any)[x.proses] || '#64748b'; const pc = pilihChip(chips[i], x.proses, null); return (
          <span key={x.proses} title={`${r.g.key} ${getDayLabel(d)}: ${x.n} komponen ${x.proses}${x.selesai ? ' - semua selesai' : ''}\nKlik = edit ${x.proses} · Ctrl/Alt/Shift+klik = pilih (semua komponen ${x.proses} ${r.g.key} hari ini) · seret = pindah`} {...pc?.ev} style={{ display: 'inline-flex', alignItems: 'center', gap: CHIP.gapDalam, background: w, color: '#fff', borderRadius: 4, padding: `2px ${CHIP.padX}px`, fontSize: CHIP.font, fontWeight: 800, opacity: x.selesai ? .55 : 1, maxWidth: '100%', boxSizing: 'border-box', ...gayaPilih(pc) }}>
            <span>{x.proses}</span>
            <span style={{ background: 'rgba(255,255,255,.28)', borderRadius: 3, padding: `0 ${CHIP.badgePadX}px` }}>{x.n}</span>{x.selesai && '✓'}
          </span>) }))}</td>
    }
    if (r.t === 'komp') {
      const cs = r.k.sel[d] || []
      return <td key={d} data-tgl={d} style={td} {...ev}>{wadah(cs.map((c, i) => <Chip key={c.proses + i} c={c} kode={r.k.kode} checklist={panelById.get(r.blok.panelId)?.checklist} op={opChip(r.blok.panelId, r.k.kode, c.proses)} peringatan={c.jejakKe ? undefined : tandaUrutan.get(`${r.blok.panelId}|${r.k.kode}|${c.proses}|${d}`)} pilih={pilihChip(chips[i], c.proses, c.rawId)} />))}</td>
    }
    const ada = r.p.sel[d]; const w = (PROSES_COLOR as any)[r.p.proses] || '#64748b'
    const pp = ada ? pilihChip(chips[0], r.p.proses, r.p.rawId) : undefined
    return <td key={d} data-tgl={d} style={td} {...ev}>{ada && <span title={`${r.p.proses}${r.p.selesai ? ' - selesai' : ''}`} {...pp?.ev} style={{ display: 'inline-flex', gap: 3, background: w, color: '#fff', borderRadius: 4, padding: '2px 5px', fontSize: 8.5, fontWeight: 800, opacity: r.p.selesai ? .55 : 1, ...gayaPilih(pp) }}>{r.p.proses}{r.p.selesai && ' ✓'}</span>}</td>
  }

  const jumlahKomponen = blokTampil.reduce((s, b) => s + b.grup.reduce((t, g) => t + g.komponen.length, 0), 0)
  const jumlahHeader = blokTampil.reduce((s, b) => s + b.grup.length + b.penanda.length, 0)

  return (
    <div className="fi">
      <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 10, padding: '9px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 17 }}>🧪</span>
        <div style={{ fontSize: 11.5, color: '#1e3a8a', lineHeight: 1.5 }}>
          <b>Raw Schedule tampilan per WP.</b> Dikelompokkan per WP. Satuan pilihan = <b>chip</b> (1 proses · 1 komponen · 1 hari; chip header = proses itu di WP itu). Klik chip = edit proses itu; Ctrl/Alt/Shift+klik chip = pilih; seret kotak (lasso) = pilih chip yang tersentuh; seret chip = pindah chip itu (atau seluruh pilihan); Ctrl+X → klik hari tujuan → Ctrl+V = pindah; Ctrl+C → Ctrl+V = salin (digabung); Ctrl+Z = batalkan pindah; klik area kosong sel = pilih proses (edit/tambah); Delete = hapus WP chip header terpilih (proses itu saja); klik kanan header = Hapus WP semua proses; prioritas & urutan panel di kolom Panel (dropdown, ⋮, seret ⠿); klik kartu kapasitas = Atur Kapasitas; klik header tanggal = daftar pekerjaan; klik penanda QC/PACKING = tambah/hapus. Perubahan TERSIMPAN ke jadwal asli & Rencana Harian.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary,#1e293b)' }}>Raw Schedule — per WP</div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{blokTampil.length} panel · {jumlahHeader} baris tertutup · {jumlahKomponen} komponen · tampil sekarang {baris.length} baris</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => tambahPanelRaw.setAddModal(true)} style={{ height: 28, padding: '0 12px', borderRadius: 6, border: 'none', background: '#3b5bdb', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Tambah Panel</button>
          <button onClick={riwayatQty.openRiwayat} style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            🔔 Riwayat Perubahan
            {riwayatQty.qtyChangeUnread > 0 && <span style={{ background: '#dc2626', color: '#fff', borderRadius: 99, minWidth: 16, height: 16, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{riwayatQty.qtyChangeUnread}</span>}
          </button>
          <span style={{ width: 1, height: 20, background: '#e2e8f0' }} />
          <button onClick={bukaSemua} style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid #c9d1e4', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Buka semua</button>
          <button onClick={tutupSemua} style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid #c9d1e4', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Tutup semua</button>
          <span style={{ width: 1, height: 20, background: '#e2e8f0' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>{labelRentang}</span>
          <button onClick={() => { const el = scrollRef.current; if (el) { el.scrollLeft -= 7 * LEBAR_TGL; ukur() } }} style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>‹ 7 hari</button>
          <button onClick={() => lompatKe(TODAY)} style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid #3b5bdb', background: '#eff3ff', color: '#3b5bdb', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Hari Ini</button>
          <button onClick={() => { const el = scrollRef.current; if (el) { el.scrollLeft += 7 * LEBAR_TGL; ukur() } }} style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>7 hari ›</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <MultiPilih label="Proyek" opsi={opsiProyek} nilai={filterProyek} setNilai={v => { setFilterProyek(v); setFilterPanel([]) }} />
        <MultiPilih label="Panel" opsi={opsiPanel} nilai={filterPanel} setNilai={setFilterPanel} />
        <TombolDaftarUrutan daftar={panelTampil ? pelanggaranSemua.filter(p => panelTampil(p.panelId)) : pelanggaranSemua} namaPanel={(id: number) => String(panelById.get(id)?.nama || id).trim()} namaKomponen={namaKomponenUrutan}
          onPilih={p => { const rp = rawData.find((r: any) => Number(r.panel_id || r.panelId) === p.panelId); if (rp) { setFilterProyek([]); setFilterPanel([rp.panel]) } }} />
        <span style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 2px' }} />
        <button onClick={() => setFilterProses([])} style={{ padding: '3px 10px', borderRadius: 20, border: `1.5px solid ${filterProses.length === 0 ? '#1d4ed8' : '#e2e8f0'}`, background: filterProses.length === 0 ? '#1d4ed8' : '#fff', color: filterProses.length === 0 ? '#fff' : '#64748b', cursor: 'pointer', fontSize: 10.5, fontWeight: 700 }}>Semua proses</button>
        {ALL_PROSES.map((pr: string) => { const pc = (PROSES_COLOR as any)[pr] || '#64748b'; const on = filterProses.includes(pr); return (
          <button key={pr} onClick={() => setFilterProses(on ? filterProses.filter(x => x !== pr) : [...filterProses, pr])} style={{ padding: '3px 10px', borderRadius: 20, border: `1.5px solid ${on ? pc : '#e2e8f0'}`, background: on ? pc + '18' : '#fff', color: on ? pc : '#64748b', cursor: 'pointer', fontSize: 10.5, fontWeight: 700 }}>{pr}</button>) })}
      </div>

      {notifAvailable.elemenBanner}
      {fcsKapasitas.length > 0 && (
        <div style={{ background: 'var(--card-bg,#fff)', border: '1px solid var(--border-color,#e2e8f0)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
          <div onClick={() => setKartuTutup(!kartuTutup)} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .4, marginBottom: kartuTutup ? 0 : 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}>
            <span style={{ fontSize: 10, transform: kartuTutup ? 'rotate(-90deg)' : 'none', display: 'inline-block' }}>▾</span>
            ⚡ Capacity Utilization {filterProses.length ? '— ' + filterProses.join(', ') : '(semua proses)'}
            <div onClick={e => e.stopPropagation()} style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', textTransform: 'none', letterSpacing: 0 }}>
              <span style={{ fontWeight: 600, color: '#475569' }}>{getDayLabel(minggu[0])} – {getDayLabel(minggu[6])}</span>
              <button onClick={() => setSenin(addDays(senin, -7))} style={{ height: 24, padding: '0 8px', borderRadius: 5, border: '1px solid #d1d5db', background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>‹</button>
              <button onClick={() => setSenin(SENIN_INI)} style={{ height: 24, padding: '0 8px', borderRadius: 5, border: '1px solid #3b5bdb', background: '#eff3ff', color: '#3b5bdb', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Minggu Ini</button>
              <button onClick={() => setSenin(addDays(senin, 7))} style={{ height: 24, padding: '0 8px', borderRadius: 5, border: '1px solid #d1d5db', background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>›</button>
            </div>
          </div>
          {!kartuTutup && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {minggu.map(d => (
                <div key={d} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', minWidth: 132, flex: '1 1 132px', background: d === TODAY ? '#eff6ff' : isMinggu(d) ? '#fff1f2' : '#fff' }}>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, textAlign: 'center', fontWeight: d === TODAY ? 800 : 500 }}>{getDayLabel(d)}</div>
                  {(filterProses.length ? filterProses : PROSES_KARTU).map(pr => {
                    const orang = PROSES_ORANG_RAW_GLOBAL.includes(pr)
                    const kap = kapasitasPada(fcsKapasitas, d, pr), pakai = hitungTerpakaiHari(rawData, d, pr, ctxKap)
                    const pct = kap > 0 ? Math.min(100, Math.round(pakai / kap * 100)) : 0
                    const w = pct >= 95 ? '#dc2626' : pct >= 80 ? '#f59e0b' : '#16a34a'
                    return (
                      <div key={pr} role="button" tabIndex={0} title={`Atur kapasitas ${pr} ${getDayLabel(d)}`} onClick={() => bukaAturKapasitas(d, pr)} onKeyDown={(e: any) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bukaAturKapasitas(d, pr) } }} style={{ marginBottom: 3, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}><span style={{ color: '#64748b' }}>{pr} ✎</span><b style={{ color: kap > 0 ? '#1e293b' : '#dc2626' }}>{kap > 0 ? `${orang ? Number(pakai.toFixed(1)) : Math.round(pakai)}/${kap} ${orang ? 'orang' : 'mnt'}` : 'belum diatur · Atur'}</b></div>
                        <div style={{ height: 3, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: w }} /></div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(pilihan.size > 0 || potongan.length > 0 || salinan.length > 0 || pindahMulti.undoMultiRef.current.length > 0) && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 10px', fontSize: 11 }}>
          {pilihan.size > 0 && <b style={{ color: '#1d4ed8' }}>{pilihan.size} chip dipilih</b>}
          {potongan.length > 0 && <span style={{ color: '#92400e', fontWeight: 700 }}>✂ {potongan.length} chip dipotong{tujuanTempel ? ` · tujuan ${getDayLabel(tujuanTempel)}` : ' · klik hari tujuan'}</span>}
          {salinan.length > 0 && <span style={{ color: '#1d4ed8', fontWeight: 700 }}>📋 {salinan.length} chip disalin{tujuanTempel ? ` · tujuan ${getDayLabel(tujuanTempel)}` : ' · klik hari tujuan'}</span>}
          {pilihan.size > 0 && <button onClick={salin} style={{ height: 24, padding: '0 9px', borderRadius: 5, border: '1px solid #93c5fd', background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>📋 Salin (Ctrl+C)</button>}
          {pilihan.size > 0 && <button onClick={potong} style={{ height: 24, padding: '0 9px', borderRadius: 5, border: '1px solid #93c5fd', background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✂ Potong (Ctrl+X)</button>}
          {(potongan.length > 0 || salinan.length > 0) && <button onClick={() => tempel()} style={{ height: 24, padding: '0 9px', borderRadius: 5, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Tempel (Ctrl+V)</button>}
          {pindahMulti.undoMultiRef.current.length > 0 && <button onClick={() => pindahMulti.batalkanPindahTerakhir()} style={{ height: 24, padding: '0 9px', borderRadius: 5, border: '1px solid #d1d5db', background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>↶ Batalkan pindah terakhir (Ctrl+Z)</button>}
          {(pilihan.size > 0 || potongan.length > 0 || salinan.length > 0) && <button onClick={batalkan} style={{ height: 24, padding: '0 9px', borderRadius: 5, border: '1px solid #d1d5db', background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Bersihkan (Esc)</button>}
        </div>
      )}
      {toast && (
        <div role="status" style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 10050, maxWidth: 460, background: toast.jenis === 'ok' ? '#065f46' : '#991b1b', color: '#fff', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,.25)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ flex: 1, whiteSpace: 'pre-line' }}>{toast.pesan}</span>
          {toast.aksi?.map(a => <button key={a.label} onClick={() => { setToast(null); a.fn() }} style={{ border: '1px solid #ffffff80', background: 'transparent', color: '#fff', borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{a.label}</button>)}
          <button onClick={() => setToast(null)} aria-label="Tutup" style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 14 }}>×</button>
        </div>
      )}
      {konfirmasi && (
        <div onClick={() => setKonfirmasi(null)} style={{ position: 'fixed', inset: 0, zIndex: 10040, background: 'rgba(15,23,42,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 18, width: 360, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 16px 40px rgba(0,0,0,.25)' }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>Pindah atau Copy {konfirmasi.kunci.length} chip {konfirmasi.offset > 0 ? '+' : ''}{konfirmasi.offset} hari?</div>
            {konfirmasi.header && <div style={{ fontSize: 11.5, color: '#1e3a8a', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, padding: '6px 9px', marginBottom: 8, whiteSpace: 'pre-line' }}>{konfirmasi.header.split('; ').join('\n')}</div>}
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}><b>Pindah</b>: komponen yang sudah selesai atau sudah digeser tetap di tempatnya; bisa dibatalkan dengan Ctrl+Z. <b>Copy</b>: digabung ke hari tujuan, asal tetap.</div>
            <div style={{ fontSize: 11.5, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, padding: '6px 9px', marginBottom: 14 }}>Tersimpan ke jadwal asli; Rencana Harian ikut dipindah.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setKonfirmasi(null)} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
              <button onClick={async () => { const k = konfirmasi; setKonfirmasi(null); await jalankanSalin(k.kunci, k.offset, true) }} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: '1px solid #2563eb', background: '#fff', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Copy</button>
              <button onClick={async () => { const k = konfirmasi; setKonfirmasi(null); await jalankanPindah(k.kunci, k.offset, true) }} style={{ height: 30, padding: '0 14px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Pindah</button>
            </div>
          </div>
        </div>
      )}

      {izin && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10045, background: 'rgba(15,23,42,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div role="dialog" aria-label="Konfirmasi hapus" style={{ background: '#fff', borderRadius: 12, padding: 18, width: 380, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 16px 40px rgba(0,0,0,.25)' }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>Hapus jadwal</div>
            <div style={{ fontSize: 12.5, color: '#334155', marginBottom: 10 }}>{izin.pesan}</div>
            <div style={{ marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { const z = izin; setIzin(null); z.jawab(false) }} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
              <button onClick={() => { const z = izin; setIzin(null); z.jawab(true) }} style={{ height: 30, padding: '0 14px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Hapus</button>
            </div>
          </div>
        </div>
      )}
      {popProses && (
        <>
          <div onClick={() => setPopProses(null)} onContextMenu={e => { e.preventDefault(); setPopProses(null) }} style={{ position: 'fixed', inset: 0, zIndex: 10030 }} />
          <div role="menu" aria-label="Pilih proses" style={{ position: 'fixed', left: Math.min(popProses.x, window.innerWidth - 250), top: Math.min(popProses.y, window.innerHeight - 60 - popProses.opsi.length * 30), zIndex: 10031, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.15)', padding: '6px 0', minWidth: 230, fontSize: 12 }}>
            <div style={{ padding: '2px 14px 6px', fontSize: 10.5, color: '#64748b', fontWeight: 700 }}>
              {popProses.r.t !== 'penanda' && `${popProses.r.blok.panel} · ${popProses.r.t === 'komp' ? popProses.r.k.kode : popProses.r.g.key} · ${getDayLabel(popProses.d)}`}
            </div>
            {popProses.opsi.map(o => { const w = (PROSES_COLOR as any)[o.proses] || '#64748b'; return (
              <button key={o.rawId} role="menuitem" onClick={() => bukaEdit(o, popProses.r, popProses.d)} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '6px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, textAlign: 'left', fontFamily: 'inherit', color: '#1e293b' }}>
                <span style={{ width: 9, height: 9, borderRadius: 99, background: w, flex: '0 0 auto' }} />
                <span style={{ fontWeight: 700 }}>{o.proses}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10.5, color: o.terisi ? '#1d4ed8' : '#94a3b8' }}>{o.terisi ? 'terjadwal · edit' : '+ tambah'}</span>
              </button>) })}
          </div>
        </>
      )}
      {modalJadwal.elemen}
      {notifAvailable.elemenModal}
      {aturKapasitas.elemen}
      {tambahPanelRaw.elemen}
      {riwayatQty.elemen}
      {menuUrutan && (() => {
        // SENGAJA hanya di dalam zona yang sama (pindah zona lewat dropdown prioritas) - sama dgn menu ⋮ tampilan lama.
        const me = blokUrutRef.current.find(x => x.panelId === menuUrutan.panelId)
        const bz = me ? blokUrutRef.current.filter(x => x.zona === me.zona) : []
        const i = bz.findIndex(x => x.panelId === menuUrutan.panelId)
        const opsi: { k: 'atas' | 'naik' | 'turun' | 'bawah'; l: string; ok: boolean }[] = [
          { k: 'atas', l: '⤒ Pindah ke paling atas kelompok', ok: i > 0 }, { k: 'naik', l: '↑ Naik 1', ok: i > 0 },
          { k: 'turun', l: '↓ Turun 1', ok: i >= 0 && i < bz.length - 1 }, { k: 'bawah', l: '⤓ Pindah ke paling bawah kelompok', ok: i >= 0 && i < bz.length - 1 }]
        return <>
          <div onClick={() => setMenuUrutan(null)} style={{ position: 'fixed', inset: 0, zIndex: 10030 }} />
          <div role="menu" aria-label="Urutan panel" style={{ position: 'fixed', left: Math.min(menuUrutan.x, window.innerWidth - 250), top: Math.min(menuUrutan.y + 2, window.innerHeight - 170), zIndex: 10031, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.15)', padding: '4px 0', minWidth: 230, fontSize: 12 }}>
            <div style={{ padding: '2px 14px 4px', fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>Urutan dalam kelompok {me?.zona}</div>
            {opsi.map(o => <button key={o.k} role="menuitem" disabled={!o.ok || urutanPanel.savingUrutan} onClick={() => urutanPanel.pindahViaMenu(menuUrutan.panelId, o.k)}
              style={{ display: 'block', width: '100%', padding: '7px 14px', border: 'none', background: 'none', cursor: o.ok ? 'pointer' : 'default', color: o.ok ? '#1e293b' : '#cbd5e1', fontSize: 12, textAlign: 'left', fontFamily: 'inherit' }}>{o.l}</button>)}
          </div>
        </>
      })()}
      {menu && (
        <>
          <div onClick={() => setMenu(null)} onContextMenu={e => { e.preventDefault(); setMenu(null) }} style={{ position: 'fixed', inset: 0, zIndex: 10030 }} />
          <div role="menu" style={{ position: 'fixed', left: Math.min(menu.x, window.innerWidth - 230), top: Math.min(menu.y, window.innerHeight - 260), zIndex: 10031, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.15)', padding: '4px 0', minWidth: 220, fontSize: 12 }}>
            {(() => {
              const item = (label: string, fn: (() => void) | null, warna = '#1e293b', ket?: string) => (
                <button key={label} role="menuitem" disabled={!fn} onClick={() => { setMenu(null); fn?.() }} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 10, padding: '7px 14px', border: 'none', background: 'none', cursor: fn ? 'pointer' : 'default', color: fn ? warna : '#cbd5e1', fontSize: 12, textAlign: 'left', fontFamily: 'inherit' }}>
                  <span>{label}</span>{ket && <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{ket}</span>}
                </button>)
              const adaSumber = potongan.length || salinan.length
              return <>
                {item(`📋 Salin ${pilihan.size} chip`, pilihan.size ? salin : null, '#1e293b', 'Ctrl+C')}
                {item(`✂ Potong ${pilihan.size} chip`, pilihan.size ? potong : null, '#1e293b', 'Ctrl+X')}
                {item(`📌 Tempel di ${getDayLabel(menu.d)}${potongan.length ? ' (pindah)' : salinan.length ? ' (salin)' : ''}`, adaSumber ? () => { setTujuanTempel(menu.d); tempel(menu.d) } : null, '#1d4ed8', 'Ctrl+V')}
                {menu.r.t === 'penanda' && item(menu.r.p.sel[menu.d] ? `Hapus penanda ${menu.r.p.proses}` : `Tambah penanda ${menu.r.p.proses}`, () => togglePenandaSel(menu.r, menu.d))}
                {menu.r.t !== 'penanda' && item('✏️ Edit jadwal…', () => klikEdit(null, menu.r, menu.d, true, { x: menu.x, y: menu.y }))}
                {(() => { const nh = [...pilihan].filter(k => pecahKunci(k).jenis === 'h'); return nh.length > 0 && item(`🗑 Hapus ${nh.length} chip header (proses itu saja)`, () => hapusWpKunci(nh), '#dc2626', 'Delete') })()}
                {menu.r.t === 'grup' && menu.r.g.jenis === 'wp' && item(`🗑 Hapus ${menu.r.g.key} di ${getDayLabel(menu.d)} (semua proses)`, () => hapusWpKunci([kunciSel(menu.r, menu.d)]), '#dc2626')}
                <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />
                {item('Bersihkan pilihan', batalkan, '#64748b', 'Esc')}
              </>
            })()}
          </div>
        </>
      )}

      {orderMapError && <div style={{ fontSize: 11, color: '#b45309', marginBottom: 8 }}>Urutan panel gagal dimuat - panel diurutkan per prioritas & nomor panel.</div>}

      <div ref={scrollRef} onScroll={onScroll} style={{ overflow: 'auto', height: 'calc(100vh - 230px)', minHeight: 420, border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' }}>
        <table style={{ tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, width: LEBAR_KIRI + TOTAL_KOLOM * LEBAR_TGL, fontSize: 9, lineHeight: 1.2 /* CSS global mewariskan line-height 26px - wajib dikunci agar tinggi baris = TINGGI (virtualisasi) */ }}>
          <thead>
            <tr>
              <th style={{ ...thS, ...stickyKiri('proyek'), zIndex: 5, textAlign: 'left' }}>Proyek</th>
              <th style={{ ...thS, ...stickyKiri('panel'), zIndex: 5, textAlign: 'left' }}>Panel</th>
              <th style={{ ...thS, ...stickyKiri('deadline'), zIndex: 5 }}>Deadline</th>
              <th style={{ ...thS, ...stickyKiri('komponen'), zIndex: 5, textAlign: 'left' }}>WP / Komponen</th>
              {spasiKiri > 0 && <th aria-hidden="true" style={{ ...thS, width: spasiKiri, padding: 0 }} />}
              {kolom.map(d => {
                const dl = deadlinePerTanggal.get(d)
                return (
                  <th key={d} data-tgl={d} title={(potongan.length || salinan.length) ? 'Klik = hari tujuan tempel' : 'Klik = daftar pekerjaan hari ini'}
                    onClick={() => { if (potongan.length || salinan.length) { setTujuanTempel(d); return } kartuHari.setSelDate(d === kartuHari.selDate ? null : d) }}
                    style={{ ...thS, width: LEBAR_TGL, cursor: 'pointer', background: (potongan.length || salinan.length) && tujuanTempel === d ? '#15803d' : d === TODAY ? '#1e40af' : isMinggu(d) ? '#7f1d1d' : kartuHari.selDate === d ? '#1d4ed8' : '#1e3a8a', borderBottom: d === TODAY ? '2px solid #60a5fa' : kartuHari.selDate === d ? '2px solid #fde047' : 'none' }}>
                    <div>{getDayLabel(d)}{d === TODAY && <span style={{ opacity: .8 }}> · hari ini</span>}</div>
                    {dl && <div title={'Deadline:\n' + dl.join('\n')} style={{ fontSize: 8.5, fontWeight: 800, color: '#fecaca' }}>🚩 {dl.length} deadline</div>}
                  </th>
                )
              })}
              {spasiKanan > 0 && <th aria-hidden="true" style={{ ...thS, width: spasiKanan, padding: 0 }} />}
            </tr>
          </thead>
          <tbody>
            {offset[iAwal] > 0 && <tr aria-hidden="true"><td colSpan={4 + kolom.length + 2} style={{ height: offset[iAwal], padding: 0, border: 'none' }} /></tr>}
            {baris.slice(iAwal, iAkhir).map((r, i) => {
              const nomor = iAwal + i
              const bg = r.t === 'komp' ? (nomor % 2 ? '#fafbfe' : '#fff') : r.t === 'grup' ? (r.buka ? '#f3f6fc' : '#f8fafd') : '#fff'
              const key = r.t === 'grup' ? 'g' + r.kunci : r.t === 'komp' ? 'k' + r.blok.panelId + ':' + r.g.key + ':' + r.k.kode : 'p' + r.blok.panelId + ':' + r.p.proses
              return (
                <tr key={key} data-panel={r.blok.panelId} data-jenis={r.t} data-kb={r.kb} style={{ height: tinggiBaris(r) }}>
                  {renderSelKiri(r, bg)}
                  {spasiKiri > 0 && <td aria-hidden="true" style={{ padding: 0, border: 'none', background: bg }} />}
                  {kolom.map(d => renderSelTanggal(r, d, bg, nomor))}
                  {spasiKanan > 0 && <td aria-hidden="true" style={{ padding: 0, border: 'none', background: bg }} />}
                </tr>
              )
            })}
            {totalTinggi - offset[iAkhir] > 0 && <tr aria-hidden="true"><td colSpan={4 + kolom.length + 2} style={{ height: totalTinggi - offset[iAkhir], padding: 0, border: 'none' }} /></tr>}
          </tbody>
        </table>
        {blokTampil.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Tidak ada panel yang cocok dengan filter.</div>}
      </div>
      {dragPanel && (() => {
        const cr = scrollRef.current?.getBoundingClientRect(); if (!cr) return null
        const w = dragPanel.lintas ? '#f59e0b' : '#2563eb'
        return <>
          {dragPanel.target && <div aria-hidden="true" data-garis-drop style={{ position: 'fixed', left: cr.left, width: cr.width, top: dragPanel.garisY - 1.25, height: 2.5, background: w, zIndex: 9500, pointerEvents: 'none', borderRadius: 2 }}>
            <span style={{ position: 'absolute', left: 2, top: '50%', width: 9, height: 9, borderRadius: '50%', background: w, transform: 'translateY(-50%)', boxShadow: '0 0 0 2px #fff' }} />
            {dragPanel.lintas && <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', background: '#f59e0b', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 99, padding: '2px 9px', whiteSpace: 'nowrap' }}>→ jadi {dragPanel.target.zona}</span>}
          </div>}
          <div aria-hidden="true" style={{ position: 'fixed', left: cr.left + 12, top: cr.top + 8, zIndex: 9501, pointerEvents: 'none', background: '#1e293b', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, boxShadow: '0 6px 20px #0003' }}>
            ⠿ {dragPanel.nama}{dragPanel.lintas ? ` → prioritas ${dragPanel.target?.zona}` : ''}
          </div>
        </>
      })()}
      {kartuHari.elemen}
      {urutan.elemen}
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>
        Chip putus-putus ➡️ = histori (sudah digeser) · ✓ = selesai · ⚠ bingkai merah = urutan proses terbalik · 👥 = kebutuhan orang WIRING · arahkan kursor ke chip untuk detail.
      </div>
    </div>
  )
}

// ═══ PEMBUNGKUS (Tahap A penukaran, 28 Okt 2026) ════════════════════════════════════════════════════════
// Data & fungsi simpan ASLI dari App (rawData/renhar + realtime App, updateRaw/createRaw/renhar - sama dgn Raw Schedule
// utama). SAKLAR SATU TEMPAT: MODE_RAW_PER_WP
//  - 'uji'   : tampil hanya panel WO uji (work_orders.wo = WO_UJI_RAW_PERWP); SEMUA tulisan lewat penjaga lib/penjagaUjiWo
//              (jadwal/renhar WO uji saja; kapasitas global, notifikasi, qty log, RPC lain ditolak). Hitungan kapasitas,
//              Minggu & urutan proses tetap dari SEMUA jadwal.
//  - 'utama' : tanpa penjaga & tanpa saringan panel (dipakai saat penukaran, atas izin user).
// Realtime tambahan halaman ini (kapasitas, process time, notifikasi, urutan panel, timer) = 1 kanal sendiri dgn nama
// berbeda dari kanal Raw Schedule lama (nama sama di 2 tab = crash ErrorBoundary, insiden 10 Okt). Kabar per tabel
// dijeda 1,5 dtk supaya rentetan perubahan timer operator tidak memicu muat ulang beruntun.
export const MODE_RAW_PER_WP: 'uji' | 'utama' = 'uji'

export function RawScheduleAccordion(props: {
  woData: any[]; rawData: any[]; setRawData: (f: any) => void; updateRaw: (id: number, d: any) => Promise<any>; createRaw: (d: any) => Promise<any>; refetchRaw: () => void
  renhar: any[]; setRenhar: (f: any) => void; createRenhar: (d: any) => Promise<any>; updateRenhar: (id: any, d: any) => Promise<any>; removeRenhar: (id: any) => Promise<any>
  refetchRenhar: () => void; withRenharQueue: (task: any, fn: (existing: any) => Promise<void>) => Promise<any>
  log: (action: string, description: string, module: string, extra?: any) => Promise<any>; pekerja?: any[]; livePanelTypes?: any; user?: any
}) {
  const { woData, rawData, livePanelTypes, user } = props
  const uji = MODE_RAW_PER_WP === 'uji'
  const woUji = useMemo(() => woData.filter((w: any) => String(w.wo || '').trim().toUpperCase() === WO_UJI_RAW_PERWP), [woData])
  const woUjiRef = useRef<number[]>([]); woUjiRef.current = woUji.map((w: any) => Number(w.id))
  const panelUji = useMemo(() => new Set(woUji.flatMap((w: any) => (w.panels || []).map((p: any) => Number(p.id)))), [woUji])
  const panelTampil = useCallback((id: number) => panelUji.has(Number(id)), [panelUji])

  // kabar perubahan (realtime) -> pendengar per tabel, dijeda
  const pendengar = useRef(new Set<(t: string) => void>())
  const dengar = useCallback((f: (t: string) => void) => { pendengar.current.add(f); return () => { pendengar.current.delete(f) } }, [])
  useEffect(() => {
    const jeda: Record<string, any> = {}
    const kabari = (t: string) => { clearTimeout(jeda[t]); jeda[t] = setTimeout(() => pendengar.current.forEach(f => { try { f(t) } catch (e) { console.error('[Raw per WP] pendengar gagal:', e) } }), 1500) }
    const ch = supabase.channel(uji ? 'realtime-raw-perwp-uji' : 'realtime-raw-perwp')
    for (const t of ['fcs_kapasitas_override', 'fcs_process_time', 'fcs_notifikasi', 'raw_schedule_panel_order', 'fcs_timer_kerja'])
      ch.on('postgres_changes' as any, { event: '*', schema: 'public', table: t }, () => kabari(t))
    ch.subscribe()
    return () => { Object.values(jeda).forEach(clearTimeout); supabase.removeChannel(ch) }
  }, [uji])

  // urutan panel (paginasi penuh di fetchPanelOrderMap) + muat ulang saat tabelnya berubah
  const [orderMap, setOrderMap] = useState<Record<number, string>>({})
  const [galatUrutan, setGalatUrutan] = useState<string | null>(null)
  useEffect(() => {
    let hidup = true
    const muat = () => fetchPanelOrderMap().then(m => { if (hidup) { setOrderMap(m); setGalatUrutan(null) } })
      .catch((e: any) => { console.error('[Raw per WP] gagal ambil urutan panel:', e); if (hidup) setGalatUrutan(String(e?.message || e)) })
    muat()
    const lepas = dengar(t => { if (t === 'raw_schedule_panel_order') muat() })
    return () => { hidup = false; lepas() }
  }, [dengar])

  const appRef = useRef(props); appRef.current = props
  const orderRef = useRef(orderMap); orderRef.current = orderMap
  const repo = useMemo(() => buatSupabaseRepo({
    rawData: () => appRef.current.rawData,
    updateRaw: (id, d) => appRef.current.updateRaw(id, d), createRaw: d => appRef.current.createRaw(d), log: (...a) => appRef.current.log(...a),
    withRenharQueue: (t, fn) => appRef.current.withRenharQueue(t, fn), createRenhar: d => appRef.current.createRenhar(d),
    updateRenhar: (id, d) => appRef.current.updateRenhar(id, d), removeRenhar: id => appRef.current.removeRenhar(id),
    orderMap: () => orderRef.current, dengar,
  }, uji ? buatPenjagaUji(() => woUjiRef.current) : undefined), [uji, dengar])

  const pita = uji ? (
    <div role="status" aria-label="Mode uji WO" style={{ position: 'sticky', top: 0, zIndex: 30, background: '#7c2d12', color: '#fff', borderRadius: 10, padding: '8px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', boxShadow: '0 4px 14px rgba(0,0,0,.18)' }}>
      <span style={{ fontSize: 16 }}>🧪</span>
      <b style={{ fontSize: 12.5, letterSpacing: .3 }}>MODE UJI: data ASLI, hanya WO "{WO_UJI_RAW_PERWP}" yang tampil & boleh diubah</b>
      <span style={{ fontSize: 11, opacity: .85 }}>Perubahan tersimpan ke jadwal & Rencana Harian WO uji. Kapasitas global, notifikasi & WO lain ditolak.</span>
    </div>
  ) : null
  if (uji && woUji.length === 0) return (
    <div>{pita}
      <div style={{ padding: 30, textAlign: 'center', color: '#64748b', fontSize: 12.5, lineHeight: 1.6 }}>
        WO uji belum ada. Buat WO dengan nomor <b>{WO_UJI_RAW_PERWP}</b> di Manajemen WO (beri panel & generate jadwal), lalu buka halaman ini lagi.
      </div>
    </div>
  )
  return (
    <div>
      {pita}
      {galatUrutan && <div style={{ fontSize: 11, color: '#b45309', marginBottom: 8 }}>Urutan panel gagal dimuat ({galatUrutan}) - panel diurutkan per prioritas & nomor panel.</div>}
      <RawScheduleAccordionInti woData={woData} rawData={rawData} setRawData={props.setRawData} updateRaw={repo.updateRaw} refetchRaw={props.refetchRaw} refetchRenhar={props.refetchRenhar}
        livePanelTypes={livePanelTypes} user={user} setRenhar={props.setRenhar} createRenhar={repo.renhar.create} updateRenhar={repo.renhar.update} removeRenhar={repo.renhar.remove}
        withRenharQueue={repo.renhar.withQueue} renhar={props.renhar} createRaw={repo.createRaw} log={repo.logApp}
        io={repo.io} orderMap={orderMap} setOrderMap={setOrderMap} dengar={dengar} pekerja={props.pekerja} panelTampil={uji ? panelTampil : undefined} />
    </div>
  )
}
