import { useState, useEffect, useCallback, useRef } from 'react'
import { renharService } from '../services/renharService'
import { supabase } from '../lib/supabase'
import { samakanReferensi } from '../lib/samakanReferensi'
import { pantauStatusRealtime } from '../lib/statusRealtime'
import { GLOBAL_DIRTY_RENHAR_IDS } from '../lib/globalState'
import { getRenharWindowRange } from '../lib/dateHelpers'

export function useRenhar() {
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
      // Window default (audit egress 6 Sep 2026, lihat dateHelpers.ts) - bukan fetch semua
      // histori lagi. RawSchedule.tsx & TrackingPekerja.tsx fetch tambahan sendiri kalau
      // admin navigasi/pilih tanggal di luar window ini.
      const result = await renharService.getAll(getRenharWindowRange())
      // refetch() nge-select ULANG semua baris - kalau ini nyala berbarengan sama tulisan lokal
      // yang lagi "dirty" (baru aja diupdate, misal abis klik Rilis), jangan sampai baris itu
      // ketimpa versi hasil select yang mungkin urutan sampainya di client gak sinkron sama commit
      // DB-nya. Ini nutup celah yang dulu kelewat: dirty-tracking di App.tsx cuma jaga proses
      // merge renharList->renhar, tapi gak jaga fetch() ini yang replace total `data` di hook.
      // samakanReferensi (4 Okt 2026): isi identik dgn hasil merge lama di bawah, bagian yang
      // tidak berubah memakai objek lama -> refetch tanpa perubahan tidak memicu render.
      setData(prev => {
        if (GLOBAL_DIRTY_RENHAR_IDS.size === 0) return samakanReferensi(prev, result)
        const prevMap: Record<string, any> = {}
        prev.forEach(r => { prevMap[String(r.id)] = r })
        return samakanReferensi(prev, result.map((r: any) =>
          GLOBAL_DIRTY_RENHAR_IDS.has(String(r.id)) && prevMap[String(r.id)] ? prevMap[String(r.id)] : r))
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
    const pantau = pantauStatusRealtime('renhar', () => { fetch() })
    const channel = supabase
      .channel('realtime-renhar')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'renhar' },
        (payload) => { setData(prev => prev.some(r => r.id === payload.new.id) ? prev : [...prev, payload.new]) }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'renhar' },
        (payload) => {
          setData(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r))
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'renhar' },
        (payload) => { setData(prev => prev.filter(r => r.id !== payload.old.id)) }
      )
      .subscribe(pantau.callback)
    return () => { pantau.lepas(); supabase.removeChannel(channel) }
  }, [fetch])

  const create = async (payload: any) => {
    try {
      const sess = JSON.parse(localStorage.getItem('vista_admin_session') || '{}')
      const uname = sess?.nama || sess?.name || 'Admin'
      const result = await renharService.create({ ...payload, updated_by: uname })
      setData(prev => prev.some(r => r.id === result.id) ? prev : [...prev, result])
      return { success: true, data: result }
    } catch (err) {
      // code dipertahankan biar withRenharQueue bisa bedain "row-nya udah keburu dibuat sesi
      // lain barusan" (23505, unique-violation raw_id+wp+tanggal) dari error lain.
      return { success: false, error: err instanceof Error ? err.message : 'Error', code: (err as any)?.code }
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
