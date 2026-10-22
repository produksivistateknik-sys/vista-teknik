import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { muatKendala, type Kendala } from '../lib/kendalaProduksi'
import { laporError } from '../lib/laporError'
import { pasangPemulihRealtime } from '../lib/pemulihRealtime'

// Kendala produksi BELUM teratasi (23 Okt 2026) - badge menu Kendala & notifikasi lonceng admin. Sumber: tabel
// kendala_produksi (lib/kendalaProduksi, paginasi + error dicek). Realtime: perubahan apa pun -> muat ulang (digabung).
export function useKendalaTerbuka(aktif: boolean) {
  const [data, setData] = useState<Kendala[]>([])
  const [galat, setGalat] = useState(false)
  const muat = useCallback(async () => {
    try { setData(await muatKendala(supabase, { hanyaTerbuka: true })); setGalat(false) }
    catch (e) { console.error('[Kendala] gagal memuat kendala terbuka:', e); laporError('supabase_error', e, { aksi: 'muat kendala terbuka' }); setGalat(true) }
  }, [])
  useEffect(() => {
    if (!aktif) return
    muat()
    // (23 Okt 2026) pola pemulih bersama: realtime + ambil ulang saat tersambung ulang / tab aktif / online + polling 30 dtk
    return pasangPemulihRealtime(supabase, { nama: 'kendala-terbuka-badge', tabel: 'kendala_produksi', muat, jedaMs: 800, label: 'badge Kendala' })
  }, [aktif, muat])
  return { kendalaTerbuka: data, galatKendala: galat, refetchKendalaTerbuka: muat }
}
