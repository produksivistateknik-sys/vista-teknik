// Ambil SEMUA row lewat .range() per 1000 (batas default Supabase/PostgREST) - tanpa ini query
// diam-diam kepotong di 1000 row (CLAUDE.md A.1, insiden renhar). `build` WAJIB nerusin
// (from,to) ke .range() dan punya .order() yang deterministik (tambah .order("id") sebagai
// pemutus seri) biar gak ada row dobel/kelewat antar halaman. Error dilempar (throw), bukan
// ditelan - pemanggil wajib tangani (CLAUDE.md A.2).
// Pola sama dengan fetchAllPaged lokal di PermintaanAdminTab/useWoEngineeringBroadcast.
export const fetchAllPaged = async (build: (from: number, to: number) => any): Promise<any[]> => {
  let all: any[] = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw error
    all = all.concat(data ?? [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}
