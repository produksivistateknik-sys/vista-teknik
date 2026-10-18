// SIMPAN CHECKLIST PANEL SEBAGIAN (18 Okt 2026, audit penulisan checklist admin). Dulu 4 jalur admin (edit qty
// komponen, penyesuaian busbar, simpan Edit WO, sebar komponen BOM baru) menulis ULANG SELURUH kolom
// panels.checklist dari salinan yang dibaca beberapa saat sebelumnya -> progres/foto yang disimpan operator di
// jeda itu (komponen/proses lain) tertimpa. Sekarang cuma bagian yang BERUBAH yang dikirim, lewat RPC
// merge_panel_checklist_dalam (migration 20261002070000, dipakai juga semua jalur simpan Vista Pekerja).
//
// buatPatchKomponen = CERMIN PERSIS vista-pekerja lib/checklistHelpers.ts (repo terpisah) - ubah keduanya.
// PENTING: `dasar` WAJIB snapshot yang SAMA dgn yang dipakai menyusun `baru` (bukan bacaan lebih baru) - kalau
// tidak, perubahan operator di antara dua bacaan itu ikut "dikembalikan" ke nilai lama.
// Batasan: RPC tidak bisa menghapus SATU KODE utuh - kode yang ada di `dasar` tapi tidak ada di `baru` diabaikan
// (dilaporkan di `kodeTidakDihapus`). Jalur yang memang menyusun ulang total (ganti tipe panel) tetap menulis penuh.
import { supabase } from './supabase'

const isObj = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v)
const sama = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b)

export function buatPatchKomponen(lama: any, baru: any): Record<string, any> {
  const L = isObj(lama) ? lama : {}
  const B = isObj(baru) ? baru : {}
  const patch: Record<string, any> = {}
  for (const f of Object.keys(B)) {
    const a = L[f], b = B[f]
    if (sama(a, b)) continue
    if (isObj(a) && isObj(b)) {
      const sub: Record<string, any> = {}
      for (const k of Object.keys(b)) if (!sama(a[k], b[k])) sub[k] = b[k] === undefined ? null : b[k]
      for (const k of Object.keys(a)) if (!(k in b)) sub[k] = null
      if (Object.keys(sub).length) patch[f] = sub
    } else {
      patch[f] = b === undefined ? null : b
    }
  }
  for (const f of Object.keys(L)) if (!(f in B)) patch[f] = null
  return patch
}

export function buatPatchChecklist(dasar: any, baru: any): { patch: Record<string, any>; kodeTidakDihapus: string[] } {
  const D = isObj(dasar) ? dasar : {}
  const B = isObj(baru) ? baru : {}
  const patch: Record<string, any> = {}
  for (const kode of Object.keys(B)) {
    if (!isObj(B[kode])) continue
    const p = buatPatchKomponen(D[kode], B[kode])
    if (Object.keys(p).length) patch[kode] = p
  }
  return { patch, kodeTidakDihapus: Object.keys(D).filter(k => !(k in B)) }
}

// Kirim selisih `dasar` -> `baru`. Tidak ada yang berubah -> tidak ada request (dianggap sukses).
export async function simpanChecklistSelisih(panelId: number, dasar: any, baru: any): Promise<{ error: any; jumlahKode: number; kodeTidakDihapus: string[] }> {
  const { patch, kodeTidakDihapus } = buatPatchChecklist(dasar, baru)
  if (kodeTidakDihapus.length) console.warn('[simpanChecklistSelisih] kode tidak ikut dihapus (RPC merge tidak menghapus kode):', panelId, kodeTidakDihapus)
  const jumlahKode = Object.keys(patch).length
  if (!jumlahKode) return { error: null, jumlahKode, kodeTidakDihapus }
  const { error } = await supabase.rpc('merge_panel_checklist_dalam' as any, { p_panel_id: panelId, p_patch: patch } as any)
  return { error, jumlahKode, kodeTidakDihapus }
}
