import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllPaged } from '../lib/fetchAllPaged'
import { activityLogService } from '../services/activityLogService'
import { PROSES_TEMPLATE } from '../lib/templateJadwalWp'

// EDITOR TEMPLATE JADWAL WP (22 Okt 2026, tahap 2). Isi tabel template_jadwal_wp per jenis panel: proses x WP -> Day ke-n
// (kosong = "-" = WP itu tidak mengerjakan proses itu). Simpan HANYA lewat RPC simpan_template_jadwal_wp (server menolak
// urutan proses terbalik & mencatat nilai sebelum/sesudah ke template_jadwal_wp_log). Perubahan hanya berlaku untuk FCS
// berikutnya - jadwal yang sudah ada tidak berubah.
type Props = { user?: any; onTutup: (berubah: boolean) => void }
type Grid = Record<string, Record<string, string>> // proses -> wp -> "n" | ""

const WP_DEFAULT = ['WP1', 'WP2', 'WP3', 'WP4']
const gayaBtn = (utama = false) => ({ height: 30, padding: '0 12px', borderRadius: 7, border: utama ? 'none' : '1px solid #d1d5db', background: utama ? '#1d4ed8' : '#fff', color: utama ? '#fff' : '#334155', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' })

export function ModalTemplateWp({ user, onTutup }: Props) {
  const [tipeList, setTipeList] = useState<{ tipe: string; label: string }[]>([])
  const [semua, setSemua] = useState<any[]>([])
  const [wpMeta, setWpMeta] = useState<any[]>([])
  const [tipe, setTipe] = useState('')
  const [grid, setGrid] = useState<Grid>({})
  const [alasan, setAlasan] = useState('')
  const [riwayat, setRiwayat] = useState<any[]>([])
  const [muat, setMuat] = useState(true)
  const [simpan, setSimpan] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [berubah, setBerubah] = useState(false)

  const muatSemua = async () => {
    setMuat(true); setGalat(null)
    try {
      const [meta, tpl, wm] = await Promise.all([
        fetchAllPaged((d, s) => (supabase.from('panel_type_meta').select('tipe_panel,label') as any).order('id').range(d, s)),
        fetchAllPaged((d, s) => (supabase.from('template_jadwal_wp' as any).select('tipe_panel,proses,wp,hari') as any).order('tipe_panel').order('proses').order('wp').range(d, s)),
        fetchAllPaged((d, s) => (supabase.from('panel_wp_meta').select('tipe_panel,wp') as any).order('id').range(d, s)),
      ])
      setTipeList(meta.map((m: any) => ({ tipe: m.tipe_panel, label: m.label || m.tipe_panel })))
      setSemua(tpl); setWpMeta(wm)
      setTipe(t => t || (tpl[0]?.tipe_panel ?? meta[0]?.tipe_panel ?? ''))
    } catch (e: any) { console.error('[template WP] gagal memuat:', e); setGalat('Gagal memuat template: ' + (e?.message || e)) }
    finally { setMuat(false) }
  }
  useEffect(() => { muatSemua() }, [])

  const wpKolom = useMemo(() => {
    const s = new Set<string>(wpMeta.filter(w => w.tipe_panel === tipe).map(w => w.wp))
    semua.filter(r => r.tipe_panel === tipe).forEach(r => s.add(r.wp))
    const a = [...s].filter(w => /^WP\d$/.test(w)).sort()
    return a.length ? a : WP_DEFAULT
  }, [wpMeta, semua, tipe])

  // isi grid & riwayat saat jenis berganti / data dimuat ulang
  useEffect(() => {
    if (!tipe) return
    const g: Grid = {}
    PROSES_TEMPLATE.forEach(p => { g[p] = {} })
    semua.filter(r => r.tipe_panel === tipe).forEach(r => { if (g[r.proses]) g[r.proses][r.wp] = String(r.hari) })
    setGrid(g); setAlasan('')
    let batal = false
    ;(supabase.from('template_jadwal_wp_log' as any).select('id,sebelum,sesudah,oleh,alasan,dibuat_pada') as any)
      .eq('tipe_panel', tipe).order('id', { ascending: false }).range(0, 9)
      .then(({ data, error }: any) => {
        if (batal) return
        if (error) { console.error('[template WP] gagal memuat riwayat:', error); setRiwayat([]); return }
        setRiwayat(data || [])
      })
    return () => { batal = true }
  }, [tipe, semua])

  const nilai = (p: string, w: string) => { const n = Number(grid[p]?.[w]); return grid[p]?.[w] && n >= 1 ? n : 0 }
  // Urutan (cermin cek server; server tetap penentu): di WP yang sama, proses tidak boleh lebih awal dari proses sebelumnya.
  const selSalah = useMemo(() => {
    const s = new Set<string>()
    wpKolom.forEach(w => {
      let maks = 0
      PROSES_TEMPLATE.forEach(p => { const h = nilai(p, w); if (!h) return; if (h < maks) s.add(p + '|' + w); maks = Math.max(maks, h) })
    })
    return s // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, wpKolom])
  const selTidakValid = useMemo(() => {
    const s = new Set<string>()
    PROSES_TEMPLATE.forEach(p => wpKolom.forEach(w => { const v = grid[p]?.[w]; if (v && !(/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 60)) s.add(p + '|' + w) }))
    return s
  }, [grid, wpKolom])
  const pasangAwal = useMemo(() => { const h = wpKolom.map(w => nilai('PASANG KOMPONEN', w)).filter(Boolean); return h.length ? Math.min(...h) : 0 // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, wpKolom])

  const jalankanSimpan = async () => {
    const oleh = user?.name || user?.nama || 'Admin'
    if (alasan.trim().length < 5) { alert('Isi alasan perubahan (minimal 5 huruf).'); return }
    if (selTidakValid.size) { alert('Ada isian yang bukan angka 1-60. Kosongkan sel untuk "-".'); return }
    if (selSalah.size && !confirm('Ada urutan proses terbalik (sel merah). Server akan menolak simpanan ini. Tetap kirim?')) return
    const baris: any[] = []
    PROSES_TEMPLATE.forEach(p => wpKolom.forEach(w => { const h = nilai(p, w); if (h) baris.push({ proses: p, wp: w, hari: h }) }))
    if (baris.length === 0 && !confirm(`Semua sel kosong: template ${tipe} akan DIHAPUS (FCS jenis ini kembali ke cara lama). Lanjut?`)) return
    setSimpan(true)
    try {
      const { error } = await (supabase as any).rpc('simpan_template_jadwal_wp', { p_tipe: tipe, p_baris: baris, p_oleh: oleh, p_alasan: alasan.trim() })
      if (error) { console.error('[template WP] simpan gagal:', error); alert('Gagal menyimpan template ' + tipe + ':\n' + error.message); return }
      await activityLogService.insert({ user_name: oleh, action: 'UBAH TEMPLATE WP', description: `Template jadwal WP ${tipe} disimpan (${baris.length} sel) - alasan: ${alasan.trim()}`, module: 'raw', halaman: 'Manajemen WO' })
      setBerubah(true)
      await muatSemua()
      alert('Template ' + tipe + ' tersimpan. Berlaku untuk FCS berikutnya; jadwal yang sudah ada tidak berubah.')
    } finally { setSimpan(false) }
  }

  const ringkasBaris = (a: any[]) => (a || []).length + ' sel'
  return (
    <div role="dialog" aria-label="Atur template jadwal WP" onClick={() => onTutup(berubah)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 'min(680px, 100%)', maxHeight: '92vh', overflowY: 'auto', padding: 18, boxShadow: '0 20px 50px rgba(0,0,0,.25)' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>✎ Template jadwal WP</div>
        <div style={{ fontSize: 11.5, color: '#64748b', lineHeight: 1.5, marginBottom: 12 }}>
          Angka = Day ke-n (Day 1 = Tanggal Mulai FCS, Minggu & tanggal berkapasitas 0 dilewati). Kosong = "-" (WP itu tidak mengerjakan proses itu;
          kode yang tetap relevan memakai hari proses sebelumnya pada WP yang sama). Berlaku untuk FCS berikutnya saja.
        </div>
        {galat && <div style={{ fontSize: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 7, padding: '8px 10px', marginBottom: 10 }}>{galat}</div>}
        {muat ? <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Memuat…</div> : <>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Jenis panel</label>
          <select value={tipe} onChange={e => setTipe(e.target.value)} style={{ width: '100%', height: 32, borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 12, marginBottom: 12, fontFamily: 'inherit' }}>
            {tipeList.map(t => <option key={t.tipe} value={t.tipe}>{t.label}{t.label !== t.tipe ? ` (${t.tipe})` : ''}{semua.some(r => r.tipe_panel === t.tipe) ? '' : ' - belum ada template'}</option>)}
          </select>
          <div style={{ overflowX: 'auto', marginBottom: 8 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 360 }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: '#475569' }}>Proses</th>
                {wpKolom.map(w => <th key={w} style={{ padding: '4px 6px', color: '#475569' }}>{w}</th>)}
              </tr></thead>
              <tbody>
                {PROSES_TEMPLATE.map(p => (
                  <tr key={p} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '4px 8px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{p}</td>
                    {wpKolom.map(w => {
                      const k = p + '|' + w, merah = selSalah.has(k) || selTidakValid.has(k)
                      return (
                        <td key={w} style={{ padding: '3px 4px' }}>
                          <input aria-label={`${p} ${w}`} inputMode="numeric" value={grid[p]?.[w] || ''} placeholder="-"
                            onChange={e => { const v = e.target.value.replace(/\s/g, ''); setGrid(g => ({ ...g, [p]: { ...(g[p] || {}), [w]: v } })) }}
                            title={selSalah.has(k) ? 'Lebih awal dari proses sebelumnya pada WP yang sama' : undefined}
                            style={{ width: 52, height: 28, textAlign: 'center', borderRadius: 6, border: `1.5px solid ${merah ? '#dc2626' : '#cbd5e1'}`, background: merah ? '#fef2f2' : '#fff', fontSize: 12, fontFamily: 'inherit' }} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11.5, color: '#475569', marginBottom: 10, lineHeight: 1.6 }}>
            Otomatis: BUSBAR, WIRING CONTROL & WIRING POWER = {pasangAwal ? `Day ${pasangAwal}` : '— (belum ada PASANG KOMPONEN; ikut Tanggal Mulai)'} · QC TEST & PACKING = H-1 target WO.
            {selSalah.size > 0 && <div style={{ color: '#b91c1c' }}>⚠ Sel merah: proses lebih awal dari proses sebelumnya pada WP yang sama (server akan menolak).</div>}
          </div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Alasan perubahan</label>
          <input value={alasan} onChange={e => setAlasan(e.target.value)} placeholder="mis. WP3 WM dipercepat sesuai kapasitas baru" style={{ width: '100%', boxSizing: 'border-box', height: 32, borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 12, padding: '0 10px', marginBottom: 12, fontFamily: 'inherit' }} />
          {riwayat.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Riwayat {tipe}</div>
              {riwayat.map(r => <div key={r.id} style={{ fontSize: 11, color: '#64748b', borderTop: '1px solid #f1f5f9', padding: '3px 0' }}>
                {new Date(r.dibuat_pada).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} · {r.oleh} · {ringkasBaris(r.sebelum)} → {ringkasBaris(r.sesudah)}{r.alasan ? ` · ${r.alasan}` : ''}
              </div>)}
            </div>
          )}
        </>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={() => onTutup(berubah)} style={gayaBtn()}>Tutup</button>
          <button onClick={jalankanSimpan} disabled={simpan || muat || !tipe} style={{ ...gayaBtn(true), opacity: simpan || muat ? .5 : 1, cursor: simpan ? 'wait' : 'pointer' }}>{simpan ? 'Menyimpan…' : 'Simpan template ' + (tipe || '')}</button>
        </div>
      </div>
    </div>
  )
}
