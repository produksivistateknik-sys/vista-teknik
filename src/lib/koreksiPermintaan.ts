// KOREKSI QTY PERMINTAAN - SATU aturan "qty efektif" (22 Okt 2026, keputusan user). SALINAN IDENTIK ada di
// vista-pekerja/src/lib/koreksiPermintaan.ts (repo terpisah, tidak ada shared package): KALAU DIUBAH DI SATU REPO,
// WAJIB DISALIN KE REPO LAIN (pola sama dgn rekapPermintaanArsip.ts).
// - qty efektif = permintaan_item.qty (RPC approve_permintaan_koreksi menulis hasil koreksi TERAKHIR ke kolom itu),
//   dipakai Riwayat Gudang, Riwayat Admin, Rekap per Panel & cetak rekap. Koreksi berantai otomatis terhitung dari
//   yang terakhir - JANGAN menjumlah/menghitung ulang dari daftar koreksi.
// - qty disetujui per koreksi = qty_final (sejak 22 Okt 2026; admin boleh mengubah angka sebelum menyetujui),
//   koreksi lama tanpa qty_final = qty_diusulkan. Beda qty item vs koreksi terakhir = cek Kesehatan Data K19.
// Bacaan: paginasi .range() + urutan stabil + cek error, filter .in() dipecah per 200 id.
import { supabase } from './supabase'

export type KoreksiPermintaan = {
  id: number; permintaan_item_id: number; qty_lama: number; qty_diusulkan: number; qty_final?: number | null
  alasan: string; status: 'menunggu' | 'disetujui' | 'ditolak'; diajukan_oleh: string; diajukan_at: string
  disetujui_oleh: string | null; diputuskan_at: string | null; catatan_reject?: string | null
}

export const qtyEfektif = (item: { qty?: any } | null | undefined): number => Number(item?.qty) || 0
export const qtyDisetujui = (k: KoreksiPermintaan): number => Number(k.qty_final ?? k.qty_diusulkan)
// true = admin mengubah angka dari usulan Gudang saat menyetujui (hanya bisa diketahui utk koreksi sejak 22 Okt 2026)
export const qtyDiubahAdmin = (k: KoreksiPermintaan): boolean => k.qty_final != null && Number(k.qty_final) !== Number(k.qty_diusulkan)

// Koreksi DISETUJUI satu item, urut waktu keputusan (lalu id) - rantai "800 -> 536 -> 505".
export function rantaiKoreksi(daftar: KoreksiPermintaan[]): KoreksiPermintaan[] {
  return daftar.filter(k => k.status === 'disetujui')
    .sort((a, b) => String(a.diputuskan_at || '').localeCompare(String(b.diputuskan_at || '')) || a.id - b.id)
}
export function teksRantai(daftar: KoreksiPermintaan[], satuan?: string | null): string {
  const r = rantaiKoreksi(daftar)
  if (r.length === 0) return ''
  const angka = [String(r[0].qty_lama), ...r.map(k => String(qtyDisetujui(k)))]
  return angka.join(' → ') + (satuan ? ` ${satuan}` : '')
}

const HALAMAN = 1000
// Koreksi DISETUJUI utk sekumpulan item, dipetakan per permintaan_item_id. Error dilempar.
export async function muatKoreksiDisetujui(itemIds: number[]): Promise<Record<number, KoreksiPermintaan[]>> {
  const peta: Record<number, KoreksiPermintaan[]> = {}
  const ids = [...new Set(itemIds.filter(x => x != null))]
  for (let i = 0; i < ids.length; i += 200) {
    const bagian = ids.slice(i, i + 200)
    for (let dari = 0; ; dari += HALAMAN) {
      const { data, error } = await (supabase.from('permintaan_item_koreksi') as any).select('*')
        .eq('status', 'disetujui').in('permintaan_item_id', bagian).order('id', { ascending: true }).range(dari, dari + HALAMAN - 1)
      if (error) throw error
      for (const k of (data || []) as KoreksiPermintaan[]) (peta[k.permintaan_item_id] ||= []).push(k)
      if (!data || data.length < HALAMAN) break
    }
  }
  return peta
}

// Tanda "dikoreksi" utk 1 baris Rekap per Panel (gabungan beberapa item): null = tidak ada item yang dikoreksi.
// Teks = rantai per item yang dikoreksi, mis. "Dikoreksi: 800 → 536 → 505 CM". Angka rekap TIDAK berubah (sudah qty efektif).
export function teksTandaKoreksi(itemIds: number[], peta: Record<number, KoreksiPermintaan[]>, satuan?: string | null): string | null {
  const baris = itemIds.map(id => (peta[id]?.length ? teksRantai(peta[id], satuan) : '')).filter(Boolean)
  return baris.length ? `Dikoreksi: ${baris.join('; ')}` : null
}
