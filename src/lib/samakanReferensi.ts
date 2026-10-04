// PERFORMA (4 Okt 2026, audit lambat Raw Schedule/Summary/Detail) - "structural sharing".
// Heartbeat 60 dtk + visibilitychange (App.tsx) me-refetch work_orders+panels, raw_schedule &
// renhar TOTAL - hasilnya selalu array/objek BARU walau isinya persis sama, jadi seluruh App +
// semua tab yang pernah dibuka ikut render ulang (diukur: beku +-7 dtk tiap menit).
//
// Fungsi ini mengembalikan nilai yang ISINYA SELALU IDENTIK dengan `baru` (deep-equal) - bedanya
// cuma: bagian yang isinya sama persis dengan `lama` memakai objek `lama` yang sudah ada. Kalau
// semuanya sama, `lama` itu sendiri yang dikembalikan, setState(prev=>...) lalu dilewati React
// (tanpa render). TIDAK ada data yang diubah/dibuang - aman dipakai di jalur dirty-tracking.
// Array berisi objek ber-`id` dicocokkan per id (urutan bisa bergeser), lainnya per indeks.
export function samakanReferensi<T>(lama: any, baru: T): T {
  if (Object.is(lama, baru)) return lama
  if (lama === null || baru === null || typeof lama !== 'object' || typeof baru !== 'object') return baru
  if (Array.isArray(lama) !== Array.isArray(baru)) return baru

  if (Array.isArray(baru)) {
    const pakaiId = baru.length > 0 && baru.every((x: any) => x !== null && typeof x === 'object' && !Array.isArray(x) && 'id' in x)
    let lamaById: Map<any, any> | null = null
    if (pakaiId) {
      lamaById = new Map()
      for (const x of lama as any[]) if (x !== null && typeof x === 'object' && 'id' in x) lamaById.set(x.id, x)
    }
    let sama = (lama as any[]).length === baru.length
    const hasil = baru.map((v: any, i: number) => {
      const pasangan = lamaById ? lamaById.get(v.id) : (lama as any[])[i]
      const r = pasangan === undefined ? v : samakanReferensi(pasangan, v)
      if (r !== (lama as any[])[i]) sama = false
      return r
    })
    return (sama ? lama : hasil) as T
  }

  const kunciBaru = Object.keys(baru as any)
  let sama = kunciBaru.length === Object.keys(lama).length
  const hasil: any = {}
  for (const k of kunciBaru) {
    const r = samakanReferensi(lama[k], (baru as any)[k])
    hasil[k] = r
    if (!(k in lama) || r !== lama[k]) sama = false
  }
  return (sama ? lama : hasil) as T
}
