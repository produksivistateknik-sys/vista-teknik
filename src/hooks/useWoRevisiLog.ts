/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllPaged } from '../lib/fetchAllPaged'
import { laporError } from '../lib/laporError'
import { pasangPemulihRealtime } from '../lib/pemulihRealtime'
import type { LogRevisi } from '../lib/woRevisiTag'

// LOG REVISI WO (9 Nov 2026, tag jenis revisi di Manajemen WO) - semua baris wo_revisi_log dikelompokkan per wo_id. select('*'):
// kolom `rincian` baru ada setelah migration 20261109010000 (sebelumnya layar membaca teks ringkas). Realtime + pemulih
// (tersambung ulang / tab aktif / polling 30 dtk). Gagal memuat = data lama dipertahankan, tag jatuh ke revisi_ringkas.
export function useWoRevisiLog(aktif: boolean) {
  const [log, setLog] = useState<Map<number, LogRevisi[]>>(new Map())
  const muat = useCallback(async () => {
    try {
      const rows = await fetchAllPaged((a, z) => (supabase.from('wo_revisi_log' as any).select('*') as any).order('id').range(a, z)) as LogRevisi[]
      const m = new Map<number, LogRevisi[]>()
      for (const r of rows) { const k = Number(r.wo_id); const a = m.get(k); if (a) a.push(r); else m.set(k, [r]) }
      setLog(m)
    } catch (e) { console.error('[Penanda WO] gagal memuat log revisi:', e); laporError('supabase_error', e, { aksi: 'muat wo_revisi_log' }) }
  }, [])
  useEffect(() => {
    if (!aktif) return
    muat()
    return pasangPemulihRealtime(supabase, { nama: 'wo-revisi-log', tabel: 'wo_revisi_log', muat, jedaMs: 800, label: 'tag revisi WO' })
  }, [aktif, muat])
  return log
}
