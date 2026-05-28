import { useState, useEffect, useCallback } from 'react'
import { workOrderService } from '../services/workOrderService'
import { supabase } from '../lib/supabase'

export function useWorkOrders() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await workOrderService.getAll()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    // Realtime subscription untuk tabel panels (checklist/progress update dari vista-pekerja)
    const channel = supabase
      .channel('realtime-panels')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'panels' },
        async (payload) => {
          console.log('[Realtime] panels UPDATE:', payload.new)
          // Update panel di dalam woData tanpa refetch semua
          setData(prev => prev.map(wo => ({
            ...wo,
            panels: (wo.panels || []).map((p: any) =>
              p.id === payload.new.id ? { ...p, ...payload.new } : p
            )
          })))
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'panels' },
        async () => {
          console.log('[Realtime] panels INSERT — refetch')
          await fetch()
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'panels' },
        async () => {
          console.log('[Realtime] panels DELETE — refetch')
          await fetch()
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' },
        async () => {
          console.log('[Realtime] work_orders change — refetch')
          await fetch()
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] panels channel status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetch])

  const create = async (payload: any) => {
    try {
      const newWO = await workOrderService.create(payload)
      setData(prev => [newWO, ...prev])
      return { success: true, data: newWO }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }

  const update = async (id: number, payload: any) => {
    try {
      const updated = await workOrderService.update(id, payload)
      setData(prev => prev.map(wo => wo.id === id ? updated : wo))
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }

  const remove = async (id: number) => {
    try {
      await workOrderService.remove(id)
      setData(prev => prev.filter(wo => wo.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }

  return { data, loading, error, refetch: fetch, create, update, remove }
}
