// CATATAN PANEL (8 Nov 2026) - info yang didengar Admin Produksi tentang panel/proyek (permintaan customer, perubahan, kabar
// jadwal). Hanya vista-teknik, hanya divisi admin. Tabel panel_catatan TIDAK bisa dibaca anon langsung: baca & tulis lewat RPC
// catatan_* (migration 20261108010000_panel_catatan.sql) yang memeriksa akun admins aktif berdivisi 'admin' dari p_aktor.
// Batas: p_aktor dikirim browser (username), belum token sesi - lihat komentar migration. Realtime: tabel panel_catatan_sinyal
// (tanpa isi) naik tiap ada perubahan -> pemanggil memuat ulang lewat RPC.
// Penting = disematkan (satu tanda). Tidak ada hapus: catatan selesai -> "ditindaklanjuti" (tetap tersimpan, log awet).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { aktorAdmin } from './inventaris'

export type StatusCatatan = 'aktif' | 'ditindaklanjuti'
export type Catatan = {
  id: number; proyek: string; wo_id: number | null; panel_id: number | null; panel_nama: string | null
  inti: string; isi: string; sumber_info: string | null; penting: boolean; status: StatusCatatan
  dibuat_oleh: string; dibuat_username: string; dibuat_pada: string; diubah_pada: string | null; diubah_oleh: string | null
  ditindaklanjuti_pada: string | null; ditindaklanjuti_oleh: string | null; versi: number
}
export type IsiCatatan = { proyek: string; panelId: number | null; inti: string; isi: string; sumberInfo: string; penting: boolean }

export const BATAS_INTI = 80
export const BATAS_ISI = 2000
export const BATAS_SUMBER = 120
export const UMUR_BASI_HARI = 14 // catatan aktif setua ini diberi chip "aktif N hari"
export const TABEL_SINYAL = 'panel_catatan_sinyal'

// Pesan galat ramah: versi basi (dua admin bersamaan) & hak akses.
export function pesanGalat(e: any): string {
  if (e?.code === 'VTVER') return 'Catatan ini baru saja diubah admin lain. Data sudah dimuat ulang - periksa lalu ulangi.'
  if (e?.code === '42501' || e?.code === '28000') return 'Catatan hanya untuk akun Admin Produksi. ' + (e?.message || '')
  if (e?.code === 'PGRST202' || /catatan_daftar|could not find the function/i.test(e?.message || '')) return 'Fitur Catatan belum aktif di database (migration panel_catatan belum dijalankan).'
  return e?.message || String(e)
}
const lempar = (error: any) => { const e: any = new Error(pesanGalat(error)); e.code = error?.code; throw e }

// Semua catatan, berhalaman (PostgREST memotong hasil RPC setof di 1000 baris juga).
export async function muatCatatan(db: any, user: any): Promise<Catatan[]> {
  const p_aktor = aktorAdmin(user)
  const semua: Catatan[] = []
  for (let dari = 0; ; dari += 1000) {
    const { data, error } = await db.rpc('catatan_daftar', { p_aktor }).order('id').range(dari, dari + 999)
    if (error) lempar(error)
    semua.push(...(data || []))
    if (!data || data.length < 1000) return semua
  }
}

async function rpc(db: any, nama: string, arg: Record<string, any>): Promise<Catatan> {
  const { data, error } = await db.rpc(nama, arg)
  if (error) lempar(error)
  return data as Catatan
}
const bersih = (x: IsiCatatan) => ({ p_proyek: x.proyek, p_panel_id: x.panelId, p_inti: x.inti.trim(), p_isi: x.isi.trim(), p_sumber_info: x.sumberInfo.trim() || null, p_penting: x.penting })
export const simpanCatatan = (db: any, user: any, x: IsiCatatan) => rpc(db, 'catatan_simpan', { p_aktor: aktorAdmin(user), ...bersih(x) })
export const ubahCatatan = (db: any, user: any, c: Catatan, x: IsiCatatan) => rpc(db, 'catatan_ubah', { p_aktor: aktorAdmin(user), p_id: c.id, p_versi: c.versi, ...bersih(x) })
export const setPentingCatatan = (db: any, user: any, c: Catatan, penting: boolean) => rpc(db, 'catatan_set_penting', { p_aktor: aktorAdmin(user), p_id: c.id, p_versi: c.versi, p_penting: penting })
export const setStatusCatatan = (db: any, user: any, c: Catatan, status: StatusCatatan) => rpc(db, 'catatan_set_status', { p_aktor: aktorAdmin(user), p_id: c.id, p_versi: c.versi, p_status: status })

export const validIsi = (x: IsiCatatan) =>
  !!x.proyek && x.inti.trim().length >= 2 && x.inti.trim().length <= BATAS_INTI && x.isi.trim().length >= 3 && x.isi.trim().length <= BATAS_ISI && x.sumberInfo.trim().length <= BATAS_SUMBER

// Saran inti masalah: yang pernah dipakai, terbanyak dulu (tanpa beda huruf besar/kecil).
export function saranInti(daftar: Catatan[]): string[] {
  const m = new Map<string, { teks: string; n: number }>()
  for (const c of daftar) { const k = c.inti.trim().toLowerCase(); const r = m.get(k) || { teks: c.inti.trim(), n: 0 }; r.n++; m.set(k, r) }
  return [...m.values()].sort((a, b) => b.n - a.n || a.teks.localeCompare(b.teks)).map((r) => r.teks)
}

// Umur catatan aktif dalam hari penuh (null bila sudah ditindaklanjuti).
export const umurHari = (c: Catatan, sekarangMs = Date.now()) => c.status === 'aktif' ? Math.floor((sekarangMs - Date.parse(c.dibuat_pada)) / 864e5) : null

// Cocok pencarian: inti, isi, sumber, panel, proyek, nama pencatat/pengubah/penindak lanjut.
export function cocokCari(c: Catatan, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return [c.inti, c.isi, c.sumber_info, c.panel_nama, c.proyek, c.dibuat_oleh, c.diubah_oleh, c.ditindaklanjuti_oleh].some((v) => String(v || '').toLowerCase().includes(s))
}
