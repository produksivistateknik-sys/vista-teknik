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
