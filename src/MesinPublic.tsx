// HALAMAN QR /mesin?id= (T4 Inventaris & Maintenance, 30 Okt 2026, keputusan user). Maintenance kini lewat aplikasi Vista
// Pekerja (menu Inventaris & Maintenance) - halaman ini TIDAK lagi menulis apa pun (dulu "Tandai Selesai" ke maintenance_rutin/
// maintenance_rutin_log; data lama tetap utuh di tabel lama + sudah dimigrasi ke inv_*). QR fisik yang tertempel tetap berguna:
// menampilkan barang padanannya (inv_barang.mesin_id_lama = id mesin lama) + arahan ke aplikasi. Versi lengkap lama ada di git
// (sebelum commit T4). useVersionCheck tetap dipasang: tablet/HP yang tab-nya lama terbuka diminta muat ulang.
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useVersionCheck } from './lib/versionCheck'

type Padanan = { nama: string; nomor_inventaris: string | null; lokasi: string; kondisi: string } | null

export default function MesinPublic() {
  const hasNewVersion = useVersionCheck()
  const mesinId = Number(new URLSearchParams(window.location.search).get('id'))
  const [barang, setBarang] = useState<Padanan | undefined>(mesinId ? undefined : null)

  useEffect(() => {
    if (!mesinId) return
    const db: any = supabase   // eslint-disable-line @typescript-eslint/no-explicit-any -- tabel inv_* belum ada di tipe hasil generate
    ;(async () => {
      const { data: b, error } = await db.from('inv_barang').select('nama,nomor_inventaris,lokasi_kode,kondisi').eq('mesin_id_lama', mesinId).maybeSingle()
      if (error) console.error('[MesinPublic] gagal membaca padanan barang:', error)
      if (!b) { setBarang(null); return }
      const { data: l, error: eL } = await db.from('inv_lokasi').select('nama').eq('kode', b.lokasi_kode).maybeSingle()
      if (eL) console.error('[MesinPublic] gagal membaca lokasi:', eL)
      setBarang({ nama: b.nama, nomor_inventaris: b.nomor_inventaris, lokasi: l?.nama || b.lokasi_kode, kondisi: b.kondisi })
    })()
  }, [mesinId])

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: 'Inter,sans-serif', paddingBottom: 32 }}>
      {hasNewVersion && (
        <div style={{ background: '#1e293b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '8px 14px', fontSize: 11.5, flexWrap: 'wrap', textAlign: 'center' }}>
          <span>🔄 Ada versi baru halaman ini - muat ulang.</span>
          <button onClick={() => window.location.reload()} style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: '#fff', color: '#1e293b', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Muat Ulang</button>
        </div>
      )}
      <div style={{ background: '#1e3a5f', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, background: '#3b82f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>VT</div>
        <div><div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Vista Teknik</div><div style={{ fontSize: 11, color: '#93c5fd' }}>Info Mesin · Maintenance</div></div>
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #bfdbfe', padding: '18px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 34, marginBottom: 6 }}>📱</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>Maintenance kini lewat aplikasi Vista Pekerja</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>Buka aplikasi <b>Vista Pekerja</b> di HP, login divisi Anda, lalu pilih menu <b>Inventaris &amp; Maintenance</b> untuk melihat jadwal, menandai selesai (dengan foto/video), mengubah kondisi, dan melaporkan kerusakan.</div>
        </div>
        {barang && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4, marginBottom: 4 }}>Barang di QR ini</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{barang.nama}</div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2, fontFamily: 'monospace' }}>{barang.nomor_inventaris || 'tanpa nomor'} · {barang.lokasi}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>Cari nomor <b>{barang.nomor_inventaris || barang.nama}</b> di menu Inventaris &amp; Maintenance.</div>
          </div>
        )}
        {barang === null && <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>QR ini belum terhubung ke data inventaris baru.</div>}
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: '#cbd5e1' }}>Vista Teknik ERP</div>
      </div>
    </div>
  )
}
