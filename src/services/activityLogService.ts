import { supabase } from "../lib/supabase"

export interface ActivityPayload {
  user_name?: string
  admin_nama?: string
  action: string
  aktivitas: string
  jenis: string
  halaman: string
  wo_no?: string | null
  proyek?: string | null
  panel?: string | null
}

export const activityLogService = {
  async getAll() {
    const { data, error } = await supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error

    return data || []
  },

  async log(payload: ActivityPayload) {
    console.log("[ACTIVITY LOG PAYLOAD]", payload)
    const { error } = await supabase
      .from("activity_log")
      .insert({
        ...payload,
        created_at: new Date().toISOString(),
      })

    if (error) {
      console.error("Activity Log Error:", error)
      throw error
    }
  },

  async create(payload: ActivityPayload) {
    return this.log(payload)
  },
}

