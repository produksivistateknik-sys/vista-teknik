import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { Card, Btn, Modal } from './ui/Primitives'

// ─────────────────────────────────────────────────────────────────────────────
// TAB PERMINTAAN BARANG (BBMB & BBMU) - sisi warehouse/admin. Independen total
// dari Stok Komponen (System>Stok) dan Warehouse progress per panel - tabel
// sendiri (permintaan/permintaan_item/komponen_bbmb_master), gak nyentuh
// keduanya. Counterpart dari PermintaanView.tsx di vista-pekerja.
// ─────────────────────────────────────────────────────────────────────────────

// vista-teknik gak punya mapping label divisi yang sama persis kayak
// DIVISI_CONFIG vista-pekerja (beda konsep - itu buat login, ini buat display
// grouping) - direplikasi kecil di sini, cukup buat label tampilan.
const DIVISI_LABEL: Record<string, string> = {
  mekanik: 'Mekanik', painting: 'Painting', assembling: 'Assembling',
  wiring_ctrl: 'Wiring Control', wiring_pwr: 'Wiring Power',
  qc: 'QC', nameplate: 'Nameplate', komponen: 'Komponen',
}

const STATUS_LABEL_BBMU: Record<string, string> = { pending: 'Menunggu', tersedia: 'Tersedia', belum_lengkap: 'Belum Lengkap', belum_datang: 'Belum Datang' }
const STATUS_COLOR_BBMU: Record<string, string> = { pending: '#94a3b8', tersedia: '#16a34a', belum_lengkap: '#f59e0b', belum_datang: '#dc2626' }
const STATUS_LABEL_BBMB: Record<string, string> = { pending: 'Menunggu', submit: 'Disiapkan', reject: 'Ditolak' }
const STATUS_COLOR_BBMB: Record<string, string> = { pending: '#94a3b8', submit: '#16a34a', reject: '#dc2626' }

// Paginated fetch (hindari cap 1000-row default Supabase - lihat memory
// project soal renhar) - dipakai buat semua query di tab ini yang bisa tumbuh.
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

const fetchItemsByPermintaanIds = async (ids: number[]): Promise<any[]> => {
  if (ids.length === 0) return []
  return fetchAllPaged((from, to) => supabase.from('permintaan_item').select('*').in('permintaan_id', ids).range(from, to))
}

const groupItemsByPermintaan = (items: any[]): Record<number, any[]> => {
  const map: Record<number, any[]> = {}
  items.forEach((it: any) => { (map[it.permintaan_id] = map[it.permintaan_id] || []).push(it) })
  return map
}

const fmtDateTime = (d: string) => d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'

export function PermintaanBarangTab({ user }: { user: any }) {
  const adminName = user?.name || user?.nama || 'Admin'
  const [jenisTab, setJenisTab] = useState<'BBMB' | 'BBMU'>('BBMB')

  return (
    <div className="fi">
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {(['BBMB', 'BBMU'] as const).map(j => (
          <button key={j} onClick={() => setJenisTab(j)}
            style={{ padding: '9px 22px', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit',
              background: jenisTab === j ? '#fff' : 'transparent', color: jenisTab === j ? '#0d9488' : '#64748b',
              boxShadow: jenisTab === j ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {j === 'BBMB' ? 'BBMB (Bantu)' : 'BBMU (Utama)'}
          </button>
        ))}
      </div>
      {jenisTab === 'BBMB' ? <BBMBSection adminName={adminName} /> : <BBMUSection adminName={adminName} />}
    </div>
  )
}

// ================= BBMB =================
function BBMBSection({ adminName }: { adminName: string }) {
  const [view, setView] = useState<'masuk' | 'riwayat'>('masuk')
  const [uploadOpen, setUploadOpen] = useState(false)
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ k: 'masuk', l: '📥 Permintaan Masuk' }, { k: 'riwayat', l: '🕒 Riwayat Harian' }].map(t => (
            <button key={t.k} onClick={() => setView(t.k as any)}
              style={{ height: 30, padding: '0 16px', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit',
                border: view === t.k ? '1.5px solid #1d4ed8' : '1px solid #e2e8f0',
                background: view === t.k ? '#eff6ff' : '#fff', color: view === t.k ? '#1d4ed8' : '#64748b' }}>
              {t.l}
            </button>
          ))}
        </div>
        <button onClick={() => setUploadOpen(true)}
          style={{ height: 30, padding: '0 16px', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit',
            border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#16a34a' }}>
          📤 Upload Master Komponen
        </button>
      </div>
      {view === 'masuk' ? <BBMBPermintaanMasuk adminName={adminName} /> : <BBMBRiwayatHarian />}
      {uploadOpen && <UploadMasterKomponenModal onClose={() => setUploadOpen(false)} />}
    </div>
  )
}

// ================= Upload Master Komponen (Excel/CSV) =================
type ParsedRow = { nama: string; tipe: string }
type UploadResult = { berhasil: number; skipDuplikat: number; skipKosong: number }

// Kolom A = nama (wajib), kolom B = tipe/spesifikasi (opsional, mis. "SEGI 6" buat
// "BAUT 10X100 KUNCI"). File sumber (database barang.xlsx) TANPA header - baris
// pertama LANGSUNG data. Tetap deteksi header kalau suatu saat ada file YANG PAKAI
// header (baris pertama isinya literal "nama"/"tipe"/dst) - baris itu dilewati,
// selain itu semua baris (termasuk baris pertama) dianggap data.
const HEADER_WORDS = new Set(['nama', 'tipe', 'satuan', 'name', 'type'])
const isHeaderRow = (row: any[]) => {
  const a = String(row[0] ?? '').trim().toLowerCase()
  const b = String(row[1] ?? '').trim().toLowerCase()
  return HEADER_WORDS.has(a) || HEADER_WORDS.has(b)
}

const parseFileRows = async (file: File): Promise<ParsedRow[]> => {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false })
  const dataRows = rawRows.length > 0 && isHeaderRow(rawRows[0]) ? rawRows.slice(1) : rawRows
  return dataRows.map(row => ({
    nama: String(row[0] ?? '').trim(),
    tipe: String(row[1] ?? '').trim(),
  }))
}

function UploadMasterKomponenModal({ onClose }: { onClose: () => void }) {
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState('')

  const onFile = async (file: File | null) => {
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setError('')
    try {
      const rows = await parseFileRows(file)
      setParsed(rows)
    } catch (e: any) {
      setError('Gagal membaca file: ' + (e?.message || 'format tidak dikenali'))
      setParsed(null)
    }
  }

  const kosongCount = (parsed || []).filter(r => !r.nama).length
  const isiCount = (parsed || []).length - kosongCount

  const doUpload = async () => {
    if (!parsed) return
    setUploading(true)
    // Ambil semua nama existing dulu (paginated) buat cek duplikat - lebih murah daripada
    // insert satu-satu dan nangkep error unique constraint per baris.
    const existing = await fetchAllPaged((from, to) => supabase.from('komponen_bbmb_master').select('nama').range(from, to))
    const existingSet = new Set(existing.map((r: any) => r.nama.trim().toLowerCase()))
    const seenInFile = new Set<string>()
    const toInsert: { nama: string; tipe: string | null }[] = []
    let skipDuplikat = 0
    let skipKosong = 0
    for (const row of parsed) {
      if (!row.nama) { skipKosong++; continue }
      const key = row.nama.toLowerCase()
      if (existingSet.has(key) || seenInFile.has(key)) { skipDuplikat++; continue }
      seenInFile.add(key)
      toInsert.push({ nama: row.nama, tipe: row.tipe || null })
    }
    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from('komponen_bbmb_master').insert(toInsert)
      if (insErr) { setError('Gagal upload: ' + insErr.message); setUploading(false); return }
    }
    setResult({ berhasil: toInsert.length, skipDuplikat, skipKosong })
    setUploading(false)
  }

  return (
    <Modal title="📤 Upload Master Komponen BBMB" onClose={onClose} width={480}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
        File Excel (.xlsx) atau CSV, TANPA header - kolom A: <strong>nama</strong> (wajib), kolom B: <strong>tipe</strong>/spesifikasi (opsional, mis. "SEGI 6"). Baris dengan nama yang sudah ada di master (atau duplikat dalam file) otomatis dilewati - data lama TIDAK dihapus/diganti.
      </div>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={(e: any) => onFile(e.target.files?.[0] || null)}
        style={{ width: '100%', padding: '8px 0', fontSize: 12, marginBottom: 12 }} />
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {parsed && !result && (
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#475569', marginBottom: 14 }}>
          <strong>{fileName}</strong> — {parsed.length} baris terdeteksi ({isiCount} ada nama{kosongCount > 0 ? `, ${kosongCount} kosong (akan dilewati)` : ''}).
        </div>
      )}
      {result && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: '#166534', marginBottom: 14, lineHeight: 1.8 }}>
          ✅ <strong>{result.berhasil}</strong> komponen berhasil ditambahkan.<br />
          {result.skipDuplikat > 0 && <>⏭ {result.skipDuplikat} baris dilewati (nama sudah ada / duplikat).<br /></>}
          {result.skipKosong > 0 && <>⏭ {result.skipKosong} baris dilewati (kolom nama kosong).<br /></>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn outline color="#64748b" onClick={onClose}>{result ? 'Tutup' : 'Batal'}</Btn>
        {!result && (
          <Btn color="#16a34a" onClick={doUpload} disabled={!parsed || uploading || isiCount === 0}
            style={{ opacity: !parsed || uploading || isiCount === 0 ? 0.6 : 1 }}>
            {uploading ? 'Mengunggah...' : `Upload ${isiCount > 0 ? `(${isiCount} baris)` : ''}`}
          </Btn>
        )}
      </div>
    </Modal>
  )
}

function BBMBPermintaanMasuk({ adminName }: { adminName: string }) {
  const [loading, setLoading] = useState(true)
  const [permMap, setPermMap] = useState<Record<number, any>>({})
  const [itemsByPerm, setItemsByPerm] = useState<Record<number, any[]>>({})
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectCatatan, setRejectCatatan] = useState('')

  const fetchData = async () => {
    setLoading(true)
    // Bounded by "berapa item yang lagi pending sekarang", bukan seluruh histori - aman buat volume tumbuh.
    const pendingItems = await fetchAllPaged((from, to) => supabase.from('permintaan_item').select('*').eq('status', 'pending').range(from, to))
    const permIds = [...new Set(pendingItems.map((it: any) => it.permintaan_id))]
    if (permIds.length === 0) { setPermMap({}); setItemsByPerm({}); setLoading(false); return }
    const perms = await fetchAllPaged((from, to) => supabase.from('permintaan').select('*').eq('jenis', 'BBMB').in('id', permIds).order('created_at', { ascending: false }).range(from, to))
    const allItems = await fetchItemsByPermintaanIds(permIds)
    const pMap: Record<number, any> = {}
    perms.forEach((p: any) => { pMap[p.id] = p })
    setPermMap(pMap)
    setItemsByPerm(groupItemsByPermintaan(allItems))
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    const ch = supabase.channel('realtime-permintaan-bbmb-masuk')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permintaan_item' }, fetchData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'permintaan' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setItemStatus = async (itemId: number, status: 'submit' | 'reject', catatan?: string) => {
    await supabase.from('permintaan_item').update({ status, catatan_reject: catatan || null, updated_by: adminName, updated_at: new Date().toISOString(), dilihat_operator: false }).eq('id', itemId)
    setRejectingId(null); setRejectCatatan('')
    fetchData()
  }

  // Grouping per divisi asal - hanya permintaan yang MASIH punya item pending yang dihitung.
  const grouped: Record<string, number[]> = {}
  Object.values(permMap).forEach((p: any) => {
    const items = itemsByPerm[p.id] || []
    if (!items.some((it: any) => it.status === 'pending')) return
    const key = p.divisi || '-'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(p.id)
  })
  const divisiKeys = Object.keys(grouped).sort()

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Memuat...</div>
  if (divisiKeys.length === 0) return <Card style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Tidak ada permintaan BBMB yang menunggu diproses. ✅</Card>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {divisiKeys.map(divisi => (
        <div key={divisi}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#1e293b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, padding: '2px 10px', fontSize: 11 }}>{DIVISI_LABEL[divisi] || divisi}</span>
            <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>{grouped[divisi].length} permintaan</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {grouped[divisi].map(permId => {
              const p = permMap[permId]
              const items = itemsByPerm[permId] || []
              return (
                <Card key={permId} style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{p.operator_nama} {p.sub_bagian ? `(${p.sub_bagian})` : ''}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{p.proyek || '-'} · {p.panel_nama || '-'} · WO {p.wo_number || '-'}</div>
                    </div>
                    <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{fmtDateTime(p.created_at)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {items.map((it: any) => (
                      <div key={it.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', borderRadius: 8, padding: '7px 10px' }}>
                          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{it.nama_komponen} <span style={{ color: '#64748b', fontWeight: 500 }}>×{it.qty}{it.satuan ? ` ${it.satuan}` : ''}</span></span>
                          {it.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => setItemStatus(it.id, 'submit')}
                                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: '#16a34a', fontWeight: 700 }}>✓ Submit</button>
                              <button onClick={() => { setRejectingId(it.id); setRejectCatatan('') }}
                                style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: '#dc2626', fontWeight: 700 }}>✕ Reject</button>
                            </div>
                          ) : (
                            <span style={{ background: STATUS_COLOR_BBMB[it.status] + '18', color: STATUS_COLOR_BBMB[it.status], borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {STATUS_LABEL_BBMB[it.status] || it.status}
                            </span>
                          )}
                        </div>
                        {rejectingId === it.id && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 6, paddingLeft: 10 }}>
                            <input autoFocus value={rejectCatatan} onChange={(e: any) => setRejectCatatan(e.target.value)}
                              placeholder="Catatan reject, mis. stok kosong..."
                              style={{ flex: 1, height: 30, padding: '0 10px', border: '1.5px solid #fecaca', borderRadius: 7, fontSize: 12, fontFamily: 'inherit' }} />
                            <Btn color="#dc2626" style={{ padding: '4px 12px', fontSize: 11 }}
                              onClick={() => { if (!rejectCatatan.trim()) { alert('Catatan reject wajib diisi'); return } setItemStatus(it.id, 'reject', rejectCatatan.trim()) }}>Konfirmasi</Btn>
                            <Btn outline color="#64748b" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => setRejectingId(null)}>Batal</Btn>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function BBMBRiwayatHarian() {
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10))
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [riwayat, setRiwayat] = useState<any[]>([])

  const fetchData = async () => {
    setLoading(true)
    const startIso = tanggal + 'T00:00:00'
    const endIso = tanggal + 'T23:59:59.999'
    const perms = await fetchAllPaged((from, to) =>
      supabase.from('permintaan').select('*').eq('jenis', 'BBMB').gte('created_at', startIso).lte('created_at', endIso)
        .order('created_at', { ascending: false }).range(from, to))
    const ids = perms.map((p: any) => p.id)
    const items = await fetchItemsByPermintaanIds(ids)
    const byPerm = groupItemsByPermintaan(items)
    setRiwayat(perms.map((p: any) => ({ ...p, items: byPerm[p.id] || [] })))
    setLoading(false)
  }

  useEffect(() => { fetchData() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tanggal])

  const filtered = riwayat.filter(r => !search || [r.operator_nama, r.proyek, r.panel_nama].some((v: string) => v?.toLowerCase().includes(search.toLowerCase())))

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" value={tanggal} onChange={(e: any) => setTanggal(e.target.value)}
          style={{ height: 32, padding: '0 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontFamily: 'inherit' }} />
        <input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="🔍 Cari operator / proyek / panel..."
          style={{ height: 32, padding: '0 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', flex: 1, minWidth: 200 }} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{filtered.length} permintaan</span>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Memuat...</div>
      ) : filtered.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Tidak ada permintaan BBMB di tanggal ini.</Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(p => (
            <Card key={p.id} style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{p.operator_nama} · {DIVISI_LABEL[p.divisi] || p.divisi} {p.sub_bagian ? `(${p.sub_bagian})` : ''}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{p.proyek || '-'} · {p.panel_nama || '-'} · WO {p.wo_number || '-'}</div>
                </div>
                <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{fmtDateTime(p.created_at)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {p.items.map((it: any) => (
                  <div key={it.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', borderRadius: 8, padding: '7px 10px' }}>
                      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{it.nama_komponen} <span style={{ color: '#64748b', fontWeight: 500 }}>×{it.qty}{it.satuan ? ` ${it.satuan}` : ''}</span></span>
                      <span style={{ background: STATUS_COLOR_BBMB[it.status] + '18', color: STATUS_COLOR_BBMB[it.status], borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {STATUS_LABEL_BBMB[it.status] || it.status}
                      </span>
                    </div>
                    {it.status === 'reject' && it.catatan_reject && <div style={{ fontSize: 11, color: '#dc2626', paddingLeft: 10, marginTop: 2 }}>⚠ {it.catatan_reject}</div>}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ================= BBMU =================
const BBMU_SUBTABS = [
  { key: 'wiring_ctrl', label: 'Wiring Control', filter: (p: any) => p.divisi === 'wiring_ctrl' },
  { key: 'assembling', label: 'Assembling', filter: (p: any) => p.divisi === 'assembling' && p.sub_bagian === 'Assembling Luar' },
] as const

function BBMUSection({ adminName }: { adminName: string }) {
  void adminName // permintaan (header BBMU) gak punya kolom updated_by/updated_at
  const [subTab, setSubTab] = useState<typeof BBMU_SUBTABS[number]['key']>('wiring_ctrl')
  const [loading, setLoading] = useState(true)
  const [perms, setPerms] = useState<any[]>([])

  const fetchData = async () => {
    setLoading(true)
    const rows = await fetchAllPaged((from, to) =>
      supabase.from('permintaan').select('*').eq('jenis', 'BBMU').order('created_at', { ascending: false }).range(from, to))
    setPerms(rows)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    const ch = supabase.channel('realtime-permintaan-bbmu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permintaan' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setStatus = async (permId: number, status: string) => {
    await supabase.from('permintaan').update({ status, dilihat_operator: false }).eq('id', permId)
    fetchData()
  }

  const activeFilter = BBMU_SUBTABS.find(t => t.key === subTab)!.filter
  const filtered = perms.filter(activeFilter)

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {BBMU_SUBTABS.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            style={{ height: 30, padding: '0 16px', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit',
              border: subTab === t.key ? '1.5px solid #1d4ed8' : '1px solid #e2e8f0',
              background: subTab === t.key ? '#eff6ff' : '#fff', color: subTab === t.key ? '#1d4ed8' : '#64748b' }}>
            {t.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Memuat...</div>
      ) : filtered.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Belum ada permintaan BBMU dari {BBMU_SUBTABS.find(t => t.key === subTab)!.label}.</Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(p => (
            <Card key={p.id} style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{p.operator_nama}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{p.proyek || '-'} · {p.panel_nama || '-'} · WO {p.wo_number || '-'}</div>
                </div>
                <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{fmtDateTime(p.created_at)}</div>
              </div>
              {p.catatan && <div style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', background: '#f8fafc', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>{p.catatan}</div>}
              <div style={{ display: 'flex', gap: 4 }}>
                {(['tersedia', 'belum_lengkap', 'belum_datang'] as const).map(s => {
                  const active = (p.status || 'pending') === s
                  return (
                    <button key={s} onClick={() => setStatus(p.id, s)}
                      style={{ padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit',
                        border: active ? 'none' : `1px solid ${STATUS_COLOR_BBMU[s]}44`,
                        background: active ? STATUS_COLOR_BBMU[s] : STATUS_COLOR_BBMU[s] + '10',
                        color: active ? '#fff' : STATUS_COLOR_BBMU[s] }}>
                      {STATUS_LABEL_BBMU[s]}
                    </button>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
