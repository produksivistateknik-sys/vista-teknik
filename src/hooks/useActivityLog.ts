import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useActivityLog() {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    // Supabase/PostgREST default-nya cuma balikin maks 1000 baris tanpa .range() -
    // activity_log sudah lewat 16.000+ baris, jadi tanpa fetchAll ini entry lama (di luar
    // 1000 terbaru) gak akan pernah ke-load ke ActivityLogView (yang filter tanggal/admin/
    // module/search-nya semua jalan client-side dari array ini, bukan query per-filter).
    const fetchAll = async () => {
      let all: any[] = []
      let from = 0
      const step = 1000
      while (true) {
        const { data, error } = await supabase.from('activity_log')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + step - 1)
        if (error || !data) break
        all = all.concat(data)
        if (data.length < step) break
        from += step
      }
      setData(all)
    }
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
  }, [])

  return { data }
}
