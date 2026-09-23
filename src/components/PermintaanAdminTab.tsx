import { useState, useEffect, useMemo, type CSSProperties } from 'react'
import { supabase } from '../lib/supabase'
import { Btn, Modal, Badge, Lbl, Inp, Sel } from './ui/Primitives'
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
  qc: 'QC', nameplate: 'Nameplate', komponen: 'QS', gudang: 'Gudang', // label "Komponen"->"QS" (23 Sep 2026), key TETAP "komponen"
  admin: 'Admin', // permintaan yang diajukan LANGSUNG oleh admin (16 Sep 2026, lihat submitAjukanAdmin)
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

// Header tabel Rekap TAMPILAN LAYAR (14 Sep 2026, ikut gaya Quality Center - abu terang, BUKAN
// biru tua #1e3a8a lagi) - dokumen PRINT (openPrintWindow, string HTML terpisah di bawah) TETAP
// pakai header biru tua formal seperti sebelumnya, TIDAK disentuh sama sekali oleh constant ini.
const rekapThS: CSSProperties = {
  padding: '10px 14px', fontWeight: 800, fontSize: 11, color: '#475569',
  textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', whiteSpace: 'nowrap',
}

const RIWAYAT_STATUS_OPTIONS: { key: 'ALL' | 'DISETUJUI' | 'DITOLAK', label: string, color: string }[] = [
  { key: 'ALL', label: 'Semua', color: '#475569' },
  { key: 'DISETUJUI', label: '✓ Disetujui', color: '#16a34a' },
  { key: 'DITOLAK', label: '✕ Ditolak Admin', color: '#dc2626' },
]

export function PermintaanAdminTab({ user, woData = [] }: any) {
  const adminUsername: string = user?.username || user?.name || 'Admin'
  const [viewMode, setViewMode] = useState<'pending' | 'riwayat' | 'rekap' | 'koreksi'>('pending')
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<any[]>([])
  const [qtyEdit, setQtyEdit] = useState<Record<number, string>>({})
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [rejectTarget, setRejectTarget] = useState<any | null>(null)
  const [rejectAlasan, setRejectAlasan] = useState('')
  // KONFIRMASI AMBIL - PERMINTAAN ADMIN (23 Sep 2026) - reuse PERSIS kolom & logic
  // sudah_diambil/diambil_oleh/diambil_at (permintaan_item, migration 17 Agu 2026) yang selama
  // ini cuma dikonfirmasi operator (PermintaanView.tsx, vista-pekerja, tombol "Konfirmasi Sudah
  // Diambil"). Gap: permintaan divisi='admin' TIDAK PERNAH nongol di riwayat operator manapun
  // (query mereka scoped .eq("divisi",divisi) sendiri) - begitu Gudang set status='submit',
  // gak ada UI SAMA SEKALI buat tandai sudah_diambil, field itu permanen false walau barangnya
  // beneran sudah diambil. SENGAJA cuma untuk baris divisi==='admin' di tab Riwayat (bukan
  // baris operator biasa yang tampil di sini juga - itu SUDAH punya jalur sendiri di vista-
  // pekerja, gak perlu tombol duplikat yang malah bisa bikin dua sisi rebutan konfirmasi).
  const [confirmingAmbilId, setConfirmingAmbilId] = useState<number | null>(null)
  const konfirmasiAmbilAdmin = async (itemId: number) => {
    setConfirmingAmbilId(itemId)
    const { error } = await supabase.from('permintaan_item').update({
      sudah_diambil: true, diambil_oleh: adminUsername, diambil_at: new Date().toISOString(),
    }).eq('id', itemId)
    if (error) { alert('Gagal konfirmasi pengambilan: ' + error.message); setConfirmingAmbilId(null); return }
    setConfirmingAmbilId(null)
    fetchRiwayat(riwayatTanggal)
  }

  // KOREKSI QTY (13 Sep 2026, "approval koreksi qty diarahkan ke Admin") - dulu diputuskan siapa
  // pun yang login di divisi peminta (PermintaanView.tsx vista-pekerja, tab "Koreksi", SEKARANG
  // DIHAPUS). Sekarang di sini, pola SAMA PERSIS "Menunggu Persetujuan" di atas (qty bisa diedit
  // sebelum Setujui, Tolak wajib alasan) - target_divisi='admin' adalah pseudo-divisi (nilai yang
  // ditulis RiwayatGudangTab.tsx saat submit, BUKAN kolom baru - lihat migration
  // 20260907010000_permintaan_item_koreksi.sql versi lama utk histori kenapa kolomnya
  // "target_divisi" padahal sekarang isinya selalu 'admin').
  const [koreksiList, setKoreksiList] = useState<any[]>([])
  const [loadingKoreksi, setLoadingKoreksi] = useState(true)
  const [koreksiQtyEdit, setKoreksiQtyEdit] = useState<Record<number, string>>({})
  const [processingKoreksiId, setProcessingKoreksiId] = useState<number | null>(null)
  const [koreksiRejectTarget, setKoreksiRejectTarget] = useState<any | null>(null)
  const [koreksiRejectAlasan, setKoreksiRejectAlasan] = useState('')

  const fetchKoreksi = async (silent = false) => {
    if (!silent) setLoadingKoreksi(true)
    const koreksiRows = await fetchAllPaged((from, to) =>
      supabase.from('permintaan_item_koreksi').select('*').eq('target_divisi', 'admin').eq('status', 'menunggu').range(from, to))
    if (koreksiRows.length === 0) { setKoreksiList([]); if (!silent) setLoadingKoreksi(false); return }
    const itemIds = [...new Set(koreksiRows.map((k: any) => k.permintaan_item_id))]
    const itemRows = await fetchAllPaged((from, to) => supabase.from('permintaan_item').select('*').in('id', itemIds).range(from, to))
    const permIds = [...new Set(itemRows.map((it: any) => it.permintaan_id))]
    const perms = await fetchAllPaged((from, to) => supabase.from('permintaan').select('*').in('id', permIds).range(from, to))
    const permMap: Record<number, any> = {}
    perms.forEach((p: any) => { permMap[p.id] = p })
    const itemMap: Record<number, any> = {}
    itemRows.forEach((it: any) => { itemMap[it.id] = { ...it, perm: permMap[it.permintaan_id] } })
    const merged = koreksiRows.map((k: any) => ({ ...k, item: itemMap[k.permintaan_item_id] }))
      .filter((k: any) => k.item && k.item.perm)
      .sort((a: any, b: any) => (a.diajukan_at || '').localeCompare(b.diajukan_at || ''))
    setKoreksiList(merged)
    setKoreksiQtyEdit(prev => {
      const next = { ...prev }
      merged.forEach((k: any) => { if (next[k.id] === undefined) next[k.id] = String(k.qty_diusulkan) })
      return next
    })
    if (!silent) setLoadingKoreksi(false)
  }

  useEffect(() => {
    fetchKoreksi()
    const ch = supabase.channel('realtime-permintaan-admin-koreksi')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permintaan_item_koreksi' }, () => fetchKoreksi(true))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Setujui: qty ASLI di permintaan_item berubah ke nilai yang admin konfirmasi (bisa beda dari
  // qty_diusulkan Gudang kalau admin edit dulu), sudah_diinput direset (Gudang perlu input ulang
  // ke pembukuan). AUDIT FIX (13 Sep 2026, "aplikasi bebas bug") - dulu 2 UPDATE terpisah dari
  // client (qty item, lalu status koreksi) TANPA transaksi - kalau koneksi putus di tengah, qty
  // sudah berubah tapi status koreksi nyangkut 'menunggu' (keliatan belum diproses padahal udah).
  // Sekarang lewat RPC approve_permintaan_koreksi (atomik + guard status='menunggu', race
  // condition 2 admin klik bersamaan otomatis ke-tangani - yang kedua dapat sukses=false).
  const setujuiKoreksi = async (k: any) => {
    const qtyBaru = Number(koreksiQtyEdit[k.id])
    if (!koreksiQtyEdit[k.id] || isNaN(qtyBaru) || qtyBaru < 0) { alert('Qty harus diisi, angka >= 0'); return }
    setProcessingKoreksiId(k.id)
    const { data, error } = await supabase.rpc('approve_permintaan_koreksi', {
      p_koreksi_id: k.id, p_qty_final: qtyBaru, p_admin: adminUsername,
    }).single<{ sukses: boolean, pesan: string }>()
    if (error || !data?.sukses) { alert('Gagal menyetujui: ' + (error?.message || data?.pesan || 'unknown error')); setProcessingKoreksiId(null); return }
    try {
      await supabase.functions.invoke('notify-permintaan', { body: {
        trigger: 'koreksi_keputusan', namaKomponen: k.item?.nama_komponen, disetujui: true, qtyDiusulkan: qtyBaru, satuan: k.item?.satuan,
      } })
    } catch { /* notifikasi gagal - diabaikan, keputusan tetap tersimpan */ }
    setProcessingKoreksiId(null)
  }

  // AUDIT FIX (13 Sep 2026) - sama kayak setujuiKoreksi di atas, lewat RPC reject_permintaan_koreksi
  // (atomik + guard status='menunggu').
  const tolakKoreksi = async () => {
    if (!koreksiRejectTarget) return
    if (!koreksiRejectAlasan.trim()) { alert('Alasan penolakan wajib diisi'); return }
    setProcessingKoreksiId(koreksiRejectTarget.id)
    const { data, error } = await supabase.rpc('reject_permintaan_koreksi', {
      p_koreksi_id: koreksiRejectTarget.id, p_admin: adminUsername, p_catatan: koreksiRejectAlasan.trim(),
    }).single<{ sukses: boolean, pesan: string }>()
    if (error || !data?.sukses) { alert('Gagal menolak: ' + (error?.message || data?.pesan || 'unknown error')); setProcessingKoreksiId(null); return }
    try {
      await supabase.functions.invoke('notify-permintaan', { body: {
        trigger: 'koreksi_keputusan', namaKomponen: koreksiRejectTarget.item?.nama_komponen, disetujui: false,
        qtyDiusulkan: koreksiRejectTarget.qty_diusulkan, satuan: koreksiRejectTarget.item?.satuan,
      } })
    } catch { /* notifikasi gagal - diabaikan, keputusan tetap tersimpan */ }
    setProcessingKoreksiId(null)
    setKoreksiRejectTarget(null)
    setKoreksiRejectAlasan('')
  }

  // RIWAYAT LENGKAP - disiapkan/diambil/koreksi qty (23 Sep 2026, diminta user setelah fitur
  // "Konfirmasi Ambil"). Disiapkan oleh reuse permintaan_item.updated_by/updated_at (kolom sudah
  // ada, ditulis Gudang PERSIS saat mereka submit/penuhi - lihat PermintaanGudangTab.tsx
  // vista-pekerja). Koreksi qty reuse tabel permintaan_item_koreksi (sudah ada sejak 13 Sep 2026,
  // dipakai tab "Koreksi Qty" buat approval - Riwayat SEBELUMNYA gak pernah JOIN ke tabel ini sama
  // sekali, jadi begitu koreksi diputuskan, riwayatnya hilang dari KEDUA tab). Cuma status
  // 'disetujui' yang ditampilkan (keputusan user) - koreksi yang ditolak gak muncul di sini (tetap
  // ada historinya sendiri kalau suatu saat dibutuhkan, cuma gak dirender).
  const [riwayatKoreksiMap, setRiwayatKoreksiMap] = useState<Record<number, any[]>>({})
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
  // AJUKAN PERMINTAAN LANGSUNG OLEH ADMIN (16 Sep 2026, DIPERBAIKI 21 Sep 2026) - admin Vista
  // Teknik bisa ajukan sendiri (mis. kebutuhan darurat/administratif), skip tahap approval
  // 'menunggu_admin' (admin yang ajukan = otomatis disetujui, disetujui_admin_oleh/at diisi
  // langsung) - TAPI TETAP WAJIB lewat Gudang buat pemenuhan fisik, PERSIS seperti permintaan
  // operator biasa yang sudah di-approve (setujui() di atas). Status jadi 'pending' (BUKAN
  // 'submit' - itu status TERMINAL, cuma boleh ditulis Gudang sendiri sesudah mereka BENERAN
  // memenuhi barangnya). Versi awal (16 Sep) salah asumsi "admin ajukan = otomatis selesai",
  // nulis status='submit' + updated_by/at langsung di sini - akibatnya PermintaanGudangTab.tsx
  // (filter ketat status==='pending') GAK PERNAH nampilin permintaan admin sama sekali, Gudang
  // gak pernah tau ada permintaan itu. updated_by/updated_at SENGAJA TIDAK diisi di sini (beda
  // dari versi lama) - itu murni milik Gudang, cuma diisi kalau mereka BENERAN sudah proses.
  // sudah_diambil SENGAJA TIDAK ikut di-set true - itu peristiwa fisik terpisah (ada orang yang
  // benar-benar ambil barangnya), gak boleh diasumsikan otomatis ikut kejadian cuma karena
  // permintaannya diajukan+disetujui via jalur ini.
  const [ajukanModalOpen, setAjukanModalOpen] = useState(false)
  const [ajukanWoSearch, setAjukanWoSearch] = useState('')
  const [ajukanWoId, setAjukanWoId] = useState<number | null>(null)
  const [ajukanPanelId, setAjukanPanelId] = useState<number | null>(null)
  const [ajukanJenis, setAjukanJenis] = useState<'BBMB' | 'BBMU'>('BBMB')
  const [ajukanKomponenList, setAjukanKomponenList] = useState<any[]>([])
  const [ajukanKomponenLoading, setAjukanKomponenLoading] = useState(false)
  type AjukanItemRow = { searchText: string, komponenId: string, namaKomponen: string, qty: string, satuanList: string[], satuanDipilih: string }
  const kosongItemAjukan = (): AjukanItemRow => ({ searchText: '', komponenId: '', namaKomponen: '', qty: '1', satuanList: [], satuanDipilih: '' })
  const [ajukanItems, setAjukanItems] = useState<AjukanItemRow[]>([kosongItemAjukan()])
  const [ajukanSubmitting, setAjukanSubmitting] = useState(false)
  const ajukanPanelOpts = ajukanWoId ? allPanelsFlat.filter((p: any) => p.woId === ajukanWoId) : []
  const ajukanWoFiltered = allWosFlat.filter((w: any) => {
    const q = ajukanWoSearch.trim().toLowerCase()
    if (!q) return true
    return [w.wo, w.proyek].join(' ').toLowerCase().includes(q)
  })

  // Komponen master di-scope per kategori (BBMB/BBMU) - SAMA PERSIS pola PermintaanView.tsx
  // (Vista Pekerja): fetchAllPaged (komponen_master kategori BBMU sendirian 1.424 baris, lewat
  // cap 1000 default kalau gak di-.range()), refetch tiap kategori diganti.
  useEffect(() => {
    if (!ajukanModalOpen) return
    let cancelled = false
    const fetchKomponen = async () => {
      setAjukanKomponenLoading(true)
      try {
        const rows = await fetchAllPaged((from, to) =>
          supabase.from('komponen_master').select('id,nama,satuan_utama,satuan_list').eq('kategori', ajukanJenis).order('nama', { ascending: true }).range(from, to))
        if (!cancelled) setAjukanKomponenList(rows)
      } catch (e: any) {
        if (!cancelled) alert('Gagal memuat daftar komponen: ' + e.message)
      }
      if (!cancelled) setAjukanKomponenLoading(false)
    }
    fetchKomponen()
    return () => { cancelled = true }
  }, [ajukanModalOpen, ajukanJenis])

  const tutupAjukanModal = () => {
    setAjukanModalOpen(false)
    setAjukanWoId(null); setAjukanPanelId(null); setAjukanWoSearch('')
    setAjukanJenis('BBMB'); setAjukanItems([kosongItemAjukan()])
  }
  const updateAjukanItem = (idx: number, patch: Partial<AjukanItemRow>) => {
    setAjukanItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }
  const pilihKomponenAjukan = (idx: number, m: any) => {
    const satuanList: string[] = m.satuan_list || []
    const satuanDefault = m.satuan_utama && satuanList.includes(m.satuan_utama) ? m.satuan_utama : (satuanList[0] || '')
    updateAjukanItem(idx, { komponenId: String(m.id), namaKomponen: m.nama, searchText: m.nama, satuanList, satuanDipilih: satuanDefault })
  }

  const submitAjukanAdmin = async () => {
    if (!ajukanWoId) { alert('Pilih WO dulu'); return }
    if (!ajukanPanelId) { alert('Pilih Panel dulu'); return }
    const itemsValid = ajukanItems.filter(it => it.namaKomponen && Number(it.qty) > 0)
    if (itemsValid.length === 0) { alert('Isi minimal 1 komponen dengan qty lebih dari 0'); return }
    setAjukanSubmitting(true)
    const woObj = allWosFlat.find((w: any) => w.id === ajukanWoId)
    const panelObj = allPanelsFlat.find((p: any) => p.id === ajukanPanelId)
    const nowIso = new Date().toISOString()
    const { data: perm, error: permErr } = await supabase.from('permintaan').insert({
      jenis: ajukanJenis, operator_nama: adminUsername, divisi: 'admin', sub_bagian: null,
      wo_id: ajukanWoId, panel_id: ajukanPanelId,
      wo_number: woObj?.wo || null, proyek: woObj?.proyek || null, panel_nama: panelObj?.nama || null,
    }).select().single()
    if (permErr || !perm) {
      alert('Gagal mengirim permintaan: ' + (permErr?.message || 'unknown error'))
      setAjukanSubmitting(false)
      return
    }
    // BUG FIX (21 Sep 2026, dilaporkan user - "permintaan dari Admin gak nongol di Gudang") -
    // dulu status DITULIS LANGSUNG 'submit' di sini ('submit' itu status TERMINAL, cuma boleh
    // ditulis GUDANG sendiri sesudah mereka BENERAN memenuhi/mengeluarkan barangnya - lihat
    // PermintaanGudangTab.tsx). PermintaanGudangTab.tsx (jalur TIDAK disentuh) filter ketat
    // status==="pending" - permintaan dari admin yang lompat langsung ke 'submit' JADI GAK
    // PERNAH KELIATAN GUDANG SAMA SEKALI, walau datanya sendiri tersimpan sempurna (dicek live:
    // 3 permintaan admin terbaru semua status=submit, updated_by/at sudah keisi nama admin
    // padahal field itu seharusnya null sampai GUDANG yang isi).
    // Dikonfirmasi user: permintaan admin TETAP WAJIB lewat Gudang, sama seperti permintaan
    // operator - bukan jalur pintas. Fix: status jadi 'pending' (bukan skip ke 'submit'), field
    // yang ditulis dipersis-samakan dengan setujui() di atas (approval admin ke permintaan
    // OPERATOR biasa) - cuma status+qty+disetujui_admin_oleh/at, TIDAK isi updated_by/updated_at
    // (itu murni milik Gudang, isi kalau ditulis di sini bikin baris ini KELIATAN sudah
    // diproses Gudang padahal belum disentuh sama sekali - dicek live baseline baris pending
    // asli: updated_by/updated_at selalu null sampai Gudang proses).
    const rows = itemsValid.map(it => ({
      permintaan_id: perm.id,
      komponen_master_id: it.komponenId ? Number(it.komponenId) : null,
      nama_komponen: it.namaKomponen,
      qty: Number(it.qty),
      satuan: it.satuanDipilih || null,
      satuan_dipilih: it.satuanDipilih || null,
      status: 'pending', // admin = otomatis disetujui (disetujui_admin_oleh/at diisi di bawah), TAPI TETAP lewat Gudang buat pemenuhan fisik seperti permintaan operator
      disetujui_admin_oleh: adminUsername, disetujui_admin_at: nowIso,
      dilihat_operator: true,
    }))
    const { error: itemErr } = await supabase.from('permintaan_item').insert(rows)
    if (itemErr) {
      alert('Permintaan tersimpan tapi gagal simpan komponen: ' + itemErr.message)
      setAjukanSubmitting(false)
      return
    }
    setAjukanSubmitting(false)
    tutupAjukanModal()
    alert('Permintaan berhasil diajukan & langsung disetujui - sekarang menunggu diproses Gudang.')
    if (viewMode === 'riwayat') fetchRiwayat(riwayatTanggal)
  }

  const [rekapWoSearch, setRekapWoSearch] = useState('')
  const [rekapWoId, setRekapWoId] = useState<number | null>(null)
  const [rekapScopePanelId, setRekapScopePanelId] = useState<number | null>(null) // null = semua panel di WO ini
  const [rekapSearch, setRekapSearch] = useState('') // filter tabel di layar (poin A), TIDAK ikut query ulang
  const [rekapLoading, setRekapLoading] = useState(false)
  const [rekapRawItems, setRekapRawItems] = useState<{ komponen_master_id: number | null, nama_komponen: string, satuan_dipilih: string | null, satuan: string | null, qty: number, panel_id: number, divisi: string | null }[]>([])
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
      const perms = await fetchAllPaged((from, to) => supabase.from('permintaan').select('id,panel_id,divisi').in('panel_id', panelIds).range(from, to))
      if (perms.length === 0) { setRekapRawItems([]); setRekapLoading(false); return }
      const permIds = perms.map((p: any) => p.id)
      const permPanelMap: Record<number, number> = {}
      const permDivisiMap: Record<number, string | null> = {}
      perms.forEach((p: any) => { permPanelMap[p.id] = p.panel_id; permDivisiMap[p.id] = p.divisi })
      const itemRows = await fetchAllPaged((from, to) =>
        supabase.from('permintaan_item').select('permintaan_id,komponen_master_id,nama_komponen,satuan_dipilih,satuan,qty')
          .in('permintaan_id', permIds).eq('status', 'submit').range(from, to))
      setRekapRawItems(itemRows.map((it: any) => ({ ...it, panel_id: permPanelMap[it.permintaan_id], divisi: permDivisiMap[it.permintaan_id] })))
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

  // Agregasi (SUM per divisi+komponen_master_id+satuan) DIHITUNG ULANG tiap kali cakupan panel
  // (rekapScopePanelId) berubah - murni di memori dari rekapRawItems, gak query ulang.
  // Divisi (14 Sep 2026) IKUT masuk key grouping - item yang sama diminta 2 divisi beda TETAP
  // 2 baris terpisah (bukan digabung jadi 1), biar qty per baris tetap akurat mewakili 1 divisi.
  // Sumber divisi = permintaan.divisi (kolom yang SUDAH ADA, diisi otomatis dari divisi login
  // operator saat submit - dipakai juga di tab Menunggu Persetujuan/Riwayat/Koreksi Qty).
  const rekapRowsFull = useMemo(() => {
    const rows = rekapScopePanelId ? rekapRawItems.filter(it => it.panel_id === rekapScopePanelId) : rekapRawItems
    const groups: Record<string, { nama: string, satuan: string, totalQty: number, divisi: string }> = {}
    rows.forEach(it => {
      const satuan = it.satuan_dipilih || it.satuan || '-'
      const divisi = it.divisi || '-'
      const key = `${divisi}|${it.komponen_master_id ?? 'x'}|${satuan}`
      if (!groups[key]) groups[key] = { nama: it.nama_komponen, satuan, totalQty: 0, divisi }
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
  /* Logo di pojok kiri (absolute, keluar dari flow) TERPISAH dari teks nama perusahaan yang
     center - dua elemen independen, bukan satu blok gabungan kayak sebelumnya. .kop dikasih
     position:relative + min-height biar logo absolute punya area acuan, flex+justify-center
     buat nengahin teks company secara vertikal DAN horizontal relatif ke lebar halaman penuh
     (bukan relatif ke sisa ruang setelah logo). */
  .kop { position: relative; display: flex; align-items: center; justify-content: center; min-height: 42px; border-bottom: 3px solid #1e3a8a; padding-bottom: 16px; margin-bottom: 22px; }
  .kop-logo { position: absolute; left: 0; top: 50%; transform: translateY(-50%); height: 34px; width: auto; }
  .kop-company { font-size: 21px; font-weight: 800; color: #1e293b; letter-spacing: 0.4px; text-align: center; }
  .doc-title { text-align: center; margin: 0 0 18px; }
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
    <img class="kop-logo" src="${VISTA_LOGO_DATA_URI}" />
    <div class="kop-company">PT. VISTA INTI TEKNIK</div>
  </div>
  <div class="doc-title"><h1>REKAP PERMINTAAN BARANG</h1></div>
  <div class="info-block">
    <div><b>Proyek</b>: ${escapeHtml(rekapWo.proyek)}</div>
    <div><b>WO</b>: ${escapeHtml(judulWo)}</div>
    <div><b>Panel</b>: ${escapeHtml(panelListLabel)}</div>
    <div><b>Tanggal cetak</b>: ${escapeHtml(fmtDateTime(new Date().toISOString()))}</div>
  </div>
  <table>
    <thead><tr><th>Divisi</th><th>Nama Item</th><th class="num">Total Qty</th><th class="center">Satuan</th></tr></thead>
    <tbody>
      ${rows.map(r => `<tr><td>${escapeHtml(DIVISI_LABEL[r.divisi] || r.divisi)}</td><td>${escapeHtml(r.nama)}</td><td class="num">${escapeHtml(r.totalQty.toLocaleString('id-ID'))}</td><td class="center">${escapeHtml(r.satuan)}</td></tr>`).join('')}
    </tbody>
    <tfoot><tr><td colspan="4">Total ${rows.length} jenis item</td></tr></tfoot>
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
      // Koreksi qty yang SUDAH disetujui, punya permintaan_item_id salah satu dari item yang
      // sedang ditampilkan - status='disetujui' saja (keputusan user, koreksi ditolak gak
      // dirender). Di-map per item, bisa lebih dari 1 koreksi per item (jarang, tapi mungkin).
      const itemIds = merged.map((it: any) => it.id)
      const koreksiMap: Record<number, any[]> = {}
      if (itemIds.length > 0) {
        const koreksiRows = await fetchAllPaged((from, to) =>
          supabase.from('permintaan_item_koreksi').select('*').eq('status', 'disetujui')
            .in('permintaan_item_id', itemIds).range(from, to))
        koreksiRows.forEach((k: any) => { (koreksiMap[k.permintaan_item_id] ||= []).push(k) })
      }
      setRiwayatKoreksiMap(koreksiMap)
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

  const koreksiGrouped: Record<string, any[]> = {}
  koreksiList.forEach((k: any) => {
    const key = k.item.perm.divisi || '-'
    if (!koreksiGrouped[key]) koreksiGrouped[key] = []
    koreksiGrouped[key].push(k)
  })
  const koreksiDivisiKeys = Object.keys(koreksiGrouped).sort()

  return (
    <div className="fi">
      {/* Banner header (14 Sep 2026, ikut gaya Quality Center/LaporanQCView.tsx - gradient biru +
          icon box + judul/deskripsi dinamis per tab + lingkaran dekoratif). Counter "X menunggu"
          fungsi lama TETAP ada, cuma dipindah ke dalam banner di sisi kanan. */}
      <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '1px solid #bfdbfe', borderRadius: 14, padding: '20px 24px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px #1d4ed84d', zIndex: 1 }}>
          <i className="ti ti-clipboard-list" style={{ fontSize: 28, color: '#fff' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: '#1e293b' }}>Permintaan Barang</div>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: '#334155', marginTop: 2 }}>
            {viewMode === 'pending' ? 'Permintaan operator (BBMB/BBMU) harus disetujui di sini dulu sebelum masuk ke Gudang.' : viewMode === 'riwayat' ? 'Riwayat keputusan admin (disetujui / ditolak).' : viewMode === 'koreksi' ? 'Pengajuan koreksi qty dari Gudang (salah input) - qty ASLI baru berubah setelah disetujui di sini.' : 'Rekap semua item yang sudah keluar dari Gudang untuk 1 WO (gabungan semua panel di dalamnya), digabung per jenis item.'}
          </div>
        </div>
        {/* Ajukan Permintaan (admin) - SELALU tampil apapun viewMode aktif (aksi global, bukan
            konten per-tab), diposisikan sebelum badge counter yang emang cuma muncul per-tab. */}
        <button onClick={() => setAjukanModalOpen(true)}
          style={{ zIndex: 1, display: 'flex', alignItems: 'center', gap: 6, background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 20, padding: '9px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
          <i className="ti ti-plus" style={{ fontSize: 14 }} /> Ajukan Permintaan
        </button>
        {viewMode === 'pending' && (
          <span style={{ zIndex: 1, background: '#fff', color: '#1d4ed8', borderRadius: 20, padding: '5px 14px', fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>{items.length} menunggu</span>
        )}
        {viewMode === 'koreksi' && (
          <span style={{ zIndex: 1, background: '#fff', color: '#b45309', borderRadius: 20, padding: '5px 14px', fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>{koreksiList.length} menunggu</span>
        )}
        <div style={{ position: 'absolute', right: -24, top: -30, width: 150, height: 150, borderRadius: '50%', background: '#1d4ed81a' }} />
        <div style={{ position: 'absolute', right: 60, bottom: -40, width: 100, height: 100, borderRadius: '50%', background: '#1d4ed812' }} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1.5px solid var(--border-color,#e2e8f0)' }}>
        {/* Badge jumlah pending di label tab (16 Sep 2026) - items.length/koreksiList.length UDAH
            di-fetch + realtime-subscribe dari mount (independen dari viewMode aktif, lihat
            useEffect fetchData/fetchKoreksi di atas), jadi badge ini akurat real-time TANPA query
            baru sama sekali - murni tambahan render. Sembunyi total kalau 0 (bukan nampilin "0"). */}
        {[
          { key: 'pending', label: 'Menunggu Persetujuan', count: items.length },
          { key: 'riwayat', label: 'Riwayat', count: 0 },
          { key: 'rekap', label: 'Rekap per Panel', count: 0 },
          { key: 'koreksi', label: 'Koreksi Qty', count: koreksiList.length },
        ].map(t => (
          <button key={t.key} onClick={() => setViewMode(t.key as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none',
              borderBottom: viewMode === t.key ? '2.5px solid #2563eb' : '2.5px solid transparent',
              color: viewMode === t.key ? '#2563eb' : '#94a3b8', marginBottom: -1.5,
            }}>
            {t.label}
            {t.count > 0 && (
              <span style={{
                minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#dc2626', color: '#fff',
                fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}>{t.count}</span>
            )}
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
                  style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12.5, fontWeight: 600, color: '#1e293b', background: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}>
                  <option value="">Semua panel di WO ini ({rekapPanelsInWo.length})</option>
                  {rekapPanelsInWo.map((p: any) => <option key={p.id} value={p.id}>Cuma panel: {p.nama}</option>)}
                </select>
              )}
              <input type="text" placeholder="🔍 Cari nama item..." value={rekapSearch}
                onChange={(e: any) => setRekapSearch(e.target.value)}
                style={{ flex: '1 1 180px', minWidth: 160, height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12.5, fontWeight: 500, color: '#1e293b', background: '#fff', fontFamily: 'inherit', outline: 'none' }} />
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
              <div style={{ textAlign: 'center', padding: 50, color: '#94a3b8', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <i className="ti ti-package-off" style={{ fontSize: 36, display: 'block', marginBottom: 10 }} />
                <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                  {rekapRowsFull.length === 0 ? 'Belum ada item' : 'Tidak ada item yang cocok dengan pencarian'}
                </div>
                <div style={{ fontSize: 12 }}>
                  {rekapRowsFull.length === 0 ? 'Belum ada permintaan barang yang sudah keluar dari Gudang untuk cakupan ini.' : `Coba kata kunci lain (pencarian: "${rekapSearch}").`}
                </div>
              </div>
            ) : (
              /* Tabel layar (14 Sep 2026, ikut gaya Quality Center - header abu terang + ikon per
                 baris) - SENGAJA beda dari header biru tua dokumen print (openPrintWindow di atas,
                 string HTML terpisah, TIDAK disentuh sama sekali) - style baru ini cuma buat
                 tampilan di layar aplikasi. */
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflowX: 'auto' as const }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                      <th style={rekapThS}>Divisi</th>
                      <th style={rekapThS}>Nama Item</th>
                      <th style={{ ...rekapThS, textAlign: 'right' }}>Total Qty</th>
                      <th style={{ ...rekapThS, textAlign: 'center' }}>Satuan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekapRowsDisplayed.map((r, ri) => (
                      <tr key={r.key} style={{ borderBottom: ri < rekapRowsDisplayed.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <td style={{ padding: '11px 14px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' as const }}>{DIVISI_LABEL[r.divisi] || r.divisi}</td>
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <i className="ti ti-box" style={{ fontSize: 15, color: '#94a3b8', flexShrink: 0 }} />
                            <span style={{ color: '#1e293b', fontWeight: 600 }}>{r.nama}</span>
                          </div>
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>{r.totalQty.toLocaleString('id-ID')}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'center', color: '#64748b' }}>{r.satuan}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ padding: '11px 14px', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: 12.5, borderTop: '2px solid #dbeafe' }}>
                        Total {rekapRowsDisplayed.length} jenis item{rekapSearch ? ` (dari ${rekapRowsFull.length} total)` : ''}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {rekapSearch && rekapRowsDisplayed.length > 0 && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                Menampilkan {rekapRowsDisplayed.length} dari {rekapRowsFull.length} item (hasil pencarian "{rekapSearch}") - Print akan cetak persis yang ditampilkan ini.
              </div>
            )}
          </div>
        ) : (
          <div>
            <input type="text" placeholder="🔍 Cari nomor WO atau nama proyek..." value={rekapWoSearch}
              onChange={(e: any) => setRekapWoSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12.5, fontWeight: 500, color: '#1e293b', fontFamily: 'inherit', outline: 'none', marginBottom: 14 }} />
            {rekapWoFiltered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 50, color: '#94a3b8', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <i className="ti ti-folder-x" style={{ fontSize: 36, display: 'block', marginBottom: 10 }} />
                WO tidak ditemukan.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rekapWoFiltered.map((w: any) => (
                  <button key={w.id} onClick={() => setRekapWoId(w.id)}
                    style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className="ti ti-folder" style={{ fontSize: 18, color: '#2563eb' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>WO {w.wo}</div>
                      <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{w.proyek} - {w.panelCount} panel</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      ) : viewMode === 'riwayat' ? (
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <input type="date" value={riwayatTanggal} onChange={(e: any) => setRiwayatTanggal(e.target.value)}
              style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12.5, fontWeight: 600, color: '#1e293b', fontFamily: 'inherit' }} />
            <input type="text" placeholder="🔍 Cari nama komponen, proyek, panel, operator..." value={riwayatSearch}
              onChange={(e: any) => setRiwayatSearch(e.target.value)}
              style={{ flex: '1 1 220px', minWidth: 180, height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12.5, fontWeight: 500, color: '#1e293b', fontFamily: 'inherit', outline: 'none' }} />
            <div style={{ display: 'flex', gap: 6 }}>
              {RIWAYAT_STATUS_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => setRiwayatStatusFilter(opt.key)}
                  style={{
                    height: 36, padding: '0 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: riwayatStatusFilter === opt.key ? `1.5px solid ${opt.color}` : '1px solid #e2e8f0',
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
            <div style={{ textAlign: 'center', padding: 50, color: '#94a3b8', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <i className="ti ti-history-toggle" style={{ fontSize: 36, display: 'block', marginBottom: 10 }} />
              <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>Tidak ada riwayat</div>
              <div style={{ fontSize: 12 }}>Tidak ada keputusan admin pada tanggal ini.</div>
            </div>
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
                      // BUG FIX (23 Sep 2026, ditemukan pas "scan ulang cek bug lain") - `ditolak`
                      // SEBELUMNYA cuma cek status==='ditolak_admin', gak menghitung status==='reject'
                      // (Gudang menolak - barang gak ada stok dkk, BEDA dari admin menolak approval).
                      // updated_by/updated_at DIPAKAI BERSAMA oleh submit ("disiapkan") DAN reject
                      // ("ditolak Gudang") di PermintaanGudangTab.tsx (vista-pekerja) - baris "Disiapkan
                      // oleh" yang baru ditambahkan kemarin jadi SALAH LABEL kalau cuma cek !ditolak:
                      // item yang Gudang TOLAK (status=reject) ikut kebaca "!ditolak" (karena bukan
                      // 'ditolak_admin') terus nampilin "Disiapkan oleh {updated_by}" - padahal orang itu
                      // MENOLAK, bukan menyiapkan. Dicek live: 21 item nyata kena kasus ini (status=reject
                      // + disetujui_admin_at terisi, catatan_reject a.l. "salah input"/"Terlalu banyak").
                      const ditolakAdmin = it.status === 'ditolak_admin'
                      const ditolakGudang = it.status === 'reject'
                      const ditolak = ditolakAdmin || ditolakGudang
                      return (
                        <div key={it.id} style={{ padding: '10px 4px', borderBottom: '1px solid var(--border-color,#e2e8f0)', textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                            <i className="ti ti-box" style={{ fontSize: 15, color: '#94a3b8', flexShrink: 0 }} />
                            <Badge label={ditolakAdmin ? '✕ Ditolak Admin' : ditolakGudang ? '✕ Ditolak Gudang' : '✓ Disetujui'} color={ditolak ? '#dc2626' : '#16a34a'} bg={ditolak ? '#fef2f2' : '#f0fdf4'} />
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
                          {/* RIWAYAT LENGKAP (23 Sep 2026) - disiapkan/koreksi qty/diambil, semua reuse kolom
                              yang sudah ada (lihat komentar riwayatKoreksiMap di atas). Tampil buat SEMUA baris
                              non-ditolak (bukan cuma divisi==='admin') - ini murni info bacaan, beda dari tombol
                              Konfirmasi Ambil di bawah yang sengaja dibatasi (itu ACTION, bisa numpuk konfirmasi
                              dgn operator kalau dibuka juga; info bacaan begini gak punya risiko itu). */}
                          {it.status === 'submit' && it.updated_by && (
                            <div style={{ fontSize: 11.5, color: '#334155', marginTop: 4 }}>
                              Disiapkan oleh <strong>{it.updated_by}</strong> — {fmtDateTime(it.updated_at)}
                            </div>
                          )}
                          {!ditolak && (riwayatKoreksiMap[it.id] || []).map((k: any) => (
                            <div key={k.id} style={{ fontSize: 11.5, color: '#b45309', marginTop: 4 }}>
                              Qty dikoreksi <strong>{k.qty_lama}{it.satuan ? ` ${it.satuan}` : ''} → {k.qty_diusulkan}{it.satuan ? ` ${it.satuan}` : ''}</strong> oleh {k.diajukan_oleh || '-'} (Gudang) — {fmtDateTime(k.diajukan_at)}
                              <div style={{ color: '#64748b' }}>Disetujui oleh {k.disetujui_oleh || '-'} — {fmtDateTime(k.diputuskan_at)}{k.alasan ? ` · Alasan: ${k.alasan}` : ''}</div>
                            </div>
                          ))}
                          {!ditolak && it.sudah_diambil && (
                            <div style={{ marginTop: 4, fontSize: 11.5, color: '#16a34a', fontWeight: 700 }}>
                              ✓ Sudah diambil oleh {it.diambil_oleh || '-'} — {fmtDateTime(it.diambil_at)}
                            </div>
                          )}
                          {/* Konfirmasi Ambil - CUMA permintaan yang diajukan admin sendiri (divisi==='admin'),
                              lihat komentar konfirmasiAmbilAdmin di atas kenapa dibatasi ke sini saja. */}
                          {!ditolak && it.perm.divisi === 'admin' && it.status === 'submit' && !it.sudah_diambil && (
                            <button onClick={() => konfirmasiAmbilAdmin(it.id)} disabled={confirmingAmbilId === it.id}
                              style={{ width: '100%', marginTop: 8, padding: '7px', borderRadius: 7, border: 'none',
                                background: confirmingAmbilId === it.id ? '#94a3b8' : '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 11,
                                cursor: confirmingAmbilId === it.id ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                              {confirmingAmbilId === it.id ? 'Menyimpan...' : 'Konfirmasi Sudah Diambil'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === 'koreksi' ? (
        loadingKoreksi ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Memuat...</div>
        ) : koreksiDivisiKeys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 50, color: '#94a3b8', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <i className="ti ti-circle-check" style={{ fontSize: 36, display: 'block', marginBottom: 10, color: '#16a34a' }} />
            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>Tidak ada pengajuan koreksi</div>
            <div style={{ fontSize: 12 }}>Pengajuan koreksi qty dari Gudang (kalau ada salah input) akan muncul di sini.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {koreksiDivisiKeys.map(divisi => (
              <div key={divisi}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 8 }}>
                  {DIVISI_LABEL[divisi] || divisi} <span style={{ color: '#cbd5e1' }}>({koreksiGrouped[divisi].length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {koreksiGrouped[divisi].map((k: any) => {
                    const isProcessing = processingKoreksiId === k.id
                    return (
                      <div key={k.id} style={{ padding: '10px 4px', borderBottom: '1px solid var(--border-color,#e2e8f0)', textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <i className="ti ti-box" style={{ fontSize: 15, color: '#94a3b8', flexShrink: 0 }} />
                          <Badge label="⏳ Menunggu Admin" color="#d97706" bg="#fffbeb" />
                          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary,#1e293b)' }}>{k.item.nama_komponen}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>
                          {k.item.perm.jenis} · {k.item.perm.proyek || '-'} · {k.item.perm.panel_nama || '-'} {k.item.perm.wo_number ? `(WO ${k.item.perm.wo_number})` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
                          Diajukan oleh <strong>{k.diajukan_oleh}</strong> (Gudang) — {fmtDateTime(k.diajukan_at)}
                        </div>
                        <div style={{ background: '#fffbeb', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
                            <span style={{ color: '#94a3b8', textDecoration: 'line-through' }}>{k.qty_lama}{k.item.satuan ? ` ${k.item.satuan}` : ''}</span>
                            <span style={{ color: '#d97706' }}>→</span>
                            <span style={{ color: '#16a34a' }}>{k.qty_diusulkan}{k.item.satuan ? ` ${k.item.satuan}` : ''}</span>
                          </div>
                          <div style={{ fontSize: 11.5, color: '#92400e', marginTop: 6, lineHeight: 1.5 }}>💬 {k.alasan}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', borderRadius: 8, padding: '7px 10px', marginBottom: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Qty final:</span>
                          <input type="number" min="0" value={koreksiQtyEdit[k.id] ?? String(k.qty_diusulkan)}
                            onChange={(e: any) => setKoreksiQtyEdit(prev => ({ ...prev, [k.id]: e.target.value }))}
                            style={{ width: 110, padding: '6px 10px', borderRadius: 6, border: '1.5px solid #cbd5e1', fontSize: 13, fontWeight: 700, color: 'var(--text-primary,#1e293b)' }} />
                          <span style={{ fontSize: 12, color: '#64748b' }}>{k.item.satuan || ''}</span>
                          {Number(koreksiQtyEdit[k.id]) !== k.qty_diusulkan && !isNaN(Number(koreksiQtyEdit[k.id])) && (
                            <span style={{ fontSize: 10.5, color: '#d97706', fontWeight: 600 }}>(diubah dari usulan {k.qty_diusulkan})</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Btn color="#dc2626" outline onClick={() => setKoreksiRejectTarget(k)} disabled={isProcessing}>
                            ✕ Tolak
                          </Btn>
                          <Btn color="#16a34a" onClick={() => setujuiKoreksi(k)} disabled={isProcessing}>
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
        )
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Memuat...</div>
      ) : divisiKeys.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 50, color: '#94a3b8', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <i className="ti ti-circle-check" style={{ fontSize: 36, display: 'block', marginBottom: 10, color: '#16a34a' }} />
          <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>Tidak ada permintaan menunggu</div>
          <div style={{ fontSize: 12 }}>Semua permintaan sudah diproses. Permintaan baru dari operator akan muncul di sini.</div>
        </div>
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
                        <i className="ti ti-box" style={{ fontSize: 15, color: '#94a3b8', flexShrink: 0 }} />
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

      {koreksiRejectTarget && (
        <Modal title="Tolak Pengajuan Koreksi Qty" onClose={() => { setKoreksiRejectTarget(null); setKoreksiRejectAlasan('') }} width={420}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            {koreksiRejectTarget.item?.nama_komponen} - usulan {koreksiRejectTarget.qty_lama} → {koreksiRejectTarget.qty_diusulkan}{koreksiRejectTarget.item?.satuan ? ` ${koreksiRejectTarget.item.satuan}` : ''} - diajukan oleh {koreksiRejectTarget.diajukan_oleh}
          </div>
          <textarea autoFocus value={koreksiRejectAlasan} onChange={(e: any) => setKoreksiRejectAlasan(e.target.value)} rows={3}
            placeholder="Alasan penolakan (wajib diisi)..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border-color,#e2e8f0)', fontSize: 13, color: 'var(--text-primary,#1e293b)', fontFamily: 'inherit', resize: 'vertical', marginBottom: 14, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn color="#94a3b8" outline onClick={() => { setKoreksiRejectTarget(null); setKoreksiRejectAlasan('') }}>Batal</Btn>
            <Btn color="#dc2626" onClick={tolakKoreksi} disabled={processingKoreksiId === koreksiRejectTarget.id}>
              {processingKoreksiId === koreksiRejectTarget.id ? 'Menyimpan...' : 'Tolak Pengajuan'}
            </Btn>
          </div>
        </Modal>
      )}

      {ajukanModalOpen && (
        <Modal title="Ajukan Permintaan (Admin)" onClose={tutupAjukanModal} width={640}>
          <div style={{ fontSize: 12, color: '#1d4ed8', marginBottom: 14, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 }}>
            Permintaan yang diajukan lewat sini LANGSUNG disetujui (tidak perlu approval lagi karena diajukan oleh Admin) - tapi tetap masuk antrean Gudang buat diproses/disiapkan, sama seperti permintaan biasa.
          </div>

          <Lbl>Work Order</Lbl>
          {ajukanWoId ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1.5px solid #bfdbfe', background: '#eff6ff', borderRadius: 8, marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>WO {allWosFlat.find((w: any) => w.id === ajukanWoId)?.wo}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{allWosFlat.find((w: any) => w.id === ajukanWoId)?.proyek}</div>
              </div>
              <button onClick={() => { setAjukanWoId(null); setAjukanPanelId(null) }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Ganti</button>
            </div>
          ) : (
            <>
              <Inp placeholder="Cari nomor WO atau nama proyek..." value={ajukanWoSearch} onChange={(e: any) => setAjukanWoSearch(e.target.value)} style={{ marginBottom: 8 }} />
              <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border-color,#e2e8f0)', borderRadius: 8, marginBottom: 14 }}>
                {ajukanWoFiltered.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>WO tidak ditemukan</div>
                ) : ajukanWoFiltered.map((w: any) => (
                  <button key={w.id} onClick={() => { setAjukanWoId(w.id); setAjukanPanelId(null) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f1f5f9', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <span style={{ fontWeight: 700, fontSize: 12.5, color: '#1e293b' }}>WO {w.wo}</span>
                    <span style={{ fontSize: 11.5, color: '#64748b' }}> - {w.proyek}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {ajukanWoId && (
            <>
              <Lbl>Panel</Lbl>
              <Sel value={ajukanPanelId ?? ''} onChange={(e: any) => setAjukanPanelId(e.target.value ? Number(e.target.value) : null)} style={{ marginBottom: 14 }}>
                <option value="">Pilih panel...</option>
                {ajukanPanelOpts.map((p: any) => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </Sel>
            </>
          )}

          <Lbl>Kategori</Lbl>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(['BBMB', 'BBMU'] as const).map(j => (
              <button key={j} onClick={() => setAjukanJenis(j)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${ajukanJenis === j ? '#2563eb' : 'var(--border-color,#e2e8f0)'}`, background: ajukanJenis === j ? '#eff6ff' : '#fff', color: ajukanJenis === j ? '#2563eb' : '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                {j}
              </button>
            ))}
          </div>

          <Lbl>Komponen</Lbl>
          {ajukanKomponenLoading && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>Memuat daftar komponen...</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
            {ajukanItems.map((it, idx) => {
              const q = it.searchText.trim().toLowerCase()
              const matches = q && !it.komponenId ? ajukanKomponenList.filter((m: any) => m.nama.toLowerCase().includes(q)).slice(0, 50) : []
              return (
                <div key={idx} style={{ border: '1px solid var(--border-color,#e2e8f0)', borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <Inp placeholder="Cari nama komponen..." value={it.searchText}
                        onChange={(e: any) => updateAjukanItem(idx, { searchText: e.target.value, komponenId: '', namaKomponen: '', satuanList: [], satuanDipilih: '' })} />
                      {matches.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid var(--border-color,#e2e8f0)', borderRadius: 8, marginTop: 2, maxHeight: 180, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          {matches.map((m: any) => (
                            <button key={m.id} onClick={() => pilihKomponenAjukan(idx, m)}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', borderBottom: '1px solid #f1f5f9', background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                              {m.nama}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Inp type="number" min="0" placeholder="Qty" value={it.qty} onChange={(e: any) => updateAjukanItem(idx, { qty: e.target.value })} style={{ width: 80, flexShrink: 0 }} />
                    {it.satuanList.length > 1 ? (
                      <Sel value={it.satuanDipilih} onChange={(e: any) => updateAjukanItem(idx, { satuanDipilih: e.target.value })} style={{ width: 100, flexShrink: 0 }}>
                        {it.satuanList.map(s => <option key={s} value={s}>{s}</option>)}
                      </Sel>
                    ) : (
                      <div style={{ width: 100, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#64748b' }}>{it.satuanDipilih || '-'}</div>
                    )}
                    {ajukanItems.length > 1 && (
                      <button onClick={() => setAjukanItems(prev => prev.filter((_, i) => i !== idx))}
                        style={{ width: 32, flexShrink: 0, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', borderRadius: 7, cursor: 'pointer', fontSize: 14 }}>✕</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <Btn color="#64748b" outline onClick={() => setAjukanItems(prev => [...prev, kosongItemAjukan()])} style={{ marginBottom: 16, width: '100%' }}>+ Tambah Baris</Btn>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn color="#94a3b8" outline onClick={tutupAjukanModal} disabled={ajukanSubmitting}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={submitAjukanAdmin} disabled={ajukanSubmitting}>
              {ajukanSubmitting ? 'Mengirim...' : 'Ajukan & Setujui'}
            </Btn>
          </div>
        </Modal>
      )}

    </div>
  )
}
