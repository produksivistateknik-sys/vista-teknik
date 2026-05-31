import { useState, useEffect, useCallback } from 'react'
import { kendalaService } from '../services/kendalaService'
import { supabase } from '../lib/supabase'

export function useKendala() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      setLoading(true)
      const result = await kendalaService.getAll()
      setData(result)
    } catch (err) {
      console.error('useKendala fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const channel = supabase
      .channel('realtime-kendala')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kendala' },
        (payload) => {
          console.log('[Realtime] kendala INSERT:', payload.new)
          setData(prev => {
            if (prev.some(k => k.id === payload.new.id)) return prev
            return [payload.new, ...prev]
          })
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'kendala' },
        (payload) => {
          console.log('[Realtime] kendala DELETE:', payload.old)
          setData(prev => prev.filter(k => k.id !== payload.old.id))
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] kendala channel status:', status)
      })
    return () => { supabase.removeChannel(channel) }
  }, [fetch])

  const create = async (payload: any) => {
    try {
      const result = await kendalaService.create(payload)
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }

  const remove = async (id: number) => {
    try {
      await kendalaService.remove(id)
      setData(prev => prev.filter(k => k.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }

  return { data, loading, refetch: fetch, create, remove }
}
