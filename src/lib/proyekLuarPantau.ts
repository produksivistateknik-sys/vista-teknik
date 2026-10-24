// PANTAU HARIAN PROYEK LUAR (24 Okt 2026) - SATU sumber aturan "aktif hari ini", penanda BARU/DIPERBARUI per admin, label
// "Diperbarui HH:MM", dan kapan jejak "Diubah oleh" ditampilkan. File ini IDENTIK di vista-teknik & vista-pekerja
// (src/lib/proyekLuarPantau.ts) - ubah keduanya bersamaan.
//  - aktivitas_pada (kolom, diisi TRIGGER saat catatan/foto/status/nama/tanggal berubah - migration 20261024030000) =
//    waktu terakhir ISI laporan berubah. updated_at TIDAK dipakai (ikut berubah saat admin mengarsip).
//  - Hari kerja WIB: 00.00-06.59 = hari sebelumnya (lib/tanggalWib).
//  - Penanda per admin: sudah pernah dilihat -> DIPERBARUI bila aktivitas sesudah dilihat; belum pernah dilihat -> hanya bila
//    aktivitasnya hari kerja ini/kemarin (laporan lama tidak menyala saat fitur dirilis). Laporan diarsip tidak ditandai.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { hariKerjaDari, hariKerjaWib } from './tanggalWib'

const WIB_MS = 7 * 3600 * 1000
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export const aktivitasPL = (l: any): string | null => l?.aktivitas_pada || l?.created_at || null

export const aktifHariIniPL = (l: any, sekarangMs: number = Date.now()): boolean =>
  !!aktivitasPL(l) && hariKerjaDari(aktivitasPL(l)) === hariKerjaWib(sekarangMs)

export type StatusPantauPL = 'baru' | 'diperbarui' | null
export function statusPantauPL(l: any, dilihatPada: string | undefined, sekarangMs: number = Date.now()): StatusPantauPL {
  const akt = aktivitasPL(l)
  if (!l || l.is_archived || !akt) return null
  if (dilihatPada) return Date.parse(akt) > Date.parse(dilihatPada) ? 'diperbarui' : null
  const hk = hariKerjaWib(sekarangMs), kemarin = hariKerjaWib(sekarangMs - 86400000)
  if (![hk, kemarin].includes(hariKerjaDari(akt))) return null
  return [hk, kemarin].includes(hariKerjaDari(l.created_at)) ? 'baru' : 'diperbarui'
}

// "14:05" bila hari kerja ini, selain itu "22 Okt 14:05" (jam WIB, tidak bergantung zona perangkat).
export function labelWaktuPL(iso: string | null | undefined, sekarangMs: number = Date.now()): string {
  const ms = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms + WIB_MS)
  const jam = String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0')
  return hariKerjaDari(ms) === hariKerjaWib(sekarangMs) ? jam : `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${jam}`
}

// Jejak "Diubah oleh": hanya bila yang mengubah BUKAN pelapor, atau diubah SESUDAH hari kerjanya (pengisian oleh pelapor
// sendiri di hari itu = pengisian biasa, cukup "Diperbarui HH:MM"). Semua perubahan tetap tercatat di proyek_luar_catatan_log.
export function jejakUbahCatatanPL(l: any): { oleh: string; pada: string } | null {
  const oleh = String(l?.catatan_diubah_oleh || '').trim(), pada = l?.catatan_diubah_pada
  if (!oleh || !pada) return null
  const pelapor = String(l?.operator_nama || '').trim().toLowerCase()
  if (oleh.toLowerCase() === pelapor && hariKerjaDari(pada) <= String(l?.tanggal || '')) return null
  return { oleh, pada }
}

// Nama proyek dinormalkan - SAMA dgn mulai_laporan_proyek_luar (lower + spasi beruntun jadi satu).
export const normalNamaPL = (s: string) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase()

// Pesan bentrok dari RPC ubah_catatan_proyek_luar (errcode PT409 = HTTP 409; 40001 versi awal - diulang PostgREST sampai timeout).
export const bentrokCatatanPL = (err: any) => err?.code === 'PT409' || err?.code === '40001' || /BENTROK/i.test(String(err?.message || ''))
