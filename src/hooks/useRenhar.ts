import { useState, useEffect, useCallback } from 'react'
import { useRenhar } from './hooks/useRenhar'
import { renharService } from '../services/renharService'

export function useRenhar() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await renharService.getAll()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = async (payload: any) => {
    try {
      const result = await renharService.create(payload)
      setData(prev => [...prev, result])
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }

  const update = async (id: number, payload: any) => {
    try {
      const result = await renharService.update(id, payload)
      setData(prev => prev.map(r => r.id === id ? result : r))
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }

  const remove = async (id: number) => {
    try {
      await renharService.remove(id)
      setData(prev => prev.filter(r => r.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }

  return { data, loading, error, refetch: fetch, create, update, remove }
}