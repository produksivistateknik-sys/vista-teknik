// STATUS TAMPILAN PERMINTAAN BARANG (18 Nov 2026, tampilan tabel tab Permintaan Barang admin - keputusan user).
// HANYA TAMPILAN: diturunkan dari kolom permintaan_item yang sudah ada, BUKAN status baru di database. Satu sumber untuk
// tab Riwayat & Menunggu Persetujuan (CLAUDE.md B.1).
//   menunggu_admin                         -> Menunggu
//   pending (sudah disetujui admin)        -> Disetujui (belum disiapkan Gudang)
//   submit & belum sudah_diambil           -> Siap diambil (Gudang sudah menyiapkan/mengeluarkan)
//   submit & sudah_diambil                 -> Selesai
//   ditolak_admin                          -> Ditolak Admin
//   reject                                 -> Ditolak Gudang (keputusan user: tetap lencana sendiri)
// Catatan data (Tahap 0, 18 Nov): pemenuhan sebagian -> baris ini qty yang dikeluarkan, sisanya baris hutang (tanpa
// disetujui_admin_at, tidak tampil di Riwayat admin); dipenuhi 0 -> baris asli dihapus Gudang.
export type StatusTampil = 'menunggu' | 'disetujui' | 'siap' | 'selesai' | 'ditolak_admin' | 'ditolak_gudang' | 'lain'

export function statusTampilPermintaan(it: { status?: string | null; sudah_diambil?: boolean | null }): StatusTampil {
  switch (it?.status) {
    case 'menunggu_admin': return 'menunggu'
    case 'pending': return 'disetujui'
    case 'submit': return it.sudah_diambil ? 'selesai' : 'siap'
    case 'ditolak_admin': return 'ditolak_admin'
    case 'reject': return 'ditolak_gudang'
    default: return 'lain'
  }
}

export const LABEL_STATUS_TAMPIL: Record<StatusTampil, string> = {
  menunggu: 'Menunggu',
  disetujui: 'Disetujui',
  siap: 'Siap diambil',
  selesai: 'Selesai',
  ditolak_admin: 'Ditolak Admin',
  ditolak_gudang: 'Ditolak Gudang',
  lain: 'Lainnya',
}

export const statusDitolak = (s: StatusTampil) => s === 'ditolak_admin' || s === 'ditolak_gudang'
