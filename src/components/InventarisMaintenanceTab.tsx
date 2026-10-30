// INVENTARIS & MAINTENANCE - TAB ADMIN (T2, 29 Okt 2026). Pengganti tab Maintenance lama (mesin/maintenance_rutin/
// maintenance_log). Acuan tampilan & alur: pratinjau "maintenance-mesin.html" yang disepakati user (bukan disalin):
// tiga kartu ringkasan = filter, sub-tab Inventaris/Laporan/Maintenance/Riwayat, tabel gaya spreadsheet (kolom nama
// menempel), filter lokasi multi-pilih di judul kolom Lokasi (ikon ▾, jumlah per lokasi), Lokasi & Kondisi diganti
// langsung di sel, klik baris = detail. Data & aturan: lib/inventaris.ts (semua tulis lewat RPC inv_*). Realtime +
// pemulih (fokus/visibility/polling) lewat pasangPemulihRealtime - perubahan operator langsung tampil di sini.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { pasangPemulihRealtime } from '../lib/pemulihRealtime'
import {
  muatInventaris, muatLogBarang, tambahBarang, ubahBarang, setKondisi, ubahStatusLaporan, simpanJadwal, selesaiJadwal,
  tambahMedia, hapusMedia, imporBarang, unggahMediaInventaris, KONDISI, infoKondisi, STATUS_JADWAL, STATUS_LAPORAN, FREKUENSI,
  labelFrekuensi, fmtTanggal, fmtWaktu, teksSisaHari, laporanAktif, isVideo, isPdf, BATAS_DATASHEET_MB,
  type DataInventaris, type Barang, type Jadwal, type Laporan, type Media, type LogBarang,
} from '../lib/inventaris'
import { bacaBarisInventaris, ringkasImpor, barisUntukRpc, rapikanTeks, type BarisImpor } from '../lib/inventarisImpor'
import { MediaPickerSheet } from './ui/MediaPickerSheet'
import { ThumbMedia } from './ui/ThumbMedia'
import { Modal, Inp, Sel, Lbl, Btn } from './ui/Primitives'

const db: any = supabase
const BARIS_PER_HALAMAN = 200 // riwayat terus bertambah - tabel tidak merender ribuan baris sekaligus
type Tab = 'inventaris' | 'laporan' | 'maintenance' | 'riwayat'
const TABS: [Tab, string][] = [['inventaris', 'Inventaris'], ['laporan', 'Laporan'], ['maintenance', 'Maintenance'], ['riwayat', 'Riwayat']]
const OPSI_FILTER: Record<Tab, [string, string][]> = {
  inventaris: [['semua', 'Semua kondisi'], ...KONDISI.map(k => [k.kode, k.label] as [string, string])],
  laporan: [['semua', 'Semua status'], ['aktif', 'Aktif (Open / In Progress)'], ['closed', 'Closed']],
  maintenance: [['semua', 'Semua jadwal aktif'], ['terlambat', 'Terlambat'], ['segera', 'Jatuh tempo ≤ 2 hari'], ['normal', 'Normal'], ['nonaktif', 'Nonaktif']],
  riwayat: [['semua', 'Semua jenis'], ['rutin', 'Rutin'], ['kerusakan', 'Kerusakan']],
}

const CSS = `
.invm{--iv-card:var(--card-bg,#fff);--iv-fg:var(--text-primary,#16202e);--iv-mute:var(--text-muted,#5d6b7e);--iv-line:var(--border-color,#d9dfe8);
  --iv-head:var(--bg-secondary,#eef1f6);--iv-hover:var(--bg-tertiary,#f0f4fb);--iv-acc:#1d4ed8;--iv-acc-bg:#e3ebff;
  color:var(--iv-fg);font-size:13px;line-height:1.4;text-align:left;display:flex;flex-direction:column;gap:12px}
[data-theme="dark"] .invm{--iv-acc:#6b9bff;--iv-acc-bg:#1b2a4d}
.invm *{box-sizing:border-box}
.invm h1{font-size:20px;font-weight:700;margin:0}
.invm .iv-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.invm .iv-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}
.invm .iv-sum button{background:var(--iv-card);border:1px solid var(--iv-line);border-radius:10px;padding:9px 12px;display:flex;align-items:baseline;gap:10px;text-align:left;cursor:pointer;font-family:inherit;color:var(--iv-fg)}
.invm .iv-sum button[aria-pressed="true"]{border-color:var(--iv-acc);background:var(--iv-acc-bg);box-shadow:inset 0 0 0 1px var(--iv-acc)}
.invm .iv-sum b{font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}
.invm .iv-sum span{color:var(--iv-mute);font-size:12.5px}
.invm .iv-tabs{display:flex;gap:2px;border-bottom:1px solid var(--iv-line);overflow-x:auto}
.invm .iv-tabs button{border:0;background:transparent;padding:9px 14px;font-weight:600;font-size:13px;color:var(--iv-mute);border-bottom:2px solid transparent;white-space:nowrap;cursor:pointer;font-family:inherit}
.invm .iv-tabs button[aria-selected="true"]{color:var(--iv-acc);border-bottom-color:var(--iv-acc)}
.invm .iv-tabs i{font-style:normal;font-size:11px;margin-left:6px;background:var(--iv-head);border-radius:99px;padding:1px 7px}
.invm .iv-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.invm .iv-bar select,.invm .iv-bar input[type=text]{font:inherit;color:var(--iv-fg);background:var(--iv-card);border:1px solid var(--iv-line);border-radius:8px;padding:7px 9px;min-width:0}
.invm .iv-bar input[type=text]{flex:1;min-width:150px}
.invm .iv-cnt{margin-left:auto;color:var(--iv-mute);font-size:12.5px}
.invm .iv-btn{font:inherit;font-size:12.5px;font-weight:600;border:1px solid var(--iv-line);background:var(--iv-card);color:var(--iv-fg);border-radius:8px;padding:6px 12px;cursor:pointer;white-space:nowrap}
.invm .iv-btn.pri{background:var(--iv-acc);border-color:var(--iv-acc);color:#fff}
.invm .iv-btn.ok{background:#dcf5e5;color:#15803d;border-color:transparent}
.invm .iv-btn:disabled{opacity:.5;cursor:not-allowed}
.invm .iv-tw{overflow:auto;max-height:600px;background:var(--iv-card);border:1px solid var(--iv-line);border-radius:10px}
.invm table{border-collapse:separate;border-spacing:0;width:100%}
.invm th,.invm td{padding:7px 10px;border-bottom:1px solid var(--iv-line);border-right:1px solid var(--iv-line);text-align:left;vertical-align:top}
.invm th:last-child,.invm td:last-child{border-right:0}
.invm th{position:sticky;top:0;background:var(--iv-head);font-size:12px;font-weight:600;color:var(--iv-mute);white-space:nowrap;z-index:2}
.invm tbody tr.klik{cursor:pointer}
.invm tbody tr.klik:hover>td{background:var(--iv-hover)}
.invm .iv-inv td{white-space:nowrap}
.invm .iv-inv td.iv-wrap{white-space:normal;min-width:220px}
.invm .iv-inv th:first-child,.invm .iv-inv td:first-child{position:sticky;left:0;z-index:1;background:var(--iv-card);min-width:190px;font-weight:600}
.invm .iv-inv th:first-child{z-index:3;background:var(--iv-head)}
.invm tr.iv-exp>td{background:var(--iv-head);padding:12px 14px;white-space:normal;position:static}
.invm .iv-inv tr.iv-exp .iv-exp{position:sticky;left:14px;max-width:min(1100px,calc(100vw - 120px))}
.invm .iv-kode{font-family:ui-monospace,Menlo,monospace;font-size:12px;white-space:nowrap}
.invm .iv-kode small{display:block;color:var(--iv-mute);font-size:10.5px}
.invm .iv-mute{color:var(--iv-mute);font-size:12px}
.invm .iv-badge{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:99px;white-space:nowrap}
.invm .iv-badge::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.invm .iv-cs{font:inherit;font-size:12px;font-weight:600;border:0;border-radius:6px;padding:4px 6px;cursor:pointer;max-width:100%}
.invm .iv-cs:disabled{cursor:not-allowed;opacity:.85}
.invm .iv-fbtn{font:inherit;font-size:11.5px;border:1px solid var(--iv-line);background:var(--iv-card);color:var(--iv-mute);border-radius:6px;padding:0 7px;margin-left:6px;cursor:pointer}
.invm .iv-fbtn.on{background:var(--iv-acc-bg);color:var(--iv-acc);border-color:var(--iv-acc);font-weight:700}
.invm .iv-pop{position:fixed;z-index:10400;min-width:220px;max-height:360px;overflow:auto;background:var(--iv-card);color:var(--iv-fg);border:1px solid var(--iv-line);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:6px;font-size:13px}
.invm .iv-pop label{display:flex;gap:8px;align-items:center;padding:6px 8px;border-radius:6px;cursor:pointer;font-weight:500}
.invm .iv-pop label:hover{background:var(--iv-hover)}
.invm .iv-pop .n{margin-left:auto;color:var(--iv-mute)}
.invm .iv-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px 18px;margin-bottom:8px}
.invm .iv-g dt{font-size:11.5px;color:var(--iv-mute)}
.invm .iv-g dd{margin:2px 0 0;font-size:12.5px;overflow-wrap:anywhere}
.invm .iv-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}
.invm .iv-thumbs{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.invm .iv-thumbs a{display:block;width:56px;height:56px;border-radius:8px;overflow:hidden;border:1px solid var(--iv-line);position:relative}
.invm .iv-thumbs a span{position:absolute;inset:0;display:grid;place-items:center;font-size:11px;font-weight:700;color:#b91c1c;background:#fde0e0}
.invm .iv-exp textarea,.invm .iv-exp input[type=text],.invm .iv-exp select{font:inherit;color:var(--iv-fg);background:var(--iv-card);border:1px solid var(--iv-line);border-radius:8px;padding:7px 9px}
.invm .iv-exp textarea{width:100%}
.invm .iv-hint{color:#b91c1c;font-size:12.5px;margin-top:4px}
.invm .iv-sec{font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--iv-mute);margin:10px 0 4px}
.invm .iv-upd{border-left:2px solid var(--iv-line);padding:2px 0 2px 8px;margin:4px 0;font-size:12.5px}
.invm .iv-empty{padding:26px;text-align:center;color:var(--iv-mute)}
.invm .iv-err{background:#fde0e0;color:#b91c1c;border-radius:8px;padding:8px 12px;font-weight:600}
`

const badge = (warna: string, latar: string, label: string) => <span className="iv-badge" style={{ color: warna, background: latar }}>{label}</span>
const badgeJadwal = (j: Jadwal) => !j.aktif ? badge('#64748b', '#eef1f5', 'Nonaktif') : badge(STATUS_JADWAL[j.status_jadwal].warna, STATUS_JADWAL[j.status_jadwal].latar, STATUS_JADWAL[j.status_jadwal].label)
const badgeLaporan = (s: Laporan['status']) => badge(STATUS_LAPORAN[s].warna, STATUS_LAPORAN[s].latar, STATUS_LAPORAN[s].label)
const pesanGalat = (e: any) => e?.message || String(e)

function Thumbs({ media }: { media: Media[] }) {
  if (!media.length) return <span className="iv-mute">—</span>
  return <div className="iv-thumbs">{media.map(m => (
    <a key={m.id} href={m.url} target="_blank" rel="noreferrer" title={m.peran + ' · ' + (m.oleh || '') + ' · ' + fmtWaktu(m.dibuat_pada)}>
      {isPdf(m) ? <span>PDF</span> : <ThumbMedia url={m.url} thumb={m.thumb} video={isVideo(m)} />}
    </a>))}</div>
}

function FilePilihan({ files, setFiles }: { files: File[]; setFiles: (f: File[]) => void }) {
  return <>
    <MediaPickerSheet allowVideo onFiles={fl => setFiles([...files, ...Array.from(fl)])} triggerClassName="iv-btn">+ Foto/video</MediaPickerSheet>
    {files.map((f, i) => <span key={i} className="iv-mute">{f.name} <button type="button" className="iv-btn" style={{ padding: '0 6px' }} onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button></span>)}
  </>
}

export function InventarisMaintenanceTab({ user }: any) {
  const [data, setData] = useState<DataInventaris | null>(null)
  const [galatMuat, setGalatMuat] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('inventaris')
  const [fLok, setFLok] = useState<string[]>([])
  const [fKon, setFKon] = useState('semua')
  const [q, setQ] = useState('')
  const [nonaktif, setNonaktif] = useState(false)
  const [buka, setBuka] = useState<string | null>(null)
  const [pop, setPop] = useState<{ x: number; y: number } | null>(null)
  const [modal, setModal] = useState<any>(null)
  const [sibuk, setSibuk] = useState<string | null>(null)
  const [batas, setBatas] = useState(BARIS_PER_HALAMAN)

  const muat = useCallback(async () => {
    try { setData(await muatInventaris(db)); setGalatMuat(null) }
    catch (e: any) { console.error('[InventarisMaintenanceTab] gagal memuat:', e); setGalatMuat('Gagal memuat data inventaris: ' + pesanGalat(e)) }
  }, [])
  useEffect(() => { const t = setTimeout(muat, 0); return () => clearTimeout(t) }, [muat])
  useEffect(() => pasangPemulihRealtime(db, {
    nama: 'inventaris-admin-' + Math.random().toString(36).slice(2), label: 'Inventaris admin', jedaMs: 800, muat,
    tabel: ['inv_barang', 'inv_jadwal', 'inv_jadwal_selesai', 'inv_laporan', 'inv_laporan_update', 'inv_media', 'inv_lokasi'],
  }), [muat])
  useEffect(() => {
    if (!pop) return
    const tutup = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.iv-pop,.iv-fbtn')) setPop(null) }
    document.addEventListener('mousedown', tutup)
    return () => document.removeEventListener('mousedown', tutup)
  }, [pop])

  const d = data
  const idx = useMemo(() => {
    if (!d) return null
    const barang = new Map(d.barang.map(b => [b.id, b]))
    const lokasi = new Map(d.lokasi.map(l => [l.kode, l]))
    const per = <T,>(arr: T[], k: (x: T) => number) => { const m = new Map<number, T[]>(); for (const x of arr) m.set(k(x), [...(m.get(k(x)) || []), x]); return m }
    const media = new Map<string, Media[]>(); for (const m of d.media) { const k = m.tujuan + ':' + m.ref_id; media.set(k, [...(media.get(k) || []), m]) }
    const selesaiPerJadwal = per(d.selesai, s => s.jadwal_id)
    for (const v of selesaiPerJadwal.values()) v.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.id - a.id)
    return { barang, lokasi, media, jadwalPerBarang: per(d.jadwal, j => j.barang_id), laporanPerBarang: per(d.laporan, l => l.barang_id),
      updatePerLaporan: per(d.update, u => u.laporan_id), selesaiPerJadwal }
  }, [d])
  const namaLokasi = useCallback((k: string) => idx?.lokasi.get(k)?.nama || k, [idx])
  const mediaDari = (tujuan: string, ref: number, peran?: string) => (idx?.media.get(tujuan + ':' + ref) || []).filter(m => !peran || m.peran === peran)

  // kartu ringkasan (jadwal aktif & laporan aktif saja)
  const cnt = useMemo(() => {
    const aktif = (id: number) => idx?.barang.get(id)?.aktif !== false
    return {
      terlambat: d?.jadwal.filter(j => j.aktif && aktif(j.barang_id) && j.status_jadwal === 'terlambat').length || 0,
      segera: d?.jadwal.filter(j => j.aktif && aktif(j.barang_id) && j.status_jadwal === 'segera').length || 0,
      rusak: d?.laporan.filter(l => laporanAktif(l) && aktif(l.barang_id)).length || 0,
    }
  }, [d, idx])

  // ── baris per tab: {id, lokasi, kunciFilter, teksCari, data} ──
  const baris = useMemo(() => {
    if (!d || !idx) return { inventaris: [], laporan: [], maintenance: [], riwayat: [] } as Record<Tab, any[]>
    const b = (id: number) => idx.barang.get(id)!
    const teksBarang = (x: Barang) => [x.nama, x.nomor_inventaris, x.kode_lama, x.pengguna, x.detail_kondisi, x.merk_spesifikasi, x.nomor_seri, x.pelapor, namaLokasi(x.lokasi_kode)].join(' ')
    // barang nonaktif (dan laporan/jadwal/riwayatnya) disembunyikan kecuali "termasuk nonaktif" dicentang (keputusan user 30 Okt)
    const tampilB = (id: number) => nonaktif || b(id).aktif
    const inventaris = d.barang.filter(x => tampilB(x.id)).map(x => ({ id: 'b' + x.id, lok: x.lokasi_kode, kunci: x.kondisi, cari: teksBarang(x), x }))
    const laporan = d.laporan.filter(l => tampilB(l.barang_id)).sort((p, r) => r.dibuat_pada.localeCompare(p.dibuat_pada)).map(l => ({ id: 'l' + l.id, lok: b(l.barang_id).lokasi_kode,
      kunci: laporanAktif(l) ? 'aktif' : 'closed', cari: [l.judul, l.masalah, l.pelapor, l.teknisi, teksBarang(b(l.barang_id))].join(' '), x: l }))
    const maintenance = d.jadwal.filter(j => tampilB(j.barang_id)).sort((p, r) => (p.jatuh_tempo || '9').localeCompare(r.jatuh_tempo || '9')).map(j => ({ id: 'j' + j.id, lok: b(j.barang_id).lokasi_kode,
      kunci: j.aktif ? j.status_jadwal : 'nonaktif', cari: [j.jenis, j.teknisi, teksBarang(b(j.barang_id))].join(' '), x: j }))
    const riwayat = [
      ...d.selesai.filter(s => tampilB(s.barang_id)).map(s => ({ id: 's' + s.id, lok: b(s.barang_id).lokasi_kode, kunci: 'rutin', tgl: s.tanggal, cari: [s.oleh, d.jadwal.find(j => j.id === s.jadwal_id)?.jenis, teksBarang(b(s.barang_id))].join(' '), x: s })),
      ...d.laporan.filter(l => tampilB(l.barang_id)).map(l => ({ id: 'k' + l.id, lok: b(l.barang_id).lokasi_kode, kunci: 'kerusakan', tgl: l.dibuat_pada.slice(0, 10), cari: [l.judul, l.pelapor, teksBarang(b(l.barang_id))].join(' '), x: l })),
    ].sort((p, r) => r.tgl.localeCompare(p.tgl))
    return { inventaris, laporan, maintenance, riwayat } as Record<Tab, any[]>
  }, [d, idx, nonaktif, namaLokasi])

  const saring = (t: Tab, abaikanLokasi = false) => baris[t].filter(r =>
    (abaikanLokasi || !fLok.length || fLok.includes(r.lok))
    && (fKon === 'semua' ? (t !== 'maintenance' || r.kunci !== 'nonaktif') : r.kunci === fKon)
    && (!q || r.cari.toLowerCase().includes(q.toLowerCase())))
  // angka di judul sub-tab: tab aktif = hasil filter; tab lain = bawaan (jadwal nonaktif tidak dihitung)
  const tampil = (t: Tab) => (t === tab ? saring(t) : baris[t].filter(r => t !== 'maintenance' || r.kunci !== 'nonaktif'))
  const semuaBaris = saring(tab)
  const daftar = semuaBaris.slice(0, batas)

  const gantiTab = (t: Tab, kon = 'semua', cari = '') => { setBatas(BARIS_PER_HALAMAN); setTab(t); setFKon(kon); setQ(cari); setBuka(null); setPop(null) }
  const reset = () => { setFLok([]); setFKon('semua'); setQ(''); setBuka(null) }

  // ── aksi ──
  const jalankan = async (label: string, fn: () => Promise<any>) => {
    setSibuk(label)
    try { await fn(); await muat(); return true }
    catch (e: any) { alert(pesanGalat(e)); if (e?.code === 'VTVER') await muat(); return false }
    finally { setSibuk(null) }
  }
  const gantiLokasi = (x: Barang, kode: string) => {
    const l = idx?.lokasi.get(kode)
    if (!x.nomor_inventaris && l?.boleh_nomor && !confirm(`${x.nama} akan mendapat nomor inventaris baru di lokasi ${l.nama}. Nomor tidak bisa diubah lagi walau barang pindah. Lanjut?`)) return
    jalankan('lok' + x.id, () => ubahBarang(db, user, x, { lokasi_kode: kode }))
  }
  const gantiKondisi = (x: Barang, k: string) => jalankan('kon' + x.id, () => setKondisi(db, user, x, k))

  if (galatMuat && !d) return <div className="invm"><style>{CSS}</style><div className="iv-err">{galatMuat} <button className="iv-btn" onClick={muat}>Coba lagi</button></div></div>
  if (!d || !idx) return <div className="invm"><style>{CSS}</style><div className="iv-empty">Memuat inventaris…</div></div>

  const lokasiAktif = d.lokasi.filter(l => l.aktif)
  const opsiLokasi = (x: Barang) => [...lokasiAktif, ...(lokasiAktif.some(l => l.kode === x.lokasi_kode) ? [] : [idx.lokasi.get(x.lokasi_kode)!].filter(Boolean))]
  const kodeSel = (barangId: number) => { const x = idx.barang.get(barangId); return <div className="iv-kode">{x?.nomor_inventaris || '—'}{x?.kode_lama && <small>{x.kode_lama}</small>}</div> }
  const hitungLokasi = (() => { const m = new Map<string, number>(); for (const r of saring(tab, true)) m.set(r.lok, (m.get(r.lok) || 0) + 1); return m })()
  const thLokasi = <th key="lok">Lokasi<button type="button" className={'iv-fbtn' + (fLok.length ? ' on' : '')} aria-label="Filter lokasi"
    onClick={e => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setPop(pop ? null : { x: Math.min(r.left, window.innerWidth - 240), y: r.bottom + 4 }) }}>{fLok.length ? fLok.length + ' ' : ''}▾</button></th>

  const ctx: Ctx = { idx, user, sibuk, jalankan, mediaDari, gantiTab, setModal, setBuka }

  return (
    <div className="invm">
      <style>{CSS}</style>
      <div className="iv-top"><h1>Inventaris & Maintenance</h1>
        <button className="iv-btn pri" type="button" onClick={() => setModal({ jenis: 'tambah' })}>+ Tambah inventaris</button></div>
      {galatMuat && <div className="iv-err">{galatMuat}</div>}
      <div className="iv-sum">
        <button type="button" aria-pressed={tab === 'maintenance' && fKon === 'terlambat'} onClick={() => tab === 'maintenance' && fKon === 'terlambat' ? setFKon('semua') : gantiTab('maintenance', 'terlambat')}><b style={{ color: '#b91c1c' }}>{cnt.terlambat}</b><span>jadwal terlambat</span></button>
        <button type="button" aria-pressed={tab === 'maintenance' && fKon === 'segera'} onClick={() => tab === 'maintenance' && fKon === 'segera' ? setFKon('semua') : gantiTab('maintenance', 'segera')}><b style={{ color: '#a15c07' }}>{cnt.segera}</b><span>jatuh tempo ≤ 2 hari</span></button>
        <button type="button" aria-pressed={tab === 'laporan' && fKon === 'aktif'} onClick={() => tab === 'laporan' && fKon === 'aktif' ? setFKon('semua') : gantiTab('laporan', 'aktif')}><b style={{ color: '#6d28d9' }}>{cnt.rusak}</b><span>kerusakan aktif</span></button>
      </div>
      <div className="iv-tabs" role="tablist">{TABS.map(([t, l]) => <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => gantiTab(t)}>{l}<i>{tampil(t).length}</i></button>)}</div>
      <div className="iv-bar">
        <select value={fKon} onChange={e => { setFKon(e.target.value); setBuka(null) }} aria-label="Filter">{OPSI_FILTER[tab].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nomor, nama, PIC…" />
        {<label className="iv-mute" style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={nonaktif} onChange={e => setNonaktif(e.target.checked)} />termasuk nonaktif</label>}
        <button className="iv-btn" type="button" onClick={reset}>Reset</button>
        <span className="iv-cnt">{semuaBaris.length} baris{sibuk ? ' · menyimpan…' : ''}</span>
      </div>
      {pop && <div className="iv-pop" style={{ left: pop.x, top: pop.y }} role="group" aria-label="Filter lokasi">
        <div className="iv-acts" style={{ marginTop: 0, padding: '2px 4px 8px', borderBottom: '1px solid var(--iv-line)' }}>
          <button className="iv-btn" type="button" onClick={() => setFLok([...hitungLokasi.keys()])}>Pilih semua</button>
          <button className="iv-btn" type="button" onClick={() => setFLok([])}>Hapus pilihan</button></div>
        {d.lokasi.filter(l => hitungLokasi.has(l.kode) || fLok.includes(l.kode)).map(l => <label key={l.kode}>
          <input type="checkbox" checked={fLok.includes(l.kode)} onChange={e => { setFLok(e.target.checked ? [...fLok, l.kode] : fLok.filter(k => k !== l.kode)); setBuka(null) }} />
          {l.nama}<span className="n">{hitungLokasi.get(l.kode) || 0}</span></label>)}
      </div>}

      {!daftar.length ? <div className="iv-tw"><div className="iv-empty">Tidak ada data untuk filter ini. <button className="iv-btn" type="button" onClick={reset}>Reset filter</button></div></div> : (
        <div className="iv-tw">
          {tab === 'inventaris' && <table className="iv-inv"><thead><tr>
            <th>Nama barang</th><th>Nomor inventaris</th><th>Tanggal terakhir update</th><th>Pelapor</th>{thLokasi}<th>Pengguna / penanggung jawab</th>
            <th>Kondisi barang</th><th>Detail kondisi</th><th>Merk / spesifikasi</th><th>Nomor seri</th><th>Tanggal perolehan</th></tr></thead>
            <tbody>{daftar.map(r => { const x: Barang = r.x; const ik = infoKondisi(x.kondisi)
              const aktifLap = (idx.laporanPerBarang.get(x.id) || []).filter(laporanAktif)
              return <Fragment key={r.id}>
                <tr className="klik" onClick={e => { if (!(e.target as HTMLElement).closest('select,button,a,input')) setBuka(buka === r.id ? null : r.id) }} style={x.aktif ? undefined : { opacity: .55 }}>
                  <td>{x.nama}{!x.aktif && <span className="iv-mute"> (nonaktif)</span>}</td>
                  <td>{kodeSel(x.id)}</td><td>{fmtTanggal(x.diperbarui_pada)}</td><td>{x.pelapor || ''}</td>
                  <td><select className="iv-cs" style={{ background: 'var(--iv-head)', color: 'var(--iv-fg)' }} value={x.lokasi_kode} disabled={!!sibuk} aria-label="Lokasi"
                    onChange={e => gantiLokasi(x, e.target.value)}>{opsiLokasi(x).map(l => <option key={l.kode} value={l.kode}>{l.nama}</option>)}</select></td>
                  <td>{x.pengguna || ''}</td>
                  <td><select className="iv-cs" style={{ background: ik.latar, color: ik.warna }} value={x.kondisi} disabled={!!sibuk || aktifLap.length > 0}
                    title={aktifLap.length ? 'Ada laporan kerusakan aktif - tutup laporan dulu' : undefined} aria-label="Kondisi"
                    onChange={e => gantiKondisi(x, e.target.value)}>{KONDISI.map(k => <option key={k.kode} value={k.kode}>{k.label}</option>)}</select></td>
                  <td className="iv-wrap">{x.detail_kondisi || ''}</td><td className="iv-wrap">{x.merk_spesifikasi || ''}</td><td>{x.nomor_seri || ''}</td>
                  <td>{x.tanggal_perolehan ? fmtTanggal(x.tanggal_perolehan) : (x.tanggal_perolehan_teks || '')}</td>
                </tr>
                {buka === r.id && <tr className="iv-exp"><td colSpan={11}><DetailBarang x={x} c={ctx} /></td></tr>}
              </Fragment>
            })}</tbody></table>}

          {tab === 'laporan' && <table><thead><tr><th>Tanggal</th><th>Kode</th><th>Barang</th>{thLokasi}<th>Masalah</th><th>Pelapor</th><th>Status</th><th>Update</th></tr></thead>
            <tbody>{daftar.map(r => { const l: Laporan = r.x; const x = idx.barang.get(l.barang_id)!
              return <Fragment key={r.id}>
                <tr className="klik" onClick={() => setBuka(buka === r.id ? null : r.id)}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtTanggal(l.dibuat_pada)}</td><td>{kodeSel(l.barang_id)}</td><td>{x.nama}</td><td>{namaLokasi(x.lokasi_kode)}</td>
                  <td>{l.judul}</td><td>{l.pelapor}</td><td>{badgeLaporan(l.status)}</td><td>{(idx.updatePerLaporan.get(l.id) || []).length}</td>
                </tr>
                {buka === r.id && <tr className="iv-exp"><td colSpan={8}><DetailLaporan l={l} c={ctx} /></td></tr>}
              </Fragment>
            })}</tbody></table>}

          {tab === 'maintenance' && <table><thead><tr><th>Kode</th><th>Barang</th>{thLokasi}<th>Tugas</th><th>Frekuensi</th><th>PIC</th><th>Terakhir selesai</th><th>Jatuh tempo</th><th>Status</th></tr></thead>
            <tbody>{daftar.map(r => { const j: Jadwal = r.x; const x = idx.barang.get(j.barang_id)!; const akhir = idx.selesaiPerJadwal.get(j.id)?.[0]
              return <Fragment key={r.id}>
                <tr className="klik" onClick={() => setBuka(buka === r.id ? null : r.id)}>
                  <td>{kodeSel(j.barang_id)}</td><td>{x.nama}</td><td>{namaLokasi(x.lokasi_kode)}</td><td>{j.jenis}</td><td>{labelFrekuensi(j.frekuensi)}</td><td>{j.teknisi || ''}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{j.terakhir_dilakukan ? fmtTanggal(j.terakhir_dilakukan) : '—'}{akhir && <span className="iv-mute"> {akhir.oleh}</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtTanggal(j.jatuh_tempo)}{j.jatuh_tempo && <span className="iv-mute"> ({teksSisaHari(j.jatuh_tempo)})</span>}</td>
                  <td>{j.selesai_hari_ini ? badge('#15803d', '#dcf5e5', 'Selesai hari ini') : badgeJadwal(j)}</td>
                </tr>
                {buka === r.id && <tr className="iv-exp"><td colSpan={9}><DetailJadwal j={j} c={ctx} /></td></tr>}
              </Fragment>
            })}</tbody></table>}

          {tab === 'riwayat' && <table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Kode</th><th>Barang</th>{thLokasi}<th>Keterangan</th><th>Oleh</th><th>Foto/video</th></tr></thead>
            <tbody>{daftar.map(r => { const x = idx.barang.get(r.x.barang_id)!
              if (r.kunci === 'rutin') { const s = r.x; const m = mediaDari('jadwal_selesai', s.id)
                return <tr key={r.id}><td style={{ whiteSpace: 'nowrap' }}>{fmtTanggal(s.tanggal)}</td><td>{badge('#64748b', '#eef1f5', 'Rutin')}</td><td>{kodeSel(s.barang_id)}</td><td>{x.nama}</td><td>{namaLokasi(x.lokasi_kode)}</td>
                  <td>{d.jadwal.find(j => j.id === s.jadwal_id)?.jenis}{s.catatan && <span className="iv-mute"> · {s.catatan}</span>}</td>
                  <td>{s.oleh}{s.sumber === 'qr_lama' && <span className="iv-mute"> (QR)</span>}</td>
                  <td>{m.length ? <Thumbs media={m} /> : <span className="iv-mute">{s.tanpa_dokumentasi ? 'tanpa dokumentasi' : '—'}</span>}</td></tr> }
              const l: Laporan = r.x; const seb = mediaDari('laporan', l.id, 'sebelum').length + mediaDari('laporan', l.id, 'lama').length, ses = mediaDari('laporan', l.id, 'sesudah').length
              return <tr key={r.id}><td style={{ whiteSpace: 'nowrap' }}>{fmtTanggal(l.dibuat_pada)}</td><td>{badge('#6d28d9', '#ece3ff', 'Kerusakan')}</td><td>{kodeSel(l.barang_id)}</td><td>{x.nama}</td><td>{namaLokasi(x.lokasi_kode)}</td>
                <td>{l.judul} <span className="iv-mute">{STATUS_LAPORAN[l.status].label}</span></td><td>{l.pelapor}</td>
                <td>{seb || ses ? <span>{seb ? 'sebelum ' + seb : ''}{seb && ses ? ' · ' : ''}{ses ? <b>sesudah {ses}</b> : ''}</span> : <span className="iv-mute">—</span>}</td></tr>
            })}</tbody></table>}
          {semuaBaris.length > batas && <div className="iv-empty" style={{ padding: 12 }}>Menampilkan {batas} dari {semuaBaris.length} baris. <button className="iv-btn" type="button" onClick={() => setBatas(batas + BARIS_PER_HALAMAN)}>Tampilkan lebih banyak</button></div>}
        </div>)}

      {modal?.jenis === 'tambah' && <ModalTambah lokasi={lokasiAktif} semuaLokasi={d.lokasi} barang={d.barang} user={user} onClose={() => setModal(null)} onSelesai={muat} />}
      {modal?.jenis === 'edit' && <ModalEditBarang x={modal.x} user={user} onClose={() => setModal(null)} onSelesai={muat} />}
      {modal?.jenis === 'jadwal' && <ModalJadwal barang={idx.barang.get(modal.barangId)!} j={modal.j} user={user} onClose={() => setModal(null)} onSelesai={muat} />}
      {modal?.jenis === 'log' && <ModalLog x={modal.x} namaLokasi={namaLokasi} onClose={() => setModal(null)} />}
    </div>
  )

}

// Konteks untuk detail baris - komponen di tingkat atas (bukan di dalam induk) supaya isian form tidak hilang
// tiap induk render ulang (muat ulang realtime / polling 30 detik).
type Ctx = { idx: any; user: any; sibuk: string | null; jalankan: (label: string, fn: () => Promise<any>) => Promise<boolean>
  mediaDari: (tujuan: string, ref: number, peran?: string) => Media[]; gantiTab: (t: Tab, kon?: string, cari?: string) => void
  setModal: (m: any) => void; setBuka: (b: string | null) => void }

function DetailBarang({ x, c }: { x: Barang; c: Ctx }) {
  const jd = c.idx.jadwalPerBarang.get(x.id) || [], lp = c.idx.laporanPerBarang.get(x.id) || [], ds = c.mediaDari('barang', x.id, 'datasheet')
  const fileRef = useRef<HTMLInputElement>(null)
  const unggahDatasheet = async (f: File | undefined) => {
    if (!f) return
    if (f.type !== 'application/pdf') { alert('Datasheet harus file PDF'); return }
    if (f.size > BATAS_DATASHEET_MB * 1048576) { alert(`PDF ${(f.size / 1048576).toFixed(1)} MB - maksimal ${BATAS_DATASHEET_MB} MB`); return }
    await c.jalankan('ds' + x.id, async () => { const m = await unggahMediaInventaris([f], `inventaris/${x.id}/datasheet`); await tambahMedia(db, c.user, 'barang', x.id, 'datasheet', m) })
  }
  return <div className="iv-exp">
    <dl className="iv-g">
      <div><dt>Datasheet PDF</dt><dd>{ds.length ? ds.map(m => <div key={m.id}><a href={m.url} target="_blank" rel="noreferrer">PDF · {fmtTanggal(m.dibuat_pada)}</a>{' '}
        <button className="iv-btn" style={{ padding: '0 6px' }} type="button" title="Hapus datasheet" onClick={() => confirm('Hapus datasheet ini?') && c.jalankan('hd', () => hapusMedia(db, c.user, m.id))}>✕</button></div>) : 'belum ada'}</dd></div>
      <div><dt>Jadwal rutin</dt><dd>{jd.filter(j => j.aktif).length} tugas aktif</dd></div>
      <div><dt>Laporan kerusakan</dt><dd>{lp.length} laporan ({lp.filter(laporanAktif).length} aktif)</dd></div>
      <div><dt>Kode lama</dt><dd>{x.kode_lama || '—'}</dd></div>
      <div><dt>Dibuat</dt><dd>{x.dibuat_oleh || '—'} · {fmtTanggal(x.dibuat_pada)}</dd></div>
    </dl>
    <div className="iv-acts">
      <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={e => { unggahDatasheet(e.target.files?.[0]); e.target.value = '' }} />
      <button className="iv-btn pri" type="button" disabled={!!c.sibuk} onClick={() => fileRef.current?.click()}>{c.sibuk === 'ds' + x.id ? 'Mengunggah…' : 'Unggah datasheet PDF'}</button>
      <button className="iv-btn" type="button" onClick={() => c.gantiTab('maintenance', 'semua', x.nomor_inventaris || x.nama)}>Lihat jadwal</button>
      <button className="iv-btn" type="button" onClick={() => c.gantiTab('laporan', 'semua', x.nomor_inventaris || x.nama)}>Lihat laporan</button>
      <button className="iv-btn" type="button" onClick={() => c.setModal({ jenis: 'jadwal', barangId: x.id })}>+ Jadwal rutin</button>
      <button className="iv-btn" type="button" onClick={() => c.setModal({ jenis: 'edit', x })}>Edit</button>
      <button className="iv-btn" type="button" onClick={() => c.setModal({ jenis: 'log', x })}>Riwayat perubahan</button>
    </div>
  </div>
}

function DetailLaporan({ l, c }: { l: Laporan; c: Ctx }) {
  const [status, setStatus] = useState(l.status)
  const [catatan, setCatatan] = useState('')
  const [perbaikan, setPerbaikan] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [hint, setHint] = useState('')
  const sesudah = c.mediaDari('laporan', l.id, 'sesudah')
  const upd = c.idx.updatePerLaporan.get(l.id) || []
  const simpan = async () => {
    if (status === 'closed' && l.status !== 'closed' && !sesudah.length && !files.length) { setHint('Tambahkan foto atau video setelah perbaikan dulu.'); return }
    if (status === l.status && !catatan.trim() && !perbaikan.trim() && !files.length) { setHint('Tidak ada perubahan.'); return }
    const ok = await c.jalankan('lap' + l.id, async () => {
      const m = files.length ? await unggahMediaInventaris(files, `inventaris/${l.barang_id}/laporan/${l.id}/sesudah`) : []
      await ubahStatusLaporan(db, c.user, { laporanId: l.id, status, catatan, perbaikan, mediaSesudah: m })
    })
    if (ok) c.setBuka(null)
  }
  return <div className="iv-exp">
    <dl className="iv-g">
      <div><dt>Masalah</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{l.masalah || l.judul}</dd></div>
      <div><dt>Dilaporkan</dt><dd>{l.pelapor} · {fmtWaktu(l.dibuat_pada)}</dd></div>
      {(l.teknisi || l.perbaikan) && <div><dt>PIC / perbaikan</dt><dd>{l.teknisi || '—'}{l.perbaikan ? ' · ' + l.perbaikan : ''}</dd></div>}
      {l.catatan_lama && <div><dt>Catatan lama</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{l.catatan_lama}</dd></div>}
      {l.ditutup_pada && <div><dt>Ditutup</dt><dd>{l.ditutup_oleh} · {fmtWaktu(l.ditutup_pada)}</dd></div>}
    </dl>
    <div className="iv-sec">Dokumentasi sebelum</div><Thumbs media={[...c.mediaDari('laporan', l.id, 'sebelum'), ...c.mediaDari('laporan', l.id, 'lama')]} />
    <div className="iv-sec">Dokumentasi sesudah perbaikan</div><Thumbs media={sesudah} />
    {upd.length > 0 && <><div className="iv-sec">Update</div>{upd.map(u => <div key={u.id} className="iv-upd">
      <b>{u.oleh}</b> <span className="iv-mute">{fmtWaktu(u.waktu)}</span>{u.status_ke && <span className="iv-mute"> · {STATUS_LAPORAN[u.status_dari as Laporan['status']]?.label || u.status_dari} → {STATUS_LAPORAN[u.status_ke as Laporan['status']]?.label || u.status_ke}</span>}
      {u.catatan && <div style={{ whiteSpace: 'pre-wrap' }}>{u.catatan}</div>}{c.mediaDari('laporan_update', u.id).length > 0 && <Thumbs media={c.mediaDari('laporan_update', u.id)} />}</div>)}</>}
    <div className="iv-sec">Ubah status laporan</div>
    <div className="iv-acts" style={{ marginTop: 0 }}>
      <select value={status} onChange={e => { setStatus(e.target.value as Laporan['status']); setHint('') }} aria-label="Status laporan">
        {Object.entries(STATUS_LAPORAN).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
      <input type="text" value={perbaikan} onChange={e => setPerbaikan(e.target.value)} placeholder="Perbaikan yang dilakukan (opsional)" style={{ flex: 1, minWidth: 200 }} />
    </div>
    <textarea rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Tambah update (opsional): apa yang sudah dikerjakan?" style={{ marginTop: 8 }} />
    <div className="iv-mute" style={{ marginTop: 8 }}>Dokumentasi setelah diperbaiki (wajib untuk menutup laporan)</div>
    <div className="iv-acts" style={{ marginTop: 4 }}><FilePilihan files={files} setFiles={f => { setFiles(f); setHint('') }} /></div>
    {hint && <div className="iv-hint">{hint}</div>}
    <div className="iv-acts"><button className="iv-btn pri" type="button" disabled={!!c.sibuk} onClick={simpan}>{c.sibuk === 'lap' + l.id ? 'Menyimpan…' : 'Simpan'}</button></div>
  </div>
}

function DetailJadwal({ j, c }: { j: Jadwal; c: Ctx }) {
  const [files, setFiles] = useState<File[]>([])
  const [catatan, setCatatan] = useState('')
  const riw = (c.idx.selesaiPerJadwal.get(j.id) || []).slice(0, 8)
  const selesai = async () => {
    if (!files.length && !confirm('Tandai selesai tanpa foto/video? Akan dicatat "tanpa dokumentasi".')) return
    const ok = await c.jalankan('sel' + j.id, async () => {
      const m = files.length ? await unggahMediaInventaris(files, `inventaris/${j.barang_id}/jadwal/${j.id}`) : []
      await selesaiJadwal(db, c.user, j.id, catatan, m)
    })
    if (ok) { setFiles([]); setCatatan('') }
  }
  return <div className="iv-exp">
    <div className="iv-mute">{j.terakhir_dilakukan ? `Terakhir selesai ${fmtTanggal(j.terakhir_dilakukan)}${riw[0] ? ' oleh ' + riw[0].oleh : ''}. ` : 'Belum pernah selesai. '}
      Jatuh tempo {fmtTanggal(j.jatuh_tempo) || '—'}.{j.catatan ? ' Catatan: ' + j.catatan : ''}</div>
    {j.aktif && <>
      <input type="text" value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan (opsional)" style={{ width: '100%', marginTop: 8 }} />
      <div className="iv-acts"><FilePilihan files={files} setFiles={setFiles} />
        <button className="iv-btn ok" type="button" disabled={!!c.sibuk} onClick={selesai}>{c.sibuk === 'sel' + j.id ? 'Menyimpan…' : 'Tandai selesai hari ini'}</button></div>
      <div className="iv-mute" style={{ marginTop: 6 }}>Dari admin, penyelesaian tanpa foto atau video dicatat sebagai tanpa dokumentasi.</div></>}
    <div className="iv-acts">
      <button className="iv-btn" type="button" onClick={() => c.setModal({ jenis: 'jadwal', barangId: j.barang_id, j })}>Edit jadwal</button>
      <button className="iv-btn" type="button" disabled={!!c.sibuk} onClick={() => (j.aktif ? confirm('Nonaktifkan jadwal ini? Riwayatnya tetap tersimpan.') : true) && c.jalankan('akt' + j.id, () => simpanJadwal(db, c.user, j.id, { aktif: !j.aktif }))}>{j.aktif ? 'Nonaktifkan' : 'Aktifkan lagi'}</button>
    </div>
    {riw.length > 0 && <><div className="iv-sec">Riwayat selesai</div>{riw.map(s => <div key={s.id} className="iv-upd">
      <b>{fmtTanggal(s.tanggal)}</b> · {s.oleh}{s.sumber === 'qr_lama' ? ' (QR)' : ''}{s.tanpa_dokumentasi ? <span className="iv-mute"> · tanpa dokumentasi</span> : ''}{s.catatan ? ' · ' + s.catatan : ''}
      {c.mediaDari('jadwal_selesai', s.id).length > 0 && <Thumbs media={c.mediaDari('jadwal_selesai', s.id)} />}</div>)}</>}
  </div>
}

// ── modal ────────────────────────────────────────────────────────────────────────────────────
const fld = (label: string, isi: any, ket?: string) => <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><Lbl>{label}</Lbl>{isi}{ket && <div style={{ fontSize: 11.5, color: '#64748b' }}>{ket}</div>}</div>
const dua = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }

function ModalTambah({ lokasi, semuaLokasi, barang, user, onClose, onSelesai }: any) {
  const [mode, setMode] = useState<'satu' | 'impor'>('satu')
  const [f, setF] = useState<any>({ nama: '', lokasi_kode: 'BELUM', kondisi: 'belum_dinilai', pengguna: '', detail_kondisi: '', merk_spesifikasi: '', nomor_seri: '', tanggal_perolehan: '', jenis: '', frekuensi: 'mingguan', jatuh_tempo: '', teknisi: '' })
  const [ds, setDs] = useState<File | null>(null)
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const simpan = async () => {
    if (!f.nama.trim()) { setGalat('Nama barang wajib diisi.'); return }
    if (ds && (ds.type !== 'application/pdf' || ds.size > BATAS_DATASHEET_MB * 1048576)) { setGalat(`Datasheet harus PDF maksimal ${BATAS_DATASHEET_MB} MB.`); return }
    setSibuk(true); setGalat('')
    try {
      const data: any = { nama: f.nama.trim(), lokasi_kode: f.lokasi_kode, kondisi: f.kondisi, pengguna: f.pengguna, detail_kondisi: f.detail_kondisi,
        merk_spesifikasi: f.merk_spesifikasi, nomor_seri: f.nomor_seri, tanggal_perolehan: f.tanggal_perolehan }
      if (f.jenis.trim()) data.jadwal = { jenis: f.jenis.trim(), frekuensi: f.frekuensi, jatuh_tempo: f.jatuh_tempo || null, teknisi: f.teknisi }
      const b = await tambahBarang(db, user, data)
      if (ds) {
        try { const m = await unggahMediaInventaris([ds], `inventaris/${b.id}/datasheet`); await tambahMedia(db, user, 'barang', b.id, 'datasheet', m) }
        catch (e: any) { alert(`${b.nama} tersimpan (${b.nomor_inventaris || 'tanpa nomor'}), tetapi datasheet gagal diunggah: ${pesanGalat(e)}\nUnggah lagi dari detail barang.`) }
      }
      await onSelesai(); onClose()
    } catch (e: any) { setGalat(pesanGalat(e)) } finally { setSibuk(false) }
  }
  return <Modal title="Tambah inventaris" onClose={onClose} width={620}>
    <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
      <Btn outline={mode !== 'satu'} onClick={() => setMode('satu')}>Satu barang</Btn><Btn outline={mode !== 'impor'} onClick={() => setMode('impor')}>Impor dari Excel</Btn></div>
    {mode === 'impor' ? <PanelImpor semuaLokasi={semuaLokasi} barang={barang} user={user} onSelesai={onSelesai} onClose={onClose} /> :
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {fld('Nama barang *', <Inp value={f.nama} onChange={set('nama')} placeholder="Contoh: Mesin Bor Sedang 3" />)}
        {fld('Nomor inventaris', <Inp value="Dibuat otomatis" disabled />, 'VIT-kode lokasi-nomor urut. Dibuat sekali dan tidak berubah walau barang pindah lokasi. Lokasi "Belum ditentukan" = nomor menyusul.')}
        <div style={dua}>{fld('Lokasi', <Sel value={f.lokasi_kode} onChange={set('lokasi_kode')}>{lokasi.map((l: any) => <option key={l.kode} value={l.kode}>{l.nama}</option>)}</Sel>)}
          {fld('Kondisi', <Sel value={f.kondisi} onChange={set('kondisi')}>{KONDISI.map(k => <option key={k.kode} value={k.kode}>{k.label}</option>)}</Sel>)}</div>
        {fld('Pengguna / penanggung jawab', <Inp value={f.pengguna} onChange={set('pengguna')} placeholder="Contoh: Edi Marwoto, Siswoyo" />)}
        {fld('Detail kondisi', <Inp value={f.detail_kondisi} onChange={set('detail_kondisi')} placeholder="Opsional" />)}
        <div style={dua}>{fld('Merk / spesifikasi', <Inp value={f.merk_spesifikasi} onChange={set('merk_spesifikasi')} />)}{fld('Nomor seri', <Inp value={f.nomor_seri} onChange={set('nomor_seri')} />)}</div>
        <div style={dua}>{fld('Tanggal perolehan', <Inp type="date" value={f.tanggal_perolehan} onChange={set('tanggal_perolehan')} />)}
          {fld('Datasheet PDF', <input type="file" accept="application/pdf" onChange={e => setDs(e.target.files?.[0] || null)} />)}</div>
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Maintenance rutin (opsional)</div>
          {fld('Nama tugas', <Inp value={f.jenis} onChange={set('jenis')} placeholder="Contoh: Pelumasan rantai" />)}
          <div style={dua}>{fld('Frekuensi', <Sel value={f.frekuensi} onChange={set('frekuensi')}>{FREKUENSI.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Sel>)}
            {fld('Jatuh tempo pertama', <Inp type="date" value={f.jatuh_tempo} onChange={set('jatuh_tempo')} />, 'Kosong = 7 hari dari hari ini.')}</div>
          {fld('PIC', <Inp value={f.teknisi} onChange={set('teknisi')} placeholder="Contoh: Tim Painting" />)}
        </div>
        {galat && <div style={{ color: '#b91c1c', fontSize: 13 }}>{galat}</div>}
        <div style={{ display: 'flex', gap: 8 }}><Btn onClick={simpan} disabled={sibuk}>{sibuk ? 'Menyimpan…' : 'Simpan'}</Btn><Btn outline color="#64748b" onClick={onClose}>Batal</Btn></div>
      </div>}
  </Modal>
}

function PanelImpor({ semuaLokasi, barang, user, onSelesai, onClose }: any) {
  const [file, setFile] = useState<string>('')
  const [baca, setBaca] = useState<{ baris: BarisImpor[]; galat: string[]; catatan: string[]; sudahAda: Set<string> } | null>(null)
  const [ikutSudahAda, setIkutSudahAda] = useState(false)
  const [uji, setUji] = useState<any>(null)
  const [pesan, setPesan] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const pilih = async (fl: File | undefined) => {
    setBaca(null); setUji(null); setPesan('')
    if (!fl) return
    setFile(fl.name)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await fl.arrayBuffer(), { type: 'array', cellDates: false })
      const nama = wb.SheetNames.find(n => rapikanTeks(n).toUpperCase() === 'DATABASE INVENTARIS') || wb.SheetNames[0]
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[nama], { header: 1, defval: '' }) as unknown[][]
      const h = bacaBarisInventaris(rows, semuaLokasi, 'XL:' + fl.name)
      // barang yang sudah ada (nama + lokasi sama, dihitung per jumlah supaya nama kembar tetap benar) dilewati bawaan
      const ada = new Map<string, number>()
      for (const b of barang as Barang[]) { const k = b.nama.toUpperCase() + '@' + b.lokasi_kode; ada.set(k, (ada.get(k) || 0) + 1) }
      const sudahAda = new Set<string>()
      for (const b of h.baris) { const k = b.nama.toUpperCase() + '@' + b.lokasi_kode; if ((ada.get(k) || 0) > 0) { sudahAda.add(b.kunci); ada.set(k, ada.get(k)! - 1) } }
      setBaca({ ...h, sudahAda })
    } catch (e: any) { console.error('[impor inventaris] baca file gagal:', e); setPesan('File tidak terbaca: ' + pesanGalat(e)) }
  }
  const dikirim = baca ? baca.baris.filter(b => ikutSudahAda || !baca.sudahAda.has(b.kunci)) : []
  const r = baca ? ringkasImpor(dikirim) : null
  const cek = async () => {
    setSibuk(true); setPesan('')
    try { setUji(await imporBarang(db, user, dikirim.map(barisUntukRpc), true, file)) } catch (e: any) { setPesan(pesanGalat(e)) } finally { setSibuk(false) }
  }
  const impor = async () => {
    setSibuk(true); setPesan('')
    try { const h = await imporBarang(db, user, dikirim.map(barisUntukRpc), false, file); await onSelesai(); alert(`${h.dibuat} barang diimpor${h.dilewati ? `, ${h.dilewati} dilewati (sudah pernah diimpor)` : ''}.`); onClose() }
    catch (e: any) { setPesan(pesanGalat(e)) } finally { setSibuk(false) }
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
    <div style={{ color: '#64748b' }}>Format = sheet "DATABASE INVENTARIS" Google Sheet perusahaan: Nama barang, Tanggal terakhir update, Pelapor, Lokasi, Pengguna, Kondisi, Detail kondisi, Merk/spesifikasi, Nomor seri, Tanggal perolehan. Nomor inventaris dibuat otomatis, urut sesuai baris.</div>
    <input type="file" accept=".xlsx,.xls" onChange={e => pilih(e.target.files?.[0])} />
    {baca && r && <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Hasil pemeriksaan</div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <li><b>{baca.baris.length}</b> baris terbaca{baca.sudahAda.size ? <>; <b>{baca.sudahAda.size}</b> sudah ada (nama & lokasi sama) - {ikutSudahAda ? 'ikut diimpor' : 'dilewati'}</> : null}</li>
        <li><b>{r.jumlah}</b> akan diimpor</li>
        {r.kondisiKosong.length > 0 && <li><b>{r.kondisiKosong.length}</b> tanpa kondisi, diisi "Belum dinilai"</li>}
        {r.lokasiKosong.length > 0 && <li><b>{r.lokasiKosong.length}</b> tanpa lokasi, diisi "Belum ditentukan" (nomor menyusul): {r.lokasiKosong.map(b => b.nama).join(', ')}</li>}
        {r.kembar.length > 0 && <li><b>{r.kembar.reduce((a, k) => a + k.length, 0)}</b> baris bernama kembar di lokasi sama, tetap diimpor sebagai barang terpisah</li>}
        {r.rusak.length > 0 && <li><b>{r.rusak.length}</b> berkondisi Rusak tanpa laporan: {r.rusak.map(b => b.nama).join(', ')}</li>}
        {baca.catatan.map((c, i) => <li key={i} style={{ color: '#a15c07' }}>{c}</li>)}
        {baca.galat.map((c, i) => <li key={i} style={{ color: '#b91c1c' }}>{c}</li>)}
      </ul>
      {baca.sudahAda.size > 0 && <label style={{ display: 'flex', gap: 6, marginTop: 6 }}><input type="checkbox" checked={ikutSudahAda} onChange={e => { setIkutSudahAda(e.target.checked); setUji(null) }} />Impor juga baris yang sudah ada</label>}
      {uji && <div style={{ marginTop: 8, color: '#15803d' }}>Uji coba server: {uji.dibuat} dibuat, {uji.dilewati} dilewati. Nomor: {Object.entries(uji.per_lokasi || {}).map(([k, v]: any) => v.nomor_awal ? `${v.nomor_awal}…${v.nomor_akhir}` : `${k} ${v.jumlah} tanpa nomor`).join(', ')}</div>}
      {uji?.galat && <div style={{ color: '#b91c1c' }}>{uji.galat.join('; ')}</div>}
    </div>}
    {pesan && <div style={{ color: '#b91c1c' }}>{pesan}</div>}
    <div style={{ display: 'flex', gap: 8 }}>
      {!uji ? <Btn disabled={!baca || !!baca.galat.length || !dikirim.length || sibuk} onClick={cek}>{sibuk ? 'Memeriksa…' : 'Periksa dulu'}</Btn>
        : <Btn disabled={sibuk || !!uji.galat} onClick={impor}>{sibuk ? 'Mengimpor…' : `Impor ${dikirim.length} barang`}</Btn>}
      <Btn outline color="#64748b" onClick={onClose}>Batal</Btn></div>
  </div>
}

function ModalEditBarang({ x, user, onClose, onSelesai }: { x: Barang; user: any; onClose: () => void; onSelesai: () => Promise<void> }) {
  const awal: any = { nama: x.nama, pengguna: x.pengguna || '', detail_kondisi: x.detail_kondisi || '', merk_spesifikasi: x.merk_spesifikasi || '', nomor_seri: x.nomor_seri || '', tanggal_perolehan: x.tanggal_perolehan || '', aktif: x.aktif }
  const [f, setF] = useState<any>(awal)
  const [galat, setGalat] = useState(''); const [sibuk, setSibuk] = useState(false)
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const simpan = async () => {
    const patch = Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== awal[k]))
    if (!Object.keys(patch).length) { onClose(); return }
    if (patch.aktif === false && !confirm(`Nonaktifkan ${x.nama}? Data & riwayatnya tetap tersimpan, nomor ${x.nomor_inventaris || ''} tidak dipakai ulang.`)) return
    setSibuk(true); setGalat('')
    try { await ubahBarang(db, user, x, patch); await onSelesai(); onClose() } catch (e: any) { setGalat(pesanGalat(e)) } finally { setSibuk(false) }
  }
  return <Modal title={`Edit ${x.nomor_inventaris || x.nama}`} onClose={onClose} width={560}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {fld('Nama barang', <Inp value={f.nama} onChange={set('nama')} />)}
      {fld('Pengguna / penanggung jawab', <Inp value={f.pengguna} onChange={set('pengguna')} />)}
      {fld('Detail kondisi', <Inp value={f.detail_kondisi} onChange={set('detail_kondisi')} />)}
      <div style={dua}>{fld('Merk / spesifikasi', <Inp value={f.merk_spesifikasi} onChange={set('merk_spesifikasi')} />)}{fld('Nomor seri', <Inp value={f.nomor_seri} onChange={set('nomor_seri')} />)}</div>
      {fld('Tanggal perolehan', <Inp type="date" value={f.tanggal_perolehan} onChange={set('tanggal_perolehan')} />, x.tanggal_perolehan_teks ? `Teks asli Excel: ${x.tanggal_perolehan_teks}` : undefined)}
      <label style={{ display: 'flex', gap: 6, fontSize: 13 }}><input type="checkbox" checked={f.aktif} onChange={e => setF({ ...f, aktif: e.target.checked })} />Barang aktif (hilangkan centang = nonaktifkan, tidak dihapus)</label>
      <div style={{ fontSize: 12, color: '#64748b' }}>Lokasi & kondisi diubah langsung di tabel. Nomor inventaris tidak bisa diubah.</div>
      {galat && <div style={{ color: '#b91c1c', fontSize: 13 }}>{galat}</div>}
      <div style={{ display: 'flex', gap: 8 }}><Btn onClick={simpan} disabled={sibuk}>{sibuk ? 'Menyimpan…' : 'Simpan'}</Btn><Btn outline color="#64748b" onClick={onClose}>Batal</Btn></div>
    </div>
  </Modal>
}

function ModalJadwal({ barang, j, user, onClose, onSelesai }: { barang: Barang; j?: Jadwal; user: any; onClose: () => void; onSelesai: () => Promise<void> }) {
  const [f, setF] = useState<any>({ jenis: j?.jenis || '', frekuensi: j?.frekuensi || 'mingguan', jatuh_tempo: j?.jatuh_tempo || '', teknisi: j?.teknisi || '', catatan: j?.catatan || '' })
  const [galat, setGalat] = useState(''); const [sibuk, setSibuk] = useState(false)
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const simpan = async () => {
    if (!f.jenis.trim()) { setGalat('Nama tugas wajib diisi.'); return }
    setSibuk(true); setGalat('')
    const tempo = f.jatuh_tempo || (j ? '' : new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }))
    try { await simpanJadwal(db, user, j?.id ?? null, { ...f, jatuh_tempo: tempo, ...(j ? {} : { barang_id: barang.id }) }); await onSelesai(); onClose() }
    catch (e: any) { setGalat(pesanGalat(e)) } finally { setSibuk(false) }
  }
  return <Modal title={(j ? 'Edit jadwal - ' : 'Jadwal rutin baru - ') + (barang.nomor_inventaris || barang.nama)} onClose={onClose} width={520}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, color: '#64748b' }}>{barang.nama}</div>
      {fld('Nama tugas *', <Inp value={f.jenis} onChange={set('jenis')} />)}
      <div style={dua}>{fld('Frekuensi', <Sel value={f.frekuensi} onChange={set('frekuensi')}>{FREKUENSI.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Sel>)}
        {fld('Jatuh tempo', <Inp type="date" value={f.jatuh_tempo} onChange={set('jatuh_tempo')} />, j ? undefined : 'Kosong = 7 hari dari hari ini.')}</div>
      {fld('PIC', <Inp value={f.teknisi} onChange={set('teknisi')} />)}
      {fld('Catatan', <Inp value={f.catatan} onChange={set('catatan')} />)}
      {galat && <div style={{ color: '#b91c1c', fontSize: 13 }}>{galat}</div>}
      <div style={{ display: 'flex', gap: 8 }}><Btn onClick={simpan} disabled={sibuk}>{sibuk ? 'Menyimpan…' : 'Simpan'}</Btn><Btn outline color="#64748b" onClick={onClose}>Batal</Btn></div>
    </div>
  </Modal>
}

function ModalLog({ x, namaLokasi, onClose }: { x: Barang; namaLokasi: (k: string) => string; onClose: () => void }) {
  const [log, setLog] = useState<LogBarang[] | null>(null); const [galat, setGalat] = useState('')
  useEffect(() => { muatLogBarang(db, x.id).then(setLog).catch(e => { console.error('[inventaris] log gagal:', e); setGalat(pesanGalat(e)) }) }, [x.id])
  const nilai = (g: LogBarang, v: string | null) => v == null ? '—' : g.jenis === 'kondisi' ? infoKondisi(v).label : g.jenis === 'lokasi' ? namaLokasi(v) : g.jenis === 'aktif' ? (v === 'true' ? 'aktif' : 'nonaktif') : v
  return <Modal title={`Riwayat perubahan - ${x.nomor_inventaris || x.nama}`} onClose={onClose} width={620}>
    {galat ? <div style={{ color: '#b91c1c' }}>{galat}</div> : !log ? 'Memuat…' : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
      {log.map(g => <div key={g.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
        <b style={{ textTransform: 'capitalize' }}>{g.jenis}</b>: {nilai(g, g.dari)} → <b>{nilai(g, g.ke)}</b>{g.detail ? <span style={{ color: '#64748b' }}> · {g.detail}</span> : null}
        <div style={{ fontSize: 12, color: '#64748b' }}>{fmtWaktu(g.waktu)} · {g.oleh} · {g.sumber}{g.keterangan ? ' · ' + g.keterangan : ''}</div></div>)}
      {!log.length && 'Belum ada perubahan.'}</div>}
  </Modal>
}
