import { supabase } from '../lib/supabase'

export const adminService = {
  async login(username: string, password: string) {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .eq('is_active', true)
      .single()
    if (error) throw new Error('Username atau password salah')
    // update last_login
    await supabase.from('admins').update({ last_login: new Date().toISOString() }).eq('id', data.id)
    return data
  },
  async getAll() {
    const { data, error } = await supabase.from('admins').select('*').order('nama')
    if (error) throw new Error(error.message)
    return data ?? []
  },
}
