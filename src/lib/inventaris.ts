// INVENTARIS & MAINTENANCE (T2, 29 Okt 2026) - data & aksi tab admin "Inventaris & Maintenance". Skema/aturan di
// migration 20261030010000_inventaris_t1.sql: SEMUA tulis lewat RPC inv_* (tabel cuma bisa dibaca anon), p_aktor
// {"admin": username}. Status jadwal (Terlambat/Segera/Normal) dibaca dari view inv_jadwal_v - satu sumber dengan HP
// operator & pengingat push (batas "Segera" = inv_pengaturan.batas_segera_hari, sekarang 2 hari).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchAllPaged } from './fetchAllPaged'
import { unggahMediaKeR2 } from './siapkanMedia'

export type Lokasi = { kode: string; nama: string; boleh_nomor: boolean; tampil_operator: boolean; divisi_operator: string[]; urut: number; aktif: boolean }
export type Barang = {
  id: number; nama: string; nomor_inventaris: string | null; lokasi_kode: string; pengguna: string | null; kondisi: string
  detail_kondisi: string | null; merk_spesifikasi: string | null; nomor_seri: string | null; tanggal_perolehan: string | null
  tanggal_perolehan_teks: string | null; pelapor: string | null; diperbarui_pada: string | null; kode_lama: string | null
  aktif: boolean; versi: number; dibuat_oleh: string | null; dibuat_pada: string
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

export async function muatInventaris(db: any): Promise<DataInventaris> {
  const semua = (tabel: string, kolom = '*', saring: (q: any) => any = q => q) =>
    fetchAllPaged((from, to) => saring(db.from(tabel).select(kolom)).order('id').range(from, to))
  const [lokasiRes, barang, jadwal, selesai, laporan, update, media] = await Promise.all([
    db.from('inv_lokasi').select('*').order('urut'),
    semua('inv_barang'), semua('inv_jadwal_v'), semua('inv_jadwal_selesai'), semua('inv_laporan'), semua('inv_laporan_update'),
    semua('inv_media', '*', q => q.is('dihapus_pada', null)),
  ])
  if (lokasiRes.error) throw lokasiRes.error
  return { lokasi: lokasiRes.data || [], barang, jadwal, selesai, laporan, update, media }
}
export async function muatLogBarang(db: any, barangId: number): Promise<LogBarang[]> {
  return fetchAllPaged((from, to) => db.from('inv_log').select('*').eq('barang_id', barangId).order('id', { ascending: false }).range(from, to))
}

// Pesan galat RPC apa adanya (sudah berbahasa Indonesia di server); kode VTVER = versi basi -> pemanggil muat ulang (bukan 40001: PostgREST mengulang 40001 sampai timeout).
async function rpc(db: any, nama: string, arg: Record<string, any>): Promise<any> {
  const { data, error } = await db.rpc(nama, arg)
  if (error) { console.error(`[inventaris] ${nama} gagal:`, error); throw Object.assign(new Error(error.message || String(error)), { code: error.code }) }
  return data
}
export const aktorAdmin = (user: any) => {
  let username = user?.username
  if (!username) { try { username = JSON.parse(localStorage.getItem('vista_admin_session') || '{}').username } catch { /* sesi rusak */ } }
  if (!username) throw new Error('Sesi admin tidak dikenali - login ulang')
  return { admin: username }
}
export const tambahBarang = (db: any, user: any, data: Record<string, any>) => rpc(db, 'inv_tambah_barang', { p_data: data, p_aktor: aktorAdmin(user) })
export const ubahBarang = (db: any, user: any, b: Barang, patch: Record<string, any>) => rpc(db, 'inv_ubah_barang', { p_id: b.id, p_versi: b.versi, p_patch: patch, p_aktor: aktorAdmin(user) })
export const setKondisi = (db: any, user: any, b: Barang, kondisi: string, detail: string | null = null) =>
  rpc(db, 'inv_set_kondisi', { p_id: b.id, p_versi: b.versi, p_kondisi: kondisi, p_detail: detail, p_aktor: aktorAdmin(user) })
export const ubahStatusLaporan = (db: any, user: any, a: { laporanId: number; status: string; catatan?: string; perbaikan?: string; teknisi?: string; mediaSesudah?: any[] }) =>
  rpc(db, 'inv_ubah_status_laporan', { p_laporan_id: a.laporanId, p_status: a.status, p_catatan: a.catatan || null, p_perbaikan: a.perbaikan || null,
    p_teknisi: a.teknisi || null, p_media_sesudah: a.mediaSesudah?.length ? a.mediaSesudah : null, p_aktor: aktorAdmin(user) })
export const simpanJadwal = (db: any, user: any, id: number | null, data: Record<string, any>) => rpc(db, 'inv_simpan_jadwal', { p_id: id, p_data: data, p_aktor: aktorAdmin(user) })
export const selesaiJadwal = (db: any, user: any, jadwalId: number, catatan: string, media: any[]) =>
  rpc(db, 'inv_selesai_jadwal', { p_jadwal_id: jadwalId, p_catatan: catatan || null, p_media: media.length ? media : null, p_kunci: crypto.randomUUID(), p_aktor: aktorAdmin(user) })
export const tambahMedia = (db: any, user: any, tujuan: string, refId: number, peran: string, media: any[]) =>
  rpc(db, 'inv_tambah_media', { p_tujuan: tujuan, p_ref_id: refId, p_peran: peran, p_media: media, p_aktor: aktorAdmin(user) })
export const hapusMedia = (db: any, user: any, mediaId: number) => rpc(db, 'inv_hapus_media', { p_media_id: mediaId, p_aktor: aktorAdmin(user) })
export const imporBarang = (db: any, user: any, baris: any[], dryRun: boolean, file: string) =>
  rpc(db, 'inv_impor', { p_baris: baris, p_dry_run: dryRun, p_file: file, p_aktor: aktorAdmin(user) })

// Unggah file ke R2 dulu (gagal = dilempar, BELUM ada yang tersimpan di database), hasil siap jadi p_media RPC.
export async function unggahMediaInventaris(files: File[], prefix: string, onProgres?: (selesai: number, total: number) => void) {
  const hasil: { url: string; mime: string }[] = []
  for (const f of files) {
    const r = await unggahMediaKeR2(f, prefix)
    hasil.push({ url: r.url, mime: r.mime })
    onProgres?.(hasil.length, files.length)
  }
  return hasil
}
