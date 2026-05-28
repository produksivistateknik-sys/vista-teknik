import { supabase } from '../lib/supabase'
export const renharService = {
  async getAll() {
    const { data, error } = await supabase
      .from('renhar')
      .select('*')
      .order('tanggal', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  },
  async getByTanggal(tanggal: string) {
    const { data, error } = await supabase
      .from('renhar')
      .select('*')
      .eq('tanggal', tanggal)
    if (error) throw new Error(error.message)
    return data ?? []
  },
  async create(payload: any) {
    const { updated_by, ...safe } = payload
    const { data, error } = await supabase
      .from('renhar')
      .insert(safe)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },
  async update(id: number, payload: any) {
    const { updated_by, ...safe } = payload
    const { data, error } = await supabase
      .from('renhar')
      .update({ ...safe, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },
  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from('renhar')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  },
}
