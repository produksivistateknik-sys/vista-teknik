// KESEHATAN DATA (15 Okt 2026, MVP tahap 1; revisi tampilan 16 Okt 2026) - status cek otomatis (fungsi SQL
// jalankan_cek_kesehatan, dijadwalkan pg_cron) + penjelasan per cek + sampel temuan + tren 14 hari + log error
// aplikasi terpusat (log_error_app). Halaman ini HANYA membaca tabel hasil; satu-satunya aksi = "Jalankan cek
// sekarang" (RPC, dibatasi 1x per menit di server).
// Penjelasan per cek (apa_terjadi/penyebab_umum/dampak_aplikasi/langkah/aplikasi) dibaca dari kesehatan_cek -
// bisa diedit dari SQL Editor tanpa deploy. Status otomatis kembali Aman saat cek berikutnya menghasilkan 0.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllPaged } from '../lib/fetchAllPaged'

type Cek = {
  kode: string; nama: string; kategori: string; penjelasan: string | null; frekuensi: string; urutan: number; aktif: boolean
  apa_terjadi?: string | null; penyebab_umum?: string | null; dampak_aplikasi?: string | null; langkah?: string[] | null; aplikasi?: string[] | null
}
type Hasil = { id: number; kode: string; waktu: string; jumlah: number | null; status: string; durasi_ms: number | null }
type Detail = { sampel: any[]; pesan_error: string | null }
type Status = 'kritis' | 'error' | 'peringatan' | 'info' | 'ok' | 'belum'
type Pola = { kode: string; nama: string; pola: string; jenis: string[]; aplikasi: string[]; apa_terjadi: string | null; penyebab: string | null; dampak: string | null; langkah: string[]; urutan: number }
type StatusErr = { sidik: string; status: 'baru' | 'ditangani' | 'selesai' | 'diabaikan'; catatan: string | null; versi_ditandai: string | null; jumlah_saat_ditandai: number; ditandai_oleh: string | null; ditandai_pada: string | null; muncul_lagi: boolean; muncul_lagi_pada: string | null; muncul_lagi_versi: string | null }
type Tunda = { kode: string; sampai: string; jumlah_saat_tunda: number | null; status_saat_tunda: string | null; catatan: string | null; ditunda_oleh: string | null; ditunda_pada: string }
type Sifat = 'baru' | 'memburuk' | 'stabil' | null
type Baris = { cek: Cek; akhir?: Hasil; status: Status; tren: (number | null)[]; hari: string[]; pulihSejak: string | null; aplikasi: string[]
  sifat: Sifat; tunda: Tunda | null; tundaAktif: boolean; tundaBerakhir: string | null }

const C = {
  bg: '#f6f7f9', surface: '#ffffff', line: '#e2e5ea', lineSoft: '#eceef2', fg: '#1b2230', fg2: '#4a5468', fg3: '#76809a',
  accent: '#1d4ed8', accentSoft: '#e8eefc',
}
const WARNA: Record<Status, { bg: string; fg: string; label: string }> = {
  kritis: { bg: '#fdeceb', fg: '#b42318', label: 'Kritis' },
  error: { bg: '#f3e8ff', fg: '#6b21a8', label: 'Cek gagal' },
  peringatan: { bg: '#fdf1d8', fg: '#92580a', label: 'Peringatan' },
  info: { bg: '#e6effc', fg: '#1a56b0', label: 'Info' },
  ok: { bg: '#e3f4ea', fg: '#157347', label: 'Aman' },
  belum: { bg: '#f1f5f9', fg: '#475569', label: 'Belum jalan' },
}
const PERINGKAT: Record<string, number> = { kritis: 0, error: 1, peringatan: 2, info: 3, ok: 4, belum: 5 }
const NAMA_APLIKASI: Record<string, string> = { 'vista-teknik': 'Admin', 'vista-pekerja': 'Operator' }
// label kolom sampel yang lebih mudah dibaca (kolom lain tampil apa adanya)
const LABEL_KOLOM: Record<string, string> = {
  panel_id: 'Panel id', panel: 'Panel', wo: 'WO', proyek: 'Proyek', kode_komponen: 'Komponen', proses: 'Proses', tahap: 'Tahap',
  operator: 'Operator', timer_id: 'Timer id', tanggal: 'Tanggal', mulai: 'Mulai', jam: 'Jam', jenis: 'Jenis', ref: 'Ref', info: 'Info',
  ccp: 'CCP %', checklist: 'Checklist %', last_operator_nama: 'Operator terakhir', updated_at: 'Diubah', tabel: 'Data', jumlah: 'Jumlah',
  tingkat: 'Tingkat', waktu_terakhir: 'Terakhir', jam_lalu: 'Jam lalu', disimpan: 'Disimpan %', waktu: 'Waktu',
}
// urutan kolom contoh baris: yang paling membantu dibaca dulu (sampel jsonb tidak menjaga urutan kolom query)
const URUTAN_KOLOM = ['jenis', 'operator', 'proses', 'tahap', 'kode_komponen', 'panel', 'panel_id', 'wo', 'proyek', 'tanggal', 'mulai', 'jam',
  'disimpan', 'ccp', 'checklist', 'waktu', 'last_operator_nama', 'updated_at', 'timer_id', 'ref', 'info', 'tabel', 'jumlah', 'tingkat', 'waktu_terakhir', 'jam_lalu']
const posisiKolom = (k: string) => { const i = URUTAN_KOLOM.indexOf(k); return i < 0 ? 999 : i }
const LABEL_STATUS_ERR: Record<string, { label: string; bg: string; fg: string }> = {
  baru: { label: 'Baru', bg: '#fdeceb', fg: '#b42318' },
  ditangani: { label: 'Sedang ditangani', bg: '#e6effc', fg: '#1a56b0' },
  selesai: { label: 'Selesai', bg: '#e3f4ea', fg: '#157347' },
  diabaikan: { label: 'Diabaikan', bg: '#f1f5f9', fg: '#475569' },
}
const LABEL_SIFAT: Record<string, { label: string; bg: string; fg: string }> = {
  baru: { label: 'Baru', bg: '#fdeceb', fg: '#b42318' },
  memburuk: { label: 'Memburuk', bg: '#fdeceb', fg: '#b42318' },
  stabil: { label: 'Stabil', bg: '#f1f5f9', fg: '#475569' },
}
const namaPenanda = () => { try { const x = JSON.parse(localStorage.getItem('vista_admin_session') || '{}'); return String(x?.nama || x?.name || 'Unknown') } catch { return 'Unknown' } }
// versi build LIVE aplikasi terkait saat ditandai (version.json; vista-pekerja mengizinkan dibaca lintas domain)
async function versiLive(aplikasi: string): Promise<string | null> {
  const url = aplikasi === 'vista-pekerja' ? 'https://operator.vistaproduksi.com/version.json' : '/version.json'
  try { const r0 = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' }); if (!r0.ok) return null; return String((await r0.json())?.buildId || '') || null } catch { return null }
}
// Aturan kerja standar yang ikut tersalin (tombol "Salin" error) supaya bisa langsung ditempel ke Claude Code.
const ATURAN_KERJA = [
  'INVESTIGASI dulu (baca saja, jangan ubah data/kode, jangan push).',
  'Laporkan temuan dengan bukti (query nyata ke database / activity_log / log_error_app + hasilnya), bukan teori dari kode saja.',
  'Sajikan usulan perbaikan, lalu TUNGGU konfirmasi saya.',
  'Setelah disetujui: kerjakan di branch, tes di Preview, tanpa push ke main sebelum izin saya.',
  'Perubahan skema (migration) saya jalankan sendiri di SQL Editor dengan verifikasi + rollback.',
  'Rilis vista-pekerja (aplikasi operator) hanya di luar jam kerja.',
]
// pola pertama (urutan kecil dulu) yang cocok dgn pesan + jenis + aplikasi; regex rusak dilewati
function polaUntuk(e: any, daftarPola: Pola[]): Pola | null {
  for (const p of daftarPola) {
    if (p.jenis?.length && !p.jenis.includes(e.jenis)) continue
    if (p.aplikasi?.length && !p.aplikasi.includes(e.aplikasi)) continue
    try { if (new RegExp(p.pola, 'i').test(String(e.pesan || ''))) return p } catch { /* pola tidak valid - lewati */ }
  }
  return null
}
async function salinKeClipboard(teks: string): Promise<boolean> {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(teks); return true } } catch { /* coba cara lama */ }
  try {
    const ta = document.createElement('textarea'); ta.value = teks; ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok
  } catch { return false }
}
const fmtWaktu = (s?: string | null) => s ? new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'
const tglWib = (s: string) => new Date(Date.parse(s) + 7 * 3600000).toISOString().slice(0, 10)
const tabelBelumAda = (e: any) => /does not exist|PGRST205|42P01|schema cache/i.test(String(e?.message || e?.code || ''))
const nilaiSel = (v: any) => {
  if (v == null) return ''
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return fmtWaktu(v)
  return typeof v === 'object' ? JSON.stringify(v) : String(v)
}

const CSS = `
.kd{color:${C.fg};text-align:left;max-width:1080px}
.kd *{box-sizing:border-box}
.kd-head{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:flex-start;justify-content:space-between}
.kd h1{font-size:20px;font-weight:700;margin:0 0 2px}
.kd .sub{color:${C.fg3};font-size:13px;margin:0;font-weight:400}
.kd-btn{border:1px solid ${C.line};background:${C.surface};border-radius:6px;padding:7px 12px;font-weight:500;font-size:13px;cursor:pointer;color:${C.fg}}
.kd-btn:hover{border-color:${C.accent};color:${C.accent}}
.kd-btn.primary{background:${C.accent};border-color:${C.accent};color:#fff}
.kd-btn:disabled{opacity:.6;cursor:default}
.kd-chip{display:inline-flex;gap:6px;padding:4px 10px;border-radius:999px;font-size:12.5px;font-weight:500}
.kd h2{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.fg3};margin:26px 0 8px}
.kd-list{background:${C.surface};border:1px solid ${C.line};border-radius:8px;overflow:hidden}
.kd-item+.kd-item{border-top:1px solid ${C.lineSoft}}
.kd-row{display:grid;grid-template-columns:44px 96px minmax(0,1fr) auto auto 20px;gap:12px;align-items:center;width:100%;background:none;border:0;padding:12px 14px;text-align:left;cursor:pointer;font:inherit;color:inherit}
.kd-row:hover{background:${C.bg}}
.kd-code{font-family:ui-monospace,Consolas,monospace;font-size:12px;color:${C.fg3}}
.kd-pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700;text-align:center;white-space:nowrap}
.kd-title{font-weight:700;font-size:14px;margin:0}
.kd-meta{color:${C.fg3};font-size:12.5px;font-weight:400;margin:1px 0 0}
.kd-tags{display:flex;gap:6px;margin-top:5px;flex-wrap:wrap}
.kd-tag{font-size:11.5px;font-weight:500;padding:1px 7px;border-radius:4px;border:1px solid ${C.line};color:${C.fg2};background:${C.surface}}
.kd-tag.op{border-color:transparent;background:${C.accentSoft};color:${C.accent}}
.kd-count{font-family:ui-monospace,Consolas,monospace;font-size:18px;font-weight:500;text-align:right;min-width:36px}
.kd-chev{color:${C.fg3};transition:transform .15s}
.kd-item.open .kd-chev{transform:rotate(90deg)}
.kd-detail{padding:2px 14px 18px 14px}
.kd-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px 24px;margin-left:56px}
.kd-block h3{font-size:12px;font-weight:700;color:${C.fg3};letter-spacing:.04em;text-transform:uppercase;margin:0 0 4px}
.kd-block p{margin:0;font-weight:400;color:${C.fg};font-size:13.5px;line-height:1.5}
.kd-extra{margin:16px 0 0 56px;display:grid;gap:14px}
.kd-steps{margin:0;padding-left:18px;font-size:13.5px;font-weight:400}
.kd-steps li{margin:2px 0}
.kd-tw{overflow-x:auto;border:1px solid ${C.lineSoft};border-radius:6px}
.kd table{border-collapse:collapse;width:100%;font-size:12.5px}
.kd th{text-align:left;font-weight:700;color:${C.fg3};padding:6px 10px;background:${C.bg};border-bottom:1px solid ${C.lineSoft};white-space:nowrap}
.kd td{text-align:left;padding:6px 10px;border-bottom:1px solid ${C.lineSoft};font-weight:400;white-space:nowrap;max-width:340px;overflow:hidden;text-overflow:ellipsis}
.kd tr:last-child td{border-bottom:0}
.kd-foot{color:${C.fg3};font-size:12px;margin:6px 0 0;font-weight:400}
.kd-resolved{margin:0 0 10px 56px;color:#157347;font-size:13.5px;font-weight:600}
.kd-seg{display:inline-flex;border:1px solid ${C.line};border-radius:6px;overflow:hidden;background:${C.surface}}
.kd-seg button{border:0;background:none;padding:6px 14px;font-size:13px;font-weight:500;color:${C.fg2};cursor:pointer}
.kd-seg button[aria-pressed="true"]{background:${C.accentSoft};color:${C.accent};font-weight:700}
.kd-err{padding:11px 14px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 14px}
.kd-err .m{font-weight:700;font-size:13.5px;overflow-wrap:anywhere}
.kd-err .d{color:${C.fg3};font-size:12.5px;font-weight:400}
.kd-err .n{font-family:ui-monospace,Consolas,monospace;font-size:13px;color:${C.fg2};grid-row:1/3;grid-column:2;align-self:center}
.kd-empty{padding:16px 14px;color:${C.fg3};font-size:13px;font-weight:400}
.kd-how{margin-top:28px;padding:14px 16px;background:${C.surface};border:1px solid ${C.line};border-radius:8px}
.kd-how h3{margin:0 0 6px;font-size:14px;font-weight:700}
.kd-how ol{margin:0;padding-left:18px;color:${C.fg2};font-size:13.5px;font-weight:400}
@media (max-width:760px){
  .kd-row{grid-template-columns:minmax(0,1fr) auto 20px;grid-template-areas:"a c d" "b b b" "t t t";gap:8px 10px}
  .kd-row .kd-code{display:none}.kd-row .kd-pill{grid-area:b;justify-self:start}
  .kd-row .kd-main{grid-area:a}.kd-row .kd-count{grid-area:c}.kd-row .kd-chev{grid-area:d}.kd-row .kd-tren{grid-area:t}
  .kd-grid,.kd-extra,.kd-resolved{margin-left:0}.kd-grid{grid-template-columns:1fr}
}`

function Pill({ status }: { status: Status }) {
  const w = WARNA[status] || WARNA.belum
  return <span className="kd-pill" style={{ background: w.bg, color: w.fg }}>{w.label}</span>
}
function Tag({ app }: { app: string }) {
  return <span className={'kd-tag' + (app === 'Operator' ? ' op' : '')}>{app}</span>
}

function TabelSampel({ rows, total }: { rows: any[]; total: number | null | undefined }) {
  if (!rows?.length) return <p className="kd-foot">Tidak ada contoh baris.</p>
  const kolom = [...new Set(rows.flatMap(r => Object.keys(r || {})))].sort((x, y) => posisiKolom(x) - posisiKolom(y)).slice(0, 10)
  return (
    <>
      <div className="kd-tw">
        <table>
          <thead><tr>{kolom.map(k => <th key={k}>{LABEL_KOLOM[k] || k}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{kolom.map(k => <td key={k} title={nilaiSel(r?.[k])}>{nilaiSel(r?.[k])}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <p className="kd-foot">Menampilkan {rows.length} dari {total ?? rows.length} temuan (maksimal 50 baris disimpan per pemeriksaan).</p>
    </>
  )
}

export function KesehatanDataTab() {
  const [memuat, setMemuat] = useState(true)
  const [belumDipasang, setBelumDipasang] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [cek, setCek] = useState<Cek[]>([])
  const [hasil, setHasil] = useState<Hasil[]>([])
  const [detail, setDetail] = useState<Record<string, Detail>>({})
  const [buka, setBuka] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<any[]>([])
  const [pola, setPola] = useState<Pola[]>([])
  const [bukaErr, setBukaErr] = useState<Record<number, boolean>>({})
  const [statusSalin, setStatusSalin] = useState<Record<string, string>>({})
  const [statusErr, setStatusErr] = useState<Record<string, StatusErr>>({})
  const [tunda, setTunda] = useState<Record<string, Tunda>>({})
  const [filterStatus, setFilterStatus] = useState<'aktif' | 'selesai' | 'diabaikan' | 'semua'>('aktif')
  const [lipatBuka, setLipatBuka] = useState(false)
  const [sibuk, setSibuk] = useState<string | null>(null)
  const [filterApp, setFilterApp] = useState<'Semua' | 'Admin' | 'Operator'>('Semua')
  const [menjalankan, setMenjalankan] = useState(false)
  const [salin, setSalin] = useState('Salin laporan')

  const muat = async () => {
    setMemuat(true); setGalat(null)
    try {
      const { data: c, error: cErr } = await supabase.from('kesehatan_cek' as any).select('*').order('urutan')
      if (cErr) { if (tabelBelumAda(cErr)) { setBelumDipasang(true); return } throw cErr }
      setBelumDipasang(false)
      const sejak = new Date(Date.now() - 14 * 86400000).toISOString()
      const h = await fetchAllPaged((a, b) => supabase.from('kesehatan_hasil' as any).select('id,kode,waktu,jumlah,status,durasi_ms').gte('waktu', sejak).order('waktu', { ascending: false }).order('id', { ascending: false }).range(a, b))
      // detail (sampel) hanya utk hasil TERBARU tiap cek
      const terbaru = new Map<string, Hasil>()
      for (const x of h as Hasil[]) if (!terbaru.has(x.kode)) terbaru.set(x.kode, x)
      const ids = [...terbaru.values()].map(x => x.id)
      const det: Record<string, Detail> = {}
      if (ids.length) {
        const { data: d, error: dErr } = await supabase.from('kesehatan_hasil' as any).select('id,kode,sampel,pesan_error').in('id', ids)
        if (dErr) throw dErr
        for (const x of (d as any[]) || []) det[x.kode] = { sampel: x.sampel || [], pesan_error: x.pesan_error }
      }
      const { data: e, error: eErr } = await supabase.from('log_error_app' as any).select('*').gte('waktu_terakhir', new Date(Date.now() - 7 * 86400000).toISOString()).order('waktu_terakhir', { ascending: false }).limit(200)
      if (eErr) throw eErr
      // pola error dikenal (tabel kesehatan_pola_error) - belum dipasang = semua error tampil "Belum dianalisis"
      const { data: pl, error: plErr } = await supabase.from('kesehatan_pola_error' as any).select('*').eq('aktif', true).order('urutan')
      if (plErr && !tabelBelumAda(plErr)) throw plErr
      setPola(((pl as any[]) || []) as Pola[])
      // status kelompok error & tunda cek (migration 20261016060000) - belum dipasang = semua Baru, tidak ada tunda
      const { data: se, error: seErr } = await supabase.from('kesehatan_status_error' as any).select('*').limit(1000)
      if (seErr && !tabelBelumAda(seErr)) throw seErr
      setStatusErr(Object.fromEntries(((se as any[]) || []).map((x: any) => [x.sidik, x])))
      const { data: td, error: tdErr } = await supabase.from('kesehatan_tunda_cek' as any).select('*')
      if (tdErr && !tabelBelumAda(tdErr)) throw tdErr
      setTunda(Object.fromEntries(((td as any[]) || []).map((x: any) => [x.kode, x])))
      setCek((c as any[]) || []); setHasil(h as Hasil[]); setDetail(det); setErrors((e as any[]) || [])
      // cek berstatus Kritis terbuka otomatis (pilihan buka/tutup user tetap dihormati sesudahnya)
      setBuka(prev => {
        const n = { ...prev }
        for (const x of terbaru.values()) if (x.status === 'kritis' && n[x.kode] === undefined) n[x.kode] = true
        return n
      })
    } catch (err: any) {
      console.error('[Kesehatan Data] gagal memuat:', err)
      setGalat(err?.message || String(err))
    } finally { setMemuat(false) }
  }
  useEffect(() => { muat() }, [])

  const jalankan = async () => {
    setMenjalankan(true)
    const { error } = await supabase.rpc('jalankan_cek_kesehatan' as any, { p_frekuensi: 'manual' } as any)
    setMenjalankan(false)
    if (error) { console.error('[Kesehatan Data] jalankan cek gagal:', error); alert('Gagal menjalankan cek: ' + error.message); return }
    await muat()
  }

  const baris = useMemo<Baris[]>(() => {
    const perKode = new Map<string, Hasil[]>()
    for (const x of hasil) { const a = perKode.get(x.kode) || []; a.push(x); perKode.set(x.kode, a) }
    const hari = Array.from({ length: 14 }, (_, i) => tglWib(new Date(Date.now() - (13 - i) * 86400000).toISOString()))
    return cek.filter(c => c.aktif).map(c => {
      const daftar = perKode.get(c.kode) || [] // terbaru dulu
      const akhir = daftar[0]
      const status = (akhir?.status || 'belum') as Status
      const tren = hari.map(d => { const di = daftar.filter(x => tglWib(x.waktu) === d); return di.length ? Math.max(...di.map(x => x.jumlah ?? 0)) : null })
      // "sudah tidak terdeteksi": sekarang Aman, tapi dalam 14 hari pernah bermasalah -> sejak kapan Aman lagi
      let pulihSejak: string | null = null
      if (status === 'ok') {
        const idxMasalah = daftar.findIndex(x => x.status !== 'ok')
        if (idxMasalah > 0) pulihSejak = daftar[idxMasalah - 1].waktu
      }
      // Baru = belum ada temuan >= 24 jam lalu; Memburuk = jumlah naik dibanding hasil terakhir >= 24 jam lalu; selain itu Stabil
      let sifat: Sifat = null
      if (status !== 'ok' && status !== 'belum') {
        const batas = Date.now() - 24 * 3600000
        const dulu = daftar.find(x => Date.parse(x.waktu) <= batas)
        if (!dulu || dulu.status === 'ok') sifat = 'baru'
        else if ((akhir?.jumlah ?? 0) > (dulu.jumlah ?? 0)) sifat = 'memburuk'
        else sifat = 'stabil'
      }
      // tunda aktif = belum habis & jumlah tidak naik melebihi jumlah saat ditunda (cek Aman: tunda tidak berarti)
      const t = tunda[c.kode] || null
      let tundaAktif = false, tundaBerakhir: string | null = null
      if (t && status !== 'ok' && status !== 'belum') {
        const habis = Date.parse(t.sampai) <= Date.now()
        const naik = (akhir?.jumlah ?? 0) > (t.jumlah_saat_tunda ?? 0)
        tundaAktif = !habis && !naik
        if (habis) tundaBerakhir = 'masa tunda habis ' + fmtWaktu(t.sampai)
        else if (naik) tundaBerakhir = `jumlah naik ${t.jumlah_saat_tunda ?? 0} -> ${akhir?.jumlah ?? 0} sejak ditunda`
      }
      return { cek: c, akhir, status, tren, hari, pulihSejak, aplikasi: c.aplikasi?.length ? c.aplikasi : ['Admin'], sifat, tunda: t, tundaAktif, tundaBerakhir }
    })
  }, [cek, hasil, tunda])

  const kelompok = useMemo(() => {
    const urut = (a: Baris, b: Baris) => (PERINGKAT[a.status] ?? 9) - (PERINGKAT[b.status] ?? 9) || a.cek.urutan - b.cek.urutan
    // tampilan utama: Kritis/Cek gagal (kecuali sedang ditunda), Peringatan/Info yang Baru atau Memburuk.
    // Ditunda (aktif) & Stabil -> bagian terlipat "Ditunda dan stabil". Ringkasan chip tetap menghitung semuanya.
    const utama = (b: Baris) => !b.tundaAktif && (b.status === 'kritis' || b.status === 'error' || b.sifat === 'baru' || b.sifat === 'memburuk')
    const bermasalah = (b: Baris) => b.status !== 'ok' && b.status !== 'belum'
    return {
      tindakan: baris.filter(b => ['kritis', 'error', 'peringatan'].includes(b.status) && utama(b)).sort(urut),
      informasi: baris.filter(b => b.status === 'info' && utama(b)).sort(urut),
      lipat: baris.filter(b => bermasalah(b) && !utama(b)).sort(urut),
      aman: baris.filter(b => b.status === 'ok' || b.status === 'belum').sort(urut),
    }
  }, [baris])

  const teksError = (e: any, p: Pola | null) => {
    const app = NAMA_APLIKASI[e.aplikasi] || e.aplikasi
    const baris = [
      `LAPORAN ERROR - Kesehatan Data (${app})`,
      `Pesan    : ${e.pesan}`,
      `Aplikasi : ${e.aplikasi} (${app})`,
      `Jenis    : ${e.jenis}`,
      `Halaman  : ${String(e.halaman || '').trim() || '-'}`,
      `Pengguna : ${e.pengguna || '-'}`,
      `Waktu    : pertama ${fmtWaktu(e.waktu_pertama)} WIB, terakhir ${fmtWaktu(e.waktu_terakhir)} WIB`,
      `Jumlah   : ${e.jumlah}x`,
      `Versi    : ${e.versi || '-'}`,
    ]
    const k = e.konteks || {}
    const ref = [k.panelId != null ? `panel ${k.panelId}` : '', k.kode ? `komponen ${k.kode}` : '', k.proses ? `proses ${k.proses}` : '', k.tahap ? `tahap ${k.tahap}` : ''].filter(Boolean).join(', ')
    if (ref) baris.push(`Data     : ${ref}`)
    if (k.lokasi) baris.push(`Lokasi kode: ${k.lokasi}`)
    if (k.jenisGagal) baris.push(`Jenis gagal: ${k.jenisGagal}${k.online === false ? ' (HP offline)' : ''}`)
    const st = statusErr[e.sidik]
    baris.push(`Status   : ${LABEL_STATUS_ERR[st?.status || 'baru'].label}${st?.ditandai_pada ? ` (ditandai ${st.ditandai_oleh || '-'}, ${fmtWaktu(st.ditandai_pada)} WIB, versi ${st.versi_ditandai || '-'}${st.catatan ? ', catatan: ' + st.catatan : ''})` : ''}`)
    if (st?.muncul_lagi) baris.push(`MUNCUL LAGI: ${fmtWaktu(st.muncul_lagi_pada)} WIB di versi ${st.muncul_lagi_versi || '-'} (sebelumnya ditandai selesai, ${st.jumlah_saat_ditandai} kejadian s.d. ditandai, sekarang ${e.jumlah} dalam 7 hari)`)
    baris.push('')
    if (p) {
      baris.push(`POLA DIKENAL: ${p.kode} - ${p.nama}`)
      if (p.apa_terjadi) baris.push(`Apa yang terjadi: ${p.apa_terjadi}`)
      if (p.penyebab) baris.push(`Penyebab: ${p.penyebab}`)
      if (p.dampak) baris.push(`Dampak bagi aplikasi: ${p.dampak}`)
      if (p.langkah?.length) baris.push('Langkah penanganan:', ...p.langkah.map((l, i) => `  ${i + 1}. ${l}`))
    } else {
      baris.push('POLA: Belum dianalisis - tolong investigasi penyebab, cakupan (berapa kali, siapa, halaman apa), dan dampaknya.')
    }
    return baris.join('\n')
  }
  const aturanTeks = () => ['', '', 'ATURAN KERJA:', ...ATURAN_KERJA.map(a => '- ' + a)].join('\n')
  const salinTeks = async (kunci: string, teks: string) => {
    const ok = await salinKeClipboard(teks)
    setStatusSalin(p => ({ ...p, [kunci]: ok ? 'Tersalin' : 'Gagal menyalin' }))
    setTimeout(() => setStatusSalin(p => { const n = { ...p }; delete n[kunci]; return n }), 1600)
  }
  // kelompok error per sidik (1 sidik bisa punya beberapa baris log: digabung per jam di server)
  const grupError = useMemo(() => {
    const m = new Map<string, any>()
    for (const e of errors) {
      const g = m.get(e.sidik)
      if (!g) { m.set(e.sidik, { ...e, jumlah: Number(e.jumlah) || 0, pengguna_semua: new Set([e.pengguna].filter(Boolean)) }); continue }
      g.jumlah += Number(e.jumlah) || 0
      if (e.waktu_pertama < g.waktu_pertama) g.waktu_pertama = e.waktu_pertama
      if (e.waktu_terakhir > g.waktu_terakhir) { Object.assign(g, { waktu_terakhir: e.waktu_terakhir, versi: e.versi, pesan: e.pesan, halaman: e.halaman, konteks: e.konteks, pengguna: e.pengguna }) }
      if (e.pengguna) g.pengguna_semua.add(e.pengguna)
    }
    return [...m.values()].map(g => ({ ...g, pengguna: [...g.pengguna_semua].join(', ') || g.pengguna })).sort((a, b) => (a.waktu_terakhir < b.waktu_terakhir ? 1 : -1))
  }, [errors])
  const statusDari = (g: any): StatusErr['status'] => statusErr[g.sidik]?.status || 'baru'
  const tandai = async (g: any, statusBaru: StatusErr['status']) => {
    const label = LABEL_STATUS_ERR[statusBaru].label
    const catatan = window.prompt(`Tandai "${label}" - catatan singkat (opsional), mis. commit/perbaikan:`, statusErr[g.sidik]?.catatan || '')
    if (catatan === null) return
    setSibuk('e' + g.sidik)
    const versi = (await versiLive(g.aplikasi)) || g.versi || null
    const { error } = await supabase.rpc('tandai_status_error' as any, { p_sidik: g.sidik, p_status: statusBaru, p_catatan: catatan, p_versi: versi, p_oleh: namaPenanda() } as any)
    setSibuk(null)
    if (error) { console.error('[Kesehatan Data] tandai status error gagal:', error); alert('Gagal menandai: ' + error.message); return }
    await muat()
  }
  const tundaCek = async (b: Baris) => {
    const kritis = b.status === 'kritis' || b.status === 'error'
    const catatan = window.prompt(`Tunda ${b.cek.kode} ${kritis ? '24 jam (Kritis maksimal 24 jam)' : '7 hari'} - catatan (alasan ditunda):`, '')
    if (catatan === null) return
    setSibuk('c' + b.cek.kode)
    const { error } = await supabase.rpc('tunda_cek_kesehatan' as any, { p_kode: b.cek.kode, p_jam: kritis ? 24 : 168, p_catatan: catatan, p_oleh: namaPenanda() } as any)
    setSibuk(null)
    if (error) { console.error('[Kesehatan Data] tunda cek gagal:', error); alert('Gagal menunda: ' + error.message); return }
    await muat()
  }
  const batalTunda = async (kode: string) => {
    setSibuk('c' + kode)
    const { error } = await supabase.rpc('batal_tunda_cek_kesehatan' as any, { p_kode: kode, p_oleh: namaPenanda() } as any)
    setSibuk(null)
    if (error) { console.error('[Kesehatan Data] batal tunda gagal:', error); alert('Gagal membatalkan tunda: ' + error.message); return }
    await muat()
  }
  const errorTampil = grupError.filter(e => filterApp === 'Semua' || (NAMA_APLIKASI[e.aplikasi] || e.aplikasi) === filterApp)
    .filter(e => { const st = statusDari(e); return filterStatus === 'semua' || (filterStatus === 'aktif' ? (st === 'baru' || st === 'ditangani') : st === filterStatus) })
  const terakhirJalan = hasil[0]?.waktu

  const salinLaporan = () => {
    const teks = ['KESEHATAN DATA - ' + fmtWaktu(terakhirJalan) + ' WIB']
      .concat([...kelompok.tindakan, ...kelompok.informasi, ...kelompok.lipat, ...kelompok.aman].map(b => `${b.cek.kode} ${WARNA[b.status].label} (${b.akhir?.jumlah ?? '-'}): ${b.cek.nama}`))
      .join('\n')
    const selesai = (m: string) => { setSalin(m); setTimeout(() => setSalin('Salin laporan'), 1600) }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(teks).then(() => selesai('Tersalin'), () => selesai('Gagal menyalin'))
    else selesai('Gagal menyalin')
  }

  if (belumDipasang) return (
    <div className="kd" style={{ padding: 20, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8 }}>
      <style>{CSS}</style>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Kesehatan Data belum dipasang</div>
      <div style={{ fontSize: 13, color: C.fg2 }}>Jalankan migration <code>supabase/migrations/20261015010000_kesehatan_data.sql</code> di SQL Editor, lalu file verifikasinya.</div>
    </div>
  )

  const ringkas = baris.reduce((m: Record<string, number>, b) => { m[b.status] = (m[b.status] || 0) + 1; return m }, {})

  const itemCek = (b: Baris) => {
    const { cek: c, akhir, status, tren, hari, pulihSejak, aplikasi } = b
    const terbuka = !!buka[c.kode]
    const d = detail[c.kode]
    const w = WARNA[status]
    const maks = Math.max(1, ...tren.map(t => t ?? 0))
    const apa = c.apa_terjadi || c.penjelasan
    const langkah = (c.langkah || []).filter(Boolean)
    const adaMasalah = status !== 'ok' && status !== 'belum'
    const adaSampel = (d?.sampel?.length ?? 0) > 0
    return (
      <div key={c.kode} className={'kd-item' + (terbuka ? ' open' : '')} data-cek={c.kode}>
        <button type="button" className="kd-row" aria-expanded={terbuka} onClick={() => setBuka(p => ({ ...p, [c.kode]: !terbuka }))}>
          <span className="kd-code">{c.kode}</span>
          <Pill status={status} />
          <span className="kd-main">
            <p className="kd-title">{c.nama}</p>
            <p className="kd-meta">{c.kategori} · {c.frekuensi === 'per_jam' ? 'per jam' : 'harian'} · terakhir {fmtWaktu(akhir?.waktu)}{pulihSejak ? ' · sudah tidak terdeteksi' : ''}</p>
            <span className="kd-tags">{aplikasi.map(a => <Tag key={a} app={a} />)}
              {b.sifat && <span className="kd-tag" style={{ background: LABEL_SIFAT[b.sifat].bg, color: LABEL_SIFAT[b.sifat].fg, borderColor: 'transparent' }}>{LABEL_SIFAT[b.sifat].label}</span>}
              {b.tundaAktif && b.tunda && <span className="kd-tag">Ditunda s.d. {fmtWaktu(b.tunda.sampai)}</span>}
              {b.tundaBerakhir && <span className="kd-tag" style={{ background: '#fdf1d8', color: '#92580a', borderColor: 'transparent' }}>Muncul lagi: {b.tundaBerakhir}</span>}
            </span>
          </span>
          <span className="kd-tren" title={'Riwayat 14 hari (temuan terbanyak per hari): ' + tren.map((t, i) => hari[i].slice(5) + '=' + (t ?? '-')).join(', ')} style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24 }}>
            {tren.map((t, i) => <span key={i} style={{ width: 5, height: t == null ? 2 : Math.max(3, Math.round((t / maks) * 24)), background: t == null ? C.line : t > 0 ? (c.kode === 'K10' ? '#93b4e8' : '#f0b44c') : '#4fbf85', borderRadius: 1, display: 'block' }} />)}
          </span>
          <span className="kd-count" style={{ color: w.fg }}>{akhir?.jumlah ?? '-'}</span>
          <span className="kd-chev" aria-hidden="true">▸</span>
        </button>
        {terbuka && (
          <div className="kd-detail">
            {pulihSejak && <p className="kd-resolved">Sudah tidak terdeteksi sejak {fmtWaktu(pulihSejak)}. Riwayat 14 hari tetap tersimpan di grafik.</p>}
            {d?.pesan_error && <p className="kd-resolved" style={{ color: WARNA.error.fg }}>Cek gagal dijalankan: {d.pesan_error}</p>}
            {adaMasalah && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: '0 0 12px 56px' }} className="kd-aksi">
                {b.tunda && (b.tundaAktif || b.tundaBerakhir) && <span className="kd-foot" style={{ margin: 0 }}>Ditunda {fmtWaktu(b.tunda.ditunda_pada)} oleh {b.tunda.ditunda_oleh || '-'} saat {b.tunda.jumlah_saat_tunda ?? '-'} temuan, s.d. {fmtWaktu(b.tunda.sampai)}{b.tunda.catatan ? ' · ' + b.tunda.catatan : ''}</span>}
                <button type="button" className="kd-btn" data-tunda={c.kode} disabled={sibuk === 'c' + c.kode} onClick={() => tundaCek(b)}>{status === 'kritis' || status === 'error' ? 'Tunda 24 jam' : 'Tunda 7 hari'}</button>
                {b.tunda && <button type="button" className="kd-btn" disabled={sibuk === 'c' + c.kode} onClick={() => batalTunda(c.kode)}>Batalkan tunda</button>}
              </div>
            )}
            <div className="kd-grid">
              {apa && <div className="kd-block"><h3>Apa yang terjadi</h3><p>{apa}</p></div>}
              {c.penyebab_umum && <div className="kd-block"><h3>Penyebab</h3><p>{c.penyebab_umum}</p></div>}
              {c.dampak_aplikasi && <div className="kd-block"><h3>Dampak bagi aplikasi</h3><p>{c.dampak_aplikasi}</p></div>}
            </div>
            {((adaMasalah && langkah.length > 0) || adaSampel) && (
              <div className="kd-extra">
                {adaMasalah && langkah.length > 0 && (
                  <div className="kd-block"><h3>Langkah penanganan</h3><ol className="kd-steps">{langkah.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
                )}
                {adaSampel && <div className="kd-block"><h3>Contoh baris</h3><TabelSampel rows={d.sampel} total={akhir?.jumlah} /></div>}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
  const daftar = (isi: Baris[], kosong: string) => (
    <div className="kd-list">{isi.length ? isi.map(itemCek) : <div className="kd-empty">{kosong}</div>}</div>
  )

  return (
    <div className="kd">
      <style>{CSS}</style>
      <div className="kd-head">
        <div>
          <h1>Kesehatan Data</h1>
          <p className="sub">Otomatis: per jam (K1, K8) dan tiap hari 05.30 WIB. Pemeriksaan terakhir {fmtWaktu(terakhirJalan)} WIB.</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="kd-btn" onClick={salinLaporan}>{salin}</button>
          <button type="button" className="kd-btn" onClick={muat} disabled={memuat}>Muat ulang</button>
          <button type="button" className="kd-btn primary" onClick={jalankan} disabled={menjalankan}>{menjalankan ? 'Menjalankan...' : 'Jalankan cek sekarang'}</button>
        </div>
      </div>
      {galat && <div style={{ background: '#fdeceb', color: '#b42318', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginTop: 12 }}>Gagal memuat: {galat}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '18px 0 0' }}>
        {(['kritis', 'error', 'peringatan', 'info', 'ok'] as Status[]).filter(s => s !== 'error' || ringkas[s]).map(s => (
          <span key={s} className="kd-chip" style={{ background: WARNA[s].bg, color: WARNA[s].fg }}><b>{ringkas[s] || 0}</b> {WARNA[s].label}</span>
        ))}
      </div>

      {memuat && !baris.length ? <p className="kd-empty">Memuat...</p> : (
        <>
          <h2>Perlu tindakan</h2>
          {daftar(kelompok.tindakan, 'Tidak ada masalah yang perlu tindakan.')}
          <h2>Informasi</h2>
          {daftar(kelompok.informasi, 'Tidak ada informasi.')}
          <h2 style={{ cursor: 'pointer' }} onClick={() => setLipatBuka(v => !v)} data-lipat>{lipatBuka ? '▾' : '▸'} Ditunda dan stabil ({kelompok.lipat.length})</h2>
          {lipatBuka && daftar(kelompok.lipat, 'Tidak ada cek yang ditunda atau stabil.')}
          <h2>Aman</h2>
          {daftar(kelompok.aman, 'Belum ada cek yang aman.')}
        </>
      )}

      <h2>Error aplikasi, 7 hari terakhir</h2>
      <div className="kd-seg" role="group" aria-label="Filter aplikasi">
        {(['Semua', 'Admin', 'Operator'] as const).map(a => (
          <button key={a} type="button" aria-pressed={filterApp === a} onClick={() => setFilterApp(a)}>{a}</button>
        ))}
      </div>
      <div className="kd-seg" role="group" aria-label="Filter status" style={{ marginLeft: 8 }}>
        {([['aktif', 'Baru & ditangani'], ['selesai', 'Selesai'], ['diabaikan', 'Diabaikan'], ['semua', 'Semua status']] as const).map(([k, l]) => (
          <button key={k} type="button" data-filter-status={k} aria-pressed={filterStatus === k} onClick={() => setFilterStatus(k)}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <span className="kd-foot" style={{ margin: 0 }}>{errorTampil.length} kelompok error · {errorTampil.filter(e => !polaUntuk(e, pola)).length} belum dianalisis</span>
        <div style={{ flex: 1 }} />
        {errorTampil.length > 0 && (
          <button type="button" className="kd-btn" onClick={() => {
            const kelompokPola = new Map<string, any[]>()
            for (const e of errorTampil) { const p = polaUntuk(e, pola); const k = p ? `${p.kode} - ${p.nama}` : 'Belum dianalisis'; kelompokPola.set(k, [...(kelompokPola.get(k) || []), e]) }
            const teks = [`RINGKASAN ERROR APLIKASI - Kesehatan Data (${filterApp}), 7 hari terakhir, disalin ${fmtWaktu(new Date().toISOString())} WIB`,
              `${errorTampil.length} kelompok error, ${errorTampil.reduce((n, e) => n + (Number(e.jumlah) || 0), 0)} kejadian.`, '']
            for (const [k, list] of kelompokPola) {
              teks.push(`== ${k} (${list.length} kelompok, ${list.reduce((n, e) => n + (Number(e.jumlah) || 0), 0)} kejadian)`)
              for (const e of list) teks.push(`- ${fmtWaktu(e.waktu_terakhir)} | ${e.aplikasi} | ${e.jenis} | ${e.pengguna || '-'} | ${String(e.halaman || '').trim() || '-'} | ${e.jumlah}x | ${e.pesan}`)
              teks.push('')
            }
            teks.push('Rincian tiap error (pola, sebab, akibat, langkah) bisa disalin dari tombol "Salin" per error.')
            salinTeks('semua', teks.join('\n') + aturanTeks())
          }}>{statusSalin['semua'] || 'Salin semua'}</button>
        )}
      </div>
      <div className="kd-list" style={{ marginTop: 8 }}>
        {errorTampil.length === 0 ? <div className="kd-empty">Tidak ada error tercatat.</div> : errorTampil.map(e => {
          const app = NAMA_APLIKASI[e.aplikasi] || e.aplikasi
          const p = polaUntuk(e, pola)
          const terbuka = !!bukaErr[e.id]
          return (
            <div key={e.id} className={'kd-item' + (terbuka ? ' open' : '')} data-error-app={app} data-pola={p?.kode || 'belum'} data-status={statusDari(e)}>
              <div className="kd-err" style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto' }} title={(e.konteks?.lokasi || '') + (e.versi ? '\nversi ' + e.versi : '')}>
                <span className="m" style={{ cursor: 'pointer' }} onClick={() => setBukaErr(s0 => ({ ...s0, [e.id]: !terbuka }))}>{terbuka ? '▾ ' : '▸ '}{e.pesan}</span>
                <span className="n">{e.jumlah}x</span>
                <button type="button" className="kd-btn" data-salin={e.id} style={{ gridRow: '1/3', alignSelf: 'center', padding: '4px 10px', fontSize: 12 }}
                  onClick={() => salinTeks('e' + e.id, teksError(e, p) + aturanTeks())}>{statusSalin['e' + e.id] || 'Salin'}</button>
                <span className="d"><Tag app={app} /> {p
                  ? <span className="kd-tag" style={{ background: '#e3f4ea', color: '#157347', borderColor: 'transparent' }}>{p.kode} · {p.nama}</span>
                  : <span className="kd-tag" style={{ background: '#fdf1d8', color: '#92580a', borderColor: 'transparent' }}>Belum dianalisis</span>}
                  {' '}<span className="kd-tag" style={{ background: LABEL_STATUS_ERR[statusDari(e)].bg, color: LABEL_STATUS_ERR[statusDari(e)].fg, borderColor: 'transparent' }}>{LABEL_STATUS_ERR[statusDari(e)].label}</span>
                  {statusErr[e.sidik]?.muncul_lagi && <span className="kd-tag" style={{ background: '#fdeceb', color: '#b42318', borderColor: 'transparent' }}>Muncul lagi {fmtWaktu(statusErr[e.sidik].muncul_lagi_pada)}</span>}
                  {' '}{e.jenis} · {String(e.halaman || '').trim() || '-'} · {fmtWaktu(e.waktu_terakhir)}{e.pengguna ? ' · ' + e.pengguna : ''}</span>
              </div>
              {terbuka && (
                <div className="kd-detail" style={{ paddingTop: 0 }}>
                  {p ? (
                    <>
                      <div className="kd-grid" style={{ marginLeft: 0 }}>
                        {p.apa_terjadi && <div className="kd-block"><h3>Apa yang terjadi</h3><p>{p.apa_terjadi}</p></div>}
                        {p.penyebab && <div className="kd-block"><h3>Penyebab</h3><p>{p.penyebab}</p></div>}
                        {p.dampak && <div className="kd-block"><h3>Dampak bagi aplikasi</h3><p>{p.dampak}</p></div>}
                      </div>
                      {p.langkah?.length > 0 && <div className="kd-extra" style={{ marginLeft: 0 }}><div className="kd-block"><h3>Langkah penanganan</h3><ol className="kd-steps">{p.langkah.map((l, i) => <li key={i}>{l}</li>)}</ol></div></div>}
                    </>
                  ) : (
                    <p className="kd-foot" style={{ fontSize: 13 }}>Pola error ini belum dianalisis. Tekan <b>Salin</b> lalu tempel ke Claude Code untuk diinvestigasi; hasilnya bisa ditambahkan ke tabel <code>kesehatan_pola_error</code> (tanpa deploy).</p>
                  )}
                  <p className="kd-foot">Pertama {fmtWaktu(e.waktu_pertama)} · terakhir {fmtWaktu(e.waktu_terakhir)} · versi {e.versi || '-'}{e.konteks?.lokasi ? ' · ' + e.konteks.lokasi : ''}</p>
                  {statusErr[e.sidik]?.ditandai_pada && <p className="kd-foot">Status {LABEL_STATUS_ERR[statusDari(e)].label} · ditandai {statusErr[e.sidik].ditandai_oleh || '-'} {fmtWaktu(statusErr[e.sidik].ditandai_pada)} · versi {statusErr[e.sidik].versi_ditandai || '-'}{statusErr[e.sidik].catatan ? ' · ' + statusErr[e.sidik].catatan : ''}</p>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {(['ditangani', 'selesai', 'diabaikan', 'baru'] as const).filter(sx => sx !== statusDari(e)).map(sx => (
                      <button key={sx} type="button" className="kd-btn" data-tandai={sx} disabled={sibuk === 'e' + e.sidik} onClick={() => tandai(e, sx)}>
                        {sx === 'selesai' ? 'Tandai selesai' : sx === 'ditangani' ? 'Sedang ditangani' : sx === 'diabaikan' ? 'Abaikan' : 'Buka lagi (Baru)'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="kd-how">
        <h3>Cara kerja status</h3>
        <ol>
          <li>Setiap cek dijalankan terjadwal. Kalau masalahnya sudah diperbaiki, statusnya berubah menjadi Aman di pemeriksaan berikutnya dan pindah ke daftar Aman. Tidak perlu dihapus manual.</li>
          <li>Grafik batang kecil menyimpan riwayat 14 hari, jadi tetap terlihat kapan masalah muncul dan hilang.</li>
          <li>Label Operator berarti cek itu membaca data dari aplikasi operator (timer, progres). Error dari kedua aplikasi masuk ke daftar yang sama.</li>
        </ol>
      </div>
    </div>
  )
}
