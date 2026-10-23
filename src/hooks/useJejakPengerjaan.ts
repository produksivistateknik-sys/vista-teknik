import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchAllPaged, UKURAN_POTONGAN_ID } from '../lib/fetchAllPaged'
import { laporError } from '../lib/laporError'
import { indeksTimerJejak, type TimerJejak } from '../lib/jejakPengerjaan'

// Jejak pengerjaan Rencana Harian (23 Okt 2026): SEMUA timer (semua tanggal) utk panel yang sedang tampil, dimuat sekali
// (fcs_timer_kerja .in(panel_id) per potongan 200 id, .order('id') + .range() penuh), dikelompokkan per panel|kode|proses.
// Disegarkan tiap 5 menit saat tab terlihat + saat tab aktif lagi (jejak historis tidak perlu secepat kolom "hari ini",
// yang tetap memakai useTimerHariRencana). Gagal muat -> data lama dipakai + log error (tanpa memblokir halaman).
const POLLING_MS = 5 * 60 * 1000

export function useJejakPengerjaan(db: any, panelIds: (number | string)[]) {
  const kunci = useMemo(() => [...new Set(panelIds.map((x) => Number(x)).filter((x) => Number.isFinite(x)))].sort((a, b) => a - b).join(','), [panelIds])
  const [rows, setRows] = useState<TimerJejak[]>([])
  const muat = useCallback(async () => {
    const ids = kunci ? kunci.split(',').map(Number) : []
    if (!ids.length) { setRows([]); return }
    try {
      const semua: TimerJejak[] = []
      for (let i = 0; i < ids.length; i += UKURAN_POTONGAN_ID) {
        const pot = ids.slice(i, i + UKURAN_POTONGAN_ID)
        semua.push(...await fetchAllPaged((a, z) => db.from('fcs_timer_kerja').select('id,panel_id,kode_komponen,proses,tahap,tanggal,pekerja_id,mulai,selesai,durasi_menit,progress').in('panel_id', pot).order('id').range(a, z)))
      }
      setRows(semua)
    } catch (e) {
      console.error('[Jejak pengerjaan] gagal memuat timer (data lama dipakai):', e)
      laporError('supabase_error', e, { aksi: 'muat jejak pengerjaan' })
    }
  }, [db, kunci])
  useEffect(() => {
    muat()
    const segarkan = () => { if (document.visibilityState === 'visible') muat() }
    const iv = setInterval(segarkan, POLLING_MS)
    document.addEventListener('visibilitychange', segarkan)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', segarkan) }
  }, [muat])
  return useMemo(() => indeksTimerJejak(rows), [rows])
}
