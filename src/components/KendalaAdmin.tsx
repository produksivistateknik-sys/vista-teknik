// KENDALA - TAMPILAN ADMIN (23 Okt 2026). Acuan: artifact "Kendala Admin Sederhana" (keputusan user): judul + "+ Catat
// kendala", tab Belum selesai / Selesai / Semua (+jumlah) & filter proyek, daftar per proyek > panel (huruf kapital oranye)
// > kendala; lingkaran centang = tandai selesai / buka kembali (alasan otomatis); menu ⋯ = Ubah (belum selesai), Riwayat,
// Hapus (konfirmasi di baris, tanpa alasan). Lebar penuh area konten, rata kiri. Mode gelap ikut [data-theme="dark"]
// aplikasi (variabel --card-bg/--text-primary/...). Semua tombol ber-class "kdaBtn": aturan global mode gelap
// `[data-theme=dark] button:not([class*="Btn"])` (globalCss) tidak menimpa gaya tombol di sini. Data & aturan: lib/kendalaProduksi.ts (sama dgn vista-pekerja).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  muatProyekAktif, muatKendala, muatLogKendala, catatKendala, ubahKendala, hapusKendala, tandaiTeratasi, batalTeratasi,
  labelDivisi, fmtTanggalPanjang, fmtTanggalPendek, fmtTanggalDariWaktu, jamWib, teksSelesai, tanggalHariIniWib, LABEL_AKSI_LOG,
  type Kendala, type ProyekAktif,
} from '../lib/kendalaProduksi'

const CSS = `
.kda{--kd-card:var(--card-bg,#fff);--kd-fg:var(--text-primary,#1d1f23);--kd-mute:var(--text-muted,#7a7f87);--kd-line:var(--border-color,#e8e8e4);
  --kd-ok:#2f8f5b;--kd-warn:#c26a0a;--kd-bad:#c0392b;--kd-ink:#1d1f23;--kd-ink-fg:#fff;--kd-focus:#d97706;
  color:var(--kd-fg);text-align:left;width:100%;max-width:none;padding:4px 0 48px;font-size:15px;line-height:1.5}
[data-theme="dark"] .kda{--kd-ok:#4cc38a;--kd-warn:#f0a04b;--kd-bad:#f07b6e;--kd-ink:#e2e8f0;--kd-ink-fg:#0f1117;--kd-focus:#f0a04b}
.kda *{box-sizing:border-box}
.kda-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px}
.kda h1{font-size:24px;font-weight:700;letter-spacing:-.02em;margin:0;color:var(--kd-fg)}
.kda-btn{height:36px;padding:0 16px;border:0;border-radius:8px;background:var(--kd-ink);color:var(--kd-ink-fg);font-weight:600;font-size:14px;font-family:inherit;cursor:pointer;flex:none}
.kda-btn:disabled{opacity:.3;cursor:default}
.kda-ghost{height:36px;padding:0 12px;border:0;background:none;color:var(--kd-mute);font-weight:500;font-size:14px;font-family:inherit;cursor:pointer}
.kda-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.kda-tabs{display:flex;gap:20px;flex-wrap:wrap}
.kda-tabs button{border:0;background:none;padding:6px 0;font-weight:500;font-size:14px;font-family:inherit;color:var(--kd-mute);cursor:pointer;border-bottom:2px solid transparent}
.kda-tabs button[aria-selected="true"]{color:var(--kd-fg);border-color:var(--kd-fg)}
.kda-tabs span{color:var(--kd-mute);font-weight:400;margin-left:4px}
.kda select,.kda textarea,.kda input{font:inherit;font-size:14px;color:var(--kd-fg);background:var(--kd-card);border:1px solid var(--kd-line);border-radius:8px}
.kda select{height:34px;padding:0 8px;max-width:100%}
.kda select:focus,.kda textarea:focus,.kda input:focus{outline:2px solid var(--kd-focus);outline-offset:-1px}
.kda-form{background:var(--kd-card);border:1px solid var(--kd-line);border-radius:10px;padding:14px;margin:10px 0 6px;display:flex;flex-direction:column;gap:10px}
.kda-form .two{display:flex;gap:8px;flex-wrap:wrap}.kda-form .two select{flex:1 1 180px;min-width:0}
.kda-form textarea{width:100%;min-height:70px;padding:10px;resize:vertical}
.kda-form .foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;color:var(--kd-mute);font-size:13px}
.kda-form .foot b{color:var(--kd-fg);font-weight:500}
.kda-fa{display:flex;gap:8px}
.kda-grp{margin-top:26px}
.kda-gh{display:flex;align-items:baseline;gap:8px;padding-bottom:8px;border-bottom:1px solid var(--kd-line);flex-wrap:wrap}
.kda-gh h2{font-size:15px;font-weight:700;margin:0;color:var(--kd-fg)}
.kda-gh small,.kda-pn small{color:var(--kd-mute);font-size:13px}
.kda-pn{display:flex;align-items:baseline;gap:8px;margin-top:18px;padding-bottom:2px;flex-wrap:wrap}
.kda-pn h3{font-size:13px;font-weight:700;margin:0;text-transform:uppercase;letter-spacing:.04em;color:var(--kd-warn);overflow-wrap:anywhere}
.kda-it{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--kd-line)}
.kda-ck{flex:none;width:22px;height:22px;margin-top:1px;border-radius:50%;border:1.8px solid var(--kd-mute);background:none;cursor:pointer;display:grid;place-items:center;color:transparent;padding:0}
.kda-ck:hover{border-color:var(--kd-ok);color:var(--kd-ok)}
.kda-ck:disabled{cursor:wait;opacity:.6}
.kda-it.done .kda-ck{background:var(--kd-ok);border-color:var(--kd-ok);color:#fff}
.kda-cn{flex:1;min-width:0}
.kda-tx{font-weight:500;overflow-wrap:anywhere;white-space:pre-wrap}
.kda-it.done .kda-tx{color:var(--kd-mute);font-weight:400;text-decoration:line-through;text-decoration-color:var(--kd-line)}
.kda-mt{color:var(--kd-mute);font-size:13px;margin-top:2px;overflow-wrap:anywhere}
.kda-okt{color:var(--kd-ok)}
.kda-more{border:0;background:none;color:var(--kd-mute);font-size:18px;line-height:1;cursor:pointer;padding:0 6px;height:24px;border-radius:6px;align-self:flex-start;flex:none}
.kda-more:hover{background:var(--kd-line);color:var(--kd-fg)}
.kda-ac{display:flex;gap:14px;margin-top:8px;font-size:13px;flex-wrap:wrap;align-items:center}
.kda-ac button{border:0;background:none;padding:0;font-weight:500;font-size:13px;font-family:inherit;color:var(--kd-mute);cursor:pointer}
.kda-ac button:hover{color:var(--kd-fg)}
.kda-ac .bad{color:var(--kd-bad)}
.kda-hs{margin-top:6px;color:var(--kd-mute);font-size:12.5px}
.kda-ed{display:flex;gap:8px;margin-top:6px;flex-wrap:wrap}
.kda-ed input{flex:1 1 200px;min-width:0;height:34px;padding:0 10px}
.kda-empty{padding:40px 0;color:var(--kd-mute);text-align:center}
.kda-err{color:var(--kd-bad);font-size:13px;margin:8px 0}
`

type Tab = 'open' | 'done' | 'all'
const CENTANG = <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 6.5l2.6 2.6L10 3.4" /></svg>

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
    return (
      <div key={k.id} className={'kda-it' + (done ? ' done' : '')}>
        <button className="kda-ck kdaBtn" disabled={!!sibuk} onClick={() => togelSelesai(k)} aria-label={done ? 'Buka kembali' : 'Tandai selesai'} title={done ? 'Buka kembali' : 'Tandai selesai'}>{CENTANG}</button>
        <div className="kda-cn">
          {edit?.id === k.id ? (
            <div className="kda-ed">
              <input value={edit.teks} onChange={e => setEdit({ id: k.id, teks: e.target.value })} aria-label="Ubah kendala" autoFocus />
              <button className="kda-btn kdaBtn" disabled={!!sibuk || edit.teks.trim().length < 3} onClick={async () => { const ok = await jalankan('mengubah kendala', () => ubahKendala(db, k.id, edit.teks.trim(), nama, true)); if (ok) setEdit(null) }}>Simpan</button>
              <button className="kda-ghost kdaBtn" onClick={() => setEdit(null)}>Batal</button>
            </div>
          ) : <div className="kda-tx">{k.teks}</div>}
          <div className="kda-mt">
            {fmtTanggalPendek(k.tanggal)}, {jamWib(k.dicatat_pada)} · {k.pencatat} ({labelDivisi(k.divisi)}){k.diubah_pada ? ' · diubah' : ''}
            {done && <> · <span className="kda-okt">{teksSelesai(k)}</span></>}
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
        <button className="kda-more kdaBtn" onClick={() => { setMenu(menu === k.id ? null : k.id); setHapusId(null) }} aria-label="Lainnya" aria-expanded={menu === k.id}>⋯</button>
      </div>
    )
  }

  return (
    <div className="kda">
      <style>{CSS}</style>
      <div className="kda-head"><h1>Kendala</h1><button className="kda-btn kdaBtn" onClick={bukaForm} aria-expanded={!!form}>+ Catat kendala</button></div>
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
      <div className="kda-bar">
        <div className="kda-tabs" role="tablist">
          {([['open', 'Belum selesai', nOpen], ['done', 'Selesai', daftar.length - nOpen], ['all', 'Semua', daftar.length]] as [Tab, string, number][]).map(([t, l, n]) => (
            <button className="kdaBtn" key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{l}<span>{n}</span></button>
          ))}
        </div>
        <select aria-label="Filter proyek" value={fp} onChange={e => setFp(e.target.value)}>
          <option value="">Semua proyek</option>
          {urutanProyek.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {galat && <div className="kda-err">{galat} <button className="kda-ghost kdaBtn" onClick={() => { setMemuat(true); muat() }}>Coba lagi</button></div>}
      {memuat ? <div className="kda-empty">Memuat…</div> : grup.length === 0 ? (
        <div className="kda-empty">{tab === 'open' ? 'Tidak ada kendala yang belum selesai.' : 'Tidak ada kendala.'}</div>
      ) : grup.map(g => (
        <section key={g.proyek} className="kda-grp">
          <div className="kda-gh"><h2>{g.proyek}</h2><small>{g.jumlah} kendala</small></div>
          {g.panels.map(pn => (
            <div key={String(pn.id)}>
              <div className="kda-pn"><h3>{pn.nama}</h3><small>{pn.rows.length} kendala</small></div>
              {pn.rows.map(item)}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
