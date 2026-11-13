// SINKRON JADWAL SAAT QTY KOMPONEN BERUBAH (1 Okt 2026, diminta user) - fungsi MURNI (tanpa
// akses DB) biar dipakai bareng oleh service app (rawScheduleService.sinkronJadwalSetelahUbahQty)
// DAN script pembersihan data - satu sumber logika (CLAUDE.md B.1).
//
// Aturan "qty jadi 0 -> hilang dari jadwal":
// - Kode dihapus dari entri raw_schedule yang masih LIVE (bukan jejak digeserKe) di tanggal
//   >= tanggalMulai (hari ini). Tanggal lampau & jejak TIDAK disentuh (histori). Auto-geser juga
//   gak lagi bawa maju kode qty 0 (guard di Edge Function auto-geser-harian), jadi sisa di tanggal
//   lampau gak bakal "hidup lagi".
// - Entry yang gak punya kode asli lagi (cuma sisa token __wiring_) dibuang, pola sama Edge
//   Function. qtyPerKomponen/manualPin kode itu ikut dibersihkan.
// - Renhar di tanggal >= tanggalMulai: kode dilepas dari komponen/komponen_released/
//   pekerja_per_komponen (pola FASE 3.5 auto-geser) - row renhar-nya sendiri tetap ada.

export function hapusKodeDariScheduleMulai(schedule: any, kode: string, tanggalMulai: string): { schedule: any; tanggalTerhapus: string[] } {
  const hasil: any = { ...(schedule || {}) }
  const tanggalTerhapus: string[] = []
  Object.keys(hasil).forEach((tgl) => {
    if (tgl < tanggalMulai) return
    let berubah = false
    const entries = (hasil[tgl] || []).map((e: any) => {
      const komponen: string[] = e.komponen || []
      if (!komponen.includes(kode) || (e.digeserKe && e.digeserKe[kode])) return e
      berubah = true
      const baru: any = { ...e, komponen: komponen.filter((k) => k !== kode) }
      if (baru.qtyPerKomponen && kode in baru.qtyPerKomponen) { const { [kode]: _q, ...sisa } = baru.qtyPerKomponen; baru.qtyPerKomponen = sisa }
      if (baru.manualPin && kode in baru.manualPin) { const { [kode]: _p, ...sisa } = baru.manualPin; baru.manualPin = sisa }
      return baru
    })
    if (!berubah) return
    hasil[tgl] = entries.filter((e: any) => (e.komponen || []).some((k: string) => !k.startsWith('__wiring_')))
    tanggalTerhapus.push(tgl)
  })
  return { schedule: hasil, tanggalTerhapus }
}

export function hapusKodeDariRenhar(row: any, kode: string): { komponen: string[]; komponen_released: string[]; pekerja_per_komponen: any } | null {
  const komponen: string[] = row?.komponen || []
  const released: string[] = row?.komponen_released || []
  const ppk = row?.pekerja_per_komponen || {}
  if (!komponen.includes(kode) && !released.includes(kode) && !(kode in ppk)) return null
  const { [kode]: _x, ...ppkSisa } = ppk
  return { komponen: komponen.filter((k) => k !== kode), komponen_released: released.filter((k) => k !== kode), pekerja_per_komponen: ppkSisa }
}

// QTY NAIK -> SISA KE SEL YANG SUDAH ADA (13 Nov 2026, keputusan user; insiden panel #599 CAPACITOR BANK WO 097: panel
// ditambah dgn qty bawaan 1 -> template menulis porsi eksplisit 1 di Day ke-n; qty lalu dinaikkan -> sisa dijadwalkan
// sbg sel BARU mulai hari ini -> tiap komponen terpecah di 2 tanggal). Bila kode ini di satu proses BELUM dikerjakan
// (dicek pemanggil) dan semua sel aktifnya (>= tanggalMulai, bukan jejak) berporsi eksplisit, kekurangan porsi
// (qtyBaru - total porsi aktif) ditambahkan ke sel PALING AWAL - generator lalu melihat sisa 0 & tidak membuat sel baru.
// Satu sel saja & porsinya mencapai qtyBaru -> kunci porsi dihapus (= qty penuh). Ada sel tanpa porsi (penuh) atau tidak
// ada sel aktif -> tidak diubah (jalur lama). Fungsi MURNI, schedule masukan tidak dimutasi.
export type EntriSisa = { komponen?: string[]; digeserKe?: Record<string, string>; qtyPerKomponen?: Record<string, number>; [k: string]: unknown }
export type JadwalSisa = Record<string, EntriSisa[]>
export function tambahSisaKeSelAda(schedule: JadwalSisa | null | undefined, kode: string, qtyBaru: number, tanggalMulai: string): { schedule: JadwalSisa; tanggal: string | null; tambah: number } {
  const asli: JadwalSisa = schedule || {}
  const tetap = { schedule: asli, tanggal: null, tambah: 0 }
  if (!(qtyBaru > 0)) return tetap
  const sel: { t: string; i: number; porsi: number | undefined }[] = []
  for (const t of Object.keys(asli).filter((x) => x >= tanggalMulai).sort()) {
    ;(asli[t] || []).forEach((e, i) => {
      if ((e?.komponen || []).includes(kode) && !e?.digeserKe?.[kode]) sel.push({ t, i, porsi: e?.qtyPerKomponen?.[kode] })
    })
  }
  if (!sel.length || sel.some((x) => x.porsi == null)) return tetap
  const total = sel.reduce((a, x) => a + (Number(x.porsi) || 0), 0)
  const kurang = qtyBaru - total
  if (!(kurang > 0)) return tetap
  const target = sel[0]
  const baru: JadwalSisa = { ...asli, [target.t]: (asli[target.t] || []).map((e) => ({ ...e })) }
  const e = baru[target.t][target.i]
  const porsiBaru = (Number(target.porsi) || 0) + kurang
  const q: Record<string, number> = { ...(e.qtyPerKomponen || {}) }
  if (sel.length === 1 && porsiBaru >= qtyBaru) delete q[kode]; else q[kode] = porsiBaru
  if (Object.keys(q).length) e.qtyPerKomponen = q; else delete e.qtyPerKomponen
  return { schedule: baru, tanggal: target.t, tambah: kurang }
}
