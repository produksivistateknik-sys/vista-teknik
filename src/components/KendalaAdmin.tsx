// KENDALA - TAMPILAN ADMIN. 7 Nov 2026 (permintaan user, acuan pratinjau "kartu per panel"): satu KARTU per panel (Umum = kartu
// sendiri), mirip tab Aktivitas Panel - judul panel, proyek di bawahnya, pil "N belum selesai"/"Semua selesai"; warna kartu
// mengikuti status (oranye lembut = masih ada yang belum selesai, hijau lembut = semua selesai; token styles/tokenKartuStatus,
// sama dgn Aktivitas Panel). Kartu mengalir 2 kolom (CSS columns, tidak terpotong; urutan turun per kolom), 1 kolom <820px.
// Ringkasan 4 angka & jumlah di filter status mengikuti filter proyek + divisi (bukan filter status). Fungsi TIDAK berubah dari
// tampilan baris 23 Okt: + Catat kendala, Tandai selesai / Buka lagi (dulu lingkaran centang, alasan otomatis), Ubah (belum
// selesai), menu ⋯ = Riwayat & Hapus (konfirmasi di tempat, tanpa alasan). Urutan: proyek aktif (abjad) lalu proyek lain; panel:
// Umum, panel aktif (no_pnl), lalu panel lain; kendala terbaru di atas.
// Jebakan mode gelap (globalCss): kelas ber-kata "card" dipaksa latar --card-bg, jadi kartu memakai kelas "kda-kt";
// tombol tanpa "Btn" di kelasnya ditimpa -> semua tombol ber-class "kdaBtn". Data & aturan: lib/kendalaProduksi.ts (sama dgn vista-pekerja).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { pasangPemulihRealtime } from '../lib/pemulihRealtime'
import {
  muatProyekAktif, muatKendala, muatLogKendala, catatKendala, ubahKendala, hapusKendala, tandaiTeratasi, batalTeratasi,
  labelDivisi, fmtTanggalPanjang, fmtTanggalDariWaktu, fmtPendekDariWaktu, jamWib, tanggalHariIniWib, LABEL_AKSI_LOG,
  type Kendala, type ProyekAktif,
} from '../lib/kendalaProduksi'
import { CSS_KARTU_PANEL } from '../styles/kartuPanelCss'
import { useAdminDilihat } from '../hooks/useAdminDilihat'
import { statusDilihat } from '../lib/adminDilihat'
import { BarisWoProyek } from './ui/ChipDeadline'
import { PETA_KOSONG, type PetaWo } from '../lib/petaWo'

const CSS = CSS_KARTU_PANEL

type Tab = 'open' | 'done' | 'all'
const BLN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
// "22 Okt 2026 · 20.26 WIB" (tanggal hari pencatatan + jam WIB).
const fmtWaktu = (k: Kendala) => { const [y, m, d] = k.tanggal.split('-').map(Number); return `${d} ${BLN3[m - 1]} ${y} · ${jamWib(k.dicatat_pada)} WIB` }
// Judul panel: "PANEL ..." (nama yang sudah diawali PANEL tidak digandakan; Umum tetap UMUM).
const judulPanel = (n: string, id: number | null) => id == null || /^panel\b/i.test(n) ? n : 'Panel ' + n
const MAKS_ITEM = 10 // kartu dgn kendala lebih banyak dilipat ("Lihat N lagi")
const TANPA_PROYEK = '(tanpa proyek)'
type KartuPanel = { kunci: string; proyek: string; id: number | null; nama: string; wo: string | null; rows: Kendala[]; belum: number }

// tertanam = dipakai di dalam KendalaDanCatatan (judul halaman & pilihan subtab ada di pembungkus).
// petaWo (9 Nov 2026): nomor WO + chip deadline di kartu (lib/petaWo, components/ui/ChipDeadline BarisWoProyek).
// onBaru (11 Nov 2026): jumlah kendala BARU utk admin ini -> hitungan "N baru" di tab (KendalaDanCatatan).
export function KendalaAdmin({ db, user, tertanam = false, petaWo = PETA_KOSONG, onBaru }: { db: any; user: any; tertanam?: boolean; petaWo?: PetaWo; onBaru?: (n: number) => void }) {
  const nama = String(user?.nama || user?.name || '').trim()
  // Penanda BARU per admin (lib/adminDilihat): kendala buatan admin ini sendiri tidak pernah BARU baginya.
  const { dilihat, tandai, tandaiSemua } = useAdminDilihat(db, 'kendala', nama)
  const [proyekAktif, setProyekAktif] = useState<ProyekAktif[]>([])
  const [daftar, setDaftar] = useState<Kendala[]>([])
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('open')
  const [fp, setFp] = useState('')
  const [fd, setFd] = useState('')
  const [form, setForm] = useState<{ proyek: string; panel: string; teks: string } | null>(null)
  const [menu, setMenu] = useState<number | null>(null)
  const [hapusId, setHapusId] = useState<number | null>(null)
  const [edit, setEdit] = useState<{ id: number; teks: string } | null>(null)
  const [riwayat, setRiwayat] = useState<Record<number, any[] | 'memuat'>>({})
  const [sibuk, setSibuk] = useState<string | null>(null)
  const [terbukaPenuh, setTerbukaPenuh] = useState<Record<string, boolean>>({})

  const muat = useCallback(async () => {
    try {
      const [pa, k] = await Promise.all([muatProyekAktif(db), muatKendala(db)])
      setProyekAktif(pa); setDaftar(k); setGalat(null)
    } catch (e: any) { console.error('[Kendala admin] gagal memuat:', e); setGalat('Gagal memuat kendala: ' + (e?.message || e)) }
    finally { setMemuat(false) }
  }, [db])
  useEffect(() => { muat() }, [muat])
  // (23 Okt 2026) pola pemulih bersama: realtime + ambil ulang saat tersambung ulang / tab aktif / online + polling 30 dtk
  useEffect(() => pasangPemulihRealtime(db, { nama: 'kendala-admin-' + Math.random().toString(36).slice(2), tabel: 'kendala_produksi', muat, jedaMs: 600, label: 'Kendala admin' }), [db, muat])

  const jalankan = async (label: string, fn: () => Promise<any>) => {
    setSibuk(label)
    try { await fn(); await muat(); return true }
    catch (e: any) { console.error('[Kendala admin] ' + label + ' gagal:', e); alert('Gagal ' + label + ':\n' + (e?.message || e)); return false }
    finally { setSibuk(null) }
  }

  const proyekK = (k: Kendala) => (k.proyek || '').trim() || TANPA_PROYEK
  // Urutan proyek: proyek aktif (abjad) lalu proyek lain yang hanya ada di kendala (arsip/dihapus).
  const urutanProyek = useMemo(() => {
    const aktif = proyekAktif.map(p => p.proyek)
    const lain = [...new Set(daftar.map(proyekK).filter(p => !aktif.includes(p)))].sort()
    return [...aktif, ...lain]
  }, [proyekAktif, daftar])
  const pilihanDivisi = useMemo(() => [...new Set(daftar.map(k => k.divisi || ''))].sort((a, b) => labelDivisi(a).localeCompare(labelDivisi(b))), [daftar])
  // Dasar = filter proyek + divisi (ringkasan & jumlah per status); tampil = dasar + filter status.
  const dasar = useMemo(() => daftar.filter(k => (!fp || proyekK(k) === fp) && (!fd || (k.divisi || '') === fd)), [daftar, fp, fd])
  const nBelum = dasar.filter(k => !k.teratasi_pada).length
  const cocokTab = (k: Kendala) => tab === 'all' || (tab === 'open' ? !k.teratasi_pada : !!k.teratasi_pada)
  const kartu = useMemo(() => {
    const rows = dasar.filter(cocokTab)
    const out: KartuPanel[] = []
    for (const pr of urutanProyek) {
      const rp = rows.filter(k => proyekK(k) === pr).sort((a, b) => (b.dicatat_pada || '').localeCompare(a.dicatat_pada || '') || b.id - a.id)
      if (!rp.length) continue
      const pa = proyekAktif.find(p => p.proyek === pr)
      // Panel: Umum, lalu panel aktif (no_pnl), lalu panel lain dari snapshot kendala.
      const urutPanel: (number | null)[] = [null, ...(pa?.panels.map(p => p.id) || [])]
      rp.forEach(k => { if (!urutPanel.includes(k.panel_id)) urutPanel.push(k.panel_id) })
      const sub: KartuPanel[] = []
      for (const id of urutPanel) {
        const rk = rp.filter(k => k.panel_id === id)
        if (!rk.length) continue
        const pn = pa?.panels.find(p => p.id === id)
        sub.push({ kunci: pr + '|' + (id ?? 'umum'), proyek: pr, id, nama: id == null ? 'Umum' : (pn?.nama || rk[0].panel_nama || `Panel #${id}`), wo: pn?.wo || rk[0].wo_number || null, rows: rk, belum: rk.filter(k => !k.teratasi_pada).length })
      }
      out.push(...sub)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dasar, tab, urutanProyek, proyekAktif])
  // Ringkasan (ikut filter proyek + divisi): panel & proyek yang masih punya kendala belum selesai.
  const belumDasar = dasar.filter(k => !k.teratasi_pada)
  const ringkas = {
    belum: belumDasar.length, selesai: dasar.length - belumDasar.length,
    panel: new Set(belumDasar.map(k => proyekK(k) + '|' + (k.panel_id ?? 'umum'))).size,
    proyek: new Set(belumDasar.map(proyekK)).size,
  }

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

  const statusK = (k: Kendala) => statusDilihat({ d: dilihat, id: k.id, dibuat: k.dicatat_pada, milikSaya: k.sumber === 'admin' && k.pencatat === nama })
  const idBaru = useMemo(() => daftar.filter((k) => statusK(k)).map((k) => k.id), [daftar, dilihat, nama]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onBaru?.(idBaru.length) }, [idBaru.length, onBaru])
  const item = (k: Kendala) => {
    const done = !!k.teratasi_pada
    return (
      <div key={k.id} className={'kda-it' + (done ? ' done' : '') + (statusK(k) ? ' baru' : '')}
        onClickCapture={(e) => { if (statusK(k) && (e.target as HTMLElement).closest('button')) tandai([k.id]) }}>
        <div className="kda-ih">
          {edit?.id === k.id ? (
            <div className="kda-ed">
              <input value={edit.teks} onChange={e => setEdit({ id: k.id, teks: e.target.value })} aria-label="Ubah kendala" autoFocus />
              <button className="kda-btn kdaBtn" disabled={!!sibuk || edit.teks.trim().length < 3} onClick={async () => { const ok = await jalankan('mengubah kendala', () => ubahKendala(db, k.id, edit.teks.trim(), nama, true)); if (ok) setEdit(null) }}>Simpan</button>
              <button className="kda-ghost kdaBtn" onClick={() => setEdit(null)}>Batal</button>
            </div>
          ) : <div className="kda-tx">{statusK(k) && <span className="kda-lbl baru">BARU</span>}{k.teks}</div>}
          <span className={'kda-pill ' + (done ? 'o' : 'w')}>{done ? 'Selesai' : 'Belum selesai'}</span>
        </div>
        <div className="kda-mt">
          <span>{k.pencatat}</span>
          <span className="kda-chip">{labelDivisi(k.divisi)}</span>
          {k.diubah_pada && <span className="kda-chip ub" title={'Diubah ' + fmtTanggalDariWaktu(k.diubah_pada) + ', ' + jamWib(k.diubah_pada)}>diubah</span>}
          <span>{fmtWaktu(k)}</span>
        </div>
        {done && <div className="kda-sd">Selesai {fmtPendekDariWaktu(k.teratasi_pada!)} · {jamWib(k.teratasi_pada!)} · {k.teratasi_oleh}</div>}
        {hapusId === k.id ? (
          <div className="kda-ac"><span className="bad">Hapus kendala ini?</span>
            <button className="bad kdaBtn" disabled={!!sibuk} onClick={async () => { const ok = await jalankan('menghapus kendala', () => hapusKendala(db, k.id, nama, true, null)); if (ok) { setHapusId(null); setMenu(null) } }}>Ya, hapus</button>
            <button className="kdaBtn" onClick={() => setHapusId(null)}>Batal</button>
          </div>
        ) : (
          <div className="kda-ac">
            <button className={'kdaBtn' + (done ? '' : ' ok')} disabled={!!sibuk} onClick={() => togelSelesai(k)}>{done ? 'Buka lagi' : 'Tandai selesai'}</button>
            {!done && edit?.id !== k.id && <button className="kdaBtn" onClick={() => { setEdit({ id: k.id, teks: k.teks }); setMenu(null) }}>Ubah</button>}
            {menu === k.id && <>
              <button className="kdaBtn" onClick={() => togelRiwayat(k.id)}>{riwayat[k.id] ? 'Tutup riwayat' : 'Riwayat'}</button>
              <button className="bad kdaBtn" onClick={() => setHapusId(k.id)}>Hapus</button>
            </>}
            <button className="kda-more kdaBtn" onClick={() => { setMenu(menu === k.id ? null : k.id); setHapusId(null) }} aria-label="Lainnya" aria-expanded={menu === k.id} title="Riwayat / Hapus">⋯</button>
          </div>
        )}
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
    )
  }

  const kosong = () => {
    const dv = fd ? ' ' + labelDivisi(fd) : ''
    const pr = fp ? ` di ${fp}` : ''
    return tab === 'open' ? `Tidak ada kendala${dv} yang belum selesai${pr}.` : tab === 'done' ? `Belum ada kendala${dv} yang selesai${pr}.` : `Tidak ada kendala${dv}${pr}.`
  }
  const jumlahTampil = kartu.reduce((a, c) => a + c.rows.length, 0)
  return (
    <div className="kda">
      <style>{CSS}</style>
      <div className="kda-top">{tertanam ? <span /> : <h1>Kendala</h1>}<button className="kda-btn kdaBtn" onClick={bukaForm} aria-expanded={!!form}>+ Catat kendala</button></div>
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
      <div className="kda-sum" aria-label="Ringkasan">
        <div><b className="w">{ringkas.belum}</b><span>Belum selesai</span></div>
        <div><b className="o">{ringkas.selesai}</b><span>Selesai</span></div>
        <div><b>{ringkas.panel}</b><span>Panel terkena</span></div>
        <div><b>{ringkas.proyek}</b><span>Proyek</span></div>
      </div>
      <div className="kda-tb">
        <div className="kda-seg" role="tablist" aria-label="Status">
          {([['open', 'Belum selesai', nBelum], ['done', 'Selesai', dasar.length - nBelum], ['all', 'Semua', dasar.length]] as [Tab, string, number][]).map(([t, l, n]) => (
            <button className="kdaBtn" key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{l}<span>{n}</span></button>
          ))}
        </div>
        <select aria-label="Filter proyek" value={fp} onChange={e => setFp(e.target.value)}>
          <option value="">Semua proyek</option>
          {urutanProyek.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select aria-label="Filter divisi" value={fd} onChange={e => setFd(e.target.value)}>
          <option value="">Semua divisi</option>
          {pilihanDivisi.map(d => <option key={d} value={d}>{labelDivisi(d)}</option>)}
        </select>
        {idBaru.length > 0 && <button className="kda-semua kdaBtn" onClick={() => tandaiSemua()}>Tandai semua sudah dilihat ({idBaru.length})</button>}
        <span className="kda-cnt">{jumlahTampil} kendala · {kartu.length} kartu</span>
      </div>
      {galat && <div className="kda-err">{galat} <button className="kda-ghost kdaBtn" onClick={() => { setMemuat(true); muat() }}>Coba lagi</button></div>}
      {memuat ? <div className="kda-empty">Memuat…</div> : kartu.length === 0 ? <div className="kda-empty">{kosong()}</div> : (
        <div className="kda-kol">
          {kartu.map(c => {
            const penuh = !!terbukaPenuh[c.kunci]
            const tampil = penuh ? c.rows : c.rows.slice(0, MAKS_ITEM)
            return (
              <section key={c.kunci} className={'kda-kt ' + (c.belum > 0 ? 'n-progres' : 'n-selesai') + (c.rows.some(statusK) ? ' ada-baru' : '')} aria-label={judulPanel(c.nama, c.id) + ' - ' + c.proyek}
                onClick={(e) => { const ids = c.rows.filter(statusK).map((k) => k.id); if (ids.length && !(e.target as HTMLElement).closest('button,input,textarea,select,a,label')) tandai(ids) }}>
                <div className="kda-kh">
                  <div className="kda-kn">
                    <div className="kda-nm">{judulPanel(c.nama, c.id)}</div>
                    <div className="kda-pj"><BarisWoProyek peta={petaWo} proyek={c.proyek} panelId={c.id} snapshot={{ woId: c.rows[0]?.wo_id, nomor: c.rows[0]?.wo_number }} /></div>
                  </div>
                  <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{c.rows.some(statusK) && <span className="kda-pill baru">{c.rows.filter(statusK).length} baru</span>}<span className={'kda-pill ' + (c.belum > 0 ? 'w' : 'o')}>{c.belum > 0 ? `${c.belum} belum selesai` : 'Semua selesai'}</span></span>
                </div>
                {tampil.map(item)}
                {c.rows.length > MAKS_ITEM && (
                  <button className="kda-lagi kdaBtn" onClick={() => setTerbukaPenuh(s => ({ ...s, [c.kunci]: !penuh }))}>{penuh ? 'Lipat' : `Lihat ${c.rows.length - MAKS_ITEM} lagi`}</button>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
