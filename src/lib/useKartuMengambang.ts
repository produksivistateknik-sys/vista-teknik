import { useState, useEffect } from 'react'

// Animasi kartu notifikasi mengambang - SATU sumber (2 Okt 2026), dipindah apa adanya dari
// WoEngineeringCard (WoEngineeringBanner.tsx) supaya toast Sesi Produksi Stok punya gerak masuk/
// keluar yang identik. Nilai transform/transisi utk arah "atas" SAMA PERSIS dgn versi lama.
// - Masuk: mount di posisi "off", 1 frame kemudian (requestAnimationFrame) pindah ke posisi final -
//   transisi CSS di antaranya = slide + fade-in, ease-out 320ms.
// - Keluar: tutup() TIDAK langsung memanggil onTutup (kartu bakal hilang seketika) - set closing
//   dulu (slide + fade-out 250ms), onTutup dipanggil SETELAH animasi selesai.
// arah: "atas" = kartu di atas layar, masuk dari atas & keluar ke atas (WO Engineering);
//       "bawah" = kartu di bawah layar, masuk dari bawah & keluar ke bawah (toast Produksi Stok).
export function useKartuMengambang(onTutup: () => void, arah: 'atas' | 'bawah' = 'atas') {
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  const tutup = () => {
    setClosing(true)
    setTimeout(onTutup, 260)
  }
  const tanda = arah === 'atas' ? -1 : 1
  const gaya = {
    pointerEvents: closing ? 'none' as const : 'auto' as const,
    transform: closing ? `translateY(${16 * tanda}px)` : visible ? 'translateY(0)' : `translateY(${24 * tanda}px)`,
    opacity: closing ? 0 : visible ? 1 : 0,
    transition: closing
      ? 'transform 250ms cubic-bezier(0.4,0,1,1), opacity 250ms cubic-bezier(0.4,0,1,1)'
      : 'transform 320ms cubic-bezier(0.16,1,0.3,1), opacity 320ms ease-out',
  }
  return { gaya, tutup }
}
