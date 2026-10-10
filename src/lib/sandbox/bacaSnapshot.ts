// BACA SNAPSHOT - SATU-SATUNYA titik sandbox "Raw Schedule per WP" yang menyentuh Supabase (10 Okt 2026).
// Hanya SELECT dgn paginasi penuh (aturan 1000 baris). Tidak mengekspor klien Supabase, tidak ada
// insert/update/delete/rpc/realtime. Saring dideklarasikan (bukan builder) supaya pemanggil tidak bisa
// menyelipkan operasi lain.
import { supabase } from '../supabase'

export type SaringBaca = { eq?: [string, any][]; isNull?: string[]; urut?: { kolom: string; naik: boolean }; maks?: number }

export async function bacaTabel(tabel: string, kolom = '*', saring: SaringBaca = {}): Promise<any[]> {
  const PAGE = 1000
  let semua: any[] = []
  for (let dari = 0; ; dari += PAGE) {
    let q: any = supabase.from(tabel as any).select(kolom)
    for (const [k, v] of saring.eq || []) q = q.eq(k, v)
    for (const k of saring.isNull || []) q = q.is(k, null)
    if (saring.urut) q = q.order(saring.urut.kolom, { ascending: saring.urut.naik })
    const sampai = saring.maks != null ? Math.min(dari + PAGE, saring.maks) - 1 : dari + PAGE - 1
    const { data, error } = await q.range(dari, sampai)
    if (error) throw new Error(`Gagal memuat salinan "${tabel}": ${error.message}`)
    semua = semua.concat(data || [])
    if (!data || data.length < sampai - dari + 1 || (saring.maks != null && semua.length >= saring.maks)) break
  }
  return semua
}
