// Penentu tampil animasi masuk (14 Nov 2026, logo JRENG Tahap 4): sekali per sesi tab (sessionStorage). Bila
// sessionStorage gagal (privat/diblokir): tampil sekali per muat halaman - dipanggil sekali di main.tsx, tidak loop.
const KUNCI_SESI = 'vista_admin_animasi_masuk'
let sudahDiputuskan = false
export function perluAnimasiMasuk(): boolean {
  if (sudahDiputuskan) return false
  sudahDiputuskan = true
  try {
    if (sessionStorage.getItem(KUNCI_SESI) === '1') return false
    sessionStorage.setItem(KUNCI_SESI, '1')
  } catch { /* privat/diblokir: tetap tampil sekali untuk muat halaman ini */ }
  return true
}
