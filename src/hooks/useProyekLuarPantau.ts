import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { laporError } from '../lib/laporError'
import { fetchAllPaged } from '../lib/fetchAllPaged'
import { pasangPemulihRealtime } from '../lib/pemulihRealtime'
import { statusPantauPL } from '../lib/proyekLuarPantau'

// Pantau harian Proyek Luar (24 Okt 2026): ringkasan RINGAN semua laporan (tanpa foto/catatan - murah dipolling) + kapan admin
// ini terakhir melihat tiap laporan. Pemulih realtime bersama (event proyek_luar & proyek_luar_dilihat_admin, sambung ulang,
// tab aktif, polling 30 dtk). `tanda` berubah tiap ada laporan yang isinya/arsipnya berubah -> ProyekLuarTab memuat ulang
// data lengkap hanya saat itu (bukan memolling data lengkap). Penanda (dilihat/badge) hanya utk akun admin.
/* eslint-disable @typescript-eslint/no-explicit-any */
export function useProyekLuarPantau(admin: string, bolehLihat: boolean, penanda: boolean) {
  const [ringkas, setRingkas] = useState<any[]>([])
  const [dilihat, setDilihat] = useState<Map<number, string>>(new Map())
  const [galat, setGalat] = useState(false)
  const sudahLapor = useRef(false)
  const muat = useCallback(async () => {
    try {
      const [rows, lihat] = await Promise.all([
        fetchAllPaged((a, z) => supabase.from('proyek_luar' as any).select('id,created_at,updated_at,aktivitas_pada,is_archived').order('id').range(a, z)),
        penanda && admin
          ? fetchAllPaged((a, z) => supabase.from('proyek_luar_dilihat_admin' as any).select('proyek_luar_id,dilihat_pada').eq('admin_nama', admin).order('proyek_luar_id').range(a, z))
          : Promise.resolve([]),
      ])
      setRingkas(rows)
      if (penanda) setDilihat(new Map(lihat.map((r: any) => [Number(r.proyek_luar_id), r.dilihat_pada])))
      setGalat(false); sudahLapor.current = false
    } catch (e) {
      console.error('[Pantau Proyek Luar] gagal memuat:', e)
      if (!sudahLapor.current) { laporError('supabase_error', e, { aksi: 'muat pantau proyek_luar' }); sudahLapor.current = true } // sekali per rentetan gagal
      setGalat(true)
    }
  }, [admin, penanda])
  useEffect(() => {
    if (!bolehLihat) return
    muat()
    return pasangPemulihRealtime(supabase, { nama: 'proyek-luar-pantau', tabel: ['proyek_luar', 'proyek_luar_dilihat_admin'], muat, jedaMs: 800, label: 'pantau proyek luar' })
  }, [bolehLihat, muat])
  // Tandai dilihat: langsung di tampilan (optimistis), lalu simpan; gagal -> muat ulang dari server.
  const tandai = useCallback(async (ids: number[]) => {
    if (!penanda || !admin || !ids.length) return
    const kini = new Date().toISOString()
    setDilihat((m) => { const n = new Map(m); ids.forEach((id) => n.set(id, kini)); return n })
    const { error } = await supabase.rpc('tandai_proyek_luar_dilihat' as any, { p_ids: ids, p_admin: admin } as any)
    if (error) { console.error('[Pantau Proyek Luar] tandai dilihat gagal:', error); laporError('supabase_error', error, { aksi: 'tandai proyek luar dilihat', jumlah: ids.length }); muat() }
  }, [penanda, admin, muat])
  const tanda = useMemo(() => ringkas.map((r) => `${r.id}:${r.aktivitas_pada}:${r.updated_at}:${r.is_archived ? 1 : 0}`).join('|'), [ringkas])
  const jumlahPerluDilihat = useMemo(() => penanda ? ringkas.filter((r) => statusPantauPL(r, dilihat.get(Number(r.id)))).length : 0, [ringkas, dilihat, penanda])
  return { dilihat, tandai, tanda, jumlahPerluDilihat, galatPantau: galat, penanda }
}
export type PantauProyekLuar = ReturnType<typeof useProyekLuarPantau>
