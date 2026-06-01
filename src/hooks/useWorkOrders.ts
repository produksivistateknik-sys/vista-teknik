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
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const channel = supabase
      .channel('realtime-wo')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'work_orders' },
        (payload) => { setData(prev => prev.some(r => r.id === payload.new.id) ? prev : [...prev, payload.new]) }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'work_orders' },
        (payload) => { setData(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r)) }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'work_orders' },
        (payload) => { setData(prev => prev.filter(r => r.id !== payload.old.id)) }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetch])

  const getUname = () => {
    const sess = JSON.parse(localStorage.getItem('vista_admin_session') || '{}')
    return sess?.nama || sess?.name || 'Admin'
  }

  const create = async (payload: any) => {
    try {
      const uname = getUname()
      const result = await workOrderService.create({ ...payload, updated_by: uname }, uname)
      setData(prev => prev.some(r => r.id === result.id) ? prev : [...prev, result])
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }

  const update = async (id: number, payload: any) => {
    try {
      const uname = getUname()
      const result = await workOrderService.update(id, { ...payload, updated_by: uname }, uname)
      setData(prev => prev.map(r => r.id === id ? result : r))
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }

  const remove = async (id: number) => {
    try {
      const uname = getUname()
      await workOrderService.remove(id, uname)
      setData(prev => prev.filter(r => r.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }

  return { data, loading, error, refetch: fetch, create, update, remove }
}
