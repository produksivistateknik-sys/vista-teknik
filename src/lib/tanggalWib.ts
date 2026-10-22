// TANGGAL WIB (23 Okt 2026) - SATU helper "tanggal hari ini / tanggal suatu waktu" di zona Asia/Jakarta (UTC+7, tanpa
// DST), TIDAK bergantung zona waktu perangkat dan TIDAK dihitung sekali saat modul dimuat (konstanta TODAY basi bila tab
// dibiarkan terbuka melewati tengah malam). File ini IDENTIK di vista-teknik & vista-pekerja (src/lib/tanggalWib.ts).
// HARI KERJA vs TANGGAL KALENDER: pabrik punya shift malam - pukul 00.00-06.59 WIB masih HARI KERJA sebelumnya (aturan
// lama getHariKerjaSekarang vista-teknik & hariKerjaAwal vista-pekerja). Catatan: new Date().toISOString().slice(0,10)
// (tanggal UTC) kebetulan SAMA dgn hari kerja WIB (UTC = WIB - 7 jam) - jangan dipakai diam-diam; pakai helper di bawah
// supaya maksudnya jelas (kalender: tanggalWibDari/hariIniWib; hari kerja: hariKerjaDari/hariKerjaWib).
const WIB_MS = 7 * 3600 * 1000

// "YYYY-MM-DD" WIB dari waktu (ISO string / epoch ms / Date). Kosong/tidak valid -> ''.
export function tanggalWibDari(waktu: string | number | Date | null | undefined): string {
  if (waktu == null || waktu === '') return ''
  const ms = waktu instanceof Date ? waktu.getTime() : typeof waktu === 'number' ? waktu : Date.parse(waktu)
  if (!Number.isFinite(ms)) return ''
  return new Date(ms + WIB_MS).toISOString().slice(0, 10)
}

// "YYYY-MM-DD" hari ini WIB - selalu dihitung saat dipanggil.
export const hariIniWib = (sekarangMs: number = Date.now()): string => tanggalWibDari(sekarangMs)

// HARI KERJA WIB dari suatu waktu: 00.00-06.59 WIB -> tanggal sebelumnya (shift malam), selain itu tanggal WIB biasa.
export function hariKerjaDari(waktu: string | number | Date | null | undefined): string {
  if (waktu == null || waktu === '') return ''
  const ms = waktu instanceof Date ? waktu.getTime() : typeof waktu === 'number' ? waktu : Date.parse(waktu)
  if (!Number.isFinite(ms)) return ''
  return new Date(ms + WIB_MS - BATAS_HARI_KERJA_MS).toISOString().slice(0, 10)
}
const BATAS_HARI_KERJA_MS = 7 * 3600 * 1000 // hari kerja berganti pukul 07.00 WIB
// Hari kerja WIB saat ini - dipakai utk kolom tanggal timer baru & "hari ini" di Rencana Harian.
export const hariKerjaWib = (sekarangMs: number = Date.now()): string => hariKerjaDari(sekarangMs)
