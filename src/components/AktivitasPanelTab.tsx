// TAB AKTIVITAS PANEL (5 Nov 2026, permintaan Pak Indra) - di Dashboard: satu kartu per panel yang aktif pada satu hari kerja.
// Aturan isi: lib/aktivitasPanel. Data: hooks/useAktivitasPanel + woData & ccpMap dari Dashboard. Acuan tampilan: pratinjau
// "Aktivitas Panel Hari Ini". Mode gelap ikut [data-theme="dark"]; tombol ber-class "akpBtn" supaya aturan global mode gelap
// `[data-theme=dark] button:not([class*="Btn"])` tidak menimpanya.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { useAktivitasPanel } from '../hooks/useAktivitasPanel'
import { susunAktivitasHari, tanggalSebelum, type BarisAktivitas, type KartuAktivitas } from '../lib/aktivitasPanel'
import { hariKerjaWib } from '../lib/tanggalWib'
import { labelLama } from '../lib/jejakPengerjaan'
import { BUSBAR_TAHAP_LABEL } from '../lib/panelHelpers'

const CSS = `
.akp{--akp-card:var(--card-bg,#fff);--akp-fg:var(--text-primary,#141b2d);--akp-mute:#5d6679;--akp-line:var(--border-color,#e1e5ee);--akp-soft:var(--bg-secondary,#f7f8fb);
  --akp-acc:#2147d8;--akp-acc-soft:#e8edff;--akp-run:#0b66d6;--akp-run-soft:#e3efff;--akp-done:#13803f;--akp-done-soft:#e2f5e9;--akp-prog:#a85d00;--akp-prog-soft:#fff1d9;
  --akp-lagi:#5b3aa6;--akp-lagi-soft:#efe7ff;--akp-bar:#e6e9f1;color:var(--akp-fg);text-align:left;font-size:14px;line-height:1.45;padding:16px;display:flex;flex-direction:column;gap:14px}
[data-theme="dark"] .akp{--akp-mute:#9aa5bf;--akp-acc:#7f9bff;--akp-acc-soft:#202c57;--akp-run:#6db0ff;--akp-run-soft:#18304f;--akp-done:#4cd07f;--akp-done-soft:#143323;--akp-prog:#f2b45a;--akp-prog-soft:#3a2a10;
  --akp-lagi:#c3adff;--akp-lagi-soft:#2a2147;--akp-bar:#27304d}
.akp *{box-sizing:border-box}
.akp-top{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between}
.akp h2{margin:0;font-size:20px;font-weight:700;color:var(--akp-fg);text-align:left}
.akp-sub{margin:2px 0 0;color:var(--akp-mute);font-size:13px}
.akp-sub b{color:var(--akp-fg);font-size:15px}
.akp-live{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--akp-mute)}
.akp-dot{width:8px;height:8px;border-radius:50%;background:var(--akp-done)}
.akp-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.akp-seg{display:inline-flex;flex-wrap:wrap;background:var(--akp-card);border:1px solid var(--akp-line);border-radius:10px;padding:3px;gap:2px}
.akp button{font:inherit;cursor:pointer}
.akpBtnSeg{border:0;background:transparent;padding:6px 12px;border-radius:8px;font-size:13px;color:var(--akp-mute)}
.akpBtnSeg[aria-pressed="true"]{background:var(--akp-acc-soft);color:var(--akp-acc);font-weight:700}
.akpBtn{border:1px solid var(--akp-line);background:var(--akp-card);color:var(--akp-fg);border-radius:10px;padding:7px 12px;font-size:13px}
.akp-tgl{height:34px;border:1px solid var(--akp-line);border-radius:10px;background:var(--akp-card);color:var(--akp-fg);padding:0 10px;font:inherit;font-size:13px;color-scheme:light}
[data-theme="dark"] .akp-tgl{color-scheme:dark}
.akp-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.akp-sum>div{background:var(--akp-soft);border:1px solid var(--akp-line);border-radius:12px;padding:10px 14px}
.akp-sum b{display:block;font-size:22px;font-variant-numeric:tabular-nums}
.akp-sum span{font-size:11px;color:var(--akp-mute);text-transform:uppercase;letter-spacing:.05em}
.akp-note{font-size:12.5px;color:var(--akp-mute);background:var(--akp-soft);border:1px dashed var(--akp-line);border-radius:10px;padding:8px 12px}
.akp-galat{font-size:13px;color:var(--akp-prog);background:var(--akp-prog-soft);border-radius:10px;padding:8px 12px}
.akp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
@media (max-width:820px){.akp-grid{grid-template-columns:minmax(0,1fr)}}
.akp-card{background:var(--akp-card);border:1px solid var(--akp-line);border-radius:16px;overflow:hidden;min-width:0}
.akp-card.jalan{border-color:var(--akp-run)}
.akpBtnKartu{width:100%;text-align:left;background:transparent;border:0;padding:18px 20px;display:flex;flex-direction:column;gap:12px;color:inherit}
.akpBtnKartu:focus-visible{outline:2px solid var(--akp-acc);outline-offset:-2px}
.akp-r1{display:flex;gap:12px;justify-content:space-between;align-items:flex-start}
.akp-nama{font-size:17px;font-weight:800;overflow-wrap:anywhere}
.akp-pj{font-size:13px;color:var(--akp-mute);overflow-wrap:anywhere}
.akp-chev{flex:none;width:30px;height:30px;border-radius:8px;border:1px solid var(--akp-line);display:grid;place-items:center;color:var(--akp-mute);transition:transform .15s}
.akp-card[data-buka="1"] .akp-chev{transform:rotate(180deg)}
.akp-pg{display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--akp-mute)}
.akp-tr{flex:1;height:8px;background:var(--akp-bar);border-radius:99px;overflow:hidden}
.akp-tr i{display:block;height:100%;background:var(--akp-acc);border-radius:99px}
.akp-cnt,.akp-act{display:flex;flex-wrap:wrap;gap:8px}
.akp-act{gap:6px}
.akp-pill{display:inline-flex;align-items:center;border-radius:99px;padding:4px 10px;font-size:12px;font-weight:700}
.akp-pill.berjalan{background:var(--akp-run-soft);color:var(--akp-run)}
.akp-pill.selesai{background:var(--akp-done-soft);color:var(--akp-done)}
.akp-pill.progres{background:var(--akp-prog-soft);color:var(--akp-prog)}
.akp-pill.lagi{background:var(--akp-lagi-soft);color:var(--akp-lagi)}
.akp-pill.dimulai{background:var(--akp-soft);color:var(--akp-mute);border:1px solid var(--akp-line)}
.akp-pill.nol{background:var(--akp-soft);color:var(--akp-mute);font-weight:500}
.akp-chip{font-size:11.5px;border:1px solid var(--akp-line);background:var(--akp-soft);border-radius:6px;padding:2px 8px;color:var(--akp-mute);text-transform:uppercase;letter-spacing:.04em}
.akp-body{border-top:1px solid var(--akp-line);padding:6px 20px 18px;display:flex;flex-direction:column;gap:4px}
.akp-stg{padding-top:12px}
.akp-stg h4{margin:0 0 8px;font-size:11.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--akp-acc);text-align:left;font-weight:700}
.akp-it{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;padding:10px 12px;border-radius:10px;background:var(--akp-soft);margin-bottom:6px;border-left:4px solid var(--akp-line)}
.akp-it.berjalan{border-left-color:var(--akp-run)}.akp-it.selesai{border-left-color:var(--akp-done)}.akp-it.progres{border-left-color:var(--akp-prog)}.akp-it.lagi{border-left-color:var(--akp-lagi)}
.akp-k{font-weight:700;font-size:14px;overflow-wrap:anywhere}
.akp-k small{color:var(--akp-mute);font-weight:500;margin-left:6px}
.akp-m{font-size:12.5px;color:var(--akp-mute);overflow-wrap:anywhere}
.akp-r{text-align:right;font-size:12.5px;display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.akp-t{font-variant-numeric:tabular-nums;font-weight:800;font-size:15px;color:var(--akp-run)}
.akp-mini{width:84px;height:6px;background:var(--akp-bar);border-radius:99px;overflow:hidden}
.akp-mini i{display:block;height:100%;background:var(--akp-prog)}
.akpBtnSingkat{width:100%;text-align:left;border:1px dashed var(--akp-line);background:transparent;color:var(--akp-mute);border-radius:10px;padding:8px 12px;font-size:12.5px;margin-bottom:6px}
.akp-kosong{padding:40px 16px;text-align:center;color:var(--akp-mute);border:1px dashed var(--akp-line);border-radius:14px}
`

// Satu interval detik utk semua timer di layar; berhenti sendiri bila tidak ada yang mendengar (kartu ditutup / tab lain).
const pendengarDetik = new Set<() => void>()
let intervalDetik: ReturnType<typeof setInterval> | null = null
function langgananDetik(f: () => void) {
  pendengarDetik.add(f)
  if (!intervalDetik) intervalDetik = setInterval(() => pendengarDetik.forEach((g) => g()), 1000)
  return () => {
    pendengarDetik.delete(f)
    if (!pendengarDetik.size && intervalDetik) { clearInterval(intervalDetik); intervalDetik = null }
  }
}
const detikKini = () => Math.floor(Date.now() / 1000)
function JamBerjalan({ mulai }: { mulai: string }) {
  const kini = useSyncExternalStore(langgananDetik, detikKini)
  const d = Math.max(0, kini - Math.floor(Date.parse(mulai) / 1000))
  const dua = (n: number) => String(n).padStart(2, '0')
  return <span className="akp-t">{Math.floor(d / 3600)}:{dua(Math.floor(d / 60) % 60)}:{dua(d % 60)}</span>
}

const jamWib = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
const namaHari = (t: string) => new Date(t + 'T00:00:00Z').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const namaTahap = (t: string) => BUSBAR_TAHAP_LABEL[t] || t
const LABEL: Record<string, string> = { berjalan: 'Berjalan', selesai: 'Selesai', progres: 'In progress', lagi: 'Dikerjakan lagi' }

function Baris({ b }: { b: BarisAktivitas }) {
  const tahap = b.tahapTimer.length ? ` · ${b.tahapTimer.map(namaTahap).join(', ')}` : ''
  const nama = b.operator.length ? b.operator.join(', ') : 'tanpa catatan operator'
  const mulaiAwal = b.jalan.map((j) => j.mulai).sort()[0]
  return (
    <div className={`akp-it ${b.kategori}`}>
      <div>
        <div className="akp-k">{b.namaKomponen || b.kode}{b.namaKomponen && <small>{b.kode}</small>}</div>
        <div className="akp-m">{nama}{tahap}{b.jalan.length ? ` · mulai ${jamWib(mulaiAwal)}` : ''}{b.waktuTerakhir ? ` · ${jamWib(b.waktuTerakhir)}` : ''}</div>
        {b.catatan.length > 0 && <div className="akp-m">{b.catatan.join(' · ')}</div>}
      </div>
      <div className="akp-r">
        {b.jalan.length > 0 ? <JamBerjalan mulai={mulaiAwal} /> : b.kategori === 'dimulai' ? null : <b>{LABEL[b.kategori]}</b>}
        {b.qty ? <span>{b.qty} qty</span> : null}
        {b.pct != null && <span>{Math.round(b.pct)}%</span>}
        {b.kategori === 'progres' && b.pct != null && <span className="akp-mini"><i style={{ width: Math.min(100, b.pct) + '%' }} /></span>}
        {!b.jalan.length && b.menit > 0 && <span>{labelLama(b.menit)}</span>}
      </div>
    </div>
  )
}

// Timer singkat (< 1 menit, tanpa progres) digabung per tahap supaya tidak memenuhi kartu; sumbernya sering salah pilih.
const timerSingkat = (b: BarisAktivitas) => b.kategori === 'dimulai' && b.menit < 1
function KelompokSingkat({ baris }: { baris: BarisAktivitas[] }) {
  const [buka, setBuka] = useState(false)
  if (!baris.length) return null
  return (
    <>
      <button type="button" className="akpBtnSingkat" aria-expanded={buka} onClick={() => setBuka((x) => !x)}>
        {buka ? '▾' : '▸'} {baris.length} timer singkat (&lt; 1 menit), belum ada progres
      </button>
      {buka && baris.map((b) => <Baris key={b.kunci} b={b} />)}
    </>
  )
}

function Kartu({ k, buka, onToggle, lampau }: { k: KartuAktivitas; buka: boolean; onToggle: () => void; lampau: boolean }) {
  const pil = (kelas: string, n: number, teks: string) => <span className={`akp-pill ${n > 0 ? kelas : 'nol'}`}>{n} {teks}</span>
  return (
    <div className={`akp-card${k.jumlah.berjalan > 0 ? ' jalan' : ''}`} data-buka={buka ? '1' : '0'}>
      <button type="button" className="akpBtnKartu" aria-expanded={buka} onClick={onToggle}>
        <div className="akp-r1">
          <div><div className="akp-nama">{k.nama}</div><div className="akp-pj">WO {k.wo} · {k.proyek}</div></div>
          <span className="akp-chev" aria-hidden="true">▾</span>
        </div>
        <div className="akp-pg"><span>{lampau ? 'Progres saat ini' : 'Progres panel'}</span><span className="akp-tr"><i style={{ width: k.progres + '%' }} /></span><b>{k.progres}%</b></div>
        <div className="akp-cnt">
          {pil('berjalan', k.jumlah.berjalan, 'berjalan')}
          {pil('selesai', k.jumlah.selesai, 'selesai')}
          {pil('progres', k.jumlah.progres, 'in progress')}
          {k.jumlah.lagi > 0 && pil('lagi', k.jumlah.lagi, 'dikerjakan lagi')}
          {k.jumlah.dimulai > 0 && pil('dimulai', k.jumlah.dimulai, 'belum ada progres')}
        </div>
        <div className="akp-act">{k.tahap.map((t) => <span key={t.proses} className="akp-chip">{t.proses}</span>)}</div>
      </button>
      {buka && (
        <div className="akp-body">
          {k.tahap.map((t) => (
            <div key={t.proses} className="akp-stg">
              <h4>{t.proses}</h4>
              {t.baris.filter((b) => !timerSingkat(b)).map((b) => <Baris key={b.kunci} b={b} />)}
              <KelompokSingkat baris={t.baris.filter(timerSingkat)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AktivitasPanelTab({ woData, pekerja, ccpMap, aktif }: { woData: any[]; pekerja: any[]; ccpMap: Record<string, number>; aktif: boolean }) {
  const [hariIni, setHariIni] = useState(hariKerjaWib)
  const [pilihan, setPilihan] = useState<'hari_ini' | 'kemarin' | 'tanggal'>('hari_ini')
  const [tanggalPilih, setTanggalPilih] = useState('')
  const [filter, setFilter] = useState<'semua' | 'berjalan' | 'selesai'>('semua')
  const [terbuka, setTerbuka] = useState<Set<number>>(() => new Set())
  const tanggal = pilihan === 'hari_ini' ? hariIni : pilihan === 'kemarin' ? tanggalSebelum(hariIni) : (tanggalPilih || hariIni)
  // "Hari ini" ikut berganti pukul 07.00 walau tab dibiarkan terbuka.
  useEffect(() => {
    if (!aktif) return
    const iv = setInterval(() => setHariIni(hariKerjaWib()), 30000)
    return () => clearInterval(iv)
  }, [aktif])
  const { timer, checkpoint, termuat, diperbaruiPada, galat } = useAktivitasPanel(supabase, tanggal, aktif)
  const petaNama = useMemo(() => new Map((pekerja || []).map((p: any) => [Number(p.id), p.nama as string])), [pekerja])
  const namaById = useCallback((id: any) => petaNama.get(Number(id)) as string | undefined, [petaNama])
  const hasil = useMemo(() => susunAktivitasHari({ woData, timer, checkpoint, tanggal, hariIni, ccpMap, namaById }), [woData, timer, checkpoint, tanggal, hariIni, ccpMap, namaById])
  const kartu = hasil.kartu.filter((k) => filter === 'semua' || k.jumlah[filter] > 0)
  const lampau = tanggal < hariIni
  const semuaTerbuka = kartu.length > 0 && kartu.every((k) => terbuka.has(k.panelId))
  const toggle = (id: number) => setTerbuka((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const bukaSemua = () => setTerbuka(semuaTerbuka ? new Set() : new Set(kartu.map((k) => k.panelId)))
  return (
    <div className="akp">
      <style>{CSS}</style>
      <div className="akp-top">
        <div>
          <h2>Aktivitas Panel</h2>
          <p className="akp-sub">Hari kerja <b>{namaHari(tanggal)}</b> · 07.00 WIB sampai 06.59 WIB esok hari</p>
        </div>
        <span className="akp-live"><span className="akp-dot" />{diperbaruiPada ? `Diperbarui ${jamWib(new Date(diperbaruiPada).toISOString())}` : 'Memuat...'}</span>
      </div>
      <div className="akp-bar">
        <div className="akp-seg" role="group" aria-label="Hari">
          <button type="button" className="akpBtnSeg" aria-pressed={pilihan === 'hari_ini'} onClick={() => setPilihan('hari_ini')}>Hari ini</button>
          <button type="button" className="akpBtnSeg" aria-pressed={pilihan === 'kemarin'} onClick={() => setPilihan('kemarin')}>Kemarin</button>
        </div>
        <input className="akp-tgl" type="date" aria-label="Pilih tanggal" max={hariIni} value={tanggal}
          onChange={(e) => { if (e.target.value && e.target.value <= hariIni) { setTanggalPilih(e.target.value); setPilihan('tanggal') } }} />
        <div className="akp-seg" role="group" aria-label="Filter">
          {([['semua', 'Semua'], ['berjalan', 'Timer berjalan'], ['selesai', 'Ada yang selesai']] as const).map(([id, teks]) => (
            <button key={id} type="button" className="akpBtnSeg" aria-pressed={filter === id} onClick={() => setFilter(id)}>{teks}</button>
          ))}
        </div>
        <button type="button" className="akpBtn" onClick={bukaSemua}>{semuaTerbuka ? 'Tutup semua' : 'Buka semua'}</button>
      </div>
      {galat && <div className="akp-galat" role="alert">Gagal memperbarui data: {galat}. Data terakhir tetap ditampilkan dan dicoba lagi otomatis.</div>}
      <div className="akp-sum">
        <div><b>{hasil.kartu.length}</b><span>Panel aktif</span></div>
        <div><b>{hasil.jumlah.berjalan}</b><span>Berjalan</span></div>
        <div><b>{hasil.jumlah.selesai}</b><span>Selesai</span></div>
        <div><b>{hasil.jumlah.progres}</b><span>In progress</span></div>
      </div>
      <div className="akp-note">
        Hanya panel aktif. Panel yang sudah diarsipkan tidak tampil, jadi angka hari lampau bisa lebih sedikit dari kenyataan.
        {lampau ? ' Di hari lampau, progres panel adalah kondisi saat ini.' : ''}
        {hasil.timerDiLuar > 0 ? ` ${hasil.timerDiLuar} timer milik panel di luar daftar aktif tidak ditampilkan.` : ''}
      </div>
      {!termuat ? <div className="akp-kosong">Memuat aktivitas...</div>
        : kartu.length === 0 ? <div className="akp-kosong">{hasil.kartu.length === 0 ? 'Tidak ada panel aktif pada hari ini.' : 'Tidak ada panel yang cocok dengan filter.'}</div>
          : <div className="akp-grid">{kartu.map((k) => <Kartu key={k.panelId} k={k} lampau={lampau} buka={terbuka.has(k.panelId)} onToggle={() => toggle(k.panelId)} />)}</div>}
    </div>
  )
}
