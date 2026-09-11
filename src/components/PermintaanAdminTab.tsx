import { useState, useEffect, useMemo, type CSSProperties } from 'react'
import { supabase } from '../lib/supabase'
import { Card, Btn, Modal, Badge } from './ui/Primitives'
import { VISTA_LOGO_DATA_URI } from '../lib/logoAsset'

// ─────────────────────────────────────────────────────────────────────────────
// PERMINTAAN BARANG - APPROVAL ADMIN (7 Sep 2026) - fitur baru "wajib approval admin sebelum
// sampai ke Gudang". Operator submit (Vista Pekerja) sekarang mendarat di sini DULU dengan
// status 'menunggu_admin' (BUKAN 'pending' langsung) - baru geser jadi 'pending' begitu admin
// setuju, di titik itu BARU beneran nongol di alur Gudang (PermintaanGudangTab.tsx di Vista
// Pekerja) yang SAMA SEKALI TIDAK DIUBAH - semua query di sana sudah strict filter
// status='pending', jadi item 'menunggu_admin' otomatis gak kelihatan sampai admin proses.
//
// 3 aksi per item: Setujui (qty apa adanya), Edit qty dulu baru Setujui (qty field bisa diketik
// ulang SEBELUM klik Setujui - bukan 2 langkah terpisah), atau Tolak (alasan wajib, status jadi
// 'ditolak_admin' - SENGAJA beda dari 'reject' yang tetap berarti Gudang yang nolak di tahap
// SETELAH ini, jangan disamakan).
//
// TIDAK ada tabel audit terpisah buat edit qty di sini (beda dari fitur Koreksi Qty yang
// memang didesain buat riwayat cicilan berkali-kali) - ini gerbang SEKALI doang, qty diupdate
// langsung. disetujui_admin_oleh/disetujui_admin_at (kolom baru) jadi jejaknya, sekaligus
// dipakai Gudang buat dot notifikasi "item baru muncul" (bukan lagi permintaan.created_at).
// ─────────────────────────────────────────────────────────────────────────────

const DIVISI_LABEL: Record<string, string> = {
  mekanik: 'Mekanik', painting: 'Painting', assembling: 'Assembling',
  wiring_ctrl: 'Wiring Control', wiring_pwr: 'Wiring Power',
  qc: 'QC', nameplate: 'Nameplate', komponen: 'Komponen', gudang: 'Gudang',
}

const fetchAllPaged = async (build: (from: number, to: number) => any): Promise<any[]> => {
  let all: any[] = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw error
    all = all.concat(data ?? [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}

const fmtDateTime = (d: string) => d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'

const todayStr = () => new Date().toISOString().slice(0, 10)

// Dipakai buat build HTML dokumen print (openPrintWindow) - data dari DB (nama item/proyek/WO)
// ditulis mentah ke string HTML, WAJIB di-escape biar gak ada karakter yang kebaca sebagai tag.
const escapeHtml = (s: any) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

// Warna header tabel rekap (#1e3a8a) SAMA PERSIS dgn `thS` di RencanaHarian.tsx (tabel
// BUSBAR/Renhar) - satu-satunya tempat lain di app ini yang punya header tabel gelap solid,
// dipakai di sini biar konsisten temanya, bukan warna baru.
const rekapThS: CSSProperties = {
  background: '#1e3a8a', color: '#fff', padding: '11px 14px', fontWeight: 700, fontSize: 11,
  textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left',
}

const RIWAYAT_STATUS_OPTIONS: { key: 'ALL' | 'DISETUJUI' | 'DITOLAK', label: string, color: string }[] = [
  { key: 'ALL', label: 'Semua', color: '#475569' },
  { key: 'DISETUJUI', label: '✓ Disetujui', color: '#16a34a' },
  { key: 'DITOLAK', label: '✕ Ditolak Admin', color: '#dc2626' },
]

export function PermintaanAdminTab({ user, woData = [] }: any) {
  const adminUsername: string = user?.username || user?.name || 'Admin'
  const [viewMode, setViewMode] = useState<'pending' | 'riwayat' | 'rekap'>('pending')
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<any[]>([])
  const [qtyEdit, setQtyEdit] = useState<Record<number, string>>({})
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [rejectTarget, setRejectTarget] = useState<any | null>(null)
  const [rejectAlasan, setRejectAlasan] = useState('')

  const [riwayatTanggal, setRiwayatTanggal] = useState(todayStr())
  const [riwayatSearch, setRiwayatSearch] = useState('')
  const [riwayatStatusFilter, setRiwayatStatusFilter] = useState<'ALL' | 'DISETUJUI' | 'DITOLAK'>('ALL')
  const [riwayatLoading, setRiwayatLoading] = useState(false)
  const [riwayatItems, setRiwayatItems] = useState<any[]>([])

  // REKAP PER WO/PROJECT (11 Sep 2026, REVISI dari versi awal per-panel) - rekap SEMUA item
  // BBMB/BBMU yang pernah diminta di SELURUH panel dalam 1 WO, digabung per jenis item, buat
  // di-print. Cuma hitung item yang BENERAN sudah keluar dari Gudang (status='submit') -
  // SENGAJA bukan 'pending' (baru disetujui admin, belum tentu dipenuhi) - keputusan eksplisit
  // user (fitur serupa versi Gudang, yang jangkauannya beda, direncanakan nyusul terpisah).
  // Tetap ada toggle turun ke 1 panel spesifik (rekapScopePanelId) buat kasus mau lihat satu
  // panel doang - narrow-nya PURE CLIENT-SIDE dari rekapRawItems yang udah ke-fetch based on
  // seluruh WO (gak refetch ke DB), soalnya raw item per baris udah dibawa panel_id-nya lewat
  // permMap (perm.panel_id) di fetchRekap.
  // Group key HARUS komponen_master_id + satuan_dipilih (bukan komponen_master_id doang) -
  // dicek live 11 Sep 2026: mayoritas item konsisten 1 master_id = 1 satuan, TAPI ada 1
  // pengecualian nyata (master_id 3640, pernah diminta PCS & PACK) - kalau digabung tanpa satuan
  // bakal ke-jumlah salah (PCS+PACK jadi satu angka gak berarti).
  const allPanelsFlat = useMemo(() =>
    (woData || []).flatMap((wo: any) => (wo.panels || []).map((p: any) => ({
      id: p.id, nama: p.nama, woId: wo.id, wo: wo.wo, proyek: wo.proyek,
    }))).sort((a: any, b: any) => (a.nama || '').localeCompare(b.nama || '')),
    [woData])
  const allWosFlat = useMemo(() =>
    (woData || []).map((wo: any) => ({ id: wo.id, wo: wo.wo, proyek: wo.proyek, panelCount: (wo.panels || []).length }))
      .filter((w: any) => w.panelCount > 0)
      .sort((a: any, b: any) => (a.wo || '').localeCompare(b.wo || '')),
    [woData])
  const [rekapWoSearch, setRekapWoSearch] = useState('')
  const [rekapWoId, setRekapWoId] = useState<number | null>(null)
  const [rekapScopePanelId, setRekapScopePanelId] = useState<number | null>(null) // null = semua panel di WO ini
  const [rekapSearch, setRekapSearch] = useState('') // filter tabel di layar (poin A), TIDAK ikut query ulang
  const [rekapLoading, setRekapLoading] = useState(false)
  const [rekapRawItems, setRekapRawItems] = useState<{ komponen_master_id: number | null, nama_komponen: string, satuan_dipilih: string | null, satuan: string | null, qty: number, panel_id: number }[]>([])
  const rekapWo = allWosFlat.find((w: any) => w.id === rekapWoId) || null
  const rekapWoFiltered = allWosFlat.filter((w: any) => {
    const q = rekapWoSearch.trim().toLowerCase()
    if (!q) return true
    return [w.wo, w.proyek].join(' ').toLowerCase().includes(q)
  })
  const rekapPanelsInWo = allPanelsFlat.filter((p: any) => p.woId === rekapWoId)

  const fetchRekap = async (woId: number) => {
    setRekapLoading(true)
    try {
      const panelIds = allPanelsFlat.filter((p: any) => p.woId === woId).map((p: any) => p.id)
      if (panelIds.length === 0) { setRekapRawItems([]); setRekapLoading(false); return }
      const perms = await fetchAllPaged((from, to) => supabase.from('permintaan').select('id,panel_id').in('panel_id', panelIds).range(from, to))
      if (perms.length === 0) { setRekapRawItems([]); setRekapLoading(false); return }
      const permIds = perms.map((p: any) => p.id)
      const permPanelMap: Record<number, number> = {}
      perms.forEach((p: any) => { permPanelMap[p.id] = p.panel_id })
      const itemRows = await fetchAllPaged((from, to) =>
        supabase.from('permintaan_item').select('permintaan_id,komponen_master_id,nama_komponen,satuan_dipilih,satuan,qty')
          .in('permintaan_id', permIds).eq('status', 'submit').range(from, to))
      setRekapRawItems(itemRows.map((it: any) => ({ ...it, panel_id: permPanelMap[it.permintaan_id] })))
    } catch (e: any) {
      alert('Gagal memuat rekap: ' + e.message)
    }
    setRekapLoading(false)
  }

  useEffect(() => {
    if (viewMode === 'rekap' && rekapWoId) fetchRekap(rekapWoId)
    // Ganti WO -> reset cakupan panel & search lama, jangan sampai nyangkut ke WO baru.
    setRekapScopePanelId(null)
    setRekapSearch('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, rekapWoId])

  // Agregasi (SUM per komponen_master_id+satuan) DIHITUNG ULANG tiap kali cakupan panel
  // (rekapScopePanelId) berubah - murni di memori dari rekapRawItems, gak query ulang.
  const rekapRowsFull = useMemo(() => {
    const rows = rekapScopePanelId ? rekapRawItems.filter(it => it.panel_id === rekapScopePanelId) : rekapRawItems
    const groups: Record<string, { nama: string, satuan: string, totalQty: number }> = {}
    rows.forEach(it => {
      const satuan = it.satuan_dipilih || it.satuan || '-'
      const key = `${it.komponen_master_id ?? 'x'}|${satuan}`
      if (!groups[key]) groups[key] = { nama: it.nama_komponen, satuan, totalQty: 0 }
      groups[key].totalQty += Number(it.qty) || 0
    })
    return Object.entries(groups).map(([key, v]) => ({ key, ...v })).sort((a, b) => a.nama.localeCompare(b.nama))
  }, [rekapRawItems, rekapScopePanelId])

  // Filter search box (poin A) - CLIENT-SIDE doang, gak nyentuh rekapRawItems/query. Dipakai
  // buat render tabel DAN print sekaligus (array yang sama) - biar WYSIWYG, cetak persis yang
  // lagi kelihatan di layar kalau search sedang aktif, bukan seluruh data mentah.
  const rekapRowsDisplayed = useMemo(() => {
    const q = rekapSearch.trim().toLowerCase()
    if (!q) return rekapRowsFull
    return rekapRowsFull.filter(r => r.nama.toLowerCase().includes(q))
  }, [rekapRowsFull, rekapSearch])

  // Print (REVISI 11 Sep 2026, audit "sidebar ikut ke-print") - dulu window.print() langsung di
  // halaman utama + CSS .no-print buat nyembunyiin toolbar. TERNYATA gak cukup - sidebar/navbar
  // app shell (App.tsx, DI LUAR komponen ini) ikut tercetak karena gak ada CSS print yang
  // nyembunyiin itu (component ini gak punya akses ke markup App.tsx buat nge-hide-nya).
  // Pendekatan baru: bikin window BARU (window.open) isinya HTML MANDIRI (bukan render React
  // sama sekali) - CUMA dokumen rekap, gak ada app shell apa pun buat disembunyikan karena
  // emang gak pernah dirender di situ. Data (rekapWo, rekapRowsDisplayed dkk) di-bake langsung
  // ke string HTML lewat closure - window baru gak butuh akses ke state React.
  const openPrintWindow = () => {
    if (!rekapWo) return
    const rows = rekapRowsDisplayed
    const panelListLabel = rekapScopePanelId
      ? (rekapPanelsInWo.find((p: any) => p.id === rekapScopePanelId)?.nama || '-')
      : rekapPanelsInWo.map((p: any) => p.nama).join(', ')
    const judulWo = `WO ${rekapWo.wo}${rekapScopePanelId ? '' : ` (gabungan ${rekapPanelsInWo.length} panel)`}`
    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Rekap Permintaan Barang - WO ${escapeHtml(rekapWo.wo)}</title>
<style>
  @page { size: A4; margin: 1.8cm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; padding: 0; }
  .kop { border-bottom: 3px solid #1e3a8a; padding-bottom: 16px; margin-bottom: 26px; }
  .kop-inner { display: flex; align-items: center; justify-content: center; gap: 18px; }
  .kop img { height: 56px; width: auto; flex-shrink: 0; }
  .kop-company { font-size: 20px; font-weight: 800; color: #1e293b; letter-spacing: 0.3px; text-align: left; }
  .kop-sub { font-size: 11px; color: #64748b; letter-spacing: 1.2px; margin-top: 2px; text-align: left; }
  .doc-title { text-align: center; margin: 14px 0 18px; }
  .doc-title h1 { font-size: 17px; font-weight: 800; letter-spacing: 1.2px; margin: 0; color: #1e3a8a; }
  .info-block { font-size: 12px; color: #334155; margin-bottom: 20px; line-height: 1.7; }
  .info-block b { color: #1e293b; display: inline-block; width: 90px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr { page-break-inside: avoid; }
  th { background: #1e3a8a; color: #fff; text-align: left; padding: 9px 10px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.4px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  th.num, td.num { text-align: right; }
  th.center, td.center { text-align: center; }
  td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
  tbody tr:nth-child(even) { background: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  tfoot td { padding: 9px 10px; background: #eff6ff; color: #1e3a8a; font-weight: 700; border-top: 2px solid #1e3a8a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .ttd-section { margin-top: 48px; display: flex; justify-content: space-between; gap: 24px; page-break-inside: avoid; }
  .ttd-col { flex: 1; text-align: center; font-size: 12px; }
  .ttd-label { font-weight: 700; margin-bottom: 64px; }
  .ttd-line { border-top: 1px dashed #94a3b8; margin: 0 8px 6px; }
  .ttd-name { color: #64748b; font-size: 11px; }
</style>
</head>
<body>
  <div class="kop">
    <div class="kop-inner">
      <img src="${VISTA_LOGO_DATA_URI}" />
      <div>
        <div class="kop-company">VISTA INTI TEKNIK</div>
        <div class="kop-sub">ERP MANUFACTURE</div>
      </div>
    </div>
  </div>
  <div class="doc-title"><h1>REKAP PERMINTAAN BARANG</h1></div>
  <div class="info-block">
    <div><b>Proyek</b>: ${escapeHtml(rekapWo.proyek)}</div>
    <div><b>WO</b>: ${escapeHtml(judulWo)}</div>
    <div><b>Panel</b>: ${escapeHtml(panelListLabel)}</div>
    <div><b>Tanggal cetak</b>: ${escapeHtml(fmtDateTime(new Date().toISOString()))}</div>
  </div>
  <table>
    <thead><tr><th>Nama Item</th><th class="num">Total Qty</th><th class="center">Satuan</th></tr></thead>
    <tbody>
      ${rows.map(r => `<tr><td>${escapeHtml(r.nama)}</td><td class="num">${escapeHtml(r.totalQty.toLocaleString('id-ID'))}</td><td class="center">${escapeHtml(r.satuan)}</td></tr>`).join('')}
    </tbody>
    <tfoot><tr><td colspan="3">Total ${rows.length} jenis item</td></tr></tfoot>
  </table>
  <div class="ttd-section">
    <div class="ttd-col"><div class="ttd-label">Dibuat oleh</div><div class="ttd-line"></div><div class="ttd-name">Nama: ______________</div></div>
    <div class="ttd-col"><div class="ttd-label">Diperiksa oleh</div><div class="ttd-line"></div><div class="ttd-name">Nama: ______________</div></div>
    <div class="ttd-col"><div class="ttd-label">Disetujui oleh</div><div class="ttd-line"></div><div class="ttd-name">Nama: ______________</div></div>
  </div>
</body>
</html>`
    const win = window.open('', '_blank', 'width=900,height=1100')
    if (!win) { alert('Popup diblokir browser - izinkan popup buat halaman ini supaya bisa print.'); return }
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.onload = () => { win.focus(); win.print(); }
  }

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true)
    const itemRows = await fetchAllPaged((from, to) =>
      supabase.from('permintaan_item').select('*').eq('status', 'menunggu_admin').range(from, to))
    if (itemRows.length === 0) { setItems([]); if (!silent) setLoading(false); return }
    const permIds = [...new Set(itemRows.map((it: any) => it.permintaan_id))]
    const perms = await fetchAllPaged((from, to) => supabase.from('permintaan').select('*').in('id', permIds).range(from, to))
    const permMap: Record<number, any> = {}
    perms.forEach((p: any) => { permMap[p.id] = p })
    const merged = itemRows.map((it: any) => ({ ...it, perm: permMap[it.permintaan_id] })).filter((it: any) => it.perm)
      .sort((a: any, b: any) => (a.perm.created_at || '').localeCompare(b.perm.created_at || ''))
    setItems(merged)
    setQtyEdit(prev => {
      const next = { ...prev }
      merged.forEach((it: any) => { if (next[it.id] === undefined) next[it.id] = String(it.qty) })
      return next
    })
    if (!silent) setLoading(false)
  }

  useEffect(() => {
    fetchData()
    const ch = supabase.channel('realtime-permintaan-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permintaan_item' }, () => fetchData(true))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // RIWAYAT (8 Sep 2026) - disetujui_admin_at itu penanda PERMANEN, gak pernah ditimpa lagi
  // walau Gudang belakangan ubah status jadi submit/reject - jadi query "pernah disetujui admin
  // di tanggal X" harus pakai kolom ini, BUKAN status saat ini. Ditolak admin sebaliknya terminal
  // (status='ditolak_admin' gak pernah berubah lagi), jadi dipakai updated_at sebagai jejak waktu.
  const fetchRiwayat = async (tanggal: string) => {
    setRiwayatLoading(true)
    const startIso = new Date(tanggal + 'T00:00:00').toISOString()
    const endIso = new Date(tanggal + 'T23:59:59.999').toISOString()
    try {
      const [disetujui, ditolak] = await Promise.all([
        fetchAllPaged((from, to) =>
          supabase.from('permintaan_item').select('*').not('disetujui_admin_at', 'is', null)
            .gte('disetujui_admin_at', startIso).lte('disetujui_admin_at', endIso).range(from, to)),
        fetchAllPaged((from, to) =>
          supabase.from('permintaan_item').select('*').eq('status', 'ditolak_admin')
            .gte('updated_at', startIso).lte('updated_at', endIso).range(from, to)),
      ])
      const itemRows = [...disetujui, ...ditolak]
      if (itemRows.length === 0) { setRiwayatItems([]); setRiwayatLoading(false); return }
      const permIds = [...new Set(itemRows.map((it: any) => it.permintaan_id))]
      const perms = await fetchAllPaged((from, to) => supabase.from('permintaan').select('*').in('id', permIds).range(from, to))
      const permMap: Record<number, any> = {}
      perms.forEach((p: any) => { permMap[p.id] = p })
      const merged = itemRows.map((it: any) => ({ ...it, perm: permMap[it.permintaan_id] })).filter((it: any) => it.perm)
        .sort((a: any, b: any) => {
          const ta = a.status === 'ditolak_admin' ? a.updated_at : a.disetujui_admin_at
          const tb = b.status === 'ditolak_admin' ? b.updated_at : b.disetujui_admin_at
          return (tb || '').localeCompare(ta || '')
        })
      setRiwayatItems(merged)
    } catch (e: any) {
      alert('Gagal memuat riwayat: ' + e.message)
    }
    setRiwayatLoading(false)
  }

  useEffect(() => {
    if (viewMode === 'riwayat') fetchRiwayat(riwayatTanggal)
  }, [viewMode, riwayatTanggal])

  const setujui = async (it: any) => {
    const qtyBaru = Number(qtyEdit[it.id])
    if (!qtyEdit[it.id] || isNaN(qtyBaru) || qtyBaru <= 0) { alert('Qty harus diisi, angka lebih dari 0'); return }
    setProcessingId(it.id)
    const { error } = await supabase.from('permintaan_item').update({
      status: 'pending', qty: qtyBaru, disetujui_admin_oleh: adminUsername, disetujui_admin_at: new Date().toISOString(),
    }).eq('id', it.id)
    if (error) { alert('Gagal menyetujui: ' + error.message); setProcessingId(null); return }
    try {
      await supabase.functions.invoke('notify-permintaan', { body: {
        trigger: 'admin_disetujui', jenis: it.perm.jenis, operatorNama: it.perm.operator_nama, divisi: it.perm.divisi,
        proyek: it.perm.proyek, panelNama: it.perm.panel_nama, jumlahItem: 1,
      } })
    } catch { /* notifikasi gagal - diabaikan, keputusan tetap tersimpan */ }
    setProcessingId(null)
  }

  const tolak = async () => {
    if (!rejectTarget) return
    if (!rejectAlasan.trim()) { alert('Alasan penolakan wajib diisi'); return }
    setProcessingId(rejectTarget.id)
    const { error } = await supabase.from('permintaan_item').update({
      status: 'ditolak_admin', catatan_reject: rejectAlasan.trim(), updated_by: adminUsername, updated_at: new Date().toISOString(),
    }).eq('id', rejectTarget.id)
    if (error) { alert('Gagal menolak: ' + error.message); setProcessingId(null); return }
    try {
      await supabase.functions.invoke('notify-permintaan', { body: {
        trigger: 'admin_ditolak', targetDivisi: rejectTarget.perm.divisi,
        namaKomponen: rejectTarget.nama_komponen, qty: rejectTarget.qty, satuan: rejectTarget.satuan, alasan: rejectAlasan.trim(),
      } })
    } catch { /* notifikasi gagal - diabaikan, keputusan tetap tersimpan */ }
    setProcessingId(null)
    setRejectTarget(null)
    setRejectAlasan('')
  }

  const grouped: Record<string, any[]> = {}
  items.forEach((it: any) => {
    const key = it.perm.divisi || '-'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(it)
  })
  const divisiKeys = Object.keys(grouped).sort()

  const riwayatFiltered = riwayatItems.filter((it: any) => {
    if (riwayatStatusFilter === 'DISETUJUI' && it.status === 'ditolak_admin') return false
    if (riwayatStatusFilter === 'DITOLAK' && it.status !== 'ditolak_admin') return false
    const q = riwayatSearch.trim().toLowerCase()
    if (!q) return true
    const hay = [it.nama_komponen, it.perm.proyek, it.perm.panel_nama, it.perm.operator_nama, it.perm.wo_number].join(' ').toLowerCase()
    return hay.includes(q)
  })
  const riwayatGrouped: Record<string, any[]> = {}
  riwayatFiltered.forEach((it: any) => {
    const key = it.perm.divisi || '-'
    if (!riwayatGrouped[key]) riwayatGrouped[key] = []
    riwayatGrouped[key].push(it)
  })
  const riwayatDivisiKeys = Object.keys(riwayatGrouped).sort()

  return (
    <div className="fi">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary,#1e293b)' }}>Permintaan Barang</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            {viewMode === 'pending' ? 'Permintaan operator (BBMB/BBMU) harus disetujui di sini dulu sebelum masuk ke Gudang.' : viewMode === 'riwayat' ? 'Riwayat keputusan admin (disetujui / ditolak).' : 'Rekap semua item yang sudah keluar dari Gudang untuk 1 WO (gabungan semua panel di dalamnya), digabung per jenis item.'}
          </div>
        </div>
        {viewMode === 'pending' && (
          <span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>{items.length} menunggu</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1.5px solid var(--border-color,#e2e8f0)' }}>
        {[{ key: 'pending', label: 'Menunggu Persetujuan' }, { key: 'riwayat', label: 'Riwayat' }, { key: 'rekap', label: 'Rekap per Panel' }].map(t => (
          <button key={t.key} onClick={() => setViewMode(t.key as any)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none',
              borderBottom: viewMode === t.key ? '2.5px solid #2563eb' : '2.5px solid transparent',
              color: viewMode === t.key ? '#2563eb' : '#94a3b8', marginBottom: -1.5,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {viewMode === 'rekap' ? (
        rekapWo ? (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <Btn color="#94a3b8" outline onClick={() => setRekapWoId(null)}>← Ganti WO</Btn>
              <Btn color="#1d4ed8" onClick={openPrintWindow}>🖨️ Print Rekap</Btn>
              {rekapPanelsInWo.length > 1 && (
                <select value={rekapScopePanelId ?? ''} onChange={(e: any) => setRekapScopePanelId(e.target.value ? Number(e.target.value) : null)}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, fontWeight: 600, color: 'var(--text-primary,#1e293b)', background: '#fff' }}>
                  <option value="">Semua panel di WO ini ({rekapPanelsInWo.length})</option>
                  {rekapPanelsInWo.map((p: any) => <option key={p.id} value={p.id}>Cuma panel: {p.nama}</option>)}
                </select>
              )}
              <input type="text" placeholder="🔍 Cari nama item..." value={rekapSearch}
                onChange={(e: any) => setRekapSearch(e.target.value)}
                style={{ flex: '1 1 180px', minWidth: 160, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, color: 'var(--text-primary,#1e293b)' }} />
            </div>

            {/* Kop surat (7 Sep 2026 -> redesain 11 Sep 2026, buat dokumen cetak) - nama WO/proyek
                besar di tengah, tanggal cetak kecil muted di bawahnya, garis pemisah halus sebelum
                tabel. Warna header tabel di bawah (#1e3a8a) SAMA PERSIS dgn thS di RencanaHarian.tsx
                (tabel BUSBAR/Renhar) - biar konsisten satu tema warna di seluruh aplikasi. */}
            <div style={{ textAlign: 'center', padding: '18px 16px 16px', marginBottom: 0, borderBottom: '2px solid #1e3a8a' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{rekapWo.proyek}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginTop: 2 }}>
                WO {rekapWo.wo}{rekapScopePanelId ? ` — ${rekapPanelsInWo.find((p: any) => p.id === rekapScopePanelId)?.nama || ''}` : ` (gabungan ${rekapPanelsInWo.length} panel)`}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', marginTop: 4 }}>REKAP PERMINTAAN BARANG</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Item yang sudah keluar dari Gudang · dicetak {fmtDateTime(new Date().toISOString())}</div>
            </div>

            {rekapLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Memuat...</div>
            ) : rekapRowsDisplayed.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                  {rekapRowsFull.length === 0 ? 'Belum ada item' : 'Tidak ada item yang cocok dengan pencarian'}
                </div>
                <div style={{ fontSize: 12 }}>
                  {rekapRowsFull.length === 0 ? 'Belum ada permintaan barang yang sudah keluar dari Gudang untuk cakupan ini.' : `Coba kata kunci lain (pencarian: "${rekapSearch}").`}
                </div>
              </Card>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={rekapThS}>Nama Item</th>
                    <th style={{ ...rekapThS, textAlign: 'right' }}>Total Qty</th>
                    <th style={{ ...rekapThS, textAlign: 'center' }}>Satuan</th>
                  </tr>
                </thead>
                <tbody>
                  {rekapRowsDisplayed.map((r, ri) => (
                    <tr key={r.key} style={{ background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #f1f5f9', color: '#1e293b', fontWeight: 600 }}>{r.nama}</td>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>{r.totalQty.toLocaleString('id-ID')}</td>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', color: '#64748b' }}>{r.satuan}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ padding: '11px 14px', background: '#eff6ff', color: '#1e3a8a', fontWeight: 700, fontSize: 12.5, borderTop: '2px solid #1e3a8a' }}>
                      Total {rekapRowsDisplayed.length} jenis item{rekapSearch ? ` (dari ${rekapRowsFull.length} total)` : ''}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
            {rekapSearch && rekapRowsDisplayed.length > 0 && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                Menampilkan {rekapRowsDisplayed.length} dari {rekapRowsFull.length} item (hasil pencarian "{rekapSearch}") - Print akan cetak persis yang ditampilkan ini.
              </div>
            )}
          </div>
        ) : (
          <div>
            <input type="text" placeholder="Cari nomor WO atau nama proyek..." value={rekapWoSearch}
              onChange={(e: any) => setRekapWoSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, color: 'var(--text-primary,#1e293b)', marginBottom: 14 }} />
            {rekapWoFiltered.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>WO tidak ditemukan.</Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rekapWoFiltered.map((w: any) => (
                  <button key={w.id} onClick={() => setRekapWoId(w.id)}
                    style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>WO {w.wo}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{w.proyek} - {w.panelCount} panel</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      ) : viewMode === 'riwayat' ? (
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <input type="date" value={riwayatTanggal} onChange={(e: any) => setRiwayatTanggal(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, color: 'var(--text-primary,#1e293b)' }} />
            <input type="text" placeholder="Cari nama komponen, proyek, panel, operator..." value={riwayatSearch}
              onChange={(e: any) => setRiwayatSearch(e.target.value)}
              style={{ flex: '1 1 220px', minWidth: 180, padding: '7px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, color: 'var(--text-primary,#1e293b)' }} />
            <div style={{ display: 'flex', gap: 6 }}>
              {RIWAYAT_STATUS_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => setRiwayatStatusFilter(opt.key)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: riwayatStatusFilter === opt.key ? `1.5px solid ${opt.color}` : '1.5px solid #e2e8f0',
                    background: riwayatStatusFilter === opt.key ? `${opt.color}15` : '#fff',
                    color: riwayatStatusFilter === opt.key ? opt.color : '#64748b',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {riwayatLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Memuat...</div>
          ) : riwayatDivisiKeys.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🗂️</div>
              <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>Tidak ada riwayat</div>
              <div style={{ fontSize: 12 }}>Tidak ada keputusan admin pada tanggal ini.</div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {riwayatDivisiKeys.map(divisi => (
                <div key={divisi}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 8 }}>
                    {DIVISI_LABEL[divisi] || divisi} <span style={{ color: '#cbd5e1' }}>({riwayatGrouped[divisi].length})</span>
                  </div>
                  {/* List rata kiri (8 Sep 2026, ganti dari grid card) - baris berurutan dipisah
                      border-bottom, semua teks left-align (bukan card justify-content:space-between
                      yang bikin badge status nempel kanan). */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {riwayatGrouped[divisi].map((it: any) => {
                      const ditolak = it.status === 'ditolak_admin'
                      return (
                        <div key={it.id} style={{ padding: '10px 4px', borderBottom: '1px solid var(--border-color,#e2e8f0)', textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                            <Badge label={ditolak ? '✕ Ditolak Admin' : '✓ Disetujui'} color={ditolak ? '#dc2626' : '#16a34a'} bg={ditolak ? '#fef2f2' : '#f0fdf4'} />
                            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary,#1e293b)' }}>{it.nama_komponen} <span style={{ color: '#94a3b8', fontWeight: 600 }}>×{it.qty}{it.satuan ? ` ${it.satuan}` : ''}</span></span>
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>
                            {it.perm.jenis} · {it.perm.proyek || '-'} · {it.perm.panel_nama || '-'} {it.perm.wo_number ? `(WO ${it.perm.wo_number})` : ''}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                            Diminta oleh <strong>{it.perm.operator_nama || '-'}</strong> — {fmtDateTime(it.perm.created_at)}
                          </div>
                          <div style={{ fontSize: 12, color: ditolak ? '#b91c1c' : '#15803d' }}>
                            {ditolak
                              ? <>Ditolak oleh <strong>{it.updated_by || '-'}</strong> — {fmtDateTime(it.updated_at)}{it.catatan_reject ? <div style={{ marginTop: 3, color: '#64748b' }}>Alasan: {it.catatan_reject}</div> : null}</>
                              : <>Disetujui oleh <strong>{it.disetujui_admin_oleh || '-'}</strong> — {fmtDateTime(it.disetujui_admin_at)}</>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Memuat...</div>
      ) : divisiKeys.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>Tidak ada permintaan menunggu</div>
          <div style={{ fontSize: 12 }}>Semua permintaan sudah diproses. Permintaan baru dari operator akan muncul di sini.</div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {divisiKeys.map(divisi => (
            <div key={divisi}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 8 }}>
                {DIVISI_LABEL[divisi] || divisi} <span style={{ color: '#cbd5e1' }}>({grouped[divisi].length})</span>
              </div>
              {/* List rata kiri (8 Sep 2026, ganti dari grid card) - baris berurutan dipisah
                  border-bottom, semua teks left-align (bukan card justify-content:space-between
                  yang bikin badge status nempel kanan). Tombol aksi tetap berdampingan tapi gak
                  lagi stretch flex:1 penuh (biar gak kelihatan kayak lebar card lama). */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {grouped[divisi].map((it: any) => {
                  const isProcessing = processingId === it.id
                  return (
                    <div key={it.id} style={{ padding: '10px 4px', borderBottom: '1px solid var(--border-color,#e2e8f0)', textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <Badge label="⏳ Menunggu Admin" color="#d97706" bg="#fffbeb" />
                        <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary,#1e293b)' }}>{it.nama_komponen}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>
                        {it.perm.jenis} · {it.perm.proyek || '-'} · {it.perm.panel_nama || '-'} {it.perm.wo_number ? `(WO ${it.perm.wo_number})` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
                        Diminta oleh <strong>{it.perm.operator_nama || '-'}</strong> — {fmtDateTime(it.perm.created_at)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', borderRadius: 8, padding: '7px 10px', marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Qty diminta:</span>
                        <input type="number" min="0" value={qtyEdit[it.id] ?? String(it.qty)}
                          onChange={(e: any) => setQtyEdit(prev => ({ ...prev, [it.id]: e.target.value }))}
                          style={{ width: 110, padding: '6px 10px', borderRadius: 6, border: '1.5px solid #cbd5e1', fontSize: 13, fontWeight: 700, color: 'var(--text-primary,#1e293b)' }} />
                        <span style={{ fontSize: 12, color: '#64748b' }}>{it.satuan || ''}</span>
                        {Number(qtyEdit[it.id]) !== it.qty && !isNaN(Number(qtyEdit[it.id])) && (
                          <span style={{ fontSize: 10.5, color: '#d97706', fontWeight: 600 }}>(diubah dari {it.qty})</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn color="#dc2626" outline onClick={() => setRejectTarget(it)} disabled={isProcessing}>
                          ✕ Tolak
                        </Btn>
                        <Btn color="#16a34a" onClick={() => setujui(it)} disabled={isProcessing}>
                          {isProcessing ? 'Menyimpan...' : '✓ Setujui'}
                        </Btn>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {rejectTarget && (
        <Modal title="Tolak Permintaan" onClose={() => { setRejectTarget(null); setRejectAlasan('') }} width={420}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            {rejectTarget.nama_komponen} ×{rejectTarget.qty}{rejectTarget.satuan ? ` ${rejectTarget.satuan}` : ''} - diminta oleh {rejectTarget.perm?.operator_nama || '-'}
          </div>
          <textarea autoFocus value={rejectAlasan} onChange={(e: any) => setRejectAlasan(e.target.value)} rows={3}
            placeholder="Alasan penolakan (wajib diisi)..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border-color,#e2e8f0)', fontSize: 13, color: 'var(--text-primary,#1e293b)', fontFamily: 'inherit', resize: 'vertical', marginBottom: 14, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn color="#94a3b8" outline onClick={() => { setRejectTarget(null); setRejectAlasan('') }}>Batal</Btn>
            <Btn color="#dc2626" onClick={tolak} disabled={processingId === rejectTarget.id}>
              {processingId === rejectTarget.id ? 'Menyimpan...' : 'Tolak Permintaan'}
            </Btn>
          </div>
        </Modal>
      )}

    </div>
  )
}
