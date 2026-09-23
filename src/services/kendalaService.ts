import { supabase } from '../lib/supabase'
export const kendalaService = {
  async getAll() {
    // BUG FIX (23 Sep 2026, ditemukan lewat audit "deleted_at gak difilter") - useKendala.ts
    // remove() itu soft-delete (update deleted_at/deleted_by), TAPI query ini gak pernah filter
    // deleted_at - kelas bug SAMA PERSIS pekerja (7 Sep 2026)/Login.tsx vista-pekerja (23 Sep
    // 2026): realtime channel di useKendala.ts cuma dengarin event INSERT/DELETE (bukan UPDATE,
    // dan soft-delete itu UPDATE) jadi kendala yang sudah dihapus balik lagi begitu ada refetch
    // (reload halaman, buka tab baru, dst).
    const { data, error } = await supabase
      .from('kendala')
      .select('*')
      .is('deleted_at', null)
      .order('ts', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  },
  async create(payload: any) {
    const { data, error } = await supabase
      .from('kendala')
      .insert(payload)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },
  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from('kendala')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  },
}
