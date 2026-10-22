// KENDALA - TAMPILAN ADMIN (23 Okt 2026). Gaya halaman Activity Log (artifact "Kendala Admin Log", revisi user): satu
// kartu penuh, baris filter + judul kolom KENDALA/STATUS/WAKTU, baris proyek (abu-abu) > panel (oranye) > kendala; HP <820px:
// STATUS & WAKTU pindah ke baris keterangan. Sebelumnya acuan artifact "Kendala Admin Sederhana" (keputusan user): judul + "+ Catat
// kendala", tab Belum selesai / Selesai / Semua (+jumlah) & filter proyek, daftar per proyek > panel (huruf kapital oranye)
// > kendala; lingkaran centang = tandai selesai / buka kembali (alasan otomatis); menu ⋯ = Ubah (belum selesai), Riwayat,
// Hapus (konfirmasi di baris, tanpa alasan). Lebar penuh area konten, rata kiri. Mode gelap ikut [data-theme="dark"]
// aplikasi (variabel --card-bg/--text-primary/...). Semua tombol ber-class "kdaBtn": aturan global mode gelap
// `[data-theme=dark] button:not([class*="Btn"])` (globalCss) tidak menimpa gaya tombol di sini. Data & aturan: lib/kendalaProduksi.ts (sama dgn vista-pekerja).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  muatProyekAktif, muatKendala, muatLogKendala, catatKendala, ubahKendala, hapusKendala, tandaiTeratasi, batalTeratasi,
  labelDivisi, fmtTanggalPanjang, fmtTanggalDariWaktu, fmtPendekDariWaktu, jamWib, tanggalHariIniWib, LABEL_AKSI_LOG,
  type Kendala, type ProyekAktif,
} from '../lib/kendalaProduksi'

const CSS = `
.kda{--kd-card:var(--card-bg,#fff);--kd-fg:var(--text-primary,#1b1f2a);--kd-mute:var(--text-muted,#7b8190);--kd-line:var(--border-color,#e6e8ed);
  --kd-head:var(--bg-secondary,#f6f7f9);--kd-grp:var(--bg-tertiary,#f1f3f6);--kd-ico:var(--bg-tertiary,#eef0f6);
  --kd-ok:#2f8f5b;--kd-ok-bg:#dff5e8;--kd-warn:#b45f06;--kd-warn-bg:#fdf0d5;--kd-bad:#c0392b;--kd-ink:#1b1f2a;--kd-ink-fg:#fff;--kd-focus:#d97706;
  color:var(--kd-fg);text-align:left;width:100%;font-size:14px;line-height:1.45}
[data-theme="dark"] .kda{--kd-ok:#4cc38a;--kd-ok-bg:#12301f;--kd-warn:#f0a04b;--kd-warn-bg:#3a2d14;--kd-bad:#f07b6e;--kd-ink:#e2e8f0;--kd-ink-fg:#0f1117;--kd-focus:#f0a04b}
.kda *{box-sizing:border-box}
.kda-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.kda h1{font-size:22px;font-weight:700;letter-spacing:-.02em;margin:0;color:var(--kd-fg)}
.kda .kda-btn{height:36px;padding:0 16px;border:0;border-radius:8px;background:var(--kd-ink);color:var(--kd-ink-fg);font-weight:600;font-size:14px;font-family:inherit;cursor:pointer;flex:none}
.kda .kda-btn:disabled{opacity:.3;cursor:default}
.kda .kda-ghost{height:34px;padding:0 12px;border:0;background:none;color:var(--kd-mute);font-weight:500;font-size:14px;font-family:inherit;cursor:pointer}
.kda-card{background:var(--kd-card);border:1px solid var(--kd-line);border-radius:10px;overflow:hidden}
.kda-tb{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--kd-line)}
.kda-seg{display:flex;border:1px solid var(--kd-line);border-radius:8px;overflow:hidden;max-width:100%}
.kda .kda-seg button{height:34px;padding:0 14px;border:0;border-right:1px solid var(--kd-line);background:var(--kd-card);color:var(--kd-fg);font-weight:500;font-size:13px;font-family:inherit;cursor:pointer;white-space:nowrap}
.kda .kda-seg button:last-child{border-right:0}
.kda .kda-seg button[aria-selected="true"]{background:var(--kd-ink);color:var(--kd-ink-fg)}
.kda-seg span{opacity:.6;margin-left:4px;font-weight:400}
.kda select,.kda textarea,.kda input{font:inherit;font-size:13px;color:var(--kd-fg);background:var(--kd-card);border:1px solid var(--kd-line);border-radius:8px}
.kda select{height:34px;padding:0 10px;max-width:100%;min-width:0}
.kda select:focus,.kda textarea:focus,.kda input:focus{outline:2px solid var(--kd-focus);outline-offset:-1px}
.kda-cnt{margin-left:auto;color:var(--kd-mute);font-size:13px;white-space:nowrap}
.kda-row{display:grid;grid-template-columns:72px minmax(0,1fr) 180px 190px 56px;align-items:center}
.kda-hd{background:var(--kd-head);border-bottom:1px solid var(--kd-line);font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--kd-mute);padding-block:11px}
.kda-gp{background:var(--kd-grp);border-bottom:1px solid var(--kd-line);padding:10px 16px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-weight:700;font-size:14px;overflow-wrap:anywhere}
.kda-gq{border-bottom:1px solid var(--kd-line);padding:9px 16px 9px 88px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-weight:700;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--kd-warn);overflow-wrap:anywhere}
.kda-gp small,.kda-gq small{color:var(--kd-mute);font-weight:400;font-size:12.5px;text-transform:none;letter-spacing:0}
.kda-it{border-bottom:1px solid var(--kd-line);padding-block:14px}
.kda-ic{display:flex;justify-content:center;align-self:start}
.kda .kda-ck{width:34px;height:34px;border-radius:9px;border:0;background:var(--kd-ico);display:grid;place-items:center;cursor:pointer;padding:0}
.kda .kda-ck:disabled{cursor:wait;opacity:.6}
.kda-ck i{width:18px;height:18px;border-radius:50%;border:1.8px solid var(--kd-mute);display:grid;place-items:center;color:transparent}
.kda .kda-ck:hover i{border-color:var(--kd-ok);color:var(--kd-ok)}
.kda-it.done .kda-ck i{background:var(--kd-ok);border-color:var(--kd-ok);color:#fff}
.kda-cn{min-width:0;padding-right:16px}
.kda-tx{font-weight:600;overflow-wrap:anywhere;white-space:pre-wrap}
.kda-it.done .kda-tx{color:var(--kd-mute);font-weight:400;text-decoration:line-through;text-decoration-color:var(--kd-line)}
.kda-mt{color:var(--kd-mute);font-size:12.5px;margin-top:3px;overflow-wrap:anywhere}
.kda-mob{display:none}
.kda-stc{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:0}
.kda-pill{display:inline-flex;align-items:center;height:22px;padding:0 10px;border-radius:11px;font-size:12px;font-weight:600;white-space:nowrap}
.kda-pill.w{background:var(--kd-warn-bg);color:var(--kd-warn)}
.kda-pill.o{background:var(--kd-ok-bg);color:var(--kd-ok)}
.kda-sd{color:var(--kd-mute);font-size:12px}
.kda-wk{color:var(--kd-mute);font-size:12.5px;text-align:right;padding-right:6px;white-space:nowrap}
.kda-mc{text-align:center;align-self:start}
.kda .kda-more{border:0;background:none;color:var(--kd-mute);font-size:18px;line-height:1;cursor:pointer;height:28px;width:34px;border-radius:6px;padding:0}
.kda .kda-more:hover{background:var(--kd-grp);color:var(--kd-fg)}
.kda-ac{display:flex;gap:14px;margin-top:8px;font-size:13px;flex-wrap:wrap;align-items:center}
.kda .kda-ac button{border:0;background:none;padding:0;font-weight:500;font-size:13px;font-family:inherit;color:var(--kd-mute);cursor:pointer}
.kda .kda-ac button:hover{color:var(--kd-fg)}
.kda .kda-ac .bad,.kda-ac .bad{color:var(--kd-bad)}
.kda-hs{margin-top:6px;color:var(--kd-mute);font-size:12.5px}
.kda-ed{display:flex;gap:8px;flex-wrap:wrap}
.kda-ed input{flex:1 1 220px;min-width:0;height:34px;padding:0 10px}
.kda-empty{padding:44px 16px;color:var(--kd-mute);text-align:center}
.kda-err{color:var(--kd-bad);font-size:13px;padding:10px 16px;border-bottom:1px solid var(--kd-line)}
.kda-form{padding:14px 16px;border-bottom:1px solid var(--kd-line);background:var(--kd-head);display:flex;flex-direction:column;gap:10px}
.kda-form .two{display:flex;gap:8px;flex-wrap:wrap}.kda-form .two select{flex:1 1 200px}
.kda-form textarea{width:100%;min-height:66px;padding:10px;resize:vertical}
.kda-form .foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;color:var(--kd-mute);font-size:13px}
.kda-form .foot b{color:var(--kd-fg);font-weight:500}
.kda-fa{display:flex;gap:8px}
@media (max-width:820px){
  .kda-row{grid-template-columns:56px minmax(0,1fr) 40px}
  .kda-hd,.kda-stc,.kda-wk,.kda-cnt{display:none}
  .kda-mob{display:block}
  .kda-gq{padding-left:16px}
}
`

type Tab = 'open' | 'done' | 'all'
const CENTANG = <i><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 6.5l2.6 2.6L10 3.4" /></svg></i>
const BLN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
// Kolom WAKTU: "22 Okt 2026 · 20.26 WIB" (tanggal hari pencatatan + jam WIB).
const fmtWaktu = (k: Kendala) => { const [y, m, d] = k.tanggal.split('-').map(Number); return `${d} ${BLN3[m - 1]} ${y} · ${jamWib(k.dicatat_pada)} WIB` }
// Judul panel: "PANEL ..." (nama yang sudah diawali PANEL tidak digandakan; Umum tetap UMUM).
const judulPanel = (n: string, id: number | null) => id == null || /^panel\b/i.test(n) ? n : 'Panel ' + n

export function KendalaAdmin({ db, user }: { db: any; user: any }) {
  const nama = String(user?.nama || user?.name || '').trim()
  const [proyekAktif, setProyekAktif] = useState<ProyekAktif[]>([])
  const [daftar, setDaftar] = useState<Kendala[]>([])
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('open')
  const [fp, setFp] = useState('')
  const [form, setForm] = useState<{ proyek: string; panel: string; teks: string } | null>(null)
  const [menu, setMenu] = useState<number | null>(null)
  const [hapusId, setHapusId] = useState<number | null>(null)
  const [edit, setEdit] = useState<{ id: number; teks: string } | null>(null)
  const [riwayat, setRiwayat] = useState<Record<number, any[] | 'memuat'>>({})
  const [sibuk, setSibuk] = useState<string | null>(null)

  const muat = useCallback(async () => {
    try {
      const [pa, k] = await Promise.all([muatProyekAktif(db), muatKendala(db)])
      setProyekAktif(pa); setDaftar(k); setGalat(null)
    } catch (e: any) { console.error('[Kendala admin] gagal memuat:', e); setGalat('Gagal memuat kendala: ' + (e?.message || e)) }
    finally { setMemuat(false) }
  }, [db])
  useEffect(() => { muat() }, [muat])
  const tunda = useRef<any>(null)
  useEffect(() => {
    const ch = db.channel('kendala-admin-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kendala_produksi' }, () => { clearTimeout(tunda.current); tunda.current = setTimeout(muat, 600) })
      .subscribe()
    return () => { clearTimeout(tunda.current); db.removeChannel(ch) }
  }, [db, muat])

  const jalankan = async (label: string, fn: () => Promise<any>) => {
    setSibuk(label)
    try { await fn(); await muat(); return true }
    catch (e: any) { console.error('[Kendala admin] ' + label + ' gagal:', e); alert('Gagal ' + label + ':\n' + (e?.message || e)); return false }
    finally { setSibuk(null) }
  }

  const nOpen = daftar.filter(k => !k.teratasi_pada).length
  const cocokTab = (k: Kendala) => tab === 'all' || (tab === 'open' ? !k.teratasi_pada : !!k.teratasi_pada)
  // Urutan proyek: proyek aktif (abjad) lalu proyek lain yang hanya ada di kendala (arsip/dihapus). Panel: Umum, lalu
  // panel aktif (no_pnl), lalu panel lain dari snapshot kendala.
  const urutanProyek = useMemo(() => {
    const aktif = proyekAktif.map(p => p.proyek)
    const lain = [...new Set(daftar.map(k => k.proyek).filter(p => !aktif.includes(p)))].sort()
    return [...aktif, ...lain]
  }, [proyekAktif, daftar])
  const grup = useMemo(() => {
    const rows = daftar.filter(k => cocokTab(k) && (!fp || k.proyek === fp))
    return urutanProyek.map(pr => {
      const rp = rows.filter(k => k.proyek === pr).sort((a, b) => (b.dicatat_pada || '').localeCompare(a.dicatat_pada || '') || b.id - a.id)
      if (!rp.length) return null
      const pa = proyekAktif.find(p => p.proyek === pr)
      const urutPanel: (number | null)[] = [null, ...(pa?.panels.map(p => p.id) || [])]
      rp.forEach(k => { if (!urutPanel.includes(k.panel_id)) urutPanel.push(k.panel_id) })
      const panels = urutPanel.map(id => {
        const rk = rp.filter(k => k.panel_id === id)
        if (!rk.length) return null
        const namaPanel = id == null ? 'Umum' : (pa?.panels.find(p => p.id === id)?.nama || rk[0].panel_nama || `Panel #${id}`)
        return { id, nama: namaPanel, rows: rk }
      }).filter(Boolean) as { id: number | null; nama: string; rows: Kendala[] }[]
      return { proyek: pr, jumlah: rp.length, panels }
    }).filter(Boolean) as { proyek: string; jumlah: number; panels: { id: number | null; nama: string; rows: Kendala[] }[] }[]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daftar, tab, fp, urutanProyek, proyekAktif])

  const bukaForm = () => {
    if (form) { setForm(null); return }
    const pr = fp && proyekAktif.some(p => p.proyek === fp) ? fp : (proyekAktif[0]?.proyek || '')
    setForm({ proyek: pr, panel: '', teks: '' })
  }
  const kirimForm = async () => {
    if (!form || form.teks.trim().length < 3 || !form.proyek) return
    if (!nama) { alert('Nama pengguna tidak terbaca - masuk ulang dulu.'); return }
    const ok = await jalankan('mencatat kendala', () => catatKendala(db, { proyek: form.proyek, panelId: form.panel ? Number(form.panel) : null, teks: form.teks.trim(), oleh: nama, divisi: 'admin', admin: true }))
    if (ok) { setForm(null); if (tab === 'done') setTab('open') }
  }
  const togelSelesai = (k: Kendala) => jalankan(k.teratasi_pada ? 'membuka kembali kendala' : 'menandai selesai',
    () => k.teratasi_pada ? batalTeratasi(db, k.id, nama) : tandaiTeratasi(db, k.id, nama))
  const togelRiwayat = async (id: number) => {
    if (riwayat[id]) { setRiwayat(r => { const n = { ...r }; delete n[id]; return n }); return }
    setRiwayat(r => ({ ...r, [id]: 'memuat' }))
    try { const log = await muatLogKendala(db, id); setRiwayat(r => ({ ...r, [id]: log })) }
    catch (e: any) { console.error('[Kendala admin] riwayat gagal:', e); alert('Gagal memuat riwayat: ' + (e?.message || e)); setRiwayat(r => { const n = { ...r }; delete n[id]; return n }) }
  }
  const panelForm = proyekAktif.find(p => p.proyek === form?.proyek)?.panels || []

  const item = (k: Kendala) => {
    const done = !!k.teratasi_pada
    const status = done
      ? <><span className="kda-pill o">Selesai</span><span className="kda-sd">{fmtPendekDariWaktu(k.teratasi_pada!)} · {jamWib(k.teratasi_pada!)} · {k.teratasi_oleh}</span></>
      : <span className="kda-pill w">Belum selesai</span>
    return (
      <div key={k.id} className={'kda-row kda-it' + (done ? ' done' : '')}>
        <div className="kda-ic">
          <button className="kda-ck kdaBtn" disabled={!!sibuk} onClick={() => togelSelesai(k)} aria-label={done ? 'Buka kembali' : 'Tandai selesai'} title={done ? 'Buka kembali' : 'Tandai selesai'}>{CENTANG}</button>
        </div>
        <div className="kda-cn">
          {edit?.id === k.id ? (
            <div className="kda-ed">
              <input value={edit.teks} onChange={e => setEdit({ id: k.id, teks: e.target.value })} aria-label="Ubah kendala" autoFocus />
              <button className="kda-btn kdaBtn" disabled={!!sibuk || edit.teks.trim().length < 3} onClick={async () => { const ok = await jalankan('mengubah kendala', () => ubahKendala(db, k.id, edit.teks.trim(), nama, true)); if (ok) setEdit(null) }}>Simpan</button>
              <button className="kda-ghost kdaBtn" onClick={() => setEdit(null)}>Batal</button>
            </div>
          ) : <div className="kda-tx">{k.teks}</div>}
          <div className="kda-mt">
            {k.pencatat} · {labelDivisi(k.divisi)}{k.diubah_pada ? ' · diubah' : ''}
            {/* HP (<820px): STATUS & WAKTU pindah ke baris keterangan ini */}
            <div className="kda-mob">{fmtWaktu(k)} · {done ? <span style={{ color: 'var(--kd-ok)' }}>Selesai {fmtPendekDariWaktu(k.teratasi_pada!)} · {jamWib(k.teratasi_pada!)} · {k.teratasi_oleh}</span> : <span style={{ color: 'var(--kd-warn)' }}>Belum selesai</span>}</div>
          </div>
          {menu === k.id && (hapusId === k.id ? (
            <div className="kda-ac"><span className="bad">Hapus kendala ini?</span>
              <button className="bad kdaBtn" disabled={!!sibuk} onClick={async () => { const ok = await jalankan('menghapus kendala', () => hapusKendala(db, k.id, nama, true, null)); if (ok) { setHapusId(null); setMenu(null) } }}>Ya, hapus</button>
              <button className="kdaBtn" onClick={() => setHapusId(null)}>Batal</button>
            </div>
          ) : (
            <div className="kda-ac">
              {!done && <button className="kdaBtn" onClick={() => { setEdit({ id: k.id, teks: k.teks }); setMenu(null) }}>Ubah</button>}
              <button className="kdaBtn" onClick={() => togelRiwayat(k.id)}>{riwayat[k.id] ? 'Tutup riwayat' : 'Riwayat'}</button>
              <button className="bad kdaBtn" onClick={() => setHapusId(k.id)}>Hapus</button>
            </div>
          ))}
          {riwayat[k.id] && (
            <div className="kda-hs">
              {riwayat[k.id] === 'memuat' ? 'Memuat…' : (() => {
                // Dicatat (dari baris) + jejak log (ubah/selesai/buka kembali/...); data migrasi: selesai dari baris.
                const log = (riwayat[k.id] as any[]).filter(l => l.aksi !== 'catat')
                return <>
                  <div>Dicatat {fmtTanggalPanjang(k.tanggal)}, {jamWib(k.dicatat_pada)} oleh {k.pencatat}</div>
                  {log.map(l => <div key={l.id}>{LABEL_AKSI_LOG[l.aksi] || l.aksi} {fmtTanggalDariWaktu(l.waktu)}, {jamWib(l.waktu)} oleh {l.oleh}{l.aksi === 'batal_teratasi' && l.alasan ? ` (${l.alasan})` : ''}</div>)}
                  {done && !log.some(l => l.aksi === 'teratasi') && <div>Ditandai selesai {fmtTanggalDariWaktu(k.teratasi_pada!)}, {jamWib(k.teratasi_pada!)} oleh {k.teratasi_oleh}</div>}
                </>
              })()}
            </div>
          )}
        </div>
        <div className="kda-stc">{status}</div>
        <div className="kda-wk">{fmtWaktu(k)}</div>
        <div className="kda-mc">
          <button className="kda-more kdaBtn" onClick={() => { setMenu(menu === k.id ? null : k.id); setHapusId(null) }} aria-label="Lainnya" aria-expanded={menu === k.id}>⋯</button>
        </div>
      </div>
    )
  }

  const jumlahTampil = grup.reduce((a, g) => a + g.jumlah, 0)
  return (
    <div className="kda">
      <style>{CSS}</style>
      <div className="kda-top"><h1>Kendala</h1><button className="kda-btn kdaBtn" onClick={bukaForm} aria-expanded={!!form}>+ Catat kendala</button></div>
      <div className="kda-card">
        {form && (
          <div className="kda-form">
            <div className="two">
              <select aria-label="Proyek" value={form.proyek} onChange={e => setForm({ ...form, proyek: e.target.value, panel: '' })}>
                {proyekAktif.map(p => <option key={p.proyek} value={p.proyek}>{p.proyek}</option>)}
              </select>
              <select aria-label="Panel" value={form.panel} onChange={e => setForm({ ...form, panel: e.target.value })}>
                <option value="">Umum</option>
                {panelForm.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </select>
            </div>
            <textarea placeholder="Tulis kendala…" value={form.teks} onChange={e => setForm({ ...form, teks: e.target.value })} aria-label="Kendala" />
            <div className="foot">
              <span>Tercatat: <b>{fmtTanggalPanjang(tanggalHariIniWib())}</b> · {nama || '-'}</span>
              <span className="kda-fa">
                <button className="kda-ghost kdaBtn" onClick={() => setForm(null)}>Batal</button>
                <button className="kda-btn kdaBtn" disabled={!!sibuk || form.teks.trim().length < 3 || !form.proyek} onClick={kirimForm}>{sibuk === 'mencatat kendala' ? 'Menyimpan…' : 'Catat kendala'}</button>
              </span>
            </div>
          </div>
        )}
        <div className="kda-tb">
          <div className="kda-seg" role="tablist">
            {([['open', 'Belum selesai', nOpen], ['done', 'Selesai', daftar.length - nOpen], ['all', 'Semua', daftar.length]] as [Tab, string, number][]).map(([t, l, n]) => (
              <button className="kdaBtn" key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{l}<span>{n}</span></button>
            ))}
          </div>
          <select aria-label="Filter proyek" value={fp} onChange={e => setFp(e.target.value)}>
            <option value="">Semua proyek</option>
            {urutanProyek.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <span className="kda-cnt">{jumlahTampil} kendala</span>
        </div>
        <div className="kda-row kda-hd"><div /><div>Kendala</div><div>Status</div><div style={{ textAlign: 'right', paddingRight: 6 }}>Waktu</div><div /></div>
        {galat && <div className="kda-err">{galat} <button className="kda-ghost kdaBtn" onClick={() => { setMemuat(true); muat() }}>Coba lagi</button></div>}
        {memuat ? <div className="kda-empty">Memuat…</div> : grup.length === 0 ? (
          <div className="kda-empty">{tab === 'open' ? 'Tidak ada kendala yang belum selesai.' : 'Tidak ada kendala.'}</div>
        ) : grup.map(g => (
          <div key={g.proyek}>
            <div className="kda-gp">{g.proyek}<small>{g.jumlah} kendala</small></div>
            {g.panels.map(pn => (
              <div key={String(pn.id)}>
                <div className="kda-gq">{judulPanel(pn.nama, pn.id)}<small>{pn.rows.length} kendala</small></div>
                {pn.rows.map(item)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
