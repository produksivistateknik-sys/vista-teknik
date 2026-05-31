// src/types/database.ts

export interface WorkOrder {
  id: number
  wo: string
  proyek: string
  target: string
  created_at?: string
  updated_at?: string
  updated_by?: string | null
}

export interface Panel {
  id: number
  wo_id: number | null
  no_pnl: number
  nama: string
  tipe: string
  qty: number
  checklist?: Record<string, unknown>
  catatan?: string
  created_at?: string
  updated_at?: string
  updated_by?: string | null
}

export interface RawSchedule {
  id: number
  wo_id: number | null
  panel_id: number | null
  proyek: string
  panel: string
  proses: string
  prioritas?: string
  schedule?: Record<string, unknown>
  created_at?: string
  updated_at?: string
  updated_by?: string | null
}

export interface Renhar {
  id: number
  raw_id: number | null
  wo_id: number | null
  panel_id: number | null
  proyek: string
  panel: string
  proses: string
  prioritas?: string
  wp: string
  komponen?: unknown[]
  tanggal: string
  divisi: string
  pekerja?: unknown[]
  carry_over?: boolean
  created_at?: string
  updated_at?: string
  updated_by?: string | null
}

export interface Pekerja {
  id: number
  nama: string
  divisi: string
  created_at?: string
  updated_by?: string | null
}

export interface Profile {
  id: string
  name: string
  divisi: string
  created_at?: string
}

export interface KendalaLog {
  id: number
  divisi: string
  proses: string
  tanggal: string
  catatan: string
  operator: string
  user_id?: string | null
  created_at?: string
}

export interface ActivityLog {
  id: number
  user_id?: string | null
  user_name?: string | null
  action: string
  table_name?: string | null
  record_id?: string | null
  old_data?: Record<string, unknown> | null
  new_data?: Record<string, unknown> | null
  created_at?: string
}

// Form types (untuk input, tanpa id & timestamps)
export type WorkOrderInsert = Omit<WorkOrder, 'id' | 'created_at' | 'updated_at'>
export type WorkOrderUpdate = Partial<WorkOrderInsert>

export type PanelInsert = Omit<Panel, 'id' | 'created_at' | 'updated_at'>
export type PanelUpdate = Partial<PanelInsert>

export type KendalaLogInsert = Omit<KendalaLog, 'id' | 'created_at'>
export type KendalaLogUpdate = Partial<KendalaLogInsert>

export type PekerjaInsert = Omit<Pekerja, 'id' | 'created_at'>
export type PekerjaUpdate = Partial<PekerjaInsert>