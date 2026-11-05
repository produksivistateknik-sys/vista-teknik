// Data per hari tab Aktivitas Panel (5 Nov 2026). Timer lewat useTimerHariRencana (satu sumber dgn Rencana Harian, kanal
// sendiri); checkpoint tanggal itu utk nama cadangan (hari sibuk > 1000 baris: 1.027 pada 28 Okt 2026). Checklist & ccp
// TIDAK dimuat di sini - sudah ada di woData & useCcpMap Dashboard. aktif=false (tab/menu lain dibuka) = tanpa kanal & polling.
import { useEffect, useState } from 'react'
import { useTimerHariRencana } from './useTimerHariRencana'
import { fetchAllPaged } from '../lib/fetchAllPaged'
import { laporError } from '../lib/laporError'
import { pasangPemulihRealtime } from '../lib/pemulihRealtime'

const POLLING_TIMER_MS = 60000
const POLLING_CHECKPOINT_MS = 120000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAktivitasPanel(db: any, tanggal: string, aktif: boolean) {
  const { operatorHistoryData: timer, dimuat, galat: galatTimer } = useTimerHariRencana(db, tanggal, { namaKanal: 'realtime-aktivitas-panel-timer', pollingMs: POLLING_TIMER_MS, aktif })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cp, setCp] = useState<{ tanggal: string; baris: any[] } | null>(null)
  const [galatCp, setGalatCp] = useState<string | null>(null)
  useEffect(() => {
    if (!aktif) return
    let batal = false
    const muat = async () => {
      try {
        const baris = await fetchAllPaged((a, z) => db.from('progress_checkpoint_log').select('panel_id,kode_komponen,proses,pekerja_nama,tanggal').eq('tanggal', tanggal).order('id').range(a, z))
        if (!batal) { setCp({ tanggal, baris }); setGalatCp(null) }
      } catch (e) {
        console.error('[Aktivitas Panel] gagal memuat checkpoint (data terakhir dipertahankan):', e)
        laporError('supabase_error', e, { aksi: 'muat progress_checkpoint_log aktivitas panel', tanggal })
        if (!batal) setGalatCp((e as { message?: string })?.message || 'gagal memuat checkpoint')
      }
    }
    muat()
    const lepas = pasangPemulihRealtime(db, { nama: 'realtime-aktivitas-panel-checkpoint', tabel: 'progress_checkpoint_log', muat, pollingMs: POLLING_CHECKPOINT_MS, jedaMs: 3000, label: 'Aktivitas Panel checkpoint' })
    return () => { batal = true; lepas() }
  }, [db, tanggal, aktif])
  return {
    timer,
    checkpoint: cp?.tanggal === tanggal ? cp.baris : [],
    termuat: dimuat?.tanggal === tanggal && cp?.tanggal === tanggal,
    diperbaruiPada: dimuat?.pada ?? null,
    galat: galatTimer || galatCp,
  }
}
