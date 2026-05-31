import { supabase } from '../lib/supabase'
import { activityLogService } from './activityLogService'

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

    await activityLogService.create({
      action: 'CREATE RENHAR',
      aktivitas: `Distribusi operator proses ${safe.proses}`,
      jenis: 'rencana',
      halaman: 'Rencana Harian',
      wo_no: safe.wo_id ?? null,
      proyek: safe.proyek ?? null,
      panel: safe.panel ?? null,
      user_name: updated_by ?? 'Admin',
      admin_nama: updated_by ?? 'Admin',
    })

    return data
  },

  async update(id: number, payload: any) {
    const { updated_by, ...safe } = payload

    const { data, error } = await supabase
      .from('renhar')
      .update({
        ...safe,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)

    await activityLogService.create({
      action: 'UPDATE RENHAR',
      aktivitas: `Update distribusi operator proses ${data.proses}`,
      jenis: 'rencana',
      halaman: 'Rencana Harian',
      wo_no: data.wo_id ?? null,
      proyek: data.proyek ?? null,
      panel: data.panel ?? null,
      user_name: updated_by ?? 'Admin',
      admin_nama: updated_by ?? 'Admin',
    })

    return data
  },

  async remove(id: number): Promise<void> {
    const { data: oldData } = await supabase
      .from('renhar')
      .select('*')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('renhar')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)

    await activityLogService.create({
      action: 'DELETE RENHAR',
      aktivitas: `Hapus distribusi operator`,
      jenis: 'rencana',
      halaman: 'Rencana Harian',
      wo_no: oldData?.wo_id ?? null,
      proyek: oldData?.proyek ?? null,
      panel: oldData?.panel ?? null,
      user_name: 'Admin',
      admin_nama: 'Admin',
    })
  },
}