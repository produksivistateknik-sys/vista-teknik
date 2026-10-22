import { useEffect, useMemo, useState } from 'react'
import { hariKerjaWib } from '../lib/tanggalWib'
import { pasangPemulihRealtime } from '../lib/pemulihRealtime'

// SATU SUMBER TIMER RENCANA HARIAN (23 Okt 2026, bug A - insiden SANDI 524 POTONG: kolom Operator "SANDI - belum mulai"
// padahal kolom Status menampilkan timer berjalan 53 menit). Dulu kolom Status (timerAktifData: realtime + polling 30 dtk)
// & kolom Operator (operatorHistoryData: realtime SAJA, kanal ber-filter tanggal) dimuat terpisah -> saat realtime diam-diam
// putus (tab lama terbuka, laptop sleep, wifi putus) kolom Operator beku sementara Status tetap segar. Sekarang keduanya
// DITURUNKAN dari satu query: timer bertanggal selDate + SEMUA timer yang masih berjalan. Disegarkan lewat realtime (event
// beruntun digabung), ambil ulang saat tersambung ULANG / tab aktif lagi / perangkat online lagi, dan polling 30 dtk
// (independen dari sehat-tidaknya realtime). Timer BERJALAN selalu dihitung "sedang mengerjakan" pada hari ini apa pun
// kolom tanggal-nya (bug B: timer pernah bertanggal tanggal kartu yang dibuka). "Hari ini" = HARI KERJA WIB (00.00-06.59 = hari sebelumnya, shift malam - lib/tanggalWib, sama dgn getHariKerjaSekarang).
// `db` = klien Supabase (disuntikkan supaya kode yang sama bisa diuji dgn klien tiruan).
const JEDA_MS = 1500
const POLLING_MS = 30000

export function useTimerHariRencana(db: any, selDate: string) {
  const [timerHariData, setTimerHariData] = useState<any[]>([])
  const [hariIniStr, setHariIniStr] = useState(hariKerjaWib())
  useEffect(() => {
    let cancelled = false
    const fetchTimerHari = async () => {
      let all: any[] = [], from = 0
      while (true) {
        const { data, error }: any = await db.from('fcs_timer_kerja')
          .select('id,panel_id,kode_komponen,proses,tahap,pekerja_id,tanggal,mulai,selesai,durasi_menit')
          .or(`selesai.is.null,tanggal.eq.${selDate}`).order('id').range(from, from + 999)
        if (error) { console.error('[Rencana Harian] gagal muat timer:', error); return } // data lama dibiarkan, dicoba lagi di siklus berikut
        all = all.concat(data ?? [])
        if (!data || data.length < 1000) break
        from += 1000
      }
      if (cancelled) return
      setTimerHariData(all)
      setHariIniStr(hariKerjaWib())
    }
    fetchTimerHari()
    const lepas = pasangPemulihRealtime(db, { nama: 'realtime-timer-aktif-rencana', tabel: 'fcs_timer_kerja', muat: fetchTimerHari, pollingMs: POLLING_MS, jedaMs: JEDA_MS, label: 'Rencana Harian timer' })
    return () => { cancelled = true; lepas() }
  }, [db, selDate])
  // Kolom Status: semua timer yang masih berjalan. Kolom Operator: timer tanggal selDate + (bila selDate hari ini WIB)
  // semua yang masih berjalan apa pun tanggal-nya.
  const timerAktifData = useMemo(() => timerHariData.filter((t: any) => !t.selesai), [timerHariData])
  const operatorHistoryData = useMemo(() => timerHariData.filter((t: any) => t.tanggal === selDate || (!t.selesai && selDate === hariIniStr)), [timerHariData, selDate, hariIniStr])
  return { timerAktifData, operatorHistoryData, hariIniStr }
}
