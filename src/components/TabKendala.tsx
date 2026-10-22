// TAB KENDALA (23 Okt 2026) - tampilan BERSAMA vista-pekerja (mode "operator") & vista-teknik (mode "admin").
// File ini IDENTIK di kedua repo (src/components/TabKendala.tsx) - ubah keduanya bersamaan. Logika & akses data di
// lib/kendalaProduksi.ts. Desain mengikuti artifact "Tab Kendala": rata kiri, hierarki tebal/tipis
// (proyek > panel/Umum > tanggal > entri), hari/tanggal/jam/pencatat otomatis.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  muatProyekAktif, muatKendala, muatLogKendala, catatKendala, ubahKendala, hapusKendala, tandaiTeratasi, batalTeratasi,
  kelompokPerTanggal, ringkasPerPanel, kunciPanel, bolehUbahSendiri, terbuka, teksTeratasi, labelDivisi,
  fmtTanggalPanjang, fmtTanggalDariWaktu, jamWib, tanggalHariIniWib, type Kendala, type ProyekAktif,
} from '../lib/kendalaProduksi'

type Props = {
  db: any
  user: { nama?: string; name?: string; divisi?: string } | null
  mode: 'operator' | 'admin'
  registerBackHandler?: (fn: (() => boolean) | null) => void
}
const W = { fg: '#1c1b19', mute: '#76726a', line: '#e6e3dc', accent: '#b8860b', warn: '#a4410e', ok: '#15803d', card: '#ffffff', btn: '#1c1b19' }
const tombolKecil = (warna = W.mute) => ({ background: 'none', border: 0, padding: '2px 0', marginRight: 14, color: warna, font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' })

export function TabKendala({ db, user, mode, registerBackHandler }: Props) {
  const admin = mode === 'admin'
  const nama = (user?.nama || user?.name || '').trim()
  const divisi = admin ? 'admin' : (user?.divisi || '')
  const [proyekAktif, setProyekAktif] = useState<ProyekAktif[]>([])
  const [daftar, setDaftar] = useState<Kendala[]>([])
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)
  const [buka, setBuka] = useState<Set<string>>(new Set())
  const [draf, setDraf] = useState<Record<string, string>>({})
  const [sibuk, setSibuk] = useState<string | null>(null)
  const [edit, setEdit] = useState<{ id: number; teks: string } | null>(null)
  const [riwayat, setRiwayat] = useState<Record<number, any[] | 'memuat'>>({})
  const [hanyaTerbuka, setHanyaTerbuka] = useState(false)
  const [hanyaAda, setHanyaAda] = useState(false)
  const [hariIni, setHariIni] = useState(tanggalHariIniWib())

  const muat = useCallback(async () => {
    try {
      const pa = await muatProyekAktif(db)
      // Operator: kendala proyek aktif saja. Admin: semua (termasuk proyek arsip/dihapus - tampil dari snapshot).
      const k = await muatKendala(db, admin ? {} : { proyek: pa.map(p => p.proyek) })
      setProyekAktif(pa); setDaftar(k); setGalat(null); setHariIni(tanggalHariIniWib())
    } catch (e: any) {
      console.error('[Kendala] gagal memuat:', e)
      setGalat('Gagal memuat kendala: ' + (e?.message || e))
    } finally { setMemuat(false) }
  }, [db, admin])
  useEffect(() => { muat() }, [muat])

  // Realtime: perubahan dari HP/admin lain -> muat ulang (digabung 600 ms). Nama kanal unik per mount.
  const tunda = useRef<any>(null)
  useEffect(() => {
    const ch = db.channel('kendala-produksi-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kendala_produksi' }, () => {
        clearTimeout(tunda.current); tunda.current = setTimeout(() => muat(), 600)
      }).subscribe()
    return () => { clearTimeout(tunda.current); db.removeChannel(ch) }
  }, [db, muat])

  useEffect(() => {
    if (!registerBackHandler) return
    registerBackHandler(() => { if (buka.size === 0) return false; setBuka(new Set()); return true })
    return () => registerBackHandler(null)
  }, [registerBackHandler, buka])

  // Susunan proyek > panel. Admin: proyek/panel yang hanya ada di kendala (arsip/dihapus) ikut tampil dari snapshot.
  const susunan = useMemo(() => {
    const per = new Map<string, { proyek: string; arsip: boolean; panels: { id: number | null; nama: string; arsip: boolean }[] }>()
    for (const p of proyekAktif) per.set(p.proyek, { proyek: p.proyek, arsip: false, panels: [{ id: null, nama: 'Umum', arsip: false }, ...p.panels.map(x => ({ id: x.id, nama: x.nama, arsip: false }))] })
    for (const k of daftar) {
      let p = per.get(k.proyek)
      if (!p) { if (!admin) continue; p = { proyek: k.proyek, arsip: true, panels: [{ id: null, nama: 'Umum', arsip: false }] }; per.set(k.proyek, p) }
      if (k.panel_id != null && !p.panels.some(x => x.id === k.panel_id)) p.panels.push({ id: k.panel_id, nama: k.panel_nama || `Panel #${k.panel_id}`, arsip: true })
    }
    return [...per.values()].sort((a, b) => Number(a.arsip) - Number(b.arsip) || a.proyek.localeCompare(b.proyek))
  }, [proyekAktif, daftar, admin])
  const tampil = useMemo(() => hanyaTerbuka ? daftar.filter(terbuka) : daftar, [daftar, hanyaTerbuka])
  const ringkas = useMemo(() => ringkasPerPanel(daftar), [daftar])
  const perPanel = useMemo(() => {
    const m = new Map<string, Kendala[]>()
    for (const k of tampil) { const key = kunciPanel(k.proyek, k.panel_id); const a = m.get(key) || []; a.push(k); m.set(key, a) }
    return m
  }, [tampil])

  const togel = (key: string) => setBuka(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n })
  const jalankan = async (label: string, fn: () => Promise<any>) => {
    setSibuk(label)
    try { await fn(); await muat(); return true }
    catch (e: any) { console.error('[Kendala] ' + label + ' gagal:', e); alert('Gagal ' + label + ':\n' + (e?.message || e)); return false }
    finally { setSibuk(null) }
  }
  const catat = async (proyek: string, panelId: number | null) => {
    const key = kunciPanel(proyek, panelId), teks = (draf[key] || '').trim()
    if (!teks) return
    if (!nama) { alert('Nama pengguna tidak terbaca - masuk ulang dulu.'); return }
    const ok = await jalankan('mencatat kendala', () => catatKendala(db, { proyek, panelId, teks, oleh: nama, divisi, admin }))
    if (ok) setDraf(d => ({ ...d, [key]: '' }))
  }
  const lihatRiwayat = async (id: number) => {
    if (riwayat[id]) { setRiwayat(r => { const n = { ...r }; delete n[id]; return n }); return }
    setRiwayat(r => ({ ...r, [id]: 'memuat' }))
    try { const log = await muatLogKendala(db, id); setRiwayat(r => ({ ...r, [id]: log })) }
    catch (e: any) { console.error('[Kendala] riwayat gagal:', e); alert('Gagal memuat riwayat: ' + (e?.message || e)); setRiwayat(r => { const n = { ...r }; delete n[id]; return n }) }
  }

  const LABEL_AKSI: Record<string, string> = { catat: 'Dicatat', ubah: 'Diubah', hapus: 'Dihapus', teratasi: 'Ditandai teratasi', batal_teratasi: 'Tanda teratasi dibatalkan', migrasi: 'Dipindah dari catatan lama' }
  const entri = (k: Kendala) => {
    const selesai = !!k.teratasi_pada
    const milikSendiri = bolehUbahSendiri(k, nama, hariIni)
    const sedangEdit = edit?.id === k.id
    return (
      <div key={k.id} style={{ margin: '0 0 10px', paddingLeft: 12, borderLeft: `2px solid ${selesai ? W.line : W.accent}`, opacity: selesai ? 0.6 : 1 }}>
        {sedangEdit ? (
          <div>
            <textarea value={edit!.teks} onChange={e => setEdit({ id: k.id, teks: e.target.value })} aria-label="Ubah kendala"
              style={{ width: '100%', minHeight: 60, boxSizing: 'border-box', border: `1px solid ${W.line}`, borderRadius: 6, padding: 8, font: 'inherit', fontSize: 14 }} />
            <button disabled={!!sibuk || edit!.teks.trim().length < 3} onClick={async () => { const ok = await jalankan('mengubah kendala', () => ubahKendala(db, k.id, edit!.teks.trim(), nama)); if (ok) setEdit(null) }} style={tombolKecil(W.fg)}>Simpan</button>
            <button onClick={() => setEdit(null)} style={tombolKecil()}>Batal</button>
          </div>
        ) : <p style={{ margin: 0, fontSize: 14.5, color: W.fg, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{k.teks}</p>}
        <small style={{ color: W.mute, fontSize: 12.5 }}>
          {k.pencatat} · {labelDivisi(k.divisi)} · {jamWib(k.dicatat_pada)}{k.diubah_pada ? ' · diubah' : ''}{k.sumber === 'migrasi' ? ' · catatan lama' : ''}
        </small>
        {selesai && <div style={{ color: W.ok, fontSize: 12.5, fontWeight: 600 }}>{teksTeratasi(k)}</div>}
        {!sedangEdit && (milikSendiri || admin) && (
          <div style={{ marginTop: 2 }}>
            {milikSendiri && <button disabled={!!sibuk} onClick={() => setEdit({ id: k.id, teks: k.teks })} style={tombolKecil()}>Ubah</button>}
            {milikSendiri && !admin && <button disabled={!!sibuk} onClick={() => { if (confirm('Hapus kendala ini?')) jalankan('menghapus kendala', () => hapusKendala(db, k.id, nama)) }} style={tombolKecil(W.warn)}>Hapus</button>}
            {admin && !selesai && <button disabled={!!sibuk} onClick={() => jalankan('menandai teratasi', () => tandaiTeratasi(db, k.id, nama))} style={tombolKecil(W.ok)}>✓ Teratasi</button>}
            {admin && selesai && <button disabled={!!sibuk} onClick={() => { const a = prompt('Alasan membatalkan tanda Teratasi (mis. salah klik):'); if (a && a.trim().length >= 3) jalankan('membatalkan tanda teratasi', () => batalTeratasi(db, k.id, nama, a.trim())); else if (a !== null) alert('Alasan minimal 3 huruf.') }} style={tombolKecil(W.warn)}>Batalkan teratasi</button>}
            {admin && <button disabled={!!sibuk} onClick={() => { const a = prompt('Hapus kendala ini? Tulis alasan (boleh kosong):'); if (a !== null) jalankan('menghapus kendala', () => hapusKendala(db, k.id, nama, true, a.trim() || null)) }} style={tombolKecil(W.warn)}>Hapus</button>}
            {admin && <button onClick={() => lihatRiwayat(k.id)} style={tombolKecil()}>{riwayat[k.id] ? 'Tutup riwayat' : 'Riwayat'}</button>}
          </div>
        )}
        {riwayat[k.id] && (
          <div style={{ fontSize: 12, color: W.mute, marginTop: 4 }}>
            {riwayat[k.id] === 'memuat' ? 'Memuat…' : (riwayat[k.id] as any[]).map(l => (
              <div key={l.id}>{fmtTanggalDariWaktu(l.waktu)} {jamWib(l.waktu)} · {LABEL_AKSI[l.aksi] || l.aksi} oleh {l.oleh}{l.alasan ? ` - ${l.alasan}` : ''}</div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const meta = (total: number, open: number, kosong: string) => (
    <span style={{ color: open ? W.warn : W.mute, fontWeight: open ? 600 : 400, fontSize: 13, whiteSpace: 'nowrap' }}>
      {total === 0 ? kosong : open ? `${open} belum teratasi${total > open ? ` · ${total} total` : ''}` : `${total} kendala, teratasi`}
    </span>
  )
  const barisBtn = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, width: '100%', background: 'none', border: 0, color: W.fg, textAlign: 'left' as const, cursor: 'pointer', font: 'inherit' }
  const chev = (o: boolean) => <span style={{ display: 'inline-block', width: 12, color: W.mute, marginRight: 6, transform: o ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'left', color: W.fg, padding: '4px 2px 40px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>{admin ? 'Kendala produksi' : 'Kendala'}</h1>
      <p style={{ color: W.mute, margin: '0 0 14px', fontSize: 14 }}>
        {admin ? 'Catatan kendala dari tim produksi, per proyek dan per panel. Hanya Admin Produksi yang menandai Teratasi.'
          : 'Pilih proyek dan panel, lalu tulis kendalanya. Hari, tanggal, jam, dan nama tercatat otomatis.'}
      </p>
      {admin && (
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', color: W.mute, fontSize: 14, marginBottom: 14 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={hanyaTerbuka} onChange={e => setHanyaTerbuka(e.target.checked)} /> Hanya yang belum teratasi</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={hanyaAda} onChange={e => setHanyaAda(e.target.checked)} /> Hanya panel yang ada kendala</label>
        </div>
      )}
      {galat && <div style={{ color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 10px', fontSize: 13, marginBottom: 12 }}>{galat} <button onClick={() => { setMemuat(true); muat() }} style={tombolKecil('#991b1b')}>Coba lagi</button></div>}
      {memuat ? <p style={{ color: W.mute }}>Memuat…</p> : susunan.length === 0 ? <p style={{ color: W.mute }}>Belum ada proyek aktif.</p> : (
        <div style={{ borderBottom: `1px solid ${W.line}` }}>
          {susunan.map(pr => {
            const panelTampil = pr.panels.filter(pn => !hanyaAda || (perPanel.get(kunciPanel(pr.proyek, pn.id)) || []).length > 0)
            if (hanyaAda && panelTampil.length === 0) return null
            let tot = 0, open = 0
            pr.panels.forEach(pn => { const r = ringkas.get(kunciPanel(pr.proyek, pn.id)); if (r) { tot += r.total; open += r.terbuka } })
            const kp = 'p:' + pr.proyek, po = buka.has(kp)
            return (
              <div key={pr.proyek} style={{ borderTop: `1px solid ${W.line}` }}>
                <button aria-expanded={po} onClick={() => togel(kp)} style={{ ...barisBtn, padding: '12px 0', fontWeight: 600, fontSize: 16 }}>
                  <span style={{ minWidth: 0 }}>{chev(po)}{pr.proyek}{pr.arsip && <span style={{ color: W.mute, fontWeight: 400, fontSize: 13 }}> (arsip / tidak aktif)</span>}</span>
                  {meta(tot, open, 'Tidak ada')}
                </button>
                {po && (
                  <div style={{ paddingBottom: 8 }}>
                    {panelTampil.map(pn => {
                      const key = kunciPanel(pr.proyek, pn.id), o = buka.has(key)
                      const r = ringkas.get(key) || { total: 0, terbuka: 0 }
                      const grup = kelompokPerTanggal(perPanel.get(key) || [])
                      const bisaCatat = !pn.arsip && !pr.arsip
                      return (
                        <div key={key} style={{ borderTop: `1px dashed ${W.line}` }}>
                          <button aria-expanded={o} onClick={() => togel(key)} style={{ ...barisBtn, padding: '9px 0 9px 16px', fontWeight: pn.id == null ? 600 : 500 }}>
                            <span style={{ minWidth: 0 }}>{chev(o)}{pn.nama}{pn.arsip && <span style={{ color: W.mute, fontWeight: 400, fontSize: 13 }}> (arsip / dihapus)</span>}</span>
                            {meta(r.total, r.terbuka, '—')}
                          </button>
                          {o && (
                            <div style={{ padding: '2px 0 14px 16px' }}>
                              {grup.length === 0 && <p style={{ color: W.mute, fontSize: 14, margin: '6px 0 10px' }}>{hanyaTerbuka && r.total ? 'Semua kendala di sini sudah teratasi.' : 'Belum ada kendala tercatat.'}</p>}
                              {grup.map(g => (
                                <div key={g.tanggal}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: W.mute, letterSpacing: '.04em', textTransform: 'uppercase', margin: '12px 0 4px' }}>{fmtTanggalPanjang(g.tanggal)}</div>
                                  {g.entri.map(entri)}
                                </div>
                              ))}
                              {bisaCatat && (
                                <div style={{ marginTop: 14 }}>
                                  <textarea value={draf[key] || ''} onChange={e => setDraf(d => ({ ...d, [key]: e.target.value }))} placeholder="Tulis kendala…" aria-label={'Kendala ' + pn.nama}
                                    style={{ width: '100%', minHeight: 72, boxSizing: 'border-box', resize: 'vertical', background: W.card, color: W.fg, border: `1px solid ${W.line}`, borderRadius: 6, padding: 10, font: 'inherit', fontSize: 14.5 }} />
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                                    <span style={{ color: W.mute, fontSize: 13 }}>Tercatat: <b style={{ color: W.fg, fontWeight: 500 }}>{fmtTanggalPanjang(hariIni)}</b>{nama ? ` · ${nama}` : ''}</span>
                                    <button disabled={!!sibuk || (draf[key] || '').trim().length < 3} onClick={() => catat(pr.proyek, pn.id)}
                                      style={{ background: W.btn, color: '#faf9f6', border: 0, borderRadius: 6, padding: '9px 16px', font: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer', opacity: !!sibuk || (draf[key] || '').trim().length < 3 ? 0.35 : 1 }}>
                                      {sibuk === 'mencatat kendala' ? 'Menyimpan…' : 'Catat kendala'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
