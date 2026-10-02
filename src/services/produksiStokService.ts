import { supabase as supabaseTyped } from '../lib/supabase'

// PRODUKSI STOK (2 Okt 2026) - service admin vista-teknik. Semua tulis lewat RPC (validasi &
// increment atomik di DB, lihat supabase/migrations/20261002030000_produksi_stok.sql). Angka
// "tersedia/baik" per tahap DIBACA dari view v_produksi_stok_tahap (fungsi SQL
// produksi_stok_kondisi) - SATU rumus dgn yang dipakai RPC, gak dihitung ulang di client.
// Tabel/RPC baru belum ada di supabase-generated.ts -> client tanpa tipe di file ini.
const supabase: any = supabaseTyped

async function ambilSemua(build: (from: number, to: number) => any) {
  let semua: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw new Error(error.message)
    semua = semua.concat(data || [])
    if (!data || data.length < 1000) break
  }
  return semua
}

async function rpc(nama: string, args: Record<string, any>) {
  const { data, error } = await supabase.rpc(nama, args)
  if (error) throw new Error(error.message)
  return data
}

export const produksiStokService = {
  async ambilBatch() {
    return ambilSemua((a, b) => supabase.from('produksi_stok_batch').select('*').order('created_at', { ascending: false }).range(a, b))
  },
  async ambilTahap(batchIds: number[]) {
    if (batchIds.length === 0) return []
    return ambilSemua((a, b) => supabase.from('v_produksi_stok_tahap').select('*').in('batch_id', batchIds).order('urutan').range(a, b))
  },
  async ambilLog(batchId: number) {
    return ambilSemua((a, b) => supabase.from('produksi_stok_log').select('*').eq('batch_id', batchId).order('created_at', { ascending: false }).range(a, b))
  },
  async tahapBerlaku(tipePanel: string, kodeKomponen: string): Promise<string[]> {
    const data = await rpc('produksi_stok_tahap_berlaku', { p_tipe_panel: tipePanel, p_kode_komponen: kodeKomponen })
    return (data || []).map((r: any) => r.tahap)
  },
  buat: (komponenId: number, targetQty: number, oleh: string) =>
    rpc('buat_batch_produksi_stok', { p_komponen_id: komponenId, p_target_qty: targetQty, p_created_by: oleh }),
  ubahTarget: (batchId: number, targetQty: number, oleh: string) =>
    rpc('ubah_target_produksi_stok', { p_batch_id: batchId, p_target_qty: targetQty, p_oleh: oleh }),
  batal: (batchId: number, oleh: string, alasan: string | null) =>
    rpc('batal_produksi_stok', { p_batch_id: batchId, p_oleh: oleh, p_alasan: alasan }),
}
