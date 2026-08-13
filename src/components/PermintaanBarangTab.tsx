import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Card, Btn } from './ui/Primitives'

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
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[{ k: 'masuk', l: '📥 Permintaan Masuk' }, { k: 'riwayat', l: '🕒 Riwayat Harian' }].map(t => (
          <button key={t.k} onClick={() => setView(t.k as any)}
            style={{ height: 30, padding: '0 16px', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit',
              border: view === t.k ? '1.5px solid #1d4ed8' : '1px solid #e2e8f0',
              background: view === t.k ? '#eff6ff' : '#fff', color: view === t.k ? '#1d4ed8' : '#64748b' }}>
            {t.l}
          </button>
        ))}
      </div>
      {view === 'masuk' ? <BBMBPermintaanMasuk adminName={adminName} /> : <BBMBRiwayatHarian />}
    </div>
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
    await supabase.from('permintaan_item').update({ status, catatan_reject: catatan || null, updated_by: adminName, updated_at: new Date().toISOString() }).eq('id', itemId)
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
                          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{it.nama_komponen} <span style={{ color: '#64748b', fontWeight: 500 }}>×{it.qty}</span></span>
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
                      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{it.nama_komponen} <span style={{ color: '#64748b', fontWeight: 500 }}>×{it.qty}</span></span>
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
  const [subTab, setSubTab] = useState<typeof BBMU_SUBTABS[number]['key']>('wiring_ctrl')
  const [loading, setLoading] = useState(true)
  const [perms, setPerms] = useState<any[]>([])
  const [itemsByPerm, setItemsByPerm] = useState<Record<number, any[]>>({})

  const fetchData = async () => {
    setLoading(true)
    const rows = await fetchAllPaged((from, to) =>
      supabase.from('permintaan').select('*').eq('jenis', 'BBMU').order('created_at', { ascending: false }).range(from, to))
    const ids = rows.map((p: any) => p.id)
    const items = await fetchItemsByPermintaanIds(ids)
    setPerms(rows)
    setItemsByPerm(groupItemsByPermintaan(items))
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    const ch = supabase.channel('realtime-permintaan-bbmu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permintaan_item' }, fetchData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'permintaan' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setItemStatus = async (itemId: number, status: string) => {
    await supabase.from('permintaan_item').update({ status, updated_by: adminName, updated_at: new Date().toISOString() }).eq('id', itemId)
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(itemsByPerm[p.id] || []).map((it: any) => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', borderRadius: 8, padding: '7px 10px', flexWrap: 'wrap' }}>
                    <span style={{ flex: 1, minWidth: 140, fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{it.nama_komponen} <span style={{ color: '#64748b', fontWeight: 500 }}>×{it.qty}</span></span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['tersedia', 'belum_lengkap', 'belum_datang'] as const).map(s => {
                        const active = it.status === s
                        return (
                          <button key={s} onClick={() => setItemStatus(it.id, s)}
                            style={{ padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit',
                              border: active ? 'none' : `1px solid ${STATUS_COLOR_BBMU[s]}44`,
                              background: active ? STATUS_COLOR_BBMU[s] : STATUS_COLOR_BBMU[s] + '10',
                              color: active ? '#fff' : STATUS_COLOR_BBMU[s] }}>
                            {STATUS_LABEL_BBMU[s]}
                          </button>
                        )
                      })}
                    </div>
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
