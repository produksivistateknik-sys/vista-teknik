// PANEL NOTIFIKASI INVENTARIS (31 Okt 2026, T2) - lonceng di header tab Inventaris & Maintenance + laci "Perlu ditinjau" /
// "Semua". Satu kartu per tindakan operator; ketuk = tautan langsung ke baris (onBuka) + tandai dilihat. Setujui /
// Kembalikan lewat RPC inv_notif_* (data & aturan: lib/inventarisNotif.ts). NotifKartu juga dipakai di detail baris.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { JENIS_NOTIF, muatNotifHalaman, notifDilihat, notifSetujui, notifKembalikan, type Notifikasi } from '../lib/inventarisNotif'
import { fmtWaktu } from '../lib/inventaris'
import { DIVISI_CONFIG } from '../constants/panelTypes'

const pesanGalat = (e: any) => e?.message || String(e)
const namaDivisi = (d: string | null) => (d && (DIVISI_CONFIG as any)[d]?.label) || d || ''
const WARNA_KEPUTUSAN: Record<string, [string, string, string]> = {
  disetujui: ['#15803d', '#dcf5e5', 'Disetujui'], dikembalikan: ['#a15c07', '#fdecc8', 'Dikembalikan'], ditolak: ['#b91c1c', '#fde0e0', 'Ditolak'],
}

const CSS = `
.ivn-bell{position:relative;font:inherit;border:1px solid var(--iv-line);background:var(--iv-card);color:var(--iv-fg);border-radius:8px;width:38px;height:34px;cursor:pointer;display:grid;place-items:center}
.ivn-bell i{font-size:19px}
.ivn-bell b{position:absolute;top:-6px;right:-7px;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:#dc2626;color:#fff;font-size:11px;line-height:18px;font-weight:700}
.ivn-laci{position:fixed;inset:0;z-index:10300;display:flex;justify-content:flex-end;background:rgba(15,23,42,.35)}
.ivn-isi{width:min(440px,100vw);height:100%;background:var(--iv-bg,#f3f5f8);color:var(--iv-fg);display:flex;flex-direction:column;box-shadow:-8px 0 24px rgba(0,0,0,.18)}
.ivn-kep{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--iv-line);background:var(--iv-card)}
.ivn-kep h3{margin:0;font-size:15px;flex:1}
.ivn-tab{display:flex;gap:6px;padding:8px 14px;background:var(--iv-card);border-bottom:1px solid var(--iv-line)}
.ivn-tab button{font:inherit;font-size:12.5px;border:1px solid var(--iv-line);background:var(--iv-card);color:var(--iv-fg);border-radius:99px;padding:5px 11px;cursor:pointer}
.ivn-tab button[aria-pressed="true"]{background:var(--iv-acc-bg);color:var(--iv-acc);border-color:var(--iv-acc);font-weight:700}
.ivn-daftar{flex:1;overflow:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.ivn-k{background:var(--iv-card);border:1px solid var(--iv-line);border-radius:10px;padding:9px 11px;font-size:12.5px;display:flex;flex-direction:column;gap:5px}
.ivn-k.baru{border-left:3px solid #2563eb}
.ivn-k .t{display:flex;gap:8px;align-items:flex-start;cursor:pointer}
.ivn-k .t i{font-size:17px;color:var(--iv-mute);margin-top:1px}
.ivn-k .t .tx{flex:1;overflow-wrap:anywhere}
.ivn-k.baru .t .tx>b{font-weight:700}
.ivn-k .m{color:var(--iv-mute);font-size:11.5px}
.ivn-k .a{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.ivn-k textarea{font:inherit;width:100%;border:1px solid var(--iv-line);border-radius:7px;padding:6px 8px;background:var(--iv-card);color:var(--iv-fg)}
.ivn-pill{display:inline-block;font-size:11px;font-weight:700;padding:1px 7px;border-radius:99px}
`

export function LoncengNotif({ jumlah, onBuka }: { jumlah: number; onBuka: () => void }) {
  return <button type="button" className="ivn-bell" onClick={onBuka} title={jumlah ? `${jumlah} tindakan operator baru` : 'Notifikasi operator'} aria-label="Notifikasi operator">
    <style>{CSS}</style><i className="ti ti-bell" />{jumlah > 0 && <b>{jumlah > 99 ? '99+' : jumlah}</b>}</button>
}

// Kartu 1 notifikasi. onLihat = tautan langsung (opsional - di detail baris tidak perlu). onBerubah = muat ulang sesudah aksi.
export function NotifKartu({ n, user, db, onLihat, onBerubah }: { n: Notifikasi; user: any; db: any; onLihat?: (n: Notifikasi) => void; onBerubah: () => void }) {
  const j = JENIS_NOTIF[n.jenis]
  const [kembali, setKembali] = useState(false)
  const [catatan, setCatatan] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const jalankan = async (fn: () => Promise<any>) => {
    setSibuk(true)
    try { await fn(); setKembali(false); setCatatan('') }
    catch (e: any) { alert(pesanGalat(e)) }
    finally { setSibuk(false); onBerubah() }
  }
  const kep = n.keputusan ? WARNA_KEPUTUSAN[n.keputusan] : null
  return <div className={'ivn-k' + (n.status === 'baru' ? ' baru' : '')}>
    <div className="t" role={onLihat ? 'button' : undefined} onClick={() => onLihat?.(n)} title={onLihat ? 'Buka barisnya' : undefined}>
      <i className={'ti ' + j.ikon} />
      <div className="tx"><b>{n.teks}</b>
        <div className="m">{j.label} · {n.oleh}{n.divisi ? ' · ' + namaDivisi(n.divisi) : ''} · {fmtWaktu(n.dibuat_pada)}{n.status === 'dilihat' && n.dilihat_oleh ? ` · dilihat ${n.dilihat_oleh}` : ''}</div></div>
      {kep && <span className="ivn-pill" style={{ color: kep[0], background: kep[1] }}>{kep[2]}</span>}
    </div>
    {kep && <div className="m">{kep[2]} oleh {n.diputuskan_oleh} · {fmtWaktu(n.diputuskan_pada!)}{n.catatan_keputusan ? ' · ' + n.catatan_keputusan : ''}</div>}
    {!kep && !kembali && <div className="a">
      <button className="iv-btn pri" type="button" disabled={sibuk} onClick={() => jalankan(() => notifSetujui(db, user, n))}>{sibuk ? 'Menyimpan…' : 'Setujui'}</button>
      <button className="iv-btn" type="button" disabled={sibuk} onClick={() => setKembali(true)}>{j.aksiKembali}</button>
    </div>}
    {!kep && kembali && <>
      <textarea rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} placeholder={j.catatanWajib ? 'Catatan untuk operator (wajib)' : 'Catatan untuk operator (opsional)'} />
      <div className="a">
        <button className="iv-btn pri" type="button" disabled={sibuk || (j.catatanWajib && !catatan.trim())} onClick={() => jalankan(() => notifKembalikan(db, user, n, catatan))}>{sibuk ? 'Menyimpan…' : j.aksiKembali}</button>
        <button className="iv-btn" type="button" disabled={sibuk} onClick={() => { setKembali(false); setCatatan('') }}>Batal</button>
      </div></>}
  </div>
}

export function LaciNotif({ db, user, perlu, galat, onTutup, onLihat, onBerubah }: {
  db: any; user: any; perlu: Notifikasi[]; galat: string; onTutup: () => void; onLihat: (n: Notifikasi) => void; onBerubah: () => void
}) {
  const [mode, setMode] = useState<'perlu' | 'semua'>('perlu')
  const [semua, setSemua] = useState<Notifikasi[]>([])
  const [adaLagi, setAdaLagi] = useState(false)
  const [halaman, setHalaman] = useState(0)
  const [galatSemua, setGalatSemua] = useState('')
  const muatSemua = async (h: number) => {
    try { const r = await muatNotifHalaman(db, h); setSemua(s => h === 0 ? r.baris : [...s, ...r.baris]); setAdaLagi(r.adaLagi); setHalaman(h); setGalatSemua('') }
    catch (e: any) { console.error('[inventaris notif] riwayat gagal:', e); setGalatSemua('Gagal memuat: ' + pesanGalat(e)) }
  }
  // tab Semua dimuat ulang (halaman pertama) setiap daftar "perlu" berubah (realtime) - kartu yang sudah diputuskan ikut segar
  useEffect(() => { if (mode === 'semua') { const t = setTimeout(() => muatSemua(0), 0); return () => clearTimeout(t) } }, [mode, perlu]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onTutup() }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f) }, [onTutup])
  const baru = perlu.filter(n => n.status === 'baru')
  const daftar = mode === 'perlu' ? perlu : semua
  const berubah = () => { onBerubah(); if (mode === 'semua') muatSemua(0) }
  return createPortal(<div className="invm"><style>{CSS}</style>
    <div className="ivn-laci" onClick={e => { if (e.target === e.currentTarget) onTutup() }}>
      <div className="ivn-isi" role="dialog" aria-label="Notifikasi operator">
        <div className="ivn-kep"><h3>Tindakan operator</h3>
          {baru.length > 0 && <button className="iv-btn" type="button" onClick={() => notifDilihat(db, user, baru.map(n => n.id)).catch(e => alert(pesanGalat(e))).finally(onBerubah)}>Tandai semua dilihat</button>}
          <button className="iv-btn" type="button" onClick={onTutup} aria-label="Tutup">✕</button></div>
        <div className="ivn-tab">
          <button type="button" aria-pressed={mode === 'perlu'} onClick={() => setMode('perlu')}>Perlu ditinjau ({perlu.length})</button>
          <button type="button" aria-pressed={mode === 'semua'} onClick={() => setMode('semua')}>Semua</button>
        </div>
        <div className="ivn-daftar">
          {(mode === 'perlu' ? galat : galatSemua) && <div className="iv-err">{mode === 'perlu' ? galat : galatSemua}</div>}
          {!daftar.length && <div className="iv-empty">{mode === 'perlu' ? 'Tidak ada tindakan operator yang perlu ditinjau.' : 'Belum ada notifikasi.'}</div>}
          {daftar.map(n => <NotifKartu key={n.id + ':' + n.versi + ':' + n.status} n={n} user={user} db={db} onLihat={onLihat} onBerubah={berubah} />)}
          {mode === 'semua' && adaLagi && <button className="iv-btn" type="button" onClick={() => muatSemua(halaman + 1)}>Muat lagi</button>}
        </div>
      </div>
    </div></div>, document.body)
}

