// CATATAN - subtab di menu "Kendala dan Catatan" (8 Nov 2026, permintaan user). Admin Produksi mencatat info yang didengar
// tentang panel/proyek (permintaan customer, perubahan, kabar jadwal) supaya tidak mengandalkan ingatan. Data & aturan:
// lib/panelCatatan.ts (RPC catatan_*, migration 20261108010000). Tampilan memakai kelas kartu yang sama dgn subtab Kendala
// (styles/kartuPanelCss): satu kartu per panel + kartu "Catatan umum proyek"; kartu yang punya catatan penting aktif naik ke atas
// & kuning lembut. Penting = disematkan. Tidak ada hapus: "Sudah ditindaklanjuti" mencoret & menyembunyikan dari tampilan Aktif.
// Inti masalah teks bebas (saran dari yang pernah dipakai), tanpa pengelompokan jenis. Ringkasan & jumlah status ikut pencarian.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { pasangPemulihRealtime } from '../lib/pemulihRealtime'
import { muatProyekAktif, fmtPendekDariWaktu, jamWib, type ProyekAktif } from '../lib/kendalaProduksi'
import {
  muatCatatan, simpanCatatan, ubahCatatan, setPentingCatatan, setStatusCatatan, validIsi, saranInti, umurHari, cocokCari,
  BATAS_INTI, BATAS_ISI, BATAS_SUMBER, UMUR_BASI_HARI, TABEL_SINYAL, type Catatan, type IsiCatatan,
} from '../lib/panelCatatan'
import { CSS_KARTU_PANEL } from '../styles/kartuPanelCss'

const CSS = CSS_KARTU_PANEL + `
.kda-kt.n-penting{background:var(--ks-nb-penting);box-shadow:inset 0 5px 0 var(--ks-penting)}
.kda-kt.n-netral{background:var(--kd-head)}
.kda-pill.p{background:var(--ks-penting-soft);color:var(--ks-penting)}
.kda-pill.n{background:var(--kd-grp);color:var(--kd-mute)}
.kda-it.pin{border-color:var(--ks-penting);box-shadow:inset 3px 0 0 var(--ks-penting)}
.kct-inti{font-weight:800;overflow-wrap:anywhere;min-width:0}
.kct-inti .bt{color:var(--ks-penting);margin-right:4px}
.kct-isi{margin-top:4px;white-space:pre-wrap;overflow-wrap:anywhere}
.kct-isi.lipat{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.kda .kct-sel{border:0;background:none;padding:0;margin-top:2px;color:var(--kd-mute);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.kct-dari{margin-top:4px;font-size:12.5px;color:var(--kd-mute);overflow-wrap:anywhere}
.kct-dari b{color:var(--kd-fg);font-weight:600}
.kda-it.done .kct-inti,.kda-it.done .kct-isi{text-decoration:line-through;text-decoration-color:var(--kd-mute);color:var(--kd-mute)}
.kda-chip.basi{border-color:var(--kd-warn);color:var(--kd-warn);background:var(--kd-warn-bg)}
.kct-cari{height:34px;padding:0 10px;flex:1 1 220px;min-width:0;max-width:360px}
.kct-f{display:flex;flex-direction:column;gap:8px}
.kct-f input[type=text],.kct-f textarea{width:100%;padding:8px 10px}
.kct-f textarea{min-height:76px;resize:vertical}
.kct-f label.cb{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--kd-fg);cursor:pointer}
.kct-f .hit{font-size:11.5px;color:var(--kd-mute);text-align:right}
`

type Tab = 'aktif' | 'ditindaklanjuti' | 'semua'
type Kartu = { kunci: string; proyek: string; id: number | null; nama: string; wo: string | null; rows: Catatan[]; aktif: number; penting: number; panelNonaktif: boolean; proyekNonaktif: boolean }
const MAKS_ITEM = 10
const kosongIsi = (proyek = ''): IsiCatatan => ({ proyek, panelId: null, inti: '', isi: '', sumberInfo: '', penting: false })
const waktu = (iso: string) => `${fmtPendekDariWaktu(iso)} · ${jamWib(iso)} WIB`

// Form catat/ubah (dipakai di atas utk catatan baru & di dalam kotak utk ubah).
function FormCatatan({ awal, proyekAktif, saran, panelLama, sibuk, judulSimpan, onBatal, onSimpan }: {
  awal: IsiCatatan; proyekAktif: ProyekAktif[]; saran: string[]; panelLama?: { id: number; nama: string } | null; sibuk: boolean
  judulSimpan: string; onBatal: () => void; onSimpan: (x: IsiCatatan) => void
}) {
  const [x, setX] = useState<IsiCatatan>(awal)
  const daftarProyek = proyekAktif.some(p => p.proyek === x.proyek) || !x.proyek ? proyekAktif.map(p => p.proyek) : [x.proyek, ...proyekAktif.map(p => p.proyek)]
  const panels = proyekAktif.find(p => p.proyek === x.proyek)?.panels || []
  const panelTambahan = panelLama && !panels.some(p => p.id === panelLama.id) && x.proyek === awal.proyek ? [panelLama] : []
  const idDl = 'kct-saran-' + (panelLama?.id ?? 'baru')
  return (
    <div className="kda-form kct-f">
      <div className="two">
        <select aria-label="Proyek" value={x.proyek} onChange={e => setX({ ...x, proyek: e.target.value, panelId: null })}>
          {!x.proyek && <option value="">Pilih proyek…</option>}
          {daftarProyek.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select aria-label="Panel" value={x.panelId ?? ''} onChange={e => setX({ ...x, panelId: e.target.value ? Number(e.target.value) : null })}>
          <option value="">Catatan umum proyek</option>
          {panels.map(p => <option key={p.id} value={p.id}>{p.nama}{panels.filter(q => q.nama.trim().toUpperCase() === p.nama.trim().toUpperCase()).length > 1 ? ` (WO ${p.wo})` : ''}</option>)}
          {panelTambahan.map(p => <option key={p.id} value={p.id}>{p.nama} (panel tidak aktif)</option>)}
        </select>
      </div>
      <input type="text" list={idDl} maxLength={BATAS_INTI} placeholder="Inti masalah, mis. Menunggu approval" aria-label="Inti masalah" value={x.inti} onChange={e => setX({ ...x, inti: e.target.value })} />
      <datalist id={idDl}>{saran.slice(0, 30).map(s => <option key={s} value={s} />)}</datalist>
      <textarea maxLength={BATAS_ISI} placeholder="Isi catatan, mis. Menunggu approval dari klien untuk gambar rev.2" aria-label="Isi catatan" value={x.isi} onChange={e => setX({ ...x, isi: e.target.value })} />
      <input type="text" maxLength={BATAS_SUMBER} placeholder="Dari siapa (boleh kosong), mis. Customer lewat Sales" aria-label="Dari siapa" value={x.sumberInfo} onChange={e => setX({ ...x, sumberInfo: e.target.value })} />
      <div className="foot">
        <label className="cb"><input type="checkbox" checked={x.penting} onChange={e => setX({ ...x, penting: e.target.checked })} /> ★ Penting (disematkan)</label>
        <span className="kda-fa">
          <button className="kda-ghost kdaBtn" onClick={onBatal}>Batal</button>
          <button className="kda-btn kdaBtn" disabled={sibuk || !validIsi(x)} onClick={() => onSimpan(x)}>{sibuk ? 'Menyimpan…' : judulSimpan}</button>
        </span>
      </div>
    </div>
  )
}

export function CatatanAdmin({ db, user }: { db: any; user: any }) {
  const [proyekAktif, setProyekAktif] = useState<ProyekAktif[]>([])
  const [daftar, setDaftar] = useState<Catatan[]>([])
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('aktif')
  const [cari, setCari] = useState('')
  const [baru, setBaru] = useState(false)
  const [edit, setEdit] = useState<number | null>(null)
  const [sibuk, setSibuk] = useState<string | null>(null)
  const [penuh, setPenuh] = useState<Record<string, boolean>>({})
  const [isiPenuh, setIsiPenuh] = useState<Record<number, boolean>>({})

  const muat = useCallback(async () => {
    try {
      const [pa, c] = await Promise.all([muatProyekAktif(db), muatCatatan(db, user)])
      setProyekAktif(pa); setDaftar(c); setGalat(null)
    } catch (e: any) { console.error('[Catatan admin] gagal memuat:', e); setGalat('Gagal memuat catatan: ' + (e?.message || e)) }
    finally { setMemuat(false) }
  }, [db, user])
  useEffect(() => { muat() }, [muat])
  // Tabel catatan tidak bisa dibaca anon -> realtime lewat tabel sinyal tanpa isi + pemulih (tersambung ulang / tab aktif / 30 dtk).
  useEffect(() => pasangPemulihRealtime(db, { nama: 'catatan-admin-' + Math.random().toString(36).slice(2), tabel: TABEL_SINYAL, muat, jedaMs: 600, label: 'Catatan admin' }), [db, muat])

  const jalankan = async (label: string, fn: () => Promise<any>) => {
    setSibuk(label)
    try { await fn(); await muat(); return true }
    catch (e: any) {
      console.error('[Catatan admin] ' + label + ' gagal:', e)
      if (e?.code === 'VTVER') await muat()
      alert('Gagal ' + label + ':\n' + (e?.message || e)); return false
    } finally { setSibuk(null) }
  }

  const saran = useMemo(() => saranInti(daftar), [daftar])
  const urutanProyek = useMemo(() => {
    const aktif = proyekAktif.map(p => p.proyek)
    return [...aktif, ...[...new Set(daftar.map(c => c.proyek).filter(p => !aktif.includes(p)))].sort()]
  }, [proyekAktif, daftar])
  // Dasar = pencarian (ringkasan & jumlah per status); tampil = dasar + status.
  const dasar = useMemo(() => daftar.filter(c => cocokCari(c, cari)), [daftar, cari])
  const nAktif = dasar.filter(c => c.status === 'aktif').length
  const kartu = useMemo(() => {
    const rows = dasar.filter(c => tab === 'semua' || c.status === tab)
    const out: Kartu[] = []
    for (const pr of urutanProyek) {
      const rp = rows.filter(c => c.proyek === pr)
      if (!rp.length) continue
      const pa = proyekAktif.find(p => p.proyek === pr)
      const urut: (number | null)[] = [null, ...(pa?.panels.map(p => p.id) || [])]
      rp.forEach(c => { if (!urut.includes(c.panel_id)) urut.push(c.panel_id) })
      const sub: Kartu[] = []
      for (const id of urut) {
        const rc = rp.filter(c => c.panel_id === id)
          .sort((a, b) => Number(b.penting && b.status === 'aktif') - Number(a.penting && a.status === 'aktif') || Number(a.status !== 'aktif') - Number(b.status !== 'aktif') || b.dibuat_pada.localeCompare(a.dibuat_pada) || b.id - a.id)
        if (!rc.length) continue
        const pn = pa?.panels.find(p => p.id === id)
        sub.push({ kunci: pr + '|' + (id ?? 'umum'), proyek: pr, id, nama: id == null ? 'Catatan umum proyek' : (pn?.nama || rc[0].panel_nama || `Panel #${id}`), wo: pn?.wo || null,
          rows: rc, aktif: rc.filter(c => c.status === 'aktif').length, penting: rc.filter(c => c.penting && c.status === 'aktif').length,
          panelNonaktif: id != null && !pn, proyekNonaktif: !pa })
      }
      const n = new Map<string, number>(); sub.forEach(s => { const k = s.nama.trim().toUpperCase(); n.set(k, (n.get(k) || 0) + 1) })
      sub.forEach(s => { if (s.id == null || (n.get(s.nama.trim().toUpperCase()) || 0) < 2) s.wo = null })
      out.push(...sub)
    }
    // Kartu dgn catatan penting aktif naik ke atas (urutan proyek/panel dipertahankan di dalam kelompoknya).
    return [...out.filter(k => k.penting > 0), ...out.filter(k => k.penting === 0)]
  }, [dasar, tab, urutanProyek, proyekAktif])
  const aktifDasar = dasar.filter(c => c.status === 'aktif')
  const ringkas = {
    aktif: aktifDasar.length, penting: aktifDasar.filter(c => c.penting).length, tl: dasar.length - aktifDasar.length,
    panel: new Set(aktifDasar.filter(c => c.panel_id != null).map(c => c.proyek + '|' + c.panel_id)).size, proyek: new Set(aktifDasar.map(c => c.proyek)).size,
  }

  const item = (c: Catatan) => {
    const done = c.status !== 'aktif'
    const umur = umurHari(c)
    const panjang = c.isi.length > 280 || c.isi.split('\n').length > 4
    return (
      <div key={c.id} className={'kda-it' + (done ? ' done' : '') + (c.penting && !done ? ' pin' : '')}>
        {edit === c.id ? (
          <FormCatatan awal={{ proyek: c.proyek, panelId: c.panel_id, inti: c.inti, isi: c.isi, sumberInfo: c.sumber_info || '', penting: c.penting }}
            proyekAktif={proyekAktif} saran={saran} panelLama={c.panel_id != null ? { id: c.panel_id, nama: c.panel_nama || `Panel #${c.panel_id}` } : null}
            sibuk={!!sibuk} judulSimpan="Simpan" onBatal={() => setEdit(null)}
            onSimpan={async x => { const ok = await jalankan('mengubah catatan', () => ubahCatatan(db, user, c, x)); if (ok) setEdit(null) }} />
        ) : <>
          <div className="kda-ih">
            <div className="kct-inti">{c.penting && <span className="bt" aria-label="Penting">★</span>}{c.inti}</div>
            <span className={'kda-pill ' + (done ? 'o' : c.penting ? 'p' : 'n')}>{done ? 'Ditindaklanjuti' : c.penting ? 'Penting' : 'Aktif'}</span>
          </div>
          <div className={'kct-isi' + (panjang && !isiPenuh[c.id] ? ' lipat' : '')}>{c.isi}</div>
          {panjang && <button className="kct-sel kdaBtn" onClick={() => setIsiPenuh(s => ({ ...s, [c.id]: !s[c.id] }))}>{isiPenuh[c.id] ? 'Ringkas' : 'Selengkapnya'}</button>}
          {c.sumber_info && <div className="kct-dari">Dari: <b>{c.sumber_info}</b></div>}
          <div className="kda-mt">
            <span>{c.dibuat_oleh}</span><span>{waktu(c.dibuat_pada)}</span>
            {c.diubah_pada && <span className="kda-chip ub" title={`Diubah ${waktu(c.diubah_pada)} oleh ${c.diubah_oleh || '-'}`}>diubah</span>}
            {umur != null && umur >= UMUR_BASI_HARI && <span className="kda-chip basi" title="Catatan masih aktif sejak lama - sudah ditindaklanjuti?">aktif {umur} hari</span>}
          </div>
          {done && c.ditindaklanjuti_pada && <div className="kda-sd">Ditindaklanjuti {waktu(c.ditindaklanjuti_pada)} · {c.ditindaklanjuti_oleh}</div>}
          <div className="kda-ac">
            {!done && <button className="kdaBtn" disabled={!!sibuk} onClick={() => jalankan(c.penting ? 'melepas sematan' : 'menyematkan', () => setPentingCatatan(db, user, c, !c.penting))}>{c.penting ? 'Lepas sematan' : '★ Sematkan'}</button>}
            <button className={'kdaBtn' + (done ? '' : ' ok')} disabled={!!sibuk} onClick={() => jalankan(done ? 'mengaktifkan lagi' : 'menandai ditindaklanjuti', () => setStatusCatatan(db, user, c, done ? 'aktif' : 'ditindaklanjuti'))}>{done ? 'Aktifkan lagi' : 'Sudah ditindaklanjuti'}</button>
            {!done && <button className="kdaBtn" onClick={() => setEdit(c.id)}>Ubah</button>}
          </div>
        </>}
      </div>
    )
  }

  const kosong = () => {
    const q = cari.trim() ? ` yang cocok dengan "${cari.trim()}"` : ''
    return tab === 'aktif' ? `Tidak ada catatan aktif${q}.` : tab === 'ditindaklanjuti' ? `Belum ada catatan yang sudah ditindaklanjuti${q}.` : `Belum ada catatan${q}.`
  }
  const jumlahTampil = kartu.reduce((a, k) => a + k.rows.length, 0)
  return (
    <div className="kda">
      <style>{CSS}</style>
      <div className="kda-top"><span /><button className="kda-btn kdaBtn" onClick={() => setBaru(b => !b)} aria-expanded={baru}>+ Catat informasi</button></div>
      {baru && (
        <FormCatatan awal={kosongIsi(proyekAktif[0]?.proyek || '')} proyekAktif={proyekAktif} saran={saran} sibuk={!!sibuk} judulSimpan="Simpan catatan"
          onBatal={() => setBaru(false)}
          onSimpan={async x => { const ok = await jalankan('menyimpan catatan', () => simpanCatatan(db, user, x)); if (ok) { setBaru(false); if (tab === 'ditindaklanjuti') setTab('aktif') } }} />
      )}
      <div className="kda-sum" aria-label="Ringkasan catatan">
        <div><b>{ringkas.aktif}</b><span>Catatan aktif</span></div>
        <div><b style={{ color: 'var(--ks-penting)' }}>{ringkas.penting}</b><span>Penting</span></div>
        <div><b className="o">{ringkas.tl}</b><span>Sudah ditindaklanjuti</span></div>
        <div><b>{ringkas.panel} / {ringkas.proyek}</b><span>Panel / proyek</span></div>
      </div>
      <div className="kda-tb">
        <div className="kda-seg" role="tablist" aria-label="Status catatan">
          {([['aktif', 'Aktif', nAktif], ['ditindaklanjuti', 'Sudah ditindaklanjuti', dasar.length - nAktif], ['semua', 'Semua', dasar.length]] as [Tab, string, number][]).map(([t, l, n]) => (
            <button className="kdaBtn" key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{l}<span>{n}</span></button>
          ))}
        </div>
        <input className="kct-cari" type="search" placeholder="Cari inti, isi, panel, proyek, nama…" aria-label="Cari catatan" value={cari} onChange={e => setCari(e.target.value)} />
        <span className="kda-cnt">{jumlahTampil} catatan · {kartu.length} kartu</span>
      </div>
      {galat && <div className="kda-err">{galat} <button className="kda-ghost kdaBtn" onClick={() => { setMemuat(true); muat() }}>Coba lagi</button></div>}
      {memuat ? <div className="kda-empty">Memuat…</div> : kartu.length === 0 ? (galat ? null : <div className="kda-empty">{kosong()}</div>) : (
        <div className="kda-kol">
          {kartu.map(k => {
            const buka = !!penuh[k.kunci]
            return (
              <section key={k.kunci} className={'kda-kt ' + (k.penting > 0 ? 'n-penting' : 'n-netral')} aria-label={k.nama + ' - ' + k.proyek}>
                <div className="kda-kh">
                  <div className="kda-kn">
                    <div className="kda-nm">{k.id == null || /^panel\b/i.test(k.nama) ? k.nama : 'Panel ' + k.nama}</div>
                    <div className="kda-pj">{k.proyek}{k.wo && <small> · WO {k.wo}</small>}{k.proyekNonaktif ? <small> · proyek diarsipkan</small> : k.panelNonaktif ? <small> · panel tidak aktif</small> : null}</div>
                  </div>
                  <span className={'kda-pill ' + (k.penting > 0 ? 'p' : k.aktif > 0 ? 'n' : 'o')}>{k.penting > 0 ? `★ ${k.penting} penting` : k.aktif > 0 ? `${k.aktif} aktif` : 'Ditindaklanjuti'}</span>
                </div>
                {(buka ? k.rows : k.rows.slice(0, MAKS_ITEM)).map(item)}
                {k.rows.length > MAKS_ITEM && <button className="kda-lagi kdaBtn" onClick={() => setPenuh(s => ({ ...s, [k.kunci]: !buka }))}>{buka ? 'Lipat' : `Lihat ${k.rows.length - MAKS_ITEM} lagi`}</button>}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
