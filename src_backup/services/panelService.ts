import { supabase } from '../lib/supabase'

export const panelService = {
  async getByWoId(wo_id: number) {
    const { data, error } = await supabase
      .from('panels')
      .select('*')
      .eq('wo_id', wo_id)
      .order('no_pnl', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async create(payload: any) {
    const { data, error } = await supabase
      .from('panels')
      .insert(payload)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  async update(id: number, payload: any) {
    const { data, error } = await supabase
      .from('panels')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from('panels')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  },
}