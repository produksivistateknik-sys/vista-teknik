import { useState, useEffect, useCallback, useRef } from 'react'
import { rawScheduleService } from '../services/rawScheduleService'
import { supabase } from '../lib/supabase'
import { samakanReferensi } from '../lib/samakanReferensi'
import { pantauStatusRealtime } from '../lib/statusRealtime'
import { GLOBAL_DIRTY_RAW_IDS } from '../lib/globalState'

export function useRawSchedule() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sudahMuatRef = useRef(false)

  const fetch = useCallback(async () => {
    try {
      // PERFORMA (4 Okt 2026): loading cuma true di muat PERTAMA - dulu tiap refetch (heartbeat
      // 60 dtk/visibilitychange) membalik loading true->false = 2 render ulang App + semua tab
      // walau datanya sama. Satu-satunya pemakai flag ini guard sinkron di App.tsx.
      if (!sudahMuatRef.current) setLoading(true)
      setError(null)
      const result = await rawScheduleService.getAll()
      // Sama kayak useRenhar.fetch() - jangan biarkan refetch total ini nimpa baris yang lagi
      // dirty (baru aja ditulis lokal), biar konsisten sama proteksi di App.tsx.
      // samakanReferensi (4 Okt 2026): isi identik dgn hasil merge lama di bawah, bagian yang
      // tidak berubah memakai objek lama -> refetch tanpa perubahan tidak memicu render.
      setData(prev => {
        if (GLOBAL_DIRTY_RAW_IDS.size === 0) return samakanReferensi(prev, result)
        const prevMap: Record<string, any> = {}
        prev.forEach(r => { prevMap[String(r.id)] = r })
        return samakanReferensi(prev, result.map((r: any) =>
          GLOBAL_DIRTY_RAW_IDS.has(String(r.id)) && prevMap[String(r.id)] ? prevMap[String(r.id)] : r))
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      sudahMuatRef.current = true
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    // Status realtime dipantau (4 Okt 2026, lib/statusRealtime.ts): tersambung ulang setelah
    // putus -> ambil ulang penuh sekali (event selama putus terlewat). App.tsx memakai status ini
    // utk melewati heartbeat 60 dtk selama koneksi sehat.
    const pantau = pantauStatusRealtime('raw', () => { fetch() })
    const channel = supabase
      .channel('realtime-raw')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'raw_schedule' },
        (payload) => { setData(prev => prev.some(r => r.id === payload.new.id) ? prev : [...prev, payload.new]) }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'raw_schedule' },
        (payload) => { setData(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r)) }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'raw_schedule' },
        (payload) => { setData(prev => prev.filter(r => r.id !== payload.old.id)) }
      )
      .subscribe(pantau.callback)
    return () => { pantau.lepas(); supabase.removeChannel(channel) }
  }, [fetch])

  const create = async (payload: any) => {
    try {
      const sess = JSON.parse(localStorage.getItem('vista_admin_session') || '{}')
      const uname = sess?.nama || sess?.name || 'Admin'
      const result = await rawScheduleService.create({ ...payload, updated_by: uname })
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
      const result = await rawScheduleService.update(id, { ...payload, updated_by: uname })
      setData(prev => prev.map(r => r.id === id ? result : r))
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }

  const remove = async (id: number) => {
    try {
      const { error } = await supabase.from('raw_schedule').delete().eq('id', id)
      if (error) throw new Error(error.message)
      setData(prev => prev.filter(r => r.id !== id))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error' }
    }
  }

  return { data, loading, error, refetch: fetch, create, update, remove }
}
