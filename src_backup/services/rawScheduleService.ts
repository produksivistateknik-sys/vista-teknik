import { supabase } from '../lib/supabase'

export const rawScheduleService = {
  async getAll() {
    const { data, error } = await supabase
      .from('raw_schedule')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async getByWoId(wo_id: number) {
    const { data, error } = await supabase
      .from('raw_schedule')
      .select('*')
      .eq('wo_id', wo_id)
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async create(payload: any) {
    const { data, error } = await supabase
      .from('raw_schedule')
      .insert(payload)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  async update(id: number, payload: any) {
    const { data, error } = await supabase
      .from('raw_schedule')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from('raw_schedule')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  },
}

