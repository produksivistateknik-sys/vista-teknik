// PENANDA BARU / DIUBAH KENDALA & CATATAN PER ADMIN (11 Nov 2026, keputusan user: hanya Kendala & Catatan). Fungsi murni +
// pembungkus RPC (migration 20261111010000_admin_dilihat.sql). Status per admin (nama login, sama dgn penanda WO):
//  - BARU    : dibuat SESUDAH batas admin utk jenis itu, BUKAN buatan admin ini, dan belum ditandai dilihat;
//  - DIUBAH  : (catatan) diubah orang lain SESUDAH admin terakhir melihatnya (maks batas & waktu dilihat item) - edit TIDAK
//              memicu BARU;
// Hilang bila: klik kartu panel (semua item kartu), tombol aksi item (item itu), "Tandai semua sudah dilihat" (batas maju).
// Membuka tab / item sekadar terlihat BUKAN pemicu. Batas awal rilis = waktu SQL dijalankan -> item lama tidak BARU; akun admin
// baru mendapat batas saat pertama membuka (mulai_lacak_dilihat).
/* eslint-disable @typescript-eslint/no-explicit-any */
export type JenisDilihat = 'kendala' | 'catatan'
export type StatusDilihat = 'baru' | 'diubah' | null
export type DataDilihat = { batas: string; dilihat: Map<number, string> }

const ms = (s: string | null | undefined) => (s ? Date.parse(s) : NaN)

export function statusDilihat(o: { d: DataDilihat | null; id: number; dibuat: string; milikSaya: boolean; diubah?: string | null; diubahOlehSaya?: boolean }): StatusDilihat {
  if (!o.d) return null // fitur belum aktif (SQL belum dijalankan) / belum termuat
  const batas = ms(o.d.batas)
  const lihat = ms(o.d.dilihat.get(Number(o.id)))
  if (!o.milikSaya && ms(o.dibuat) > batas && !Number.isFinite(lihat)) return 'baru'
  if (o.diubah && !o.diubahOlehSaya) {
    const acuan = Math.max(batas, Number.isFinite(lihat) ? lihat : -Infinity)
    if (ms(o.diubah) > acuan) return 'diubah'
  }
  return null
}

const lempar = (error: any) => { const e: any = new Error(error?.message || String(error)); e.code = error?.code; throw e }
export const belumAktif = (e: any) => e?.code === 'PGRST202' || e?.code === 'PGRST205' || e?.code === '42P01'

export async function muatDilihat(db: any, jenis: JenisDilihat, admin: string): Promise<DataDilihat> {
  const { data: batas, error } = await db.rpc('mulai_lacak_dilihat', { p_jenis: jenis, p_admin: admin })
  if (error) lempar(error)
  const dilihat = new Map<number, string>()
  for (let dari = 0; ; dari += 1000) {
    const { data, error: e2 } = await db.from('admin_dilihat').select('ref_id,dilihat_pada').eq('jenis', jenis).eq('admin_nama', admin).order('ref_id').range(dari, dari + 999)
    if (e2) lempar(e2)
    for (const r of data || []) dilihat.set(Number(r.ref_id), r.dilihat_pada)
    if (!data || data.length < 1000) break
  }
  return { batas: String(batas), dilihat }
}
export async function tandaiDilihat(db: any, jenis: JenisDilihat, ids: number[], admin: string) {
  const unik = [...new Set(ids.map(Number).filter(Number.isFinite))]
  for (let i = 0; i < unik.length; i += 500) {
    const { error } = await db.rpc('tandai_dilihat', { p_jenis: jenis, p_ref_ids: unik.slice(i, i + 500), p_admin: admin })
    if (error) lempar(error)
  }
}
export async function tandaiSemuaDilihat(db: any, jenis: JenisDilihat, admin: string): Promise<string> {
  const { data, error } = await db.rpc('tandai_semua_dilihat', { p_jenis: jenis, p_admin: admin })
  if (error) lempar(error)
  return String(data)
}
