// REKAP PERMINTAAN SAMPAI ARSIP (17 Okt 2026, permintaan user: "rekap permintaan barang per panel harus ikut sampai
// arsip"). SATU sumber logika baca rekap - SALINAN IDENTIK ada di vista-pekerja/src/lib/rekapPermintaanArsip.ts (repo
// terpisah, tidak ada shared package): KALAU DIUBAH DI SINI, WAJIB DISALIN KE SANA.
// Sejak arsip_panel_aman (12 Okt 2026) permintaan panel yang diarsip TETAP ADA, hanya pindah dari panel_id ke
// panel_id_arsip. Dulu rekap cuma membaca WO aktif + panel aktif + permintaan.panel_id -> riwayat panel arsip tidak tampil.
// Semua bacaan: paginasi .range() dgn urutan stabil, cek error, filter .in() dipecah per 200 id.
import { supabase } from './supabase'

export type PanelRekap = { id: number; nama: string; woId: number; arsip: boolean }
export type WoRekap = { id: number; wo: string; proyek: string; arsip: boolean; panels: PanelRekap[] }
export type ItemRekap = { komponen_master_id: number | null; nama_komponen: string; satuan_dipilih: string | null; satuan: string | null; qty: number; panel_id: number; divisi: string | null }

const HALAMAN = 1000
async function semuaHalaman<T = any>(buat: (dari: number, sampai: number) => any): Promise<T[]> {
  let semua: T[] = []
  for (let dari = 0; ; dari += HALAMAN) {
    const { data, error } = await buat(dari, dari + HALAMAN - 1)
    if (error) throw error
    semua = semua.concat((data ?? []) as T[])
    if (!data || data.length < HALAMAN) return semua
  }
}
const potong = <T,>(arr: T[], n = 200): T[][] => { const o: T[][] = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o }

// WO + panel AKTIF (dari caller, sudah dimuat aplikasi) digabung dgn panel ARSIP (panels_archived) & WO arsipnya.
// Panel arsip yang WO-nya masih aktif ditempel ke WO itu; WO yang seluruhnya diarsip muncul sebagai WO arsip.
export async function gabungDenganArsip(woAktif: { id: number; wo: string; proyek: string; panels: { id: number; nama: string }[] }[]): Promise<WoRekap[]> {
  const peta = new Map<number, WoRekap>()
  for (const w of woAktif) peta.set(w.id, { id: w.id, wo: w.wo, proyek: w.proyek, arsip: false, panels: (w.panels || []).map(p => ({ id: p.id, nama: p.nama, woId: w.id, arsip: false })) })
  const arsip = await semuaHalaman<any>((a, b) => (supabase.from('panels_archived') as any).select('id,nama,wo_id').order('id', { ascending: true }).range(a, b))
  const woHilang = [...new Set(arsip.map(p => p.wo_id).filter((x: any) => x != null && !peta.has(x)))] as number[]
  for (const bagian of potong(woHilang)) {
    const rows = await semuaHalaman<any>((a, b) => (supabase.from('work_orders') as any).select('id,wo,proyek').in('id', bagian).order('id', { ascending: true }).range(a, b))
    for (const w of rows) peta.set(w.id, { id: w.id, wo: w.wo, proyek: w.proyek, arsip: true, panels: [] })
  }
  for (const p of arsip) {
    const w = peta.get(p.wo_id)
    if (w) w.panels.push({ id: p.id, nama: p.nama, woId: p.wo_id, arsip: true })
  }
  return [...peta.values()].filter(w => w.panels.length > 0)
}

// Item rekap (status 'submit' = benar-benar sudah keluar dari Gudang) utk sekumpulan panel aktif & arsip.
// panel_id pada hasil = id panel (aktif: permintaan.panel_id, arsip: permintaan.panel_id_arsip).
export async function muatItemRekap(panels: PanelRekap[]): Promise<ItemRekap[]> {
  const aktif = panels.filter(p => !p.arsip).map(p => p.id)
  const arsip = panels.filter(p => p.arsip).map(p => p.id)
  const perms: any[] = []
  for (const bagian of potong(aktif)) perms.push(...await semuaHalaman((a, b) => (supabase.from('permintaan') as any).select('id,panel_id,panel_id_arsip,divisi').in('panel_id', bagian).order('id', { ascending: true }).range(a, b)))
  for (const bagian of potong(arsip)) perms.push(...await semuaHalaman((a, b) => (supabase.from('permintaan') as any).select('id,panel_id,panel_id_arsip,divisi').in('panel_id_arsip', bagian).order('id', { ascending: true }).range(a, b)))
  if (perms.length === 0) return []
  const panelDari: Record<number, number> = {}, divisiDari: Record<number, string | null> = {}
  for (const p of perms) { panelDari[p.id] = p.panel_id ?? p.panel_id_arsip; divisiDari[p.id] = p.divisi }
  const items: ItemRekap[] = []
  for (const bagian of potong(perms.map(p => p.id))) {
    const rows = await semuaHalaman<any>((a, b) => (supabase.from('permintaan_item') as any).select('id,permintaan_id,komponen_master_id,nama_komponen,satuan_dipilih,satuan,qty')
      .in('permintaan_id', bagian).eq('status', 'submit').order('id', { ascending: true }).range(a, b))
    for (const it of rows) items.push({ komponen_master_id: it.komponen_master_id, nama_komponen: it.nama_komponen, satuan_dipilih: it.satuan_dipilih, satuan: it.satuan,
      qty: it.qty, panel_id: panelDari[it.permintaan_id], divisi: divisiDari[it.permintaan_id] })
  }
  return items
}
