// TAMPILAN MOBILE ADMIN (12 Nov 2026, T0 - keputusan user): tiga keadaan Otomatis -> Mobile -> Desktop, disimpan per
// perangkat (localStorage, dibungkus try/catch). Otomatis = mobile bila lebar layar < 700px. Hasilnya ditulis sebagai
// <html data-mobile="1"> (dan data-mobile-bingkai="1" bila mobile dipaksa di layar lebar -> pratinjau kolom 430px).
// SEMUA gaya mobile diawali html[data-mobile="1"] (styles/mobileCss, styles/responsif) -> saat mode mati desktop tidak
// berubah sedikit pun. Hanya tampilan: tidak menyentuh data, realtime, atau aturan apa pun.
import { useEffect, useState } from 'react'

export type PilihanTampilan = 'otomatis' | 'mobile' | 'desktop'
export const KUNCI_TAMPILAN = 'vista_teknik_tampilan'
export const BATAS_MOBILE_PX = 700
const KUERI_SEMPIT = `(max-width: ${BATAS_MOBILE_PX - 1}px)`
const URUTAN: PilihanTampilan[] = ['otomatis', 'mobile', 'desktop']

export function bacaPilihanTampilan(): PilihanTampilan {
  try {
    const v = localStorage.getItem(KUNCI_TAMPILAN)
    return v === 'mobile' || v === 'desktop' ? v : 'otomatis'
  } catch { return 'otomatis' }
}

export const pilihanBerikut = (p: PilihanTampilan): PilihanTampilan => URUTAN[(URUTAN.indexOf(p) + 1) % URUTAN.length]

// Keadaan efektif (fungsi murni, diuji tanpa browser).
export function modeEfektif(pilihan: PilihanTampilan, layarSempit: boolean): { mobile: boolean; bingkai: boolean } {
  const mobile = pilihan === 'mobile' || (pilihan === 'otomatis' && layarSempit)
  return { mobile, bingkai: mobile && !layarSempit }
}

export function teksTombolTampilan(pilihan: PilihanTampilan, mobile: boolean): string {
  const status = pilihan === 'otomatis' ? `Otomatis (sekarang ${mobile ? 'mobile' : 'desktop'})` : pilihan === 'mobile' ? 'Mobile' : 'Desktop'
  return `Tampilan: ${status}. Klik untuk ganti ke ${({ otomatis: 'Mobile', mobile: 'Desktop', desktop: 'Otomatis' } as const)[pilihan]}.`
}

const layarSempitSekarang = () => { try { return window.matchMedia(KUERI_SEMPIT).matches } catch { return false } }

export function useModeMobile() {
  const [pilihan, setPilihan] = useState<PilihanTampilan>(bacaPilihanTampilan)
  const [layarSempit, setLayarSempit] = useState<boolean>(layarSempitSekarang)
  useEffect(() => {
    let mq: MediaQueryList | null = null
    try { mq = window.matchMedia(KUERI_SEMPIT) } catch { return }
    const ubah = () => setLayarSempit(mq!.matches)
    mq.addEventListener?.('change', ubah)
    return () => mq?.removeEventListener?.('change', ubah)
  }, [])
  const { mobile, bingkai } = modeEfektif(pilihan, layarSempit)
  useEffect(() => {
    const el = document.documentElement
    if (mobile) el.setAttribute('data-mobile', '1'); else el.removeAttribute('data-mobile')
    if (bingkai) el.setAttribute('data-mobile-bingkai', '1'); else el.removeAttribute('data-mobile-bingkai')
  }, [mobile, bingkai])
  const gantiPilihan = () => setPilihan((p) => {
    const b = pilihanBerikut(p)
    try { if (b === 'otomatis') localStorage.removeItem(KUNCI_TAMPILAN); else localStorage.setItem(KUNCI_TAMPILAN, b) } catch { /* mode privat: tetap jalan di sesi ini */ }
    return b
  })
  return { pilihan, mobile, bingkai, gantiPilihan }
}
