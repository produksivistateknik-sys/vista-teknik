import { useState, useEffect, useCallback } from 'react'
import { workOrderService } from '../services/workOrderService'

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