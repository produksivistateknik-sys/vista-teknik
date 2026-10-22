import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { muatKendala, type Kendala } from '../lib/kendalaProduksi'
import { laporError } from '../lib/laporError'

// Kendala produksi BELUM teratasi (23 Okt 2026) - badge menu Kendala & notifikasi lonceng admin. Sumber: tabel
// kendala_produksi (lib/kendalaProduksi, paginasi + error dicek). Realtime: perubahan apa pun -> muat ulang (digabung).
export function useKendalaTerbuka(aktif: boolean) {
  const [data, setData] = useState<Kendala[]>([])
  const [galat, setGalat] = useState(false)
  const muat = useCallback(async () => {
    try { setData(await muatKendala(supabase, { hanyaTerbuka: true })); setGalat(false) }
    catch (e) { console.error('[Kendala] gagal memuat kendala terbuka:', e); laporError('supabase_error', e, { aksi: 'muat kendala terbuka' }); setGalat(true) }
  }, [])
  const tunda = useRef<any>(null)
  useEffect(() => {
    if (!aktif) return
    muat()
    const ch = supabase.channel('kendala-terbuka-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kendala_produksi' }, () => {
        clearTimeout(tunda.current); tunda.current = setTimeout(muat, 800)
      }).subscribe()
    return () => { clearTimeout(tunda.current); supabase.removeChannel(ch) }
  }, [aktif, muat])
  return { kendalaTerbuka: data, galatKendala: galat, refetchKendalaTerbuka: muat }
}
