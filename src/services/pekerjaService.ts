import { supabase } from '../lib/supabase'

export const pekerjaService = {
  async getAll() {
    const { data, error } = await supabase
      .from('pekerja')
      .select('*')
      .order('nama', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async create(payload: any) {
    const { data, error } = await supabase
      .from('pekerja')
      .insert(payload)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  async update(id: number, payload: any) {
    const { data, error } = await supabase
      .from('pekerja')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from('pekerja')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  },
}
