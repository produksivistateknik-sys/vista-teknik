// INVENTARIS & MAINTENANCE - TIPE & ATURAN TAMPILAN BERSAMA (30 Okt 2026). File ini IDENTIK di vista-teknik & vista-pekerja
// (dijaga `npm run cek:kop`) - warna kondisi, status jadwal/laporan, frekuensi & format tanggal satu sumber utk tab admin dan
// menu operator HP. Murni: tanpa supabase. Data & aksi: lib/inventaris.ts (admin) / lib/inventarisOperator.ts (operator).
// Status Terlambat/Segera/Normal TIDAK dihitung di sini - dibaca dari view inv_jadwal_v (batas Segera = inv_pengaturan).

export type Lokasi = { kode: string; nama: string; boleh_nomor: boolean; tampil_operator: boolean; divisi_operator: string[]; urut: number; aktif: boolean }
export type Barang = {
  id: number; nama: string; nomor_inventaris: string | null; lokasi_kode: string; pengguna: string | null; kondisi: string
  detail_kondisi: string | null; merk_spesifikasi: string | null; nomor_seri: string | null; tanggal_perolehan: string | null
  tanggal_perolehan_teks: string | null; pelapor: string | null; diperbarui_pada: string | null; kode_lama: string | null
  aktif: boolean; versi: number; dibuat_oleh: string | null; dibuat_pada: string
  // ditambah operator dari HP (30 Okt 2026): tampil langsung, berlabel "Baru dari operator" di admin sampai ditandai diperiksa
  ditambah_operator?: boolean; sudah_diperiksa?: boolean; diperiksa_oleh?: string | null; diperiksa_pada?: string | null
}
export type Jadwal = {
  id: number; barang_id: number; jenis: string; frekuensi: string; jatuh_tempo: string | null; terakhir_dilakukan: string | null
  teknisi: string | null; catatan: string | null; aktif: boolean; status_jadwal: 'terlambat' | 'segera' | 'normal'; selesai_hari_ini: boolean
}
export type Selesai = { id: number; jadwal_id: number; barang_id: number; tanggal: string; oleh: string; sumber: string; tanpa_dokumentasi: boolean; catatan: string | null; dibuat_pada: string }
export type Laporan = {
  id: number; barang_id: number; judul: string; masalah: string | null; status: 'open' | 'in_progress' | 'closed'; pelapor: string
  sumber: string; teknisi: string | null; perbaikan: string | null; catatan_lama: string | null; dibuat_pada: string
  ditutup_pada: string | null; ditutup_oleh: string | null
}
export type UpdateLaporan = { id: number; laporan_id: number; waktu: string; oleh: string; catatan: string | null; status_dari: string | null; status_ke: string | null }
export type Media = { id: number; tujuan: string; ref_id: number; peran: string; url: string; mime: string | null; thumb: string | null; oleh: string | null; dibuat_pada: string }
export type LogBarang = { id: number; waktu: string; jenis: string; dari: string | null; ke: string | null; detail: string | null; oleh: string; sumber: string; keterangan: string | null }
export type DataInventaris = { lokasi: Lokasi[]; barang: Barang[]; jadwal: Jadwal[]; selesai: Selesai[]; laporan: Laporan[]; update: UpdateLaporan[]; media: Media[] }

// Kondisi: warna tetap seperti layar lama (keputusan user) - kunci = nilai kolom inv_barang.kondisi.
export const KONDISI: { kode: string; label: string; warna: string; latar: string }[] = [
  { kode: 'baik', label: 'Berfungsi baik', warna: '#15803d', latar: '#dcf5e5' },
  { kode: 'tidak_maksimal', label: 'Berfungsi tidak maksimal', warna: '#a15c07', latar: '#fdecc8' },
  { kode: 'perlu_maintenance', label: 'Perlu maintenance', warna: '#b91c1c', latar: '#fde0e0' },
  { kode: 'rusak', label: 'Rusak', warna: '#6d28d9', latar: '#ece3ff' },
  { kode: 'belum_dinilai', label: 'Belum dinilai', warna: '#64748b', latar: '#eef1f5' },
]
export const infoKondisi = (k: string) => KONDISI.find(x => x.kode === k) || KONDISI[4]
export const STATUS_JADWAL = { terlambat: { label: 'Terlambat', warna: '#b91c1c', latar: '#fde0e0' }, segera: { label: 'Segera', warna: '#a15c07', latar: '#fdecc8' }, normal: { label: 'Normal', warna: '#15803d', latar: '#dcf5e5' } }
export const STATUS_LAPORAN = { open: { label: 'Open', warna: '#b91c1c', latar: '#fde0e0' }, in_progress: { label: 'In Progress', warna: '#a15c07', latar: '#fdecc8' }, closed: { label: 'Closed', warna: '#15803d', latar: '#dcf5e5' } }
export const FREKUENSI = [['harian', 'Harian'], ['mingguan', 'Mingguan'], ['bulanan', 'Bulanan'], ['3bulan', '3 Bulanan'], ['tahunan', 'Tahunan']] as const
export const labelFrekuensi = (f: string) => FREKUENSI.find(x => x[0] === f)?.[1] || f
export const BATAS_DATASHEET_MB = 20

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
// Tanggal (YYYY-MM-DD) atau waktu ISO -> "8 Okt 2026" (waktu ditampilkan menurut WIB)
export function fmtTanggal(v: string | null | undefined): string {
  if (!v) return ''
  const s = v.length > 10 ? new Date(v).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) : v
  const [y, m, d] = s.split('-').map(Number)
  return y ? `${d} ${BULAN[m - 1]} ${y}` : ''
}
export const fmtWaktu = (v: string) => `${fmtTanggal(v)} ${new Date(v).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })}`
export const hariIniWib = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
export function teksSisaHari(tgl: string | null): string {
  if (!tgl) return ''
  const d = Math.round((Date.parse(tgl) - Date.parse(hariIniWib())) / 86400000)
  return d < 0 ? `telat ${-d} hr` : d === 0 ? 'hari ini' : `${d} hr lagi`
}
export const laporanAktif = (l: Laporan) => l.status !== 'closed'
export const isVideo = (m: { mime?: string | null; url: string }) => (m.mime || '').startsWith('video/') || /\.(mp4|mov|m4v|webm|3gp)$/i.test(m.url)
export const isPdf = (m: { mime?: string | null; url: string }) => m.mime === 'application/pdf' || /\.pdf$/i.test(m.url)

