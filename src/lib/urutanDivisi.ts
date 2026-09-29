import { DIVISI_PROSES } from '../constants/panelTypes'

// ─────────────────────────────────────────────────────────────────────────────
// URUTAN DIVISI BAKU buat tampilan yang dikelompokkan per divisi (29 Sep 2026) - SATU sumber,
// dipakai Rekap Permintaan Barang + tab Menunggu Persetujuan/Riwayat (PermintaanAdminTab) dan
// tabel Maintenance Rutin (MaintenanceRutinTab). Urutan alur produksi dari DIVISI_PROSES
// (constants/panelTypes, dipakai juga Raw Schedule/Rencana Harian), ditambah 'admin' di akhir
// (admin juga bisa minta barang, tapi bukan bagian alur fabrikasi). Divisi lain yang gak ada di
// daftar ini (komponen/QS, gudang dst) TETAP tampil, ditaruh setelah Admin (urut label A-Z);
// '-' (divisi kosong/gak diketahui) paling bawah - jangan sampai ada baris yang hilang.
// ─────────────────────────────────────────────────────────────────────────────

export const URUTAN_DIVISI_PRODUKSI: string[] = [...Object.keys(DIVISI_PROSES), 'admin']

// Key divisi kosong/gak diketahui - selalu paling akhir.
export const DIVISI_KOSONG = '-'

export const bandingDivisiProduksi = (a: string, b: string, label: (k: string) => string = (k) => k) => {
  const ia = URUTAN_DIVISI_PRODUKSI.indexOf(a), ib = URUTAN_DIVISI_PRODUKSI.indexOf(b)
  if (ia !== -1 || ib !== -1) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib)
  if (a === DIVISI_KOSONG || b === DIVISI_KOSONG) return a === b ? 0 : a === DIVISI_KOSONG ? 1 : -1
  return label(a).localeCompare(label(b))
}
