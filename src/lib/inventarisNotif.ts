// NOTIFIKASI INVENTARIS UTK ADMIN (31 Okt 2026, migrasi 20261031010000_inventaris_notifikasi.sql). Satu baris inv_notifikasi
// per tindakan operator (dibuat di dalam RPC operator, satu transaksi). Perubahan operator sudah berlaku; admin menyetujui
// atau mengembalikan sesudahnya lewat RPC inv_notif_* (versi = kunci bentrok antar admin, galat VTVER -> muat ulang).
// Tautan langsung: "barang:<id>" | "laporan:<id>" | "jadwal:<id>" | "notif" - dari panel, dari URL push (?inv=...), dll.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react'
import { fetchAllPaged } from './fetchAllPaged'
import { pasangPemulihRealtime } from './pemulihRealtime'
import { aktorAdmin } from './inventaris'

export type JenisNotif = 'kondisi' | 'kondisi_detail' | 'barang_baru' | 'laporan_baru' | 'laporan_status' | 'laporan_update' | 'maintenance_selesai'
export type Notifikasi = {
  id: number; jenis: JenisNotif; oleh: string; pekerja_id: number | null; divisi: string | null; barang_id: number; ref_id: number | null
  teks: string; nilai_sebelum: any; nilai_sesudah: any; status: 'baru' | 'dilihat' | 'selesai'
  keputusan: 'disetujui' | 'dikembalikan' | 'ditolak' | null; catatan_keputusan: string | null; diputuskan_oleh: string | null
  diputuskan_pada: string | null; dilihat_oleh: string | null; dilihat_pada: string | null; versi: number; dibuat_pada: string
}

export const JENIS_NOTIF: Record<JenisNotif, { label: string; ikon: string; aksiKembali: string; catatanWajib: boolean }> = {
  kondisi: { label: 'Ubah kondisi', ikon: 'ti-heartbeat', aksiKembali: 'Kembalikan kondisi', catatanWajib: false },
  kondisi_detail: { label: 'Ubah detail kondisi', ikon: 'ti-notes', aksiKembali: 'Kembalikan detail', catatanWajib: false },
  barang_baru: { label: 'Barang baru', ikon: 'ti-package', aksiKembali: 'Tolak (nonaktifkan)', catatanWajib: false },
  laporan_baru: { label: 'Laporan kerusakan', ikon: 'ti-alert-triangle', aksiKembali: 'Kembalikan dgn catatan', catatanWajib: true },
  laporan_status: { label: 'Status laporan', ikon: 'ti-progress-check', aksiKembali: 'Kembalikan status', catatanWajib: false },
  laporan_update: { label: 'Update laporan', ikon: 'ti-message', aksiKembali: 'Kembalikan dgn catatan', catatanWajib: true },
  maintenance_selesai: { label: 'Maintenance selesai', ikon: 'ti-tool', aksiKembali: 'Kembalikan dgn catatan', catatanWajib: true },
}

const PER_HALAMAN = 200
const urut = (q: any) => q.order('id', { ascending: false })
// "Perlu ditinjau" = belum diputuskan (baru/dilihat), semua halaman (bisa >1000)
export const muatNotifPerlu = (db: any): Promise<Notifikasi[]> =>
  fetchAllPaged((from, to) => urut(db.from('inv_notifikasi').select('*').neq('status', 'selesai')).range(from, to))
// "Semua" = per halaman 200 (riwayat permanen terus bertambah)
export async function muatNotifHalaman(db: any, halaman: number): Promise<{ baris: Notifikasi[]; adaLagi: boolean }> {
  const { data, error } = await urut(db.from('inv_notifikasi').select('*')).range(halaman * PER_HALAMAN, (halaman + 1) * PER_HALAMAN)
  if (error) throw error
  return { baris: (data || []).slice(0, PER_HALAMAN), adaLagi: (data || []).length > PER_HALAMAN }
}
export async function hitungNotifBaru(db: any): Promise<number> {
  const { count, error } = await db.from('inv_notifikasi').select('id', { count: 'exact', head: true }).eq('status', 'baru')
  if (error) throw error
  return count || 0
}

async function rpc(db: any, nama: string, arg: Record<string, any>): Promise<any> {
  const { data, error } = await db.rpc(nama, arg)
  if (error) { console.error(`[inventaris notif] ${nama} gagal:`, error); throw Object.assign(new Error(error.message || String(error)), { code: error.code }) }
  return data
}
export const notifDilihat = (db: any, user: any, ids: number[]) => ids.length ? rpc(db, 'inv_notif_dilihat', { p_ids: ids, p_aktor: aktorAdmin(user) }) : Promise.resolve(0)
export const notifSetujui = (db: any, user: any, n: Notifikasi) => rpc(db, 'inv_notif_setujui', { p_id: n.id, p_versi: n.versi, p_aktor: aktorAdmin(user) })
export const notifKembalikan = (db: any, user: any, n: Notifikasi, catatan: string) =>
  rpc(db, 'inv_notif_kembalikan', { p_id: n.id, p_versi: n.versi, p_catatan: catatan.trim() || null, p_aktor: aktorAdmin(user) })

// ── tautan langsung ──
export type TargetInv = { tab: 'inventaris' | 'laporan' | 'maintenance'; rowId: string; barangId?: number } | { tab: 'notif' }
export const tautanNotif = (n: Pick<Notifikasi, 'jenis' | 'barang_id' | 'ref_id'>): string =>
  n.jenis.startsWith('laporan_') ? `laporan:${n.ref_id}` : n.jenis === 'maintenance_selesai' ? `jadwal:${n.ref_id}` : `barang:${n.barang_id}`
export function urai(tautan: string | null | undefined): TargetInv | null {
  if (!tautan) return null
  if (tautan === 'notif') return { tab: 'notif' }
  const [jenis, idTeks] = tautan.split(':'), id = Number(idTeks)
  if (!Number.isFinite(id) || id <= 0) return null
  if (jenis === 'barang') return { tab: 'inventaris', rowId: 'b' + id, barangId: id }
  if (jenis === 'laporan') return { tab: 'laporan', rowId: 'l' + id }
  if (jenis === 'jadwal') return { tab: 'maintenance', rowId: 'j' + id }
  return null
}
// App.tsx membersihkan query string saat mount -> ?inv=... dititipkan di sessionStorage, diambil tab Inventaris saat datanya siap
const KUNCI = 'vt_inv_tautan'
export const titipTautanInv = (v: string) => { try { sessionStorage.setItem(KUNCI, v) } catch { /* storage diblokir: tautan diabaikan */ } }
export const ambilTautanInv = (): string | null => { try { const v = sessionStorage.getItem(KUNCI); sessionStorage.removeItem(KUNCI); return v } catch { return null } }

// Data notifikasi utk tab admin: "Perlu ditinjau" (semua halaman) + jumlah 'baru'. Realtime + pemulih (fokus/visibility/polling)
// lewat pasangPemulihRealtime - sama dgn data Inventaris lain. Gagal muat = galat tampil di panel (tidak diam).
export function useNotifInventaris(db: any) {
  const [perlu, setPerlu] = useState<Notifikasi[]>([])
  const [jumlahBaru, setJumlahBaru] = useState(0)
  const [galat, setGalat] = useState('')
  const muat = useCallback(async () => {
    try { const [p, n] = await Promise.all([muatNotifPerlu(db), hitungNotifBaru(db)]); setPerlu(p); setJumlahBaru(n); setGalat('') }
    catch (e: any) { console.error('[inventaris notif] gagal memuat:', e); setGalat('Gagal memuat notifikasi: ' + (e?.message || String(e))) }
  }, [db])
  useEffect(() => { const t = setTimeout(muat, 0); return () => clearTimeout(t) }, [muat])
  useEffect(() => pasangPemulihRealtime(db, {
    nama: 'inventaris-notif-' + Math.random().toString(36).slice(2), label: 'Notifikasi inventaris', jedaMs: 600, muat, tabel: 'inv_notifikasi',
  }), [db, muat])
  return { perlu, jumlahBaru, galat, muat }
}
