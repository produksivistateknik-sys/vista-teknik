import { useState, useEffect, useRef } from 'react'
import { useSesiProduksiStokAktif, sesiBasi, type SesiProduksiStok } from '../lib/useSesiProduksiStokAktif'
import { useKartuMengambang } from '../lib/useKartuMengambang'

// Toast "Sesi Produksi Stok" utk Admin (2 Okt 2026, desain disetujui user). Bentuk kartu, blur &
// animasi = kartu WO Engineering (WoEngineeringBanner, lewat lib/useKartuMengambang.ts), tapi di
// KANAN-BAWAH (bukan tengah-atas) supaya tidak bertumpuk dgn kartu WO Engineering, aksen hijau.
// Kapan muncul: HANYA saat ada sesi BARU dimulai setelah halaman dibuka - sesi yang sudah jalan
// saat halaman dimuat dianggap sudah terlihat (buka ulang halaman tidak memunculkan toast), sesi
// basi (dari hari sebelumnya) tidak memicu. "Sudah Dibaca" cuma menutup kartu (di memori, tidak
// disimpan) - sesi baru berikutnya memunculkannya lagi. Dirender di App.tsx khusus divisi admin.
export function SesiProduksiStokToast({ onLihat }: { onLihat: () => void }) {
  const { sesi, sudahMuat } = useSesiProduksiStokAktif()
  const sudahTerlihat = useRef<Set<number> | null>(null)
  const [kartuKe, setKartuKe] = useState(0) // naik tiap ada sesi baru -> kartu di-mount ulang (animasi masuk lagi)
  const [tampil, setTampil] = useState(false)

  useEffect(() => {
    if (!sudahMuat) return
    if (sudahTerlihat.current === null) { sudahTerlihat.current = new Set(sesi.map(s => s.id)); return }
    const baru = sesi.filter(s => !sudahTerlihat.current!.has(s.id) && !sesiBasi(s))
    sesi.forEach(s => sudahTerlihat.current!.add(s.id))
    if (baru.length > 0) { setKartuKe(k => k + 1); setTampil(true) }
  }, [sesi, sudahMuat])

  const aktif = sesi.filter(s => !sesiBasi(s))
  if (!tampil || aktif.length === 0) return null
  return (
    <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 10001, width: 'calc(100% - 32px)', maxWidth: 340, pointerEvents: 'none' as const }}>
      <KartuSesi key={kartuKe} sesi={aktif} onTutup={() => setTampil(false)} onLihat={onLihat} />
    </div>
  )
}

function KartuSesi({ sesi, onTutup, onLihat }: { sesi: SesiProduksiStok[]; onTutup: () => void; onLihat: () => void }) {
  const { gaya, tutup } = useKartuMengambang(onTutup, 'bawah')
  const daftar = sesi.slice(0, 4).map(s => `${s.operator_nama} (${s.tahap})`).join(', ') + (sesi.length > 4 ? `, +${sesi.length - 4} lainnya` : '')
  return (
    <div style={{
      ...gaya,
      background: 'rgba(5,120,85,0.88)', backdropFilter: 'blur(14px) saturate(160%)',
      WebkitBackdropFilter: 'blur(14px) saturate(160%)',
      border: '1px solid rgba(255,255,255,0.2)', borderRadius: 16,
      boxShadow: '0 16px 40px rgba(5,120,85,0.35), 0 4px 14px rgba(15,23,42,0.14)',
      color: '#fff', padding: '14px 16px', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, background: 'rgba(255,255,255,0.16)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>🏭</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.35 }}>{sesi.length} operator sedang mengerjakan Produksi Stok</div>
          <div style={{ marginTop: 4, fontSize: 12.5, color: '#d1fae5', lineHeight: 1.4 }}>{daftar}</div>
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={() => { onLihat(); tutup() }}
          style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: 'none', background: '#fff', color: '#047857',
            fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
          Lihat
        </button>
        <button onClick={tutup}
          style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.12)', color: '#fff',
            fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
          ✓ Sudah Dibaca
        </button>
      </div>
    </div>
  )
}
