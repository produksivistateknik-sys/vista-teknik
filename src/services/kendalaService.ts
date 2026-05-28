import { supabase } from '../lib/supabase'
export const kendalaService = {
  async getAll() {
    const { data, error } = await supabase
      .from('kendala')
      .select('*')
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
