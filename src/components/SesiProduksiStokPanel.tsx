import { useState, useEffect, useRef } from 'react'
import { produksiStokService } from '../services/produksiStokService'
import { activityLogService } from '../services/activityLogService'
import { useSesiProduksiStokAktif, sesiBasi, formatDurasiSesi } from '../lib/useSesiProduksiStokAktif'
import { EVENT_BUKA_SESI_PRODUKSI_STOK, adaPermintaanBukaSesi, selesaiBukaSesi } from '../lib/navProduksiStok'
import { Card } from './ui/Primitives'

// Panel "Sesi Produksi Stok Aktif" (2 Okt 2026, desain disetujui user) - operator yang sedang
// menekan Mulai di kartu Produksi Stok (vista-pekerja), timer berjalan per detik dari jam mulai
// server. Baris hilang sendiri saat operator Stop / Simpan Progress (realtime). Sesi basi (dimulai
// sebelum hari ini) diberi tanda + tombol "Tutup sesi" sebagai jalur koreksi Admin.
const inisial = (nama: string) => nama.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?'

export function SesiProduksiStokPanel({ user }: any) {
  const { sesi, sudahMuat, error, muatUlang } = useSesiProduksiStokAktif()
  const [, setTick] = useState(0)
  const [menutup, setMenutup] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Tombol "Lihat" di toast -> scroll panel ini ke layar (lihat lib/navProduksiStok.ts).
  useEffect(() => {
    const scroll = () => {
      if (!adaPermintaanBukaSesi()) return
      setTimeout(() => { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); selesaiBukaSesi() }, 150)
    }
    scroll()
    window.addEventListener(EVENT_BUKA_SESI_PRODUKSI_STOK, scroll)
    return () => window.removeEventListener(EVENT_BUKA_SESI_PRODUKSI_STOK, scroll)
  }, [])

  const getUname = () => {
    const sess = JSON.parse(localStorage.getItem('vista_admin_session') || '{}')
    return user?.name || user?.nama || sess?.nama || 'Admin'
  }

  const tutup = async (s: any) => {
    if (!window.confirm(`Tutup sesi ${s.operator_nama} (${s.komponen_nama} · batch #${s.batch_id} · ${s.tahap})?\n\nDipakai kalau operator lupa menekan Stop. Progress yang sudah tersimpan tidak berubah.`)) return
    setMenutup(s.id)
    try {
      await produksiStokService.tutupSesi(s.id, getUname())
      await activityLogService.insert({ user_name: getUname(), action: 'TUTUP SESI PRODUKSI STOK', module: 'stok', halaman: 'System',
        description: `Sesi #${s.id} ${s.operator_nama} - ${s.komponen_nama} batch #${s.batch_id} ${s.tahap} ditutup Admin (mulai ${new Date(s.mulai_at).toLocaleString('id-ID')})` })
      await muatUlang()
    } catch (err: any) {
      console.error('[SesiProduksiStok] gagal tutup sesi:', err)
      alert('Gagal menutup sesi: ' + (err?.message || err))
    } finally {
      setMenutup(null)
    }
  }

  return (
    <div ref={ref} style={{ scrollMarginTop: 16 }}>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const, marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
              <style>{"@keyframes sesiPsPulse{0%,100%{opacity:1}50%{opacity:.35}}"}</style>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: sesi.length ? "#1a9e5c" : "#cbd5e1", display: "inline-block", animation: sesi.length ? "sesiPsPulse 1.6s infinite" : "none" }} />
              Sesi Produksi Stok Aktif
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Update otomatis saat operator menekan Mulai / Stop / Simpan Progress di kartu mereka</div>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, background: sesi.length ? '#e6f7ee' : '#f1f5f9', color: sesi.length ? '#1a9e5c' : '#64748b', borderRadius: 999, padding: '5px 12px' }}>
            {sesi.length} sedang jalan
          </span>
        </div>
        {error && <div style={{ fontSize: 11.5, color: '#dc2626', background: '#fef2f2', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>⚠ Gagal memuat sesi aktif: {error}</div>}
        <div style={{ border: '1px solid #e6e8ee', borderRadius: 12, overflow: 'hidden' }}>
          {!sudahMuat && !error ? (
            <div style={{ padding: '22px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>Memuat...</div>
          ) : sesi.length === 0 ? (
            <div style={{ padding: '22px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>Tidak ada sesi Produksi Stok yang sedang berjalan.</div>
          ) : sesi.map((s, i) => {
            const basi = sesiBasi(s)
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? '1px solid #e6e8ee' : 'none', background: basi ? '#fffbeb' : '#fff' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0f2555', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{inisial(s.operator_nama)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' as const }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#171b2e' }}>{s.operator_nama}</span>
                    {s.sub_bagian && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#f8f9fb', color: '#6b7280', border: '1px solid #e6e8ee' }}>{s.sub_bagian}</span>}
                    {basi && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#fef3d6', color: '#b45309' }}>belum di-stop sejak {new Date(s.mulai_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.komponen_nama} · batch #{s.batch_id} · <span style={{ fontWeight: 700, color: '#ff6a1a' }}>{s.tahap}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                  <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: 16, color: basi ? '#b45309' : '#1a9e5c' }}>{formatDurasiSesi(s.mulai_at)}</div>
                  <div style={{ fontSize: 9.5, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: 0.3 }}>berjalan</div>
                </div>
                {/* Jalur koreksi Admin di SEMUA baris (bukan cuma yg basi): kartu operator bisa hilang
                    duluan (qty tersedia habis diambil operator lain) sehingga operator tak bisa Stop. */}
                <button onClick={() => tutup(s)} disabled={menutup === s.id}
                  style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8, fontFamily: 'inherit', cursor: 'pointer', background: '#fff',
                    border: `1px solid ${basi ? '#fcd34d' : '#e2e8f0'}`, color: basi ? '#b45309' : '#94a3b8' }}>
                  {menutup === s.id ? 'Menutup...' : 'Tutup sesi'}
                </button>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
