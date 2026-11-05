// RINGKASAN HARI BUSBAR (6 Nov 2026, panel 524 OUTGOING): persen tiap baris = fcs_timer_kerja.progress. Sesi lama / klik persen
// otomatis sebelum perbaikan vista-pekerja tidak punya nilai itu. Baris TERAKHIR tiap tahap yang kosong memakai progres tahap
// terkini (checklist.busbarTahap), sebab itulah keadaan tahap tersebut. Baris lebih lama tetap kosong, tidak ditebak.
/* eslint-disable @typescript-eslint/no-explicit-any */
export function lengkapiPersenTerakhir<T extends { tahapKey: string; persen: number | null }>(baris: T[], busbarTahap: any): T[] {
  const terakhir = new Map(baris.map((b, i) => [b.tahapKey, i]))
  return baris.map((b, i) => {
    if (b.persen != null || terakhir.get(b.tahapKey) !== i) return b
    const kini = Number(busbarTahap?.[b.tahapKey]?.progress)
    return kini > 0 ? { ...b, persen: kini } : b
  })
}
