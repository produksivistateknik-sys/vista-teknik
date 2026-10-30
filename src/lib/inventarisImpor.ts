// Pembaca Excel inventaris (29 Okt 2026) - SATU sumber normalisasi untuk tombol "Impor dari Excel" (tab Inventaris &
// Maintenance) dan skrip T1 supabase/scripts/inv_dryrun_impor.mjs. Murni (tanpa supabase/Vite): baris 2D dari SheetJS
// masuk, baris siap kirim ke RPC inv_impor keluar. Kolom = Google Sheet perusahaan ("DATABASE INVENTARIS").
// Aturan (keputusan user): lokasi kosong -> BELUM (Belum ditentukan), kondisi kosong -> belum_dinilai, tanggal update &
// pelapor kosong tetap NULL, nama kembar di lokasi sama = barang berbeda, teks tanggal asli disimpan bila bukan tanggal baku.

export type LokasiImpor = { kode: string; nama: string }
export type BarisImpor = {
  kunci: string; nama: string; lokasi_kode: string; pengguna: string | null; kondisi: string; detail_kondisi: string | null
  merk_spesifikasi: string | null; nomor_seri: string | null; tanggal_perolehan: string | null; tanggal_perolehan_teks: string | null
  pelapor: string | null; diperbarui_pada: string | null
  _baris: number; _lokasiAsli: string; _kondisiAsli: string; _namaAsli: string
}
export type HasilBaca = { baris: BarisImpor[]; galat: string[]; catatan: string[] }

export const KONDISI_DARI_TEKS: Record<string, string> = {
  'BERFUNGSI BAIK': 'baik', 'BERFUNGSI TIDAK MAKSIMAL': 'tidak_maksimal', 'PERLU MAINTENANCE': 'perlu_maintenance',
  'RUSAK': 'rusak', 'BELUM DINILAI': 'belum_dinilai', '': 'belum_dinilai',
}
// Teks lokasi Excel yang namanya beda dari inv_lokasi.nama (lainnya dicocokkan ke nama/kode inv_lokasi).
const ALIAS_LOKASI: Record<string, string> = { 'WIRING': 'WR', '': 'BELUM' }
const BULAN: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 }

export const rapikanTeks = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim()
const besar = (v: unknown) => rapikanTeks(v).toUpperCase()
const pad = (n: number | string) => String(n).padStart(2, '0')
const dariSerial = (n: number) => { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` }

// Nilai sel tanggal -> { tanggal YYYY-MM-DD | null, teks asli | null, galat }
export function bacaTanggal(v: unknown): { tanggal: string | null; teks: string | null; galat: boolean } {
  if (v === '' || v == null) return { tanggal: null, teks: null, galat: false }
  if (typeof v === 'number') return { tanggal: dariSerial(v), teks: null, galat: false }
  if (v instanceof Date && !isNaN(v.getTime())) return { tanggal: `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`, teks: null, galat: false }
  const s = rapikanTeks(v); let m: RegExpMatchArray | null
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return { tanggal: `${m[1]}-${pad(m[2])}-${pad(m[3])}`, teks: null, galat: false }
  if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/))) return { tanggal: `${m[3]}-${pad(m[2])}-${pad(m[1])}`, teks: s, galat: false }
  if ((m = s.match(/^(\d{1,2})[-\s]([A-Za-z]+)[-\s](\d{4})$/)) && BULAN[m[2].slice(0, 3).toLowerCase()])
    return { tanggal: `${m[3]}-${pad(BULAN[m[2].slice(0, 3).toLowerCase()])}-${pad(m[1])}`, teks: s, galat: false }
  return { tanggal: null, teks: s, galat: true }
}

export function kodeLokasiDariTeks(teks: unknown, lokasi: LokasiImpor[]): string | null {
  const t = besar(teks)
  if (t in ALIAS_LOKASI) return ALIAS_LOKASI[t]
  const l = lokasi.find(x => besar(x.nama) === t || besar(x.kode) === t)
  return l ? l.kode : null
}

// rows = sheet_to_json(..., {header:1, defval:''}) ; kunciAwalan mis. "GA" -> kunci "GA:<nomor baris Excel>"
export function bacaBarisInventaris(rows: unknown[][], lokasi: LokasiImpor[], kunciAwalan: string): HasilBaca {
  const galat: string[] = [], catatan: string[] = []
  const h = rows.findIndex(r => (r || []).some(c => besar(c) === 'NAMA BARANG'))
  if (h < 0) return { baris: [], galat: ['Judul kolom "Nama Barang" tidak ditemukan - pakai format sheet DATABASE INVENTARIS'], catatan }
  const kol: Record<string, number> = {}
  rows[h].forEach((c, i) => { kol[besar(c)] = i })
  const K = (r: unknown[], nama: string) => kol[nama] === undefined ? '' : r[kol[nama]]
  const baris: BarisImpor[] = []
  rows.forEach((r, i) => {
    if (i <= h || !rapikanTeks(K(r || [], 'NAMA BARANG'))) return
    const excel = i + 1
    const lokTeks = rapikanTeks(K(r, 'LOKASI INVENTARIS')); const lok = kodeLokasiDariTeks(lokTeks, lokasi)
    if (!lok) galat.push(`Baris ${excel}: lokasi "${lokTeks}" tidak dikenal`)
    const konTeks = besar(K(r, 'KONDISI BARANG')); const kon = KONDISI_DARI_TEKS[konTeks]
    if (!kon) galat.push(`Baris ${excel}: kondisi "${konTeks}" tidak dikenal`)
    const tp = bacaTanggal(K(r, 'TANGGAL PEROLEHAN')); const tu = bacaTanggal(K(r, 'TANGGAL TERAKHIR UPDATE'))
    if (tp.galat) catatan.push(`Baris ${excel}: tanggal perolehan "${tp.teks}" tidak terbaca -> disimpan sebagai teks`)
    if (tu.galat) galat.push(`Baris ${excel}: tanggal terakhir update "${tu.teks}" tidak terbaca`)
    baris.push({
      kunci: `${kunciAwalan}:${excel}`, nama: rapikanTeks(K(r, 'NAMA BARANG')), lokasi_kode: lok || lokTeks,
      pengguna: rapikanTeks(K(r, 'PENGGUNA/PENANGGUNGJAWAB')) || null, kondisi: kon || konTeks,
      detail_kondisi: rapikanTeks(K(r, 'DETAIL KONDISI')) || null, merk_spesifikasi: rapikanTeks(K(r, 'MERK/SPESIFIKASI')) || null,
      nomor_seri: rapikanTeks(K(r, 'NOMOR SERI')) || null, tanggal_perolehan: tp.tanggal, tanggal_perolehan_teks: tp.teks,
      pelapor: rapikanTeks(K(r, 'PELAPOR')) || null, diperbarui_pada: tu.tanggal ? `${tu.tanggal}T00:00:00+07:00` : null,
      _baris: excel, _lokasiAsli: lokTeks, _kondisiAsli: rapikanTeks(K(r, 'KONDISI BARANG')), _namaAsli: String(K(r, 'NAMA BARANG')),
    })
  })
  return { baris, galat, catatan }
}

// Ringkasan pratinjau (jumlah, kosong, kembar) - dipakai tombol impor & skrip dry-run.
export function ringkasImpor(baris: BarisImpor[]) {
  const kembar = new Map<string, BarisImpor[]>()
  for (const b of baris) { const k = besar(b.nama) + '@' + b.lokasi_kode; kembar.set(k, [...(kembar.get(k) || []), b]) }
  return {
    jumlah: baris.length,
    lokasiKosong: baris.filter(b => b.lokasi_kode === 'BELUM'),
    kondisiKosong: baris.filter(b => !b._kondisiAsli),
    rusak: baris.filter(b => b.kondisi === 'rusak'),
    kembar: [...kembar.values()].filter(v => v.length > 1),
  }
}

// Baris siap kirim ke RPC (tanpa kolom bantu "_", tanpa null).
export const barisUntukRpc = (b: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(b).filter(([k, v]) => !k.startsWith('_') && v !== null && v !== undefined))
