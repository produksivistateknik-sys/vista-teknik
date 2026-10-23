// PENANDA "BARU" / "REVISI" MANAJEMEN WO (23 Okt 2026, keputusan user). Status PER ADMIN (nama akun login) PER RECORD WO:
//  - REVISI : work_orders.revisi_pada terisi DAN admin belum membuka WO itu sesudahnya (menang atas BARU);
//  - BARU   : work_orders.lacak_baru DAN admin belum pernah membuka WO itu;
//  - normal : selain itu. Hanya akun divisi admin yang melihat penanda & badge (Engineering tidak).
// "Membuka" = klik ▶ kartu / Edit -> tandaiWoDilihat. Pelaku revisi & pembuat WO otomatis dianggap sudah melihat (di RPC).
// REVISI dicatat di titik simpan aplikasi (bukan trigger - trigger tidak bisa membedakan split/WO baru dari revisi):
//  - Edit WO (Manajemen WO & WO Digital): ubah deadline, ubah nama proyek, ubah qty panel, tambah/hapus panel;
//  - Engineering mengunggah REVISI gambar WO (WO Digital, revisi ke-2 dst) -> WO itu + record AKTIF bernomor & berproyek sama.
//  Bukan revisi: progres, jadwal, timer, FCS, split per tanggal kirim (record pecahan tidak ditandai BARU).
// Tabel/RPC: migration 20261024010000_wo_baru_revisi.sql (wo_dilihat_admin, wo_revisi_log, tandai_wo_dilihat, catat_revisi_wo,
// catat_wo_dibuat). Semua RPC dicek error; kegagalan penanda TIDAK menggagalkan simpan WO (dicatat ke console + laporError).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchAllPaged } from './fetchAllPaged'
import { laporError } from './laporError'

export type StatusWo = 'baru' | 'revisi' | null
export function statusWo(wo: any, dilihatPada: string | undefined): StatusWo {
  if (wo?.revisi_pada && (!dilihatPada || Date.parse(wo.revisi_pada) > Date.parse(dilihatPada))) return 'revisi'
  if (wo?.lacak_baru && !dilihatPada) return 'baru'
  return null
}

export async function muatWoDilihat(db: any, admin: string): Promise<Map<number, string>> {
  const rows = await fetchAllPaged((a, z) => db.from('wo_dilihat_admin').select('wo_id,dilihat_pada').eq('admin_nama', admin).order('wo_id').range(a, z))
  return new Map(rows.map((r: any) => [Number(r.wo_id), r.dilihat_pada]))
}

const rpc = async (db: any, fn: string, args: any, apa: string) => {
  const { data, error } = await db.rpc(fn, args)
  if (error) { console.error(`[Penanda WO] ${apa} gagal:`, error); laporError('supabase_error', error, { aksi: apa, ...args }); throw error }
  return data
}
export const tandaiWoDilihat = (db: any, woId: number, admin: string) => rpc(db, 'tandai_wo_dilihat', { p_wo_id: woId, p_admin: admin }, 'tandai WO dilihat')
export const catatWoDibuat = (db: any, woId: number, oleh: string, split = false) => rpc(db, 'catat_wo_dibuat', { p_wo_id: woId, p_oleh: oleh, p_split: split }, 'catat WO dibuat')
export async function catatRevisiWo(db: any, woIds: number[], oleh: string, ringkas: string) {
  for (const id of [...new Set(woIds)]) await rpc(db, 'catat_revisi_wo', { p_wo_id: id, p_oleh: oleh, p_ringkas: ringkas }, 'catat revisi WO')
}
// Versi "tidak menggagalkan": dipakai SETELAH simpan WO berhasil - gagal = hanya log.
export async function amankan(f: () => Promise<any>) { try { await f() } catch { /* sudah di-log di rpc() */ } }

// Ringkasan revisi dari Edit WO (sebelum vs sesudah). null = tidak ada perubahan yang dihitung revisi.
export function ringkasRevisiEdit(o: {
  lama: { proyek: string; target: string; panels: { id: number; nama: string; qty: number }[] }
  baru: { proyek: string; target: string; panels: { id?: number; nama: string; qty: number }[] }
}): string | null {
  const r: string[] = []
  if ((o.lama.target || '') !== (o.baru.target || '')) r.push(`deadline ${o.lama.target || '-'} -> ${o.baru.target || '-'}`)
  if ((o.lama.proyek || '').trim() !== (o.baru.proyek || '').trim()) r.push(`proyek "${o.lama.proyek}" -> "${o.baru.proyek}"`)
  const baruAda = o.baru.panels.filter((p) => (p.nama || '').trim())
  const idBaru = new Set(baruAda.filter((p) => p.id).map((p) => Number(p.id)))
  const tambah = baruAda.filter((p) => !p.id).map((p) => p.nama.trim())
  const hapus = o.lama.panels.filter((p) => !idBaru.has(Number(p.id))).map((p) => p.nama.trim())
  const qty = baruAda.filter((p) => p.id).map((p) => ({ p, l: o.lama.panels.find((x) => Number(x.id) === Number(p.id)) }))
    .filter(({ p, l }) => l && Number(l.qty) !== Number(p.qty)).map(({ p, l }) => `qty ${p.nama.trim()} ${l!.qty} -> ${p.qty}`)
  if (tambah.length) r.push(`+${tambah.length} panel (${tambah.join(', ')})`)
  if (hapus.length) r.push(`-${hapus.length} panel (${hapus.join(', ')})`)
  r.push(...qty)
  return r.length ? r.join('; ') : null
}

// Record AKTIF (tidak diarsip/dihapus) bernomor & berproyek sama - utk revisi gambar WO (keputusan user: hanya yang aktif).
export async function woAktifSeNomor(db: any, woId: number): Promise<number[]> {
  const { data: w, error } = await db.from('work_orders').select('id,wo,proyek').eq('id', woId).range(0, 0)
  if (error) throw error
  if (!w?.[0]) return [woId]
  const { data, error: e2 } = await db.from('work_orders').select('id').eq('wo', w[0].wo).eq('proyek', w[0].proyek).is('deleted_at', null).or('is_archived.is.null,is_archived.eq.false').order('id').range(0, 999)
  if (e2) throw e2
  return [...new Set([woId, ...(data || []).map((x: any) => Number(x.id))])]
}
