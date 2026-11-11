/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react'
import { laporError } from '../lib/laporError'
import { pasangPemulihRealtime } from '../lib/pemulihRealtime'
import { muatDilihat, tandaiDilihat, tandaiSemuaDilihat, belumAktif, type DataDilihat, type JenisDilihat } from '../lib/adminDilihat'

// Status dilihat admin ini utk satu jenis (11 Nov 2026, lib/adminDilihat). Realtime (admin_dilihat & batas: tab lain / perangkat
// lain admin yang sama ikut sinkron) + pemulih. SQL belum dijalankan -> data null, penanda tidak tampil, tanpa galat berulang.
// tandai/tandaiSemua optimistik (layar langsung bersih), gagal -> muat ulang dari server.
export function useAdminDilihat(db: any, jenis: JenisDilihat, admin: string, aktif = true) {
  const [data, setData] = useState<DataDilihat | null>(null)
  const nonaktif = useRef(false)
  const muat = useCallback(async () => {
    if (!admin || nonaktif.current) return
    try { setData(await muatDilihat(db, jenis, admin)) }
    catch (e: any) {
      if (belumAktif(e)) { nonaktif.current = true; console.warn('[Penanda BARU ' + jenis + '] belum aktif (migration admin_dilihat belum dijalankan)'); return }
      console.error('[Penanda BARU ' + jenis + '] gagal memuat:', e); laporError('supabase_error', e, { aksi: 'muat admin_dilihat', jenis })
    }
  }, [db, jenis, admin])
  useEffect(() => {
    if (!aktif || !admin) return
    muat()
    return pasangPemulihRealtime(db, { nama: `admin-dilihat-${jenis}-${Math.random().toString(36).slice(2)}`, tabel: ['admin_dilihat', 'admin_dilihat_batas'], muat, jedaMs: 800, label: 'penanda BARU ' + jenis })
  }, [db, jenis, admin, aktif, muat])
  const tandai = useCallback(async (ids: number[]) => {
    if (!data || !ids.length) return
    const kini = new Date().toISOString()
    setData((d) => { if (!d) return d; const m = new Map(d.dilihat); ids.forEach((i) => m.set(Number(i), kini)); return { ...d, dilihat: m } })
    try { await tandaiDilihat(db, jenis, ids, admin) }
    catch (e) { console.error('[Penanda BARU ' + jenis + '] gagal menandai:', e); laporError('supabase_error', e, { aksi: 'tandai_dilihat', jenis }); muat() }
  }, [db, jenis, admin, data, muat])
  const tandaiSemua = useCallback(async () => {
    if (!data) return
    setData({ batas: new Date().toISOString(), dilihat: new Map() })
    try { const b = await tandaiSemuaDilihat(db, jenis, admin); setData({ batas: b, dilihat: new Map() }) }
    catch (e) { console.error('[Penanda BARU ' + jenis + '] gagal tandai semua:', e); laporError('supabase_error', e, { aksi: 'tandai_semua_dilihat', jenis }); muat() }
  }, [db, jenis, admin, data, muat])
  return { dilihat: data, tandai, tandaiSemua }
}
