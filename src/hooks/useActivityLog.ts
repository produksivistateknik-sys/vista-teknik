import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useActivityLog() {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    supabase.from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setData(data || []))

    const channel = supabase
      .channel('realtime-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' },
        (payload) => {
          console.log('[Realtime] activity_log INSERT:', payload.new)
          setData(prev => [payload.new, ...prev])
        }
      )
      .subscribe((status) => console.log('[Realtime] activity_log status:', status))

    return () => { supabase.removeChannel(channel) }
  }, [])

  return { data }
}
