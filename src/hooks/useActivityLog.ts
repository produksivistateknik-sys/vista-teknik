import { useState, useEffect, useCallback } from 'react'
import { activityLogService } from '../services/activityLogService'
import { supabase } from '../lib/supabase'

export function useActivityLog() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      setLoading(true)
      const result = await activityLogService.getAll()
      setData(result)
    } catch (err) {
      console.error('useActivityLog error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const channel = supabase
      .channel('realtime-activity-log')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' },
        (payload) => {
          console.log('[Realtime] activity_log INSERT:', payload.new)
          setData(prev => {
            if (prev.some(a => a.id === payload.new.id)) return prev
            return [payload.new, ...prev]
          })
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] activity_log status:', status)
      })
    return () => { supabase.removeChannel(channel) }
  }, [fetch])

  const log = async (payload: any) => {
    await activityLogService.log(payload)
  }

  return { data, loading, refetch: fetch, log }
}
