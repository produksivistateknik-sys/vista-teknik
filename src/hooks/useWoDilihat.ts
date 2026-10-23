import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { laporError } from '../lib/laporError'
import { pasangPemulihRealtime } from '../lib/pemulihRealtime'
import { muatWoDilihat, tandaiWoDilihat } from '../lib/woDilihat'

// Penanda BARU/REVISI Manajemen WO (23 Okt 2026): kapan admin ini terakhir membuka tiap WO (satu query, .range penuh) +
// pemulih realtime bersama (event wo_dilihat_admin, sambung ulang, tab aktif, polling 30 dtk). Kolom revisi_pada/lacak_baru
// ikut di woData (useWorkOrders, realtime work_orders). Hanya aktif utk akun admin.
export function useWoDilihat(admin: string, aktif: boolean) {
  const [dilihat, setDilihat] = useState<Map<number, string>>(new Map())
  const [galat, setGalat] = useState(false)
  const muat = useCallback(async () => {
    if (!admin) return
    try { setDilihat(await muatWoDilihat(supabase, admin)); setGalat(false) }
    catch (e) { console.error('[Penanda WO] gagal memuat status dilihat:', e); laporError('supabase_error', e, { aksi: 'muat wo_dilihat_admin' }); setGalat(true) }
  }, [admin])
  useEffect(() => {
    if (!aktif || !admin) return
    muat()
    return pasangPemulihRealtime(supabase, { nama: 'wo-dilihat-admin', tabel: 'wo_dilihat_admin', muat, jedaMs: 800, label: 'penanda WO' })
  }, [aktif, admin, muat])
  // Buka WO: langsung tandai di tampilan (optimistis), lalu simpan; gagal -> muat ulang dari server.
  const buka = useCallback(async (woId: number) => {
    if (!aktif || !admin) return
    setDilihat((m) => new Map(m).set(woId, new Date().toISOString()))
    try { await tandaiWoDilihat(supabase, woId, admin) } catch { muat() }
  }, [aktif, admin, muat])
  return { dilihat, galatDilihat: galat, bukaWo: buka, muatUlangDilihat: muat }
}
