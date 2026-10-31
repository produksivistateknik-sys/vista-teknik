// LAPORAN OUTSTANDING BERSAMA (S1, 31 Okt 2026) - satu laporan per hari kerja utk semua admin (migrasi
// 20261031030000_laporan_outstanding_bersama.sql). Model layar tetap DrafLaporan (lib/laporanOutstanding - sumber tunggal
// teks WA & berkop); di database disimpan PER BAGIAN (proyek/panel/pekerjaan/kendala/catatan/prioritas, id = id draf).
// - datarkan(draf) -> Datar (id -> baris); susunDraf(header, baris) kebalikannya. bedakan(lama, baru) -> operasi lo_simpan.
// - Konflik: terakhir menang per bagian (RPC mengembalikan peringatan "diubah oleh X"); perlindungan teks yang sedang
//   diketik ada di komponen (LaporanOutstanding.tsx).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchAllPaged } from './fetchAllPaged'
import { aktorAdmin } from './inventaris'
import { idBaru, type DrafLaporan, type ProyekLap, type PanelLap, type KendalaLap, type Varian } from './laporanOutstanding'

export type HeaderLO = {
  id: number; tanggal: string; jam: string; varian: Varian; tampil_teratasi: boolean; teks_wa: string | null; disusun_pada: string | null
  versi: number; dibuat_oleh: string; dibuat_pada: string; diperbarui_oleh: string | null; diperbarui_pada: string | null
}
export type JenisBagian = 'proyek' | 'panel' | 'pekerjaan' | 'kendala' | 'catatan' | 'prioritas'
export type Baris = { induk_id: string | null; jenis: JenisBagian; src: string | null; urut: number; data: any }
export type BagianLO = Baris & { id: string; laporan_id: number; versi: number; diperbarui_oleh: string | null; diperbarui_pada: string | null }
export type Datar = Map<string, Baris>
export type Meta = { versi: number; oleh: string | null; waktu: string | null }
export type Op = { o: 'tambah'; id: string } & Baris | { o: 'ubah'; id: string; versi_dasar?: number; data?: any; urut?: number; induk_id?: string | null } | { o: 'hapus'; id: string }

// ── draf <-> baris ──
// salinan objek tanpa satu kunci
export const tanpaKunci = <T extends Record<string, any>>(x: T, k: string): Record<string, any> => Object.fromEntries(Object.entries(x).filter(([key]) => key !== k))
const tanpaId = (x: { id: string }) => tanpaKunci(x, 'id')
export function datarkan(d: DrafLaporan): Datar {
  const m: Datar = new Map()
  const kd = (k: KendalaLap, induk: string, i: number, umum: boolean) => m.set(k.id, { induk_id: induk, jenis: 'kendala', src: null, urut: i, data: { ...tanpaId(k), ...(umum ? { umum: true } : {}) } })
  d.proyek.forEach((p, pi) => {
    m.set(p.id, { induk_id: null, jenis: 'proyek', src: p.src, urut: pi, data: { nama: p.nama, deadline: p.deadline, ringkas: p.ringkas, ...(p.semua ? { semua: true } : {}) } })
    p.kendalaUmum.forEach((k, i) => kd(k, p.id, i, true))
    p.panels.forEach((n, ni) => {
      m.set(n.id, { induk_id: p.id, jenis: 'panel', src: n.src, urut: ni, data: { nama: n.nama, panelId: n.panelId, ...(n.pekerjaanSemua ? { pekerjaanSemua: n.pekerjaanSemua } : {}), ...(n.pekerjaanRingkas ? { pekerjaanRingkas: n.pekerjaanRingkas } : {}) } })
      n.pekerjaan.forEach((j, i) => m.set(j.id, { induk_id: n.id, jenis: 'pekerjaan', src: null, urut: i, data: { teks: j.teks, selesai: j.selesai } }))
      n.kendala.forEach((k, i) => kd(k, n.id, i, false))
    })
  })
  d.catatan.forEach((c, i) => m.set(c.id, { induk_id: null, jenis: 'catatan', src: null, urut: i, data: { teks: c.teks } }))
  d.prioritas.forEach((r, i) => m.set(r.id, { induk_id: null, jenis: 'prioritas', src: null, urut: i, data: { nama: r.nama, deadline: r.deadline, panels: r.panels } }))
  return m
}
export function susunDraf(h: Pick<HeaderLO, 'tanggal' | 'jam' | 'varian' | 'tampil_teratasi' | 'disusun_pada'>, d: Datar): DrafLaporan {
  const anak = new Map<string, [string, Baris][]>()
  const akar: [string, Baris][] = []
  for (const e of d) { if (e[1].induk_id) anak.set(e[1].induk_id, [...(anak.get(e[1].induk_id) || []), e]); else akar.push(e) }
  const urut = (xs: [string, Baris][]) => [...xs].sort((a, b) => a[1].urut - b[1].urut || a[0].localeCompare(b[0]))
  const dari = (induk: string, jenis: JenisBagian) => urut((anak.get(induk) || []).filter(([, b]) => b.jenis === jenis))
  const kendala = (induk: string, umum: boolean): KendalaLap[] => dari(induk, 'kendala').filter(([, b]) => !!b.data.umum === umum)
    .map(([id, b]) => { const k = tanpaKunci(b.data, 'umum'); return { ...k, id, teks: String(k.teks ?? '') } as KendalaLap })
  const proyek: ProyekLap[] = urut(akar.filter(([, b]) => b.jenis === 'proyek')).map(([id, b]) => ({
    id, src: (b.src || 'manual') as any, nama: b.data.nama ?? '', deadline: b.data.deadline ?? '', ringkas: b.data.ringkas ?? '', ...(b.data.semua ? { semua: true } : {}),
    kendalaUmum: kendala(id, true),
    panels: dari(id, 'panel').map(([nid, n]): PanelLap => ({
      id: nid, src: (n.src || 'manual') as any, nama: n.data.nama ?? '', panelId: n.data.panelId ?? null,
      pekerjaan: dari(nid, 'pekerjaan').map(([jid, j]) => ({ id: jid, teks: String(j.data.teks ?? ''), selesai: !!j.data.selesai })),
      kendala: kendala(nid, false),
      ...(n.data.pekerjaanSemua ? { pekerjaanSemua: n.data.pekerjaanSemua } : {}), ...(n.data.pekerjaanRingkas ? { pekerjaanRingkas: n.data.pekerjaanRingkas } : {}),
    })),
  }))
  return {
    versi: 1, varian: h.varian, tanggal: h.tanggal, jam: h.jam, dibuatPada: h.disusun_pada || new Date().toISOString(), tampilTeratasi: h.tampil_teratasi,
    proyek,
    catatan: urut(akar.filter(([, b]) => b.jenis === 'catatan')).map(([id, b]) => ({ id, teks: String(b.data.teks ?? '') })),
    prioritas: urut(akar.filter(([, b]) => b.jenis === 'prioritas')).map(([id, b]) => ({ id, nama: b.data.nama ?? '', deadline: b.data.deadline ?? '', panels: Array.isArray(b.data.panels) ? b.data.panels : [] })),
  }
}
export const barisKeDatar = (rows: BagianLO[]): Datar => new Map(rows.map((r) => [r.id, { induk_id: r.induk_id, jenis: r.jenis, src: r.src, urut: r.urut, data: r.data }]))
export const datarKeDaftar = (d: Datar) => [...d].map(([id, b]) => ({ id, ...b }))
// kanonis (kunci diurutkan): jsonb Postgres menyusun ulang urutan kunci -> perbandingan JSON biasa salah anggap berubah
const kanonis = (x: any): string => x === null || typeof x !== 'object' ? JSON.stringify(x) ?? 'null'
  : Array.isArray(x) ? '[' + x.map(kanonis).join(',') + ']' : '{' + Object.keys(x).filter((k) => x[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + kanonis(x[k])).join(',') + '}'
export const sama = (a: any, b: any) => kanonis(a) === kanonis(b)
const KEDALAMAN: Record<JenisBagian, number> = { proyek: 0, catatan: 0, prioritas: 0, panel: 1, pekerjaan: 2, kendala: 2 }
// Operasi dari `lama` ke `baru`, hanya utk id di `hanya` (bila diisi). Tambah diurut induk dulu.
export function bedakan(lama: Datar, baru: Datar, hanya?: Set<string>): Op[] {
  const ops: Op[] = []
  const ikut = (id: string) => !hanya || hanya.has(id)
  for (const [id] of lama) if (!baru.has(id) && ikut(id)) ops.push({ o: 'hapus', id })
  const tambah: Op[] = []
  for (const [id, b] of baru) {
    if (!ikut(id)) continue
    const l = lama.get(id)
    if (!l) { tambah.push({ o: 'tambah', id, ...b }); continue }
    const op: any = { o: 'ubah', id }
    if (!sama(l.data, b.data)) op.data = b.data
    if (l.urut !== b.urut) op.urut = b.urut
    if (l.induk_id !== b.induk_id) op.induk_id = b.induk_id
    if (Object.keys(op).length > 2) ops.push(op)
  }
  tambah.sort((a: any, b: any) => KEDALAMAN[a.jenis as JenisBagian] - KEDALAMAN[b.jenis as JenisBagian])
  return [...tambah, ...ops]
}
export const idBerubah = (lama: Datar, baru: Datar) => new Set(bedakan(lama, baru).map((o) => o.id))
// Laporan hari baru dari laporan sebelumnya: semua id bagian dibuat ulang (id unik lintas laporan), relasi induk ikut.
export function ulangId(d: DrafLaporan): DrafLaporan {
  const baru = new Map<string, string>(); const ganti = (id: string) => { if (!baru.has(id)) baru.set(id, idBaru()); return baru.get(id)! }
  const kd = (k: KendalaLap) => ({ ...k, id: ganti(k.id) })
  return {
    ...d,
    proyek: d.proyek.map((p) => ({ ...p, id: ganti(p.id), kendalaUmum: p.kendalaUmum.map(kd),
      panels: p.panels.map((n) => ({ ...n, id: ganti(n.id), pekerjaan: n.pekerjaan.map((j) => ({ ...j, id: ganti(j.id) })), kendala: n.kendala.map(kd) })) })),
    catatan: d.catatan.map((c) => ({ ...c, id: ganti(c.id) })),
    prioritas: d.prioritas.map((r) => ({ ...r, id: ganti(r.id) })),
  }
}
export const headerDariDraf = (d: DrafLaporan, teksWa: string | null = null) => ({ jam: d.jam, varian: d.varian || 'V2', tampil_teratasi: d.tampilTeratasi !== false, teks_wa: teksWa, disusun_pada: d.dibuatPada })

// ── muat (baca saja; paginasi, urutan stabil, galat dilempar) ──
export async function muatLaporanTanggal(db: any, tanggal: string): Promise<{ header: HeaderLO | null; bagian: BagianLO[] }> {
  const { data, error } = await db.from('laporan_outstanding').select('*').eq('tanggal', tanggal).range(0, 0)
  if (error) throw error
  const header = (data?.[0] as HeaderLO) || null
  if (!header) return { header: null, bagian: [] }
  const bagian = await fetchAllPaged((a, z) => db.from('laporan_outstanding_bagian').select('id,laporan_id,induk_id,jenis,src,urut,data,versi,diperbarui_oleh,diperbarui_pada')
    .eq('laporan_id', header.id).is('dihapus_pada', null).order('id').range(a, z))
  return { header, bagian }
}
// daftar tanggal laporan (terbaru dulu) utk pemilih tanggal
export async function muatDaftarTanggal(db: any, batas = 120): Promise<{ tanggal: string; diperbarui_oleh: string | null; diperbarui_pada: string | null }[]> {
  const { data, error } = await db.from('laporan_outstanding').select('tanggal,diperbarui_oleh,diperbarui_pada').order('tanggal', { ascending: false }).range(0, batas - 1)
  if (error) throw error
  return data || []
}

// ── RPC ──
async function rpc(db: any, nama: string, arg: Record<string, any>): Promise<any> {
  const { data, error } = await db.rpc(nama, arg)
  if (error) { console.error(`[laporan outstanding] ${nama} gagal:`, error); throw Object.assign(new Error(error.message || String(error)), { code: error.code }) }
  return data
}
export type HasilSimpan = { versi: Record<string, number>; peringatan: { id: string; oleh: string | null; waktu: string | null }[]; hilang: { id: string; oleh: string | null; waktu: string | null }[] }
export const loBuat = (db: any, user: any, tanggal: string, header: any, d: Datar) =>
  rpc(db, 'lo_buat', { p_tanggal: tanggal, p_header: header, p_bagian: datarKeDaftar(d), p_aktor: aktorAdmin(user) }) as Promise<{ laporan: HeaderLO; dibuat: boolean }>
export const loSimpan = (db: any, user: any, laporanId: number, ops: Op[]) => rpc(db, 'lo_simpan', { p_laporan_id: laporanId, p_ops: ops, p_aktor: aktorAdmin(user) }) as Promise<HasilSimpan>
export const loUbahHeader = (db: any, user: any, laporanId: number, patch: Record<string, any>, versiDasar: number | null) =>
  rpc(db, 'lo_ubah_header', { p_laporan_id: laporanId, p_patch: patch, p_versi_dasar: versiDasar, p_aktor: aktorAdmin(user) }) as Promise<{ laporan: HeaderLO; peringatan: { oleh: string | null; waktu: string | null } | null }>
export const loGantiOtomatis = (db: any, user: any, laporanId: number, header: any, d: Datar) =>
  rpc(db, 'lo_ganti_otomatis', { p_laporan_id: laporanId, p_header: header, p_bagian: datarKeDaftar(d), p_aktor: aktorAdmin(user) })
export const loImpor = (db: any, user: any, tanggal: string, header: any, bagian: any[]) =>
  rpc(db, 'lo_impor', { p_tanggal: tanggal, p_header: header, p_bagian: bagian, p_aktor: aktorAdmin(user) }) as Promise<{ mode: 'baru' | 'gabung'; bagian: number; dilewati?: number }>
export const loKembalikan = (db: any, user: any, riwayatId: number) => rpc(db, 'lo_kembalikan', { p_riwayat_id: riwayatId, p_aktor: aktorAdmin(user) })

// Impor draf lama: laporan tanggal itu SUDAH ada -> hanya proyek manual/arsip (beserta isinya) & catatan; bagian otomatis lama
// tidak dibawa (sudah dibentuk ulang dari data). Belum ada -> seluruh draf.
export function bagianImpor(d: DrafLaporan, sudahAda: boolean): any[] {
  const semua = datarkan(d)
  if (!sudahAda) return datarKeDaftar(semua)
  const ambil = new Set<string>()
  d.proyek.filter((p) => p.src !== 'otomatis').forEach((p) => { ambil.add(p.id); p.kendalaUmum.forEach((k) => ambil.add(k.id)); p.panels.forEach((n) => { ambil.add(n.id); n.pekerjaan.forEach((j) => ambil.add(j.id)); n.kendala.forEach((k) => ambil.add(k.id)) }) })
  d.catatan.forEach((c) => ambil.add(c.id))
  return datarKeDaftar(semua).filter((b) => ambil.has(b.id))
}
// penanda per browser: draf lama sudah diimpor (tidak ditawarkan lagi); data lokal TIDAK dihapus (cadangan)
const kunciImpor = (nama: string) => `vt_laporan_outstanding_v1:${nama || 'admin'}:diimpor`
export const sudahDiimpor = (nama: string) => { try { return !!localStorage.getItem(kunciImpor(nama)) } catch { return false } }
export const tandaiDiimpor = (nama: string, ket: string) => { try { localStorage.setItem(kunciImpor(nama), ket) } catch { /* storage diblokir: tawaran muncul lagi, impor tetap tidak dobel */ } }
