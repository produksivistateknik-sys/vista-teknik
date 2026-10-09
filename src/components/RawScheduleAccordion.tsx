import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { ALL_PROSES, PANEL_TYPES, PROSES_COLOR, PRIORITAS_COLOR, PROSES_ORANG_RAW_GLOBAL } from '../constants/panelTypes'
import { TODAY, addDays, getDayLabel } from '../lib/dateHelpers'
import { formatBusbarTahapTooltip } from '../lib/panelHelpers'
import { fetchWiringHariKerjaMap } from '../services/fcsService'
import { useRawPanelOrder, bandingkanBarisRaw } from '../lib/rawPanelOrder'
import { muatDataKapasitas, menitPerPcs, kapasitasPada, hitungTerpakaiHari } from '../lib/kapasitasHari'
import { buatPetaDeadlinePanel, petaDeadlinePerTanggal, infoDeadline } from '../lib/deadlineRaw'
import { PROSES_ORANG_RAW, entriesTanpaSelesai } from '../lib/isiSelJadwal'
import { kodeBusbarBisaDipindah } from '../lib/jadwalPindah'
import { rencanakanPindahAccordion, pecahKunci } from '../lib/pindahAccordion'
import { usePindahMulti } from '../hooks/usePindahMulti'
import { susunPivot, type BlokPanel, type GrupKomponen, type BarisKomponen, type Penanda, type ChipProses } from '../lib/rawPivot'

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// RAW SCHEDULE ACCORDION PER WP (Tahap 1 migrasi, 9 Okt 2026) - tampilan per WP dari data produksi.
// Tahap 2 (9 Okt 2026): pilih & PINDAH (Ctrl/Alt/Shift+klik, lasso, drag grup, Ctrl+X/V, Ctrl+Z) lewat jalur
// yang SAMA dgn tampilan lama (lib/pindahAccordion -> hooks/usePindahMulti -> RPC v2 + Undo). Selama masa
// uji, pindah HANYA untuk WO "TRIAL ACCORDION" (Preview memakai database produksi). Edit/hapus/copy: Tahap 3.
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
// Tinggi baris DIKUNCI (virtualisasi menghitung posisi dari tinggi ini): isi sel dibatasi tinggi tetap,
// maksimal MAKS_CHIP chip tampil + penanda "+N" (daftar lengkap di tooltip sel).
const MAKS_CHIP = 3
const BUFFER_BARIS = 12
const PROSES_KARTU = ['POTONG', 'BENDING', 'STEL', 'FINISHING', 'PAINTING', 'WIRING CONTROL', 'WIRING POWER']
// MASA UJI (keputusan user, Tahap 2-3): tulis dari tampilan baru hanya untuk WO uji. Hapus saat penggantian.
const HANYA_WO_UJI = true
const POLA_WO_UJI = /TRIAL ACCORDION/i

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

function Chip({ c, kode, checklist }: { c: ChipProses; kode: string; checklist: any }) {
  const warna = (PROSES_COLOR as any)[c.proses] || '#64748b'
  const judul = [
    `${c.proses} · ${kode}`,
    c.selesai ? 'Selesai (100%)' : null,
    c.jejakKe ? `Sudah digeser ke ${fmtTglPendek(c.jejakKe)} (histori)` : null,
    c.pin ? 'Dipin manual (tidak ikut auto-geser)' : null,
    c.dariTanggal ? `Lanjutan dari ${fmtTglPendek(c.dariTanggal)}` : null,
    c.lanjutan ? 'Hari lanjutan sesuai durasi standar bobot wiring' : null,
    c.orang != null ? `Kebutuhan ${Number(c.orang.toFixed(1))} orang` : null,
    c.proses === 'BUSBAR' ? formatBusbarTahapTooltip(checklist?.[kode]) : null,
  ].filter(Boolean).join('\n')
  const jejak = !!c.jejakKe
  return (
    <span title={judul} style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, maxWidth: '100%', boxSizing: 'border-box',
      fontSize: 8.5, fontWeight: 800, letterSpacing: .2, lineHeight: 1.15, padding: '2px 5px', borderRadius: 4,
      background: jejak ? 'transparent' : warna, color: jejak ? warna : '#fff',
      border: jejak ? `1px dashed ${warna}` : `1px solid ${warna}`, opacity: c.selesai && !jejak ? .55 : 1,
    }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.proses}</span>
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

export function RawScheduleAccordion({ woData, rawData, setRawData, refetchRaw, refetchRenhar, livePanelTypes, user }: {
  woData: any[]; rawData: any[]; setRawData?: (f: (prev: any[]) => any[]) => void; refetchRaw?: () => void; refetchRenhar?: () => void; livePanelTypes?: any; user?: any
}) {
  // ── data pendukung (sama sumber dgn Raw Schedule lama) ──
  const [fcsKapasitas, setFcsKapasitas] = useState<any[]>([])
  const [processTimeList, setProcessTimeList] = useState<any[]>([])
  useEffect(() => {
    const fetchCap = async () => { const { kapasitas, processTime } = await muatDataKapasitas(); setFcsKapasitas(kapasitas); setProcessTimeList(processTime) }
    fetchCap()
    const ch = supabase.channel('realtime-fcs-cap-raw-accordion')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fcs_kapasitas_override' }, fetchCap)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fcs_process_time' }, fetchCap)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])
  const [wiringHariKerjaMap, setWiringHariKerjaMap] = useState<Record<string, string[]>>({})
  const wiringPanelIds = useMemo(() => [...new Set(rawData.filter((r: any) => PROSES_ORANG_RAW.includes(r.proses)).map((r: any) => Number(r.panel_id || r.panelId)))], [rawData])
  useEffect(() => {
    let batal = false
    const load = async () => {
      try { const map = await fetchWiringHariKerjaMap(wiringPanelIds as number[]); if (!batal) setWiringHariKerjaMap(map) }
      catch (err) { console.error('[Raw Schedule Accordion] gagal muat hari kerja wiring (pakai data lama):', err) }
    }
    load()
    const ch = supabase.channel('realtime-fcs-timer-kerja-raw-accordion')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fcs_timer_kerja' }, load)
      .subscribe()
    return () => { batal = true; supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(wiringPanelIds)])
  const { orderMap, error: orderMapError } = useRawPanelOrder()

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
  const opsiProyek = useMemo(() => [...new Set(rawData.map((r: any) => r.proyek).filter(Boolean))].sort(), [rawData])
  const opsiPanel = useMemo(() => [...new Set(rawData.filter((r: any) => filterProyek.length === 0 || filterProyek.includes(r.proyek)).map((r: any) => r.panel).filter(Boolean))].sort(), [rawData, filterProyek])
  const lolosPanel = useCallback((r: any) => (filterProyek.length === 0 || filterProyek.includes(r.proyek)) && (filterPanel.length === 0 || filterPanel.includes(r.panel)), [filterProyek, filterPanel])

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
  const offset = useMemo(() => { const o = new Array(baris.length + 1); o[0] = 0; for (let i = 0; i < baris.length; i++) o[i + 1] = o[i] + TINGGI[baris[i].t]; return o }, [baris])
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
  const [tujuanTempel, setTujuanTempel] = useState<string | null>(null)
  const [konfirmasi, setKonfirmasi] = useState<{ kunci: string[]; offset: number } | null>(null)
  const blokById = useMemo(() => new Map(blokTampil.map(b => [b.panelId, b])), [blokTampil])
  const panelSemua = useMemo(() => woData.flatMap((w: any) => w.panels || []), [woData])
  const entriesTanpaSelesaiRow = (row: any, entries: any[]) => { const pid = row.panel_id || row.panelId; return entriesTanpaSelesai(row.proses, entries, panelSemua.find((p: any) => p.id === pid)) }
  const checklistPanel = (row: any) => panelById.get(Number(row.panel_id || row.panelId))?.checklist
  const pindahMulti = usePindahMulti(() => ({ rawData, user, setRawData: setRawData || (() => {}), refetchRaw, refetchRenhar, tampilToastAksi }))
  const ctxPindah = () => ({
    rawData, blokById, checklistPanel, entriesTanpaSelesai: entriesTanpaSelesaiRow, tanggalKeIdx, idxKeTanggal, totalKolom: TOTAL_KOLOM,
    timerBusbar: pindahMulti.timerBusbarRef.current, kapasitasPada: (d: string, pr: string) => kapasitasPada(fcsKapasitas, d, pr),
    hitungTerpakaiHari: (rows: any[], d: string, pr: string) => hitungTerpakaiHari(rows, d, pr, ctxKap),
  })
  // Sel berisi pekerjaan yang BISA dipindah (cek cepat utk tampilan; validasi pasti di rencanakanPindahAccordion).
  const bisaPindah = (r: Baris, d: string): boolean => {
    if (r.t === 'penanda') return !!r.p.sel[d]
    const kompBisa = (k: BarisKomponen) => (k.sel[d] || []).some(c => !c.jejakKe && !c.lanjutan && !(r.g.jenis === 'wp' && c.selesai)
      && (r.g.jenis !== 'busbar' || kodeBusbarBisaDipindah(rawData.find((x: any) => x.id === c.rawId), panelById.get(r.blok.panelId)?.checklist, d).includes(k.kode)))
    return r.t === 'komp' ? kompBisa(r.k) : r.g.komponen.some(kompBisa)
  }
  const kunciSel = (r: Baris, d: string) => r.kb + '|' + d
  const bolehTulis = (kunci: string[]) => {
    if (!setRawData) { tampilToastAksi('Tampilan ini belum tersambung ke penyimpanan.', 'err'); return false }
    if (!HANYA_WO_UJI) return true
    const pids = new Set(kunci.map(k => pecahKunci(k).panelId))
    const bukanUji = [...pids].filter(pid => { const b = blokById.get(pid); return !(POLA_WO_UJI.test(b?.proyek || '') || POLA_WO_UJI.test(String(woData.find((w: any) => (w.panels || []).some((p: any) => Number(p.id) === pid))?.wo || ''))) })
    if (bukanUji.length) { tampilToastAksi('Masa uji: pindah dari tampilan baru hanya untuk WO "TRIAL ACCORDION". Data produksi lain tetap lewat menu Raw Schedule.', 'err'); return false }
    return true
  }
  const muatTimerUntuk = (kunci: string[]) => {
    const cells = kunci.flatMap(k => { const x = pecahKunci(k); const b = blokById.get(x.panelId); const g = b?.grup.find(y => y.key === x.grup && y.jenis === 'busbar'); return g ? g.komponen.flatMap(km => (km.sel[x.tanggal] || []).map(c => ({ rawId: c.rawId, date: x.tanggal }))) : [] })
    return pindahMulti.muatTimerBusbar(cells)
  }
  const jalankanPindah = async (kunci: string[], offset: number) => {
    if (offset === 0) return false
    if (!bolehTulis(kunci)) return false
    const rencana = rencanakanPindahAccordion(kunci, offset, ctxPindah())
    if (rencana.bentrok.length > 0) {
      tampilToastAksi(`Dibatalkan: ${rencana.bentrok.length} sel tidak bisa mendarat (${[...new Set(rencana.bentrok.map(b => b.alasan))].join(', ')}). Tidak ada yang dipindah.`, 'err')
      return false
    }
    return pindahMulti.jalankanPindahSel(rencana.sel, rencana.jadwal, {
      jumlah: `${rencana.jumlahKomponen} komponen`, offset,
      ulangi: () => { jalankanPindahRef.current(kunci, offset) },
      onSukses: () => {
        const geser = (k: string) => { const x = pecahKunci(k); const i = tanggalKeIdx(x.tanggal) + offset; return x.baris + '|' + idxKeTanggal(i) }
        setPilihan(prev => new Set([...prev].map(k => kunci.includes(k) ? geser(k) : k)))
        setJangkar(null)
      },
    })
  }
  const jalankanPindahRef = useRef(jalankanPindah); jalankanPindahRef.current = jalankanPindah
  const batalkan = () => { setPilihan(new Set()); setJangkar(null); setPotongan([]); setTujuanTempel(null) }
  const potong = () => {
    const isi = [...pilihan]
    if (isi.length === 0) { tampilToastAksi('Pilih sel dulu (Ctrl+klik / lasso), lalu Ctrl+X.', 'err'); return }
    setPotongan(isi); setTujuanTempel(null); muatTimerUntuk(isi)
    tampilToastAksi(`${isi.length} sel dipotong. Klik hari tujuan, lalu Ctrl+V (atau tombol Tempel).`, 'ok')
  }
  const tempel = async () => {
    if (potongan.length === 0) return
    if (!tujuanTempel) { tampilToastAksi('Klik hari tujuan di jadwal dulu, lalu Ctrl+V.', 'err'); return }
    const offset = tanggalKeIdx(tujuanTempel) - Math.min(...potongan.map(k => tanggalKeIdx(pecahKunci(k).tanggal)))
    if (offset === 0) { tampilToastAksi('Hari tujuan sama dengan posisi sekarang - tidak ada yang dipindah.', 'err'); return }
    const ok = await jalankanPindah(potongan, offset)
    if (ok) { setPotongan([]); setTujuanTempel(null) }
  }
  const aksiRef = useRef<any>({}); aksiRef.current = { potong, tempel, batalkan, undo: pindahMulti.batalkanPindahTerakhir, pilihan, potongan }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (!scrollRef.current || scrollRef.current.offsetParent === null) return // tab tidak tampil
      const mod = e.ctrlKey || e.metaKey; const k = e.key.toLowerCase()
      if (mod && k === 'x' && aksiRef.current.pilihan.size) { e.preventDefault(); aksiRef.current.potong() }
      else if (mod && k === 'v' && aksiRef.current.potongan.length) { e.preventDefault(); aksiRef.current.tempel() }
      else if (mod && k === 'z' && !e.shiftKey && pindahMulti.undoMultiRef.current.length) { e.preventDefault(); aksiRef.current.undo() }
      else if (e.key === 'Escape') aksiRef.current.batalkan()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const klikSel = (e: React.MouseEvent, r: Baris, d: string, i: number) => {
    if (potongan.length && !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) { setTujuanTempel(d); return }
    const kunci = kunciSel(r, d)
    if (e.shiftKey && jangkar) {
      const [a, b] = [Math.min(jangkar.i, i), Math.max(jangkar.i, i)]
      const [da, db] = [Math.min(tanggalKeIdx(jangkar.d), tanggalKeIdx(d)), Math.max(tanggalKeIdx(jangkar.d), tanggalKeIdx(d))]
      const s = new Set(pilihan)
      for (let x = a; x <= b; x++) for (let y = da; y <= db; y++) { const dd = idxKeTanggal(y); if (bisaPindah(baris[x], dd)) s.add(kunciSel(baris[x], dd)) }
      setPilihan(s); return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) {
      const s = new Set(pilihan)
      if (s.has(kunci)) s.delete(kunci)
      else { if (!bisaPindah(r, d)) { tampilToastAksi('Sel ini kosong / semua isinya sudah selesai atau sudah digeser - tidak bisa dipilih.', 'err'); return } s.add(kunci) }
      setPilihan(s); setJangkar({ i, d }); return
    }
    // klik biasa: Edit jadwal menyusul (Tahap 3) - di tahap ini klik biasa tidak mengubah apa pun
  }

  // Lasso: tekan di area kosong sel tanggal lalu seret. Baris & kolom dihitung dari DATA (offset kumulatif +
  // lebar kolom tetap), bukan DOM - aman utk baris lazy & kolom yang divirtualisasi.
  const lassoRef = useRef<{ x: number; y: number; tambah: boolean; aktif: boolean } | null>(null)
  const kotakRef = useRef<HTMLDivElement | null>(null)
  const lassoCtx = useRef<any>({}); lassoCtx.current = { baris, offset, pilihan, bisaPindah, cariIdx }
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
      const kol = (cx: number) => Math.floor((cx - cr.left - cont.clientLeft + cont.scrollLeft - LEBAR_KIRI) / LEBAR_TGL)
      const brs = (cy: number) => L.cariIdx(cy - cr.top - cont.clientTop + cont.scrollTop - TINGGI_HEADER)
      const s = new Set<string>(m.tambah ? L.pilihan : [])
      const i1 = Math.max(0, brs(y1)), i2 = Math.min(L.baris.length - 1, brs(y2))
      for (let i = i1; i <= i2; i++) for (let c = Math.max(0, kol(x1)); c <= Math.min(TOTAL_KOLOM - 1, kol(x2)); c++) {
        const d = idxKeTanggal(c); if (L.bisaPindah(L.baris[i], d)) s.add(L.baris[i].kb + '|' + d)
      }
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
  const onDragStart = (e: React.DragEvent, r: Baris, d: string) => {
    const kunci = kunciSel(r, d)
    const isi = pilihan.has(kunci) ? [...pilihan] : [kunci]
    if (!pilihan.has(kunci) && pilihan.size) { setPilihan(new Set()); setJangkar(null) }
    e.dataTransfer.effectAllowed = 'move'
    const badge = document.createElement('div')
    badge.style.cssText = 'position:fixed;z-index:10001;pointer-events:none;padding:5px 11px;border-radius:99px;background:#2563eb;color:#fff;font:700 12px system-ui,sans-serif;white-space:nowrap;left:-1000px;top:-1000px'
    badge.textContent = isi.length + ' sel'; document.body.appendChild(badge)
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
    if (offset === 0) { m.badge.textContent = m.kunci.length + ' sel'; m.badge.style.background = '#2563eb'; return }
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
    m.badge.textContent = `${m.kunci.length} sel · ${offset > 0 ? '+' : ''}${offset} hari${nb ? ` · ${nb} bentrok` : ''}`
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
    if (rencana.sel.length === 0) return
    setKonfirmasi({ kunci, offset })
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
    const batas = (isi: any) => <div style={{ maxHeight: TINGGI[r.t] - 6, overflow: 'hidden' }}>{isi}</div>
    return (
      <>
        <td style={stickyKiri('proyek', { ...td, color: '#475569', fontWeight: 600 })}>{r.pertama && batas(<div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.proyek}>{b.proyek}</div>)}</td>
        <td style={stickyKiri('panel', { ...td, color: '#1e293b', fontWeight: 700 })}>{r.pertama && batas(
          <div title={`${b.panel} · ${b.tipe}`}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.panel}</div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 1 }}>
              <span style={{ padding: '0 4px', borderRadius: 3, border: `1px solid ${pri}`, color: pri, background: pri + '14', fontSize: 8, fontWeight: 800 }}>{b.prioritas || 'Sedang'}</span>
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
    const kunci = kunciSel(r, d); const dipilih = pilihan.has(kunci); const dipotong = potongan.includes(kunci)
    const bisa = bisaPindah(r, d)
    const td: any = { borderTop: garisAtas, borderRight: '1px solid #f1f5f9', padding: '2px 4px', verticalAlign: 'middle', background: dipilih ? '#dbeafe' : bgSel(d, bgDasar), width: LEBAR_TGL, minWidth: LEBAR_TGL, maxWidth: LEBAR_TGL, boxSizing: 'border-box', overflow: 'hidden',
      outline: dipilih ? '2px solid #2563eb' : 'none', outlineOffset: -2, opacity: dipotong ? .45 : 1, cursor: potongan.length ? 'crosshair' : bisa ? 'grab' : 'default' }
    const ev = {
      onClick: (e: any) => klikSel(e, r, d, nomor),
      onDragOver: (e: any) => onDragOver(e, d), onDrop: (e: any) => onDrop(e, d),
      draggable: bisa && !potongan.length, onDragStart: (e: any) => onDragStart(e, r, d), onDragEnd: () => bersihkanDrag(),
    }
    const wadah = (isi: any, sisa: number, judulSemua: string) => (
      <div title={sisa > 0 ? judulSemua : undefined} style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'center', gap: 2, height: TINGGI[r.t] - 6, overflow: 'hidden' }}>
        {isi}
        {sisa > 0 && <span style={{ fontSize: 8.5, fontWeight: 800, color: '#475569', background: '#e2e8f0', borderRadius: 4, padding: '2px 4px' }}>+{sisa}</span>}
      </div>
    )
    if (r.t === 'grup') {
      const rsSemua = r.buka ? [] : (r.g.ringkasan[d] || [])
      const rs = rsSemua.length > MAKS_CHIP ? rsSemua.slice(0, MAKS_CHIP - 1) : rsSemua
      return <td key={d} data-tgl={d} style={td} {...ev}>{wadah(<>
        {rs.map(x => { const w = (PROSES_COLOR as any)[x.proses] || '#64748b'; return (
          <span key={x.proses} title={`${r.g.key}: ${x.n} komponen ${x.proses}${x.selesai ? ' - semua selesai' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: w, color: '#fff', borderRadius: 4, padding: '2px 5px', fontSize: 8.5, fontWeight: 800, opacity: x.selesai ? .55 : 1, maxWidth: '100%' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.proses}</span>
            <span style={{ background: 'rgba(255,255,255,.28)', borderRadius: 3, padding: '0 3px' }}>{x.n}</span>{x.selesai && '✓'}
          </span>) })}
      </>, rsSemua.length - rs.length, `${r.g.key} ${getDayLabel(d)}:\n` + rsSemua.map(x => `${x.proses} ${x.n} komponen${x.selesai ? ' ✓' : ''}`).join('\n'))}</td>
    }
    if (r.t === 'komp') {
      const csSemua = r.k.sel[d] || []
      const cs = csSemua.length > MAKS_CHIP ? csSemua.slice(0, MAKS_CHIP - 1) : csSemua
      return <td key={d} data-tgl={d} style={td} {...ev}>{wadah(cs.map((c, i) => <Chip key={c.proses + i} c={c} kode={r.k.kode} checklist={panelById.get(r.blok.panelId)?.checklist} />),
        csSemua.length - cs.length, `${r.k.kode} ${getDayLabel(d)}:\n` + csSemua.map(c => c.proses + (c.selesai ? ' ✓' : '') + (c.jejakKe ? ' (histori)' : '')).join('\n'))}</td>
    }
    const ada = r.p.sel[d]; const w = (PROSES_COLOR as any)[r.p.proses] || '#64748b'
    return <td key={d} data-tgl={d} style={td} {...ev}>{ada && <span title={`${r.p.proses}${r.p.selesai ? ' - selesai' : ''}`} style={{ display: 'inline-flex', gap: 3, background: w, color: '#fff', borderRadius: 4, padding: '2px 5px', fontSize: 8.5, fontWeight: 800, opacity: r.p.selesai ? .55 : 1 }}>{r.p.proses}{r.p.selesai && ' ✓'}</span>}</td>
  }

  const jumlahKomponen = blokTampil.reduce((s, b) => s + b.grup.reduce((t, g) => t + g.komponen.length, 0), 0)
  const jumlahHeader = blokTampil.reduce((s, b) => s + b.grup.length + b.penanda.length, 0)

  return (
    <div className="fi">
      <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 10, padding: '9px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 17 }}>🧪</span>
        <div style={{ fontSize: 11.5, color: '#1e3a8a', lineHeight: 1.5 }}>
          <b>Raw Schedule tampilan baru (uji).</b> Data produksi asli, dikelompokkan per WP. Pilih: Ctrl/Alt/Shift+klik atau seret kotak (lasso); pindah: drag, atau Ctrl+X → klik hari tujuan → Ctrl+V; batalkan: Ctrl+Z. <b>Masa uji: pindah hanya untuk WO "TRIAL ACCORDION"</b> - data lain tetap lewat menu <b>Raw Schedule</b>.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary,#1e293b)' }}>Raw Schedule — per WP</div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{blokTampil.length} panel · {jumlahHeader} baris tertutup · {jumlahKomponen} komponen · tampil sekarang {baris.length} baris</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
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
        <span style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 2px' }} />
        <button onClick={() => setFilterProses([])} style={{ padding: '3px 10px', borderRadius: 20, border: `1.5px solid ${filterProses.length === 0 ? '#1d4ed8' : '#e2e8f0'}`, background: filterProses.length === 0 ? '#1d4ed8' : '#fff', color: filterProses.length === 0 ? '#fff' : '#64748b', cursor: 'pointer', fontSize: 10.5, fontWeight: 700 }}>Semua proses</button>
        {ALL_PROSES.map((pr: string) => { const pc = (PROSES_COLOR as any)[pr] || '#64748b'; const on = filterProses.includes(pr); return (
          <button key={pr} onClick={() => setFilterProses(on ? filterProses.filter(x => x !== pr) : [...filterProses, pr])} style={{ padding: '3px 10px', borderRadius: 20, border: `1.5px solid ${on ? pc : '#e2e8f0'}`, background: on ? pc + '18' : '#fff', color: on ? pc : '#64748b', cursor: 'pointer', fontSize: 10.5, fontWeight: 700 }}>{pr}</button>) })}
      </div>

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
                      <div key={pr} style={{ marginBottom: 3 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}><span style={{ color: '#64748b' }}>{pr}</span><b style={{ color: kap > 0 ? '#1e293b' : '#94a3b8' }}>{kap > 0 ? `${orang ? Number(pakai.toFixed(1)) : Math.round(pakai)}/${kap} ${orang ? 'orang' : 'mnt'}` : 'belum diatur'}</b></div>
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

      {(pilihan.size > 0 || potongan.length > 0 || pindahMulti.undoMultiRef.current.length > 0) && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 10px', fontSize: 11 }}>
          {pilihan.size > 0 && <b style={{ color: '#1d4ed8' }}>{pilihan.size} sel dipilih</b>}
          {potongan.length > 0 && <span style={{ color: '#92400e', fontWeight: 700 }}>✂ {potongan.length} sel dipotong{tujuanTempel ? ` · tujuan ${getDayLabel(tujuanTempel)}` : ' · klik hari tujuan'}</span>}
          {pilihan.size > 0 && <button onClick={potong} style={{ height: 24, padding: '0 9px', borderRadius: 5, border: '1px solid #93c5fd', background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✂ Potong (Ctrl+X)</button>}
          {potongan.length > 0 && <button onClick={tempel} style={{ height: 24, padding: '0 9px', borderRadius: 5, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Tempel (Ctrl+V)</button>}
          {pindahMulti.undoMultiRef.current.length > 0 && <button onClick={() => pindahMulti.batalkanPindahTerakhir()} style={{ height: 24, padding: '0 9px', borderRadius: 5, border: '1px solid #d1d5db', background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>↶ Batalkan pindah terakhir (Ctrl+Z)</button>}
          {(pilihan.size > 0 || potongan.length > 0) && <button onClick={batalkan} style={{ height: 24, padding: '0 9px', borderRadius: 5, border: '1px solid #d1d5db', background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Bersihkan (Esc)</button>}
        </div>
      )}
      {toast && (
        <div role="status" style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 10050, maxWidth: 460, background: toast.jenis === 'ok' ? '#065f46' : '#991b1b', color: '#fff', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,.25)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ flex: 1 }}>{toast.pesan}</span>
          {toast.aksi?.map(a => <button key={a.label} onClick={() => { setToast(null); a.fn() }} style={{ border: '1px solid #ffffff80', background: 'transparent', color: '#fff', borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{a.label}</button>)}
          <button onClick={() => setToast(null)} aria-label="Tutup" style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 14 }}>×</button>
        </div>
      )}
      {konfirmasi && (
        <div onClick={() => setKonfirmasi(null)} style={{ position: 'fixed', inset: 0, zIndex: 10040, background: 'rgba(15,23,42,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 18, width: 360, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 16px 40px rgba(0,0,0,.25)' }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>Pindah {konfirmasi.kunci.length} sel {konfirmasi.offset > 0 ? '+' : ''}{konfirmasi.offset} hari?</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>Komponen yang sudah selesai atau sudah digeser tetap di tempatnya. Bisa dibatalkan dengan Ctrl+Z.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button title="Copy menyusul di Tahap 3" disabled style={{ height: 30, padding: '0 12px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#94a3b8', fontSize: 12, fontFamily: 'inherit' }}>Copy (tahap 3)</button>
              <button onClick={() => setKonfirmasi(null)} style={{ height: 30, padding: '0 12px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
              <button onClick={async () => { const k = konfirmasi; setKonfirmasi(null); await jalankanPindah(k.kunci, k.offset) }} style={{ height: 30, padding: '0 14px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Pindah</button>
            </div>
          </div>
        </div>
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
                  <th key={d} data-tgl={d} style={{ ...thS, width: LEBAR_TGL, background: d === TODAY ? '#1e40af' : isMinggu(d) ? '#7f1d1d' : '#1e3a8a', borderBottom: d === TODAY ? '2px solid #60a5fa' : 'none' }}>
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
                <tr key={key} data-panel={r.blok.panelId} data-jenis={r.t} data-kb={r.kb} style={{ height: TINGGI[r.t] }}>
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
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>
        Chip putus-putus ➡️ = histori (sudah digeser) · ✓ = selesai · 👥 = kebutuhan orang WIRING · arahkan kursor ke chip untuk detail.
      </div>
    </div>
  )
}
