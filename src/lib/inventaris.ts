// INVENTARIS & MAINTENANCE (T2, 29 Okt 2026) - data & aksi tab admin "Inventaris & Maintenance". Skema/aturan di
// migration 20261030010000_inventaris_t1.sql: SEMUA tulis lewat RPC inv_* (tabel cuma bisa dibaca anon), p_aktor
// {"admin": username}. Status jadwal (Terlambat/Segera/Normal) dibaca dari view inv_jadwal_v - satu sumber dengan HP
// operator & pengingat push (batas "Segera" = inv_pengaturan.batas_segera_hari, sekarang 2 hari).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchAllPaged } from './fetchAllPaged'
import { unggahMediaKeR2 } from './siapkanMedia'

export * from './inventarisAturan'
import type { Barang, LogBarang, DataInventaris } from './inventarisAturan'
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
