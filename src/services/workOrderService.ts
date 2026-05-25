import { supabase } from '../lib/supabase'
import type { WorkOrderInsert, WorkOrderUpdate } from '../types/database'

export const workOrderService = {

  async getAll() {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*, panels(*)')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async create(payload: WorkOrderInsert) {
    const { data, error } = await supabase
      .from('work_orders')
      .insert(payload)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  async update(id: number, payload: WorkOrderUpdate) {
    const { data, error } = await supabase
      .from('work_orders')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from('work_orders')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  },
}