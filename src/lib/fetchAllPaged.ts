// Ambil SEMUA row lewat .range() per 1000 (batas default Supabase/PostgREST) - tanpa ini query
// diam-diam kepotong di 1000 row (CLAUDE.md A.1, insiden renhar). `build` WAJIB nerusin
// (from,to) ke .range() dan punya .order() yang deterministik (tambah .order("id") sebagai
// pemutus seri) biar gak ada row dobel/kelewat antar halaman. Error dilempar (throw), bukan
// ditelan - pemanggil wajib tangani (CLAUDE.md A.2).
//
// 18 Okt 2026 (audit K5 permintaan_item) - SATU-SATUNYA helper paginasi aplikasi admin: salinan lokal di
// ManajemenWO/PermintaanAdminTab/WoDigitalTab/useWoEngineeringBroadcast diganti import dari sini.
// - Server memotong SETIAP request di 1000 baris walau diminta .range(0,9999) (terbukti live 18 Okt).
// - Tanpa .order() server mengembalikan baris sesuai letak fisik -> halaman 2 dst bisa melompati/menggandakan.
//   Mode dev memberi peringatan kalau lupa.
// - Daftar id panjang utk .in() dipecah per 200 (fetchAllPagedPerPotongan) - URL tetap pendek.
// Cermin: vista-pekerja lib/bacaSemua.ts (bacaSemuaHalaman/bacaSemuaPerPotongan).
export const UKURAN_HALAMAN = 1000
export const UKURAN_POTONGAN_ID = 200

const sudahDiperingatkan = new Set<string>()
function peringatkanTanpaUrutan(q: any) {
  if (!import.meta.env?.DEV) return
  try {
    const url: URL | undefined = q?.url // klien Supabase; MemoryDb (sandbox) tidak punya url -> dilewati
    if (url instanceof URL && !url.searchParams.has('order') && !sudahDiperingatkan.has(url.pathname)) {
      sudahDiperingatkan.add(url.pathname)
      console.warn('[fetchAllPaged] query tanpa .order() - paginasi tidak stabil:', url.pathname)
    }
  } catch { /* peringatan dev saja */ }
}

export const fetchAllPaged = async (build: (from: number, to: number) => any): Promise<any[]> => {
  let all: any[] = []
  let from = 0
  while (true) {
    const q = build(from, from + UKURAN_HALAMAN - 1)
    if (from === 0) peringatkanTanpaUrutan(q)
    const { data, error } = await q
    if (error) throw error
    all = all.concat(data ?? [])
    if (!data || data.length < UKURAN_HALAMAN) break
    from += UKURAN_HALAMAN
  }
  return all
}

export function potongDaftar<T>(daftar: T[], ukuran = UKURAN_POTONGAN_ID): T[][] {
  const unik = [...new Set(daftar)]
  const hasil: T[][] = []
  for (let i = 0; i < unik.length; i += ukuran) hasil.push(unik.slice(i, i + ukuran))
  return hasil
}

// .in(kolom, ids) dgn daftar yang bisa panjang: dipecah per 200 id (duplikat dibuang), tiap potongan dibaca
// semua halamannya. `build(bagian, from, to)` tetap WAJIB .order(...).range(from, to).
export async function fetchAllPagedPerPotongan<T>(ids: T[], build: (bagian: T[], from: number, to: number) => any): Promise<any[]> {
  const hasil: any[] = []
  for (const bagian of potongDaftar(ids)) hasil.push(...await fetchAllPaged((from, to) => build(bagian, from, to)))
  return hasil
}
