import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { produksiStokService } from '../services/produksiStokService'

// Sesi Produksi Stok yang sedang berjalan (2 Okt 2026) - hook bersama panel "Sesi Produksi Stok
// Aktif" (SesiProduksiStokPanel) & toast Admin (SesiProduksiStokToast), biar keduanya baca data &
// aturan "basi" yang sama (CLAUDE.md B.1). Realtime dari tabel produksi_stok_sesi saja - tidak
// menyentuh panels / raw_schedule / WO.
export type SesiProduksiStok = {
  id: number; batch_id: number; tahap: string; operator_id: number | null; operator_nama: string
  sub_bagian: string | null; mulai_at: string; komponen_nama: string; komponen_kode: string | null
}

// Sesi "basi" = dimulai SEBELUM hari ini (operator kemungkinan lupa Stop). Tetap tampil di panel
// (beda warna + tombol Tutup sesi), tapi tidak memicu toast.
export const sesiBasi = (s: { mulai_at: string }) => {
  const awalHariIni = new Date(); awalHariIni.setHours(0, 0, 0, 0)
  return new Date(s.mulai_at).getTime() < awalHariIni.getTime()
}

// Format timer panel Admin: MM:SS, atau HH:MM:SS kalau sudah >= 1 jam (permintaan user).
export const formatDurasiSesi = (mulaiAt: string) => {
  const total = Math.max(0, Math.floor((Date.now() - new Date(mulaiAt).getTime()) / 1000))
  const j = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), d = total % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return j > 0 ? `${p(j)}:${p(m)}:${p(d)}` : `${p(m)}:${p(d)}`
}

export function useSesiProduksiStokAktif(aktif = true) {
  const [sesi, setSesi] = useState<SesiProduksiStok[]>([])
  const [sudahMuat, setSudahMuat] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const muat = useCallback(async () => {
    try {
      setSesi(await produksiStokService.ambilSesiAktif())
      setError(null)
      setSudahMuat(true)
    } catch (err: any) {
      console.error('[SesiProduksiStok] gagal memuat:', err)
      setError(err?.message || String(err)) // data lama dipertahankan
    }
  }, [])

  useEffect(() => {
    if (!aktif) return
    muat()
    let t: any = null
    const muatUlang = () => { clearTimeout(t); t = setTimeout(muat, 400) }
    const ch = supabase.channel('realtime-produksi-stok-sesi-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'produksi_stok_sesi' }, muatUlang)
      .subscribe()
    const onVisible = () => { if (document.visibilityState === 'visible') muat() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearTimeout(t); supabase.removeChannel(ch); document.removeEventListener('visibilitychange', onVisible) }
  }, [aktif, muat])

  return { sesi, sudahMuat, error, muatUlang: muat }
}
