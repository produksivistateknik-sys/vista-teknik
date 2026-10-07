import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// PERFORMA (7 Okt 2026): `aktif` - dulu SELURUH activity_log (±6 ribu baris, 6 request, ±125 KB)
// diambil + realtime dipasang di SETIAP halaman admin, padahal cuma 3 tab yang memakainya (Stok,
// Activity Log, Master User). Sekarang baru diambil saat salah satu tab itu pertama kali dibuka
// (App.tsx), lalu tetap hidup seperti sebelumnya. aktif=false -> tidak ada fetch/realtime, refetch no-op.
export function useActivityLog(aktif: boolean = true) {
  const [data, setData] = useState<any[]>([])
  const aktifRef = useRef(aktif)
  aktifRef.current = aktif

  // Supabase/PostgREST default-nya cuma balikin maks 1000 baris tanpa .range() -
  // activity_log sudah lewat 16.000+ baris, jadi tanpa fetchAll ini entry lama (di luar
  // 1000 terbaru) gak akan pernah ke-load ke ActivityLogView (yang filter tanggal/admin/
  // module/search-nya semua jalan client-side dari array ini, bukan query per-filter).
  const fetchAll = async () => {
    if (!aktifRef.current) return
    let all: any[] = []
    let from = 0
    const step = 1000
    while (true) {
      const { data, error } = await supabase.from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + step - 1)
      if (error) console.error('Gagal memuat activity_log:', error)
      if (error || !data) break
      all = all.concat(data)
      if (data.length < step) break
      from += step
    }
    setData(all)
  }

  useEffect(() => {
    if (!aktif) return
    fetchAll()

    const channel = supabase
      .channel('realtime-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' },
        (payload) => {
          setData(prev => [payload.new, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [aktif])

  return { data, refetch: fetchAll }
}
