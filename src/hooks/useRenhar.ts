import { useState, useEffect, useCallback } from 'react'
import { renharService } from '../services/renharService'
import { supabase } from '../lib/supabase'
import { GLOBAL_DIRTY_RENHAR_IDS } from '../lib/globalState'

export function useRenhar() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await renharService.getAll()
      // refetch() nge-select ULANG semua baris - kalau ini nyala berbarengan sama tulisan lokal
      // yang lagi "dirty" (baru aja diupdate, misal abis klik Rilis), jangan sampai baris itu
      // ketimpa versi hasil select yang mungkin urutan sampainya di client gak sinkron sama commit
      // DB-nya. Ini nutup celah yang dulu kelewat: dirty-tracking di App.tsx cuma jaga proses
      // merge renharList->renhar, tapi gak jaga fetch() ini yang replace total `data` di hook.
      setData(prev => {
        if (GLOBAL_DIRTY_RENHAR_IDS.size === 0) return result
        const prevMap: Record<string, any> = {}
        prev.forEach(r => { prevMap[String(r.id)] = r })
        return result.map((r: any) =>
          GLOBAL_DIRTY_RENHAR_IDS.has(String(r.id)) && prevMap[String(r.id)] ? prevMap[String(r.id)] : r)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const channel = supabase
      .channel('realtime-renhar')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'renhar' },
        (payload) => { setData(prev => prev.some(r => r.id === payload.new.id) ? prev : [...prev, payload.new]) }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'renhar' },
        (payload) => {
          console.log('[DEBUG REALTIME renhar UPDATE]', 'id=', payload.new.id, 'komponen_released=', payload.new.komponen_released, 'jam=', new Date().toISOString());
          setData(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r));
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'renhar' },
        (payload) => { setData(prev => prev.filter(r => r.id !== payload.old.id)) }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetch])

  const create = async (payload: any) => {
    try {
      const sess = JSON.parse(localStorage.getItem('vista_admin_session') || '{}')
      const uname = sess?.nama || sess?.name || 'Admin'
      const result = await renharService.create({ ...payload, updated_by: uname })
      setData(prev => prev.some(r => r.id === result.id) ? prev : [...prev, result])
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }

  const update = async (id: number, payload: any) => {
    try {
      const sess = JSON.parse(localStorage.getItem('vista_admin_session') || '{}')
      const uname = sess?.nama || sess?.name || 'Admin'
      const result = await renharService.update(id, { ...payload, updated_by: uname })
      setData(prev => prev.map(r => r.id === id ? result : r))
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }

  const remove = async (id: number) => {
    try {
      const { error } = await supabase.from('renhar').delete().eq('id', id)
      if (error) throw new Error(error.message)
      setData(prev => prev.filter(r => r.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }

  return { data, loading, error, refetch: fetch, create, update, remove }
}
