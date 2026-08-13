export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          halaman: string | null
          id: number
          module: string | null
          panel: string | null
          proyek: string | null
          user_name: string | null
          wo_number: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          halaman?: string | null
          id?: number
          module?: string | null
          panel?: string | null
          proyek?: string | null
          user_name?: string | null
          wo_number?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          halaman?: string | null
          id?: number
          module?: string | null
          panel?: string | null
          proyek?: string | null
          user_name?: string | null
          wo_number?: string | null
        }
        Relationships: []
      }
      admins: {
        Row: {
          avatar: string | null
          created_at: string | null
          divisi: string | null
          id: number
          is_active: boolean | null
          last_login: string | null
          nama: string
          password: string
          username: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string | null
          divisi?: string | null
          id?: number
          is_active?: boolean | null
          last_login?: string | null
          nama: string
          password: string
          username: string
        }
        Update: {
          avatar?: string | null
          created_at?: string | null
          divisi?: string | null
          id?: number
          is_active?: boolean | null
          last_login?: string | null
          nama?: string
          password?: string
          username?: string
        }
        Relationships: []
      }
      app_documentation: {
        Row: {
          fungsi_singkat: string
          id: number
          isi_lengkap: string
          kategori: string
          nama_tab: string
          updated_at: string
        }
        Insert: {
          fungsi_singkat: string
          id?: never
          isi_lengkap?: string
          kategori: string
          nama_tab: string
          updated_at?: string
        }
        Update: {
          fungsi_singkat?: string
          id?: never
          isi_lengkap?: string
          kategori?: string
          nama_tab?: string
          updated_at?: string
        }
        Relationships: []
      }
      auto_geser_runs: {
        Row: {
          hari_sumber: string
          hari_target: string
          ran_at: string
        }
        Insert: {
          hari_sumber: string
          hari_target: string
          ran_at?: string
        }
        Update: {
          hari_sumber?: string
          hari_target?: string
          ran_at?: string
        }
        Relationships: []
      }
      bom_master: {
        Row: {
          created_at: string | null
          id: number
          kode_komponen: string
          nama_komponen: string
          tipe_panel: string
          updated_at: string | null
          urutan: number | null
          wp: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          kode_komponen: string
          nama_komponen: string
          tipe_panel: string
          updated_at?: string | null
          urutan?: number | null
          wp: string
        }
        Update: {
          created_at?: string | null
          id?: number
          kode_komponen?: string
          nama_komponen?: string
          tipe_panel?: string
          updated_at?: string | null
          urutan?: number | null
          wp?: string
        }
        Relationships: []
      }
      bom_proses_relevan: {
        Row: {
          created_at: string | null
          id: number
          jenis_pekerjaan: string
          kode_komponen: string
          tipe_panel: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          jenis_pekerjaan: string
          kode_komponen: string
          tipe_panel: string
        }
        Update: {
          created_at?: string | null
          id?: number
          jenis_pekerjaan?: string
          kode_komponen?: string
          tipe_panel?: string
        }
        Relationships: []
      }
      fcs_arsip_wo: {
        Row: {
          catatan_kendala: Json | null
          diarsipkan_oleh: string | null
          diarsipkan_pada: string | null
          id: number
          proyek: string | null
          rincian_panel: Json | null
          ringkasan_operator: Json | null
          selisih_hari: number | null
          snapshot_raw_schedule: Json | null
          snapshot_renhar: Json | null
          status_ketepatan: string | null
          tanggal_selesai_aktual: string | null
          target_selesai: string | null
          total_jam_kerja: number | null
          total_komponen: number | null
          total_panel: number | null
          wo_id: number
          wo_number: string
        }
        Insert: {
          catatan_kendala?: Json | null
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          id?: number
          proyek?: string | null
          rincian_panel?: Json | null
          ringkasan_operator?: Json | null
          selisih_hari?: number | null
          snapshot_raw_schedule?: Json | null
          snapshot_renhar?: Json | null
          status_ketepatan?: string | null
          tanggal_selesai_aktual?: string | null
          target_selesai?: string | null
          total_jam_kerja?: number | null
          total_komponen?: number | null
          total_panel?: number | null
          wo_id: number
          wo_number: string
        }
        Update: {
          catatan_kendala?: Json | null
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          id?: number
          proyek?: string | null
          rincian_panel?: Json | null
          ringkasan_operator?: Json | null
          selisih_hari?: number | null
          snapshot_raw_schedule?: Json | null
          snapshot_renhar?: Json | null
          status_ketepatan?: string | null
          tanggal_selesai_aktual?: string | null
          target_selesai?: string | null
          total_jam_kerja?: number | null
          total_komponen?: number | null
          total_panel?: number | null
          wo_id?: number
          wo_number?: string
        }
        Relationships: []
      }
      fcs_forum_attachment: {
        Row: {
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: number
          post_id: number
          uploaded_at: string | null
        }
        Insert: {
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: number
          post_id: number
          uploaded_at?: string | null
        }
        Update: {
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: number
          post_id?: number
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fcs_forum_attachment_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "fcs_forum_post"
            referencedColumns: ["id"]
          },
        ]
      }
      fcs_forum_post: {
        Row: {
          author_name: string
          caption: string | null
          created_at: string | null
          id: number
        }
        Insert: {
          author_name: string
          caption?: string | null
          created_at?: string | null
          id?: number
        }
        Update: {
          author_name?: string
          caption?: string | null
          created_at?: string | null
          id?: number
        }
        Relationships: []
      }
      fcs_kapasitas_override: {
        Row: {
          created_at: string | null
          created_by: string | null
          efektivitas_pct: number
          id: number
          jam_kerja: number | null
          jenis_pekerjaan: string
          jumlah_orang: number | null
          kapasitas_menit: number | null
          kapasitas_unit: number | null
          keterangan: string | null
          tanggal: string
          tipe_kapasitas: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          efektivitas_pct?: number
          id?: number
          jam_kerja?: number | null
          jenis_pekerjaan: string
          jumlah_orang?: number | null
          kapasitas_menit?: number | null
          kapasitas_unit?: number | null
          keterangan?: string | null
          tanggal: string
          tipe_kapasitas?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          efektivitas_pct?: number
          id?: number
          jam_kerja?: number | null
          jenis_pekerjaan?: string
          jumlah_orang?: number | null
          kapasitas_menit?: number | null
          kapasitas_unit?: number | null
          keterangan?: string | null
          tanggal?: string
          tipe_kapasitas?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fcs_kapasitas_pekerjaan: {
        Row: {
          created_at: string | null
          hari_kerja: number[]
          id: number
          is_active: boolean
          jenis_pekerjaan: string
          kapasitas_menit_hari: number
          keterangan: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hari_kerja?: number[]
          id?: number
          is_active?: boolean
          jenis_pekerjaan: string
          kapasitas_menit_hari?: number
          keterangan?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hari_kerja?: number[]
          id?: number
          is_active?: boolean
          jenis_pekerjaan?: string
          kapasitas_menit_hari?: number
          keterangan?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fcs_notifikasi: {
        Row: {
          catatan: string | null
          created_at: string | null
          dibaca: boolean | null
          id: number
          kode_komponen: string
          nama_komponen: string | null
          panel_id: number
          panel_nama: string | null
          pekerja_id: number | null
          pekerja_nama: string | null
          proses: string
          tanggal_aktual_selesai: string | null
          tanggal_rencana_selesai: string | null
          timer_id: number | null
          tipe: string
        }
        Insert: {
          catatan?: string | null
          created_at?: string | null
          dibaca?: boolean | null
          id?: number
          kode_komponen: string
          nama_komponen?: string | null
          panel_id: number
          panel_nama?: string | null
          pekerja_id?: number | null
          pekerja_nama?: string | null
          proses: string
          tanggal_aktual_selesai?: string | null
          tanggal_rencana_selesai?: string | null
          timer_id?: number | null
          tipe?: string
        }
        Update: {
          catatan?: string | null
          created_at?: string | null
          dibaca?: boolean | null
          id?: number
          kode_komponen?: string
          nama_komponen?: string | null
          panel_id?: number
          panel_nama?: string | null
          pekerja_id?: number | null
          pekerja_nama?: string | null
          proses?: string
          tanggal_aktual_selesai?: string | null
          tanggal_rencana_selesai?: string | null
          timer_id?: number | null
          tipe?: string
        }
        Relationships: [
          {
            foreignKeyName: "fcs_notifikasi_pekerja_id_fkey"
            columns: ["pekerja_id"]
            isOneToOne: false
            referencedRelation: "pekerja"
            referencedColumns: ["id"]
          },
        ]
      }
      fcs_process_time: {
        Row: {
          created_at: string | null
          id: number
          is_active: boolean
          jenis_pekerjaan: string
          keterangan: string | null
          kode_komponen: string
          menit_per_pcs: number
          nama_komponen: string
          tipe_panel: string
          updated_at: string | null
          wp: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          is_active?: boolean
          jenis_pekerjaan: string
          keterangan?: string | null
          kode_komponen: string
          menit_per_pcs?: number
          nama_komponen: string
          tipe_panel: string
          updated_at?: string | null
          wp: string
        }
        Update: {
          created_at?: string | null
          id?: number
          is_active?: boolean
          jenis_pekerjaan?: string
          keterangan?: string | null
          kode_komponen?: string
          menit_per_pcs?: number
          nama_komponen?: string
          tipe_panel?: string
          updated_at?: string | null
          wp?: string
        }
        Relationships: []
      }
      fcs_schedule: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          catatan: string | null
          created_at: string | null
          generated_by: string | null
          id: number
          jenis_pekerjaan: string
          kode_komponen: string
          menit_per_pcs: number
          nama_komponen: string
          panel_id: number
          panel_nama: string
          proyek: string
          qty_hari: number
          qty_total: number
          status: string
          tanggal: string
          tipe_panel: string
          total_menit: number
          updated_at: string | null
          urutan: number
          wo_id: number
          wo_number: string
          wp: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          catatan?: string | null
          created_at?: string | null
          generated_by?: string | null
          id?: number
          jenis_pekerjaan: string
          kode_komponen: string
          menit_per_pcs?: number
          nama_komponen: string
          panel_id: number
          panel_nama: string
          proyek: string
          qty_hari?: number
          qty_total?: number
          status?: string
          tanggal: string
          tipe_panel: string
          total_menit?: number
          updated_at?: string | null
          urutan?: number
          wo_id: number
          wo_number: string
          wp: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          catatan?: string | null
          created_at?: string | null
          generated_by?: string | null
          id?: number
          jenis_pekerjaan?: string
          kode_komponen?: string
          menit_per_pcs?: number
          nama_komponen?: string
          panel_id?: number
          panel_nama?: string
          proyek?: string
          qty_hari?: number
          qty_total?: number
          status?: string
          tanggal?: string
          tipe_panel?: string
          total_menit?: number
          updated_at?: string | null
          urutan?: number
          wo_id?: number
          wo_number?: string
          wp?: string
        }
        Relationships: []
      }
      fcs_schedule_archived: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          catatan: string | null
          created_at: string | null
          diarsipkan_oleh: string | null
          diarsipkan_pada: string | null
          generated_by: string | null
          id: number
          jenis_pekerjaan: string
          kode_komponen: string
          menit_per_pcs: number
          nama_komponen: string
          panel_id: number
          panel_nama: string
          proyek: string
          qty_hari: number
          qty_total: number
          status: string
          tanggal: string
          tipe_panel: string
          total_menit: number
          updated_at: string | null
          urutan: number
          wo_id: number
          wo_number: string
          wp: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          catatan?: string | null
          created_at?: string | null
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          generated_by?: string | null
          id?: number
          jenis_pekerjaan: string
          kode_komponen: string
          menit_per_pcs?: number
          nama_komponen: string
          panel_id: number
          panel_nama: string
          proyek: string
          qty_hari?: number
          qty_total?: number
          status?: string
          tanggal: string
          tipe_panel: string
          total_menit?: number
          updated_at?: string | null
          urutan?: number
          wo_id: number
          wo_number: string
          wp: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          catatan?: string | null
          created_at?: string | null
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          generated_by?: string | null
          id?: number
          jenis_pekerjaan?: string
          kode_komponen?: string
          menit_per_pcs?: number
          nama_komponen?: string
          panel_id?: number
          panel_nama?: string
          proyek?: string
          qty_hari?: number
          qty_total?: number
          status?: string
          tanggal?: string
          tipe_panel?: string
          total_menit?: number
          updated_at?: string | null
          urutan?: number
          wo_id?: number
          wo_number?: string
          wp?: string
        }
        Relationships: []
      }
      fcs_sub_bagian_password: {
        Row: {
          divisi_induk: string | null
          id: number
          password: string
          proses_list: string[] | null
          sub_bagian: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          divisi_induk?: string | null
          id?: number
          password: string
          proses_list?: string[] | null
          sub_bagian: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          divisi_induk?: string | null
          id?: number
          password?: string
          proses_list?: string[] | null
          sub_bagian?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      fcs_timer_kerja: {
        Row: {
          created_at: string | null
          durasi_menit: number | null
          id: number
          kode_komponen: string
          mulai: string
          panel_id: number
          pekerja_id: number
          proses: string
          selesai: string | null
          tahap: string | null
          tanggal: string
        }
        Insert: {
          created_at?: string | null
          durasi_menit?: number | null
          id?: number
          kode_komponen: string
          mulai: string
          panel_id: number
          pekerja_id: number
          proses: string
          selesai?: string | null
          tahap?: string | null
          tanggal: string
        }
        Update: {
          created_at?: string | null
          durasi_menit?: number | null
          id?: number
          kode_komponen?: string
          mulai?: string
          panel_id?: number
          pekerja_id?: number
          proses?: string
          selesai?: string | null
          tahap?: string | null
          tanggal?: string
        }
        Relationships: [
          {
            foreignKeyName: "fcs_timer_kerja_pekerja_id_fkey"
            columns: ["pekerja_id"]
            isOneToOne: false
            referencedRelation: "pekerja"
            referencedColumns: ["id"]
          },
        ]
      }
      fcs_timer_kerja_archived: {
        Row: {
          created_at: string | null
          diarsipkan_oleh: string | null
          diarsipkan_pada: string | null
          durasi_menit: number | null
          id: number
          kode_komponen: string
          mulai: string
          panel_id: number
          pekerja_id: number
          proses: string
          selesai: string | null
          tahap: string | null
          tanggal: string
        }
        Insert: {
          created_at?: string | null
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          durasi_menit?: number | null
          id?: number
          kode_komponen: string
          mulai: string
          panel_id: number
          pekerja_id: number
          proses: string
          selesai?: string | null
          tahap?: string | null
          tanggal: string
        }
        Update: {
          created_at?: string | null
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          durasi_menit?: number | null
          id?: number
          kode_komponen?: string
          mulai?: string
          panel_id?: number
          pekerja_id?: number
          proses?: string
          selesai?: string | null
          tahap?: string | null
          tanggal?: string
        }
        Relationships: []
      }
      fcs_tracking_komponen: {
        Row: {
          catatan: string | null
          created_at: string | null
          id: number
          operator_name: string
          panel_id: number | null
          sub_bagian: string
          wo_id: number
        }
        Insert: {
          catatan?: string | null
          created_at?: string | null
          id?: number
          operator_name: string
          panel_id?: number | null
          sub_bagian: string
          wo_id: number
        }
        Update: {
          catatan?: string | null
          created_at?: string | null
          id?: number
          operator_name?: string
          panel_id?: number | null
          sub_bagian?: string
          wo_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fcs_tracking_komponen_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fcs_tracking_komponen_wo_id_fkey"
            columns: ["wo_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      fcs_tracking_komponen_archived: {
        Row: {
          catatan: string | null
          created_at: string | null
          diarsipkan_oleh: string | null
          diarsipkan_pada: string | null
          id: number
          operator_name: string
          panel_id: number | null
          sub_bagian: string
          wo_id: number
        }
        Insert: {
          catatan?: string | null
          created_at?: string | null
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          id?: number
          operator_name: string
          panel_id?: number | null
          sub_bagian: string
          wo_id: number
        }
        Update: {
          catatan?: string | null
          created_at?: string | null
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          id?: number
          operator_name?: string
          panel_id?: number | null
          sub_bagian?: string
          wo_id?: number
        }
        Relationships: []
      }
      fcs_tracking_komponen_foto: {
        Row: {
          file_url: string
          id: number
          tracking_id: number
          uploaded_at: string | null
        }
        Insert: {
          file_url: string
          id?: number
          tracking_id: number
          uploaded_at?: string | null
        }
        Update: {
          file_url?: string
          id?: number
          tracking_id?: number
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fcs_tracking_komponen_foto_tracking_id_fkey"
            columns: ["tracking_id"]
            isOneToOne: false
            referencedRelation: "fcs_tracking_komponen"
            referencedColumns: ["id"]
          },
        ]
      }
      fcs_tracking_komponen_foto_archived: {
        Row: {
          diarsipkan_oleh: string | null
          diarsipkan_pada: string | null
          file_url: string
          id: number
          tracking_id: number
          uploaded_at: string | null
        }
        Insert: {
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          file_url: string
          id?: number
          tracking_id: number
          uploaded_at?: string | null
        }
        Update: {
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          file_url?: string
          id?: number
          tracking_id?: number
          uploaded_at?: string | null
        }
        Relationships: []
      }
      kendala: {
        Row: {
          catatan: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          divisi: string
          divisi_label: string | null
          id: number
          operator: string | null
          panel: string | null
          panel_id: number | null
          proses: string
          proyek: string | null
          tanggal: string
          ts: string | null
        }
        Insert: {
          catatan: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          divisi: string
          divisi_label?: string | null
          id?: number
          operator?: string | null
          panel?: string | null
          panel_id?: number | null
          proses: string
          proyek?: string | null
          tanggal: string
          ts?: string | null
        }
        Update: {
          catatan?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          divisi?: string
          divisi_label?: string | null
          id?: number
          operator?: string | null
          panel?: string | null
          panel_id?: number | null
          proses?: string
          proyek?: string | null
          tanggal?: string
          ts?: string | null
        }
        Relationships: []
      }
      kendala_archived: {
        Row: {
          catatan: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          diarsipkan_oleh: string | null
          diarsipkan_pada: string | null
          divisi: string
          divisi_label: string | null
          id: number
          operator: string | null
          panel: string | null
          panel_id: number | null
          proses: string
          proyek: string | null
          tanggal: string
          ts: string | null
        }
        Insert: {
          catatan: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          divisi: string
          divisi_label?: string | null
          id?: number
          operator?: string | null
          panel?: string | null
          panel_id?: number | null
          proses: string
          proyek?: string | null
          tanggal: string
          ts?: string | null
        }
        Update: {
          catatan?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          divisi?: string
          divisi_label?: string | null
          id?: number
          operator?: string | null
          panel?: string | null
          panel_id?: number | null
          proses?: string
          proyek?: string | null
          tanggal?: string
          ts?: string | null
        }
        Relationships: []
      }
      kendala_log: {
        Row: {
          catatan: string
          created_at: string | null
          divisi: string
          id: number
          operator: string
          proses: string
          tanggal: string
          user_id: string | null
        }
        Insert: {
          catatan: string
          created_at?: string | null
          divisi: string
          id?: never
          operator: string
          proses: string
          tanggal: string
          user_id?: string | null
        }
        Update: {
          catatan?: string
          created_at?: string | null
          divisi?: string
          id?: never
          operator?: string
          proses?: string
          tanggal?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kendala_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      komponen_bbmb_master: {
        Row: {
          created_at: string
          id: number
          nama: string
          satuan: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          nama: string
          satuan?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          nama?: string
          satuan?: string | null
        }
        Relationships: []
      }
      komponen_stok: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: number
          kode: string | null
          nama: string
          stok: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          kode?: string | null
          nama: string
          stok?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          kode?: string | null
          nama?: string
          stok?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      komponen_stok_masuk: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: number
          jumlah: number
          keterangan: string | null
          komponen_id: number | null
          nama: string
          tanggal: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          jumlah: number
          keterangan?: string | null
          komponen_id?: number | null
          nama: string
          tanggal: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          jumlah?: number
          keterangan?: string | null
          komponen_id?: number | null
          nama?: string
          tanggal?: string
        }
        Relationships: [
          {
            foreignKeyName: "komponen_stok_masuk_komponen_id_fkey"
            columns: ["komponen_id"]
            isOneToOne: false
            referencedRelation: "komponen_stok"
            referencedColumns: ["id"]
          },
        ]
      }
      komponen_tambahan: {
        Row: {
          created_at: string
          id: number
          nama_komponen: string
          operator_nama: string | null
          panel_id: number | null
          panel_nama: string | null
          pekerja_id: number | null
          proses: string
          proyek: string | null
          qty: number
          shift: string
          status: string
          tanggal: string | null
          waktu_mulai: string | null
          waktu_selesai: string | null
          wo: string | null
          wo_id: number | null
        }
        Insert: {
          created_at?: string
          id?: never
          nama_komponen: string
          operator_nama?: string | null
          panel_id?: number | null
          panel_nama?: string | null
          pekerja_id?: number | null
          proses?: string
          proyek?: string | null
          qty?: number
          shift?: string
          status?: string
          tanggal?: string | null
          waktu_mulai?: string | null
          waktu_selesai?: string | null
          wo?: string | null
          wo_id?: number | null
        }
        Update: {
          created_at?: string
          id?: never
          nama_komponen?: string
          operator_nama?: string | null
          panel_id?: number | null
          panel_nama?: string | null
          pekerja_id?: number | null
          proses?: string
          proyek?: string | null
          qty?: number
          shift?: string
          status?: string
          tanggal?: string | null
          waktu_mulai?: string | null
          waktu_selesai?: string | null
          wo?: string | null
          wo_id?: number | null
        }
        Relationships: []
      }
      machines: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          divisi: string | null
          id: number
          interval_service: string | null
          last_service_date: string | null
          nama_mesin: string
          status_terakhir: string | null
          tipe_mesin: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          divisi?: string | null
          id?: number
          interval_service?: string | null
          last_service_date?: string | null
          nama_mesin: string
          status_terakhir?: string | null
          tipe_mesin?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          divisi?: string | null
          id?: number
          interval_service?: string | null
          last_service_date?: string | null
          nama_mesin?: string
          status_terakhir?: string | null
          tipe_mesin?: string | null
        }
        Relationships: []
      }
      maintenance_log: {
        Row: {
          catatan: string | null
          created_at: string | null
          foto: Json
          id: number
          judul: string | null
          kendala: string | null
          mesin_id: number | null
          perbaikan: string | null
          status: string | null
          teknisi: string | null
          tgl_kendala: string | null
          tgl_perbaikan: string | null
          update_harian: Json
        }
        Insert: {
          catatan?: string | null
          created_at?: string | null
          foto?: Json
          id?: number
          judul?: string | null
          kendala?: string | null
          mesin_id?: number | null
          perbaikan?: string | null
          status?: string | null
          teknisi?: string | null
          tgl_kendala?: string | null
          tgl_perbaikan?: string | null
          update_harian?: Json
        }
        Update: {
          catatan?: string | null
          created_at?: string | null
          foto?: Json
          id?: number
          judul?: string | null
          kendala?: string | null
          mesin_id?: number | null
          perbaikan?: string | null
          status?: string | null
          teknisi?: string | null
          tgl_kendala?: string | null
          tgl_perbaikan?: string | null
          update_harian?: Json
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_log_mesin_id_fkey"
            columns: ["mesin_id"]
            isOneToOne: false
            referencedRelation: "mesin"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_logs: {
        Row: {
          created_at: string | null
          created_by: string | null
          downtime_hours: number | null
          finish_date: string | null
          id: number
          issue_title: string
          issue_type: string | null
          machine_id: number | null
          priority: string | null
          problem_description: string | null
          repair_action: string | null
          start_date: string | null
          status: string | null
          technician: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          downtime_hours?: number | null
          finish_date?: string | null
          id?: number
          issue_title: string
          issue_type?: string | null
          machine_id?: number | null
          priority?: string | null
          problem_description?: string | null
          repair_action?: string | null
          start_date?: string | null
          status?: string | null
          technician?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          downtime_hours?: number | null
          finish_date?: string | null
          id?: number
          issue_title?: string
          issue_type?: string | null
          machine_id?: number | null
          priority?: string | null
          problem_description?: string | null
          repair_action?: string | null
          start_date?: string | null
          status?: string | null
          technician?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_reminder_log: {
        Row: {
          id: number
          jatuh_tempo_saat_kirim: string
          jumlah_penerima: number
          rutin_id: number
          sent_at: string
          tanggal_kirim: string
        }
        Insert: {
          id?: never
          jatuh_tempo_saat_kirim: string
          jumlah_penerima?: number
          rutin_id: number
          sent_at?: string
          tanggal_kirim: string
        }
        Update: {
          id?: never
          jatuh_tempo_saat_kirim?: string
          jumlah_penerima?: number
          rutin_id?: number
          sent_at?: string
          tanggal_kirim?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_reminder_log_rutin_id_fkey"
            columns: ["rutin_id"]
            isOneToOne: false
            referencedRelation: "maintenance_rutin"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_rutin: {
        Row: {
          catatan: string | null
          created_at: string | null
          frekuensi: string
          id: number
          is_active: boolean | null
          jatuh_tempo: string | null
          jenis_maintenance: string
          mesin_id: number | null
          teknisi: string | null
          terakhir_dilakukan: string | null
        }
        Insert: {
          catatan?: string | null
          created_at?: string | null
          frekuensi: string
          id?: never
          is_active?: boolean | null
          jatuh_tempo?: string | null
          jenis_maintenance: string
          mesin_id?: number | null
          teknisi?: string | null
          terakhir_dilakukan?: string | null
        }
        Update: {
          catatan?: string | null
          created_at?: string | null
          frekuensi?: string
          id?: never
          is_active?: boolean | null
          jatuh_tempo?: string | null
          jenis_maintenance?: string
          mesin_id?: number | null
          teknisi?: string | null
          terakhir_dilakukan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_rutin_mesin_id_fkey"
            columns: ["mesin_id"]
            isOneToOne: false
            referencedRelation: "mesin"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_rutin_log: {
        Row: {
          catatan: string | null
          completed_via: string
          created_at: string | null
          dilakukan_pada: string
          id: number
          rutin_id: number | null
          teknisi: string | null
        }
        Insert: {
          catatan?: string | null
          completed_via?: string
          created_at?: string | null
          dilakukan_pada: string
          id?: never
          rutin_id?: number | null
          teknisi?: string | null
        }
        Update: {
          catatan?: string | null
          completed_via?: string
          created_at?: string | null
          dilakukan_pada?: string
          id?: never
          rutin_id?: number | null
          teknisi?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_rutin_log_rutin_id_fkey"
            columns: ["rutin_id"]
            isOneToOne: false
            referencedRelation: "maintenance_rutin"
            referencedColumns: ["id"]
          },
        ]
      }
      mesin: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          divisi: string | null
          id: number
          kode: string | null
          lokasi: string | null
          nama: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          divisi?: string | null
          id?: number
          kode?: string | null
          lokasi?: string | null
          nama: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          divisi?: string | null
          id?: number
          kode?: string | null
          lokasi?: string | null
          nama?: string
          status?: string | null
        }
        Relationships: []
      }
      operator_users: {
        Row: {
          created_at: string | null
          divisi: string
          id: number
          is_active: boolean | null
          last_login: string | null
          nama: string
          password: string
          username: string
        }
        Insert: {
          created_at?: string | null
          divisi: string
          id?: never
          is_active?: boolean | null
          last_login?: string | null
          nama: string
          password?: string
          username: string
        }
        Update: {
          created_at?: string | null
          divisi?: string
          id?: never
          is_active?: boolean | null
          last_login?: string | null
          nama?: string
          password?: string
          username?: string
        }
        Relationships: []
      }
      panel_seksi_archived: {
        Row: {
          data: Json
          diarsipkan_oleh: string | null
          diarsipkan_pada: string
          id: number
          kode: string
          komponen_nama: string | null
          panel_id: number
          panel_nama: string | null
          panel_tipe: string | null
          proyek_snapshot: string | null
          seksi: string
          wo_id: number | null
          wo_number_snapshot: string | null
        }
        Insert: {
          data: Json
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string
          id?: number
          kode?: string
          komponen_nama?: string | null
          panel_id: number
          panel_nama?: string | null
          panel_tipe?: string | null
          proyek_snapshot?: string | null
          seksi: string
          wo_id?: number | null
          wo_number_snapshot?: string | null
        }
        Update: {
          data?: Json
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string
          id?: number
          kode?: string
          komponen_nama?: string | null
          panel_id?: number
          panel_nama?: string | null
          panel_tipe?: string | null
          proyek_snapshot?: string | null
          seksi?: string
          wo_id?: number | null
          wo_number_snapshot?: string | null
        }
        Relationships: []
      }
      panel_type_meta: {
        Row: {
          created_at: string | null
          id: number
          label: string
          tipe_panel: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          label: string
          tipe_panel: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          label?: string
          tipe_panel?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      panel_wp_meta: {
        Row: {
          color: string
          created_at: string | null
          id: number
          range_label: string | null
          tipe_panel: string
          urutan: number | null
          wp: string
        }
        Insert: {
          color: string
          created_at?: string | null
          id?: number
          range_label?: string | null
          tipe_panel: string
          urutan?: number | null
          wp: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: number
          range_label?: string | null
          tipe_panel?: string
          urutan?: number | null
          wp?: string
        }
        Relationships: []
      }
      panels: {
        Row: {
          busbar_progress: Json | null
          catatan: string | null
          checklist: Json | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: number
          komponen_status: Json | null
          nama: string
          nameplate_history: Json | null
          nameplate_photos: Json
          nameplate_progress: number | null
          nameplate_updated_at: string | null
          nameplate_updated_by: string | null
          no_pnl: number
          packing_done: boolean | null
          packing_done_at: string | null
          packing_done_by: string | null
          pasang_komponen_photos: Json
          qc_checklist: Json | null
          qc_foto: Json | null
          qs_history: Json
          qs_photos: Json
          qs_progress: number
          qs_updated_at: string | null
          qs_updated_by: string | null
          qty: number
          synced_proses: string[] | null
          tingkat_kesulitan: string | null
          tipe: string
          updated_at: string | null
          updated_by: string | null
          warehouse_history: Json
          warehouse_photos: Json
          warehouse_progress: number
          warehouse_updated_at: string | null
          warehouse_updated_by: string | null
          wo_id: number | null
          yellowmark_history: Json | null
          yellowmark_photos: Json
          yellowmark_progress: number | null
          yellowmark_updated_at: string | null
          yellowmark_updated_by: string | null
        }
        Insert: {
          busbar_progress?: Json | null
          catatan?: string | null
          checklist?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: never
          komponen_status?: Json | null
          nama: string
          nameplate_history?: Json | null
          nameplate_photos?: Json
          nameplate_progress?: number | null
          nameplate_updated_at?: string | null
          nameplate_updated_by?: string | null
          no_pnl: number
          packing_done?: boolean | null
          packing_done_at?: string | null
          packing_done_by?: string | null
          pasang_komponen_photos?: Json
          qc_checklist?: Json | null
          qc_foto?: Json | null
          qs_history?: Json
          qs_photos?: Json
          qs_progress?: number
          qs_updated_at?: string | null
          qs_updated_by?: string | null
          qty?: number
          synced_proses?: string[] | null
          tingkat_kesulitan?: string | null
          tipe: string
          updated_at?: string | null
          updated_by?: string | null
          warehouse_history?: Json
          warehouse_photos?: Json
          warehouse_progress?: number
          warehouse_updated_at?: string | null
          warehouse_updated_by?: string | null
          wo_id?: number | null
          yellowmark_history?: Json | null
          yellowmark_photos?: Json
          yellowmark_progress?: number | null
          yellowmark_updated_at?: string | null
          yellowmark_updated_by?: string | null
        }
        Update: {
          busbar_progress?: Json | null
          catatan?: string | null
          checklist?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: never
          komponen_status?: Json | null
          nama?: string
          nameplate_history?: Json | null
          nameplate_photos?: Json
          nameplate_progress?: number | null
          nameplate_updated_at?: string | null
          nameplate_updated_by?: string | null
          no_pnl?: number
          packing_done?: boolean | null
          packing_done_at?: string | null
          packing_done_by?: string | null
          pasang_komponen_photos?: Json
          qc_checklist?: Json | null
          qc_foto?: Json | null
          qs_history?: Json
          qs_photos?: Json
          qs_progress?: number
          qs_updated_at?: string | null
          qs_updated_by?: string | null
          qty?: number
          synced_proses?: string[] | null
          tingkat_kesulitan?: string | null
          tipe?: string
          updated_at?: string | null
          updated_by?: string | null
          warehouse_history?: Json
          warehouse_photos?: Json
          warehouse_progress?: number
          warehouse_updated_at?: string | null
          warehouse_updated_by?: string | null
          wo_id?: number | null
          yellowmark_history?: Json | null
          yellowmark_photos?: Json
          yellowmark_progress?: number | null
          yellowmark_updated_at?: string | null
          yellowmark_updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "panels_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panels_wo_id_fkey"
            columns: ["wo_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      panels_archived: {
        Row: {
          busbar_progress: Json | null
          catatan: string | null
          checklist: Json | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          diarsipkan_oleh: string | null
          diarsipkan_pada: string | null
          id: number
          komponen_status: Json | null
          nama: string
          nameplate_history: Json | null
          nameplate_photos: Json
          nameplate_progress: number | null
          nameplate_updated_at: string | null
          nameplate_updated_by: string | null
          no_pnl: number
          packing_done: boolean | null
          packing_done_at: string | null
          packing_done_by: string | null
          pasang_komponen_photos: Json
          progress_snapshot: number | null
          proyek_snapshot: string | null
          qc_checklist: Json | null
          qc_foto: Json | null
          qs_history: Json
          qs_photos: Json
          qs_progress: number
          qs_updated_at: string | null
          qs_updated_by: string | null
          qty: number
          synced_proses: string[] | null
          tingkat_kesulitan: string | null
          tipe: string
          updated_at: string | null
          updated_by: string | null
          warehouse_history: Json
          warehouse_photos: Json
          warehouse_progress: number
          warehouse_updated_at: string | null
          warehouse_updated_by: string | null
          wo_id: number | null
          wo_number_snapshot: string | null
          yellowmark_history: Json | null
          yellowmark_photos: Json
          yellowmark_progress: number | null
          yellowmark_updated_at: string | null
          yellowmark_updated_by: string | null
        }
        Insert: {
          busbar_progress?: Json | null
          catatan?: string | null
          checklist?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          id: number
          komponen_status?: Json | null
          nama: string
          nameplate_history?: Json | null
          nameplate_photos?: Json
          nameplate_progress?: number | null
          nameplate_updated_at?: string | null
          nameplate_updated_by?: string | null
          no_pnl: number
          packing_done?: boolean | null
          packing_done_at?: string | null
          packing_done_by?: string | null
          pasang_komponen_photos?: Json
          progress_snapshot?: number | null
          proyek_snapshot?: string | null
          qc_checklist?: Json | null
          qc_foto?: Json | null
          qs_history?: Json
          qs_photos?: Json
          qs_progress?: number
          qs_updated_at?: string | null
          qs_updated_by?: string | null
          qty?: number
          synced_proses?: string[] | null
          tingkat_kesulitan?: string | null
          tipe: string
          updated_at?: string | null
          updated_by?: string | null
          warehouse_history?: Json
          warehouse_photos?: Json
          warehouse_progress?: number
          warehouse_updated_at?: string | null
          warehouse_updated_by?: string | null
          wo_id?: number | null
          wo_number_snapshot?: string | null
          yellowmark_history?: Json | null
          yellowmark_photos?: Json
          yellowmark_progress?: number | null
          yellowmark_updated_at?: string | null
          yellowmark_updated_by?: string | null
        }
        Update: {
          busbar_progress?: Json | null
          catatan?: string | null
          checklist?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          id?: number
          komponen_status?: Json | null
          nama?: string
          nameplate_history?: Json | null
          nameplate_photos?: Json
          nameplate_progress?: number | null
          nameplate_updated_at?: string | null
          nameplate_updated_by?: string | null
          no_pnl?: number
          packing_done?: boolean | null
          packing_done_at?: string | null
          packing_done_by?: string | null
          pasang_komponen_photos?: Json
          progress_snapshot?: number | null
          proyek_snapshot?: string | null
          qc_checklist?: Json | null
          qc_foto?: Json | null
          qs_history?: Json
          qs_photos?: Json
          qs_progress?: number
          qs_updated_at?: string | null
          qs_updated_by?: string | null
          qty?: number
          synced_proses?: string[] | null
          tingkat_kesulitan?: string | null
          tipe?: string
          updated_at?: string | null
          updated_by?: string | null
          warehouse_history?: Json
          warehouse_photos?: Json
          warehouse_progress?: number
          warehouse_updated_at?: string | null
          warehouse_updated_by?: string | null
          wo_id?: number | null
          wo_number_snapshot?: string | null
          yellowmark_history?: Json | null
          yellowmark_photos?: Json
          yellowmark_progress?: number | null
          yellowmark_updated_at?: string | null
          yellowmark_updated_by?: string | null
        }
        Relationships: []
      }
      pekerja: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          divisi: string
          id: number
          nama: string
          password: string | null
          updated_by: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          divisi: string
          id?: never
          nama: string
          password?: string | null
          updated_by?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          divisi?: string
          id?: never
          nama?: string
          password?: string | null
          updated_by?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pekerja_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permintaan: {
        Row: {
          created_at: string
          divisi: string
          id: number
          jenis: string
          operator_nama: string
          panel_id: number | null
          panel_nama: string | null
          proyek: string | null
          sub_bagian: string | null
          wo_id: number | null
          wo_number: string | null
        }
        Insert: {
          created_at?: string
          divisi: string
          id?: number
          jenis: string
          operator_nama: string
          panel_id?: number | null
          panel_nama?: string | null
          proyek?: string | null
          sub_bagian?: string | null
          wo_id?: number | null
          wo_number?: string | null
        }
        Update: {
          created_at?: string
          divisi?: string
          id?: number
          jenis?: string
          operator_nama?: string
          panel_id?: number | null
          panel_nama?: string | null
          proyek?: string | null
          sub_bagian?: string | null
          wo_id?: number | null
          wo_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permintaan_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permintaan_wo_id_fkey"
            columns: ["wo_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      permintaan_item: {
        Row: {
          catatan_reject: string | null
          id: number
          kode_komponen: string | null
          komponen_bbmb_master_id: number | null
          nama_komponen: string
          permintaan_id: number
          qty: number
          status: string
          sudah_diambil: boolean
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          catatan_reject?: string | null
          id?: number
          kode_komponen?: string | null
          komponen_bbmb_master_id?: number | null
          nama_komponen: string
          permintaan_id: number
          qty?: number
          status?: string
          sudah_diambil?: boolean
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          catatan_reject?: string | null
          id?: number
          kode_komponen?: string | null
          komponen_bbmb_master_id?: number | null
          nama_komponen?: string
          permintaan_id?: number
          qty?: number
          status?: string
          sudah_diambil?: boolean
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permintaan_item_komponen_bbmb_master_id_fkey"
            columns: ["komponen_bbmb_master_id"]
            isOneToOne: false
            referencedRelation: "komponen_bbmb_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permintaan_item_permintaan_id_fkey"
            columns: ["permintaan_id"]
            isOneToOne: false
            referencedRelation: "permintaan"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          divisi: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          divisi: string
          id: string
          name: string
        }
        Update: {
          created_at?: string | null
          divisi?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      progress_checkpoint_log: {
        Row: {
          checkpoint: number
          id: number
          kode_komponen: string
          panel_id: number
          pekerja_nama: string | null
          proses: string
          tanggal: string | null
          ts: string | null
        }
        Insert: {
          checkpoint: number
          id?: number
          kode_komponen: string
          panel_id: number
          pekerja_nama?: string | null
          proses: string
          tanggal?: string | null
          ts?: string | null
        }
        Update: {
          checkpoint?: number
          id?: number
          kode_komponen?: string
          panel_id?: number
          pekerja_nama?: string | null
          proses?: string
          tanggal?: string | null
          ts?: string | null
        }
        Relationships: []
      }
      progress_checkpoint_log_archived: {
        Row: {
          checkpoint: number
          diarsipkan_oleh: string | null
          diarsipkan_pada: string | null
          id: number
          kode_komponen: string
          panel_id: number
          pekerja_nama: string | null
          proses: string
          tanggal: string | null
          ts: string | null
        }
        Insert: {
          checkpoint: number
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          id?: number
          kode_komponen: string
          panel_id: number
          pekerja_nama?: string | null
          proses: string
          tanggal?: string | null
          ts?: string | null
        }
        Update: {
          checkpoint?: number
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          id?: number
          kode_komponen?: string
          panel_id?: number
          pekerja_nama?: string | null
          proses?: string
          tanggal?: string | null
          ts?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          admin_username: string | null
          auth: string
          created_at: string
          divisi: string | null
          endpoint: string
          id: number
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          admin_username?: string | null
          auth: string
          created_at?: string
          divisi?: string | null
          endpoint: string
          id?: never
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          admin_username?: string | null
          auth?: string
          created_at?: string
          divisi?: string | null
          endpoint?: string
          id?: never
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      qty_change_log: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: number
          is_read: boolean | null
          kode_komponen: string | null
          nama_komponen: string | null
          panel: string | null
          panel_id: number | null
          proyek: string | null
          qty_baru: number | null
          qty_lama: number | null
          tipe_panel: string | null
          wo_id: number | null
          wp: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: number
          is_read?: boolean | null
          kode_komponen?: string | null
          nama_komponen?: string | null
          panel?: string | null
          panel_id?: number | null
          proyek?: string | null
          qty_baru?: number | null
          qty_lama?: number | null
          tipe_panel?: string | null
          wo_id?: number | null
          wp?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: number
          is_read?: boolean | null
          kode_komponen?: string | null
          nama_komponen?: string | null
          panel?: string | null
          panel_id?: number | null
          proyek?: string | null
          qty_baru?: number | null
          qty_lama?: number | null
          tipe_panel?: string | null
          wo_id?: number | null
          wp?: string | null
        }
        Relationships: []
      }
      qty_fixes: {
        Row: {
          kode_sekarang: string | null
          nama_komponen: string | null
          panel: string | null
          panel_id: number | null
          qty_seharusnya: number | null
          qty_sekarang: number | null
        }
        Insert: {
          kode_sekarang?: string | null
          nama_komponen?: string | null
          panel?: string | null
          panel_id?: number | null
          qty_seharusnya?: number | null
          qty_sekarang?: number | null
        }
        Update: {
          kode_sekarang?: string | null
          nama_komponen?: string | null
          panel?: string | null
          panel_id?: number | null
          qty_seharusnya?: number | null
          qty_sekarang?: number | null
        }
        Relationships: []
      }
      raw_schedule: {
        Row: {
          bobot_komponen: Json | null
          busbar_jejak: Json
          busbar_schedule: Json | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: number
          panel: string
          panel_id: number | null
          prioritas: string | null
          proses: string
          proyek: string
          schedule: Json | null
          updated_at: string | null
          updated_by: string | null
          wo_id: number | null
        }
        Insert: {
          bobot_komponen?: Json | null
          busbar_jejak?: Json
          busbar_schedule?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: never
          panel: string
          panel_id?: number | null
          prioritas?: string | null
          proses: string
          proyek: string
          schedule?: Json | null
          updated_at?: string | null
          updated_by?: string | null
          wo_id?: number | null
        }
        Update: {
          bobot_komponen?: Json | null
          busbar_jejak?: Json
          busbar_schedule?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: never
          panel?: string
          panel_id?: number | null
          prioritas?: string | null
          proses?: string
          proyek?: string
          schedule?: Json | null
          updated_at?: string | null
          updated_by?: string | null
          wo_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_schedule_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_schedule_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_schedule_wo_id_fkey"
            columns: ["wo_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_schedule_archived: {
        Row: {
          busbar_jejak: Json
          busbar_schedule: Json | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          diarsipkan_oleh: string | null
          diarsipkan_pada: string | null
          id: number
          panel: string
          panel_id: number | null
          prioritas: string | null
          proses: string
          proyek: string
          schedule: Json | null
          updated_at: string | null
          updated_by: string | null
          wo_id: number | null
        }
        Insert: {
          busbar_jejak?: Json
          busbar_schedule?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          id: number
          panel: string
          panel_id?: number | null
          prioritas?: string | null
          proses: string
          proyek: string
          schedule?: Json | null
          updated_at?: string | null
          updated_by?: string | null
          wo_id?: number | null
        }
        Update: {
          busbar_jejak?: Json
          busbar_schedule?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          id?: number
          panel?: string
          panel_id?: number | null
          prioritas?: string | null
          proses?: string
          proyek?: string
          schedule?: Json | null
          updated_at?: string | null
          updated_by?: string | null
          wo_id?: number | null
        }
        Relationships: []
      }
      renhar: {
        Row: {
          carry_over: boolean | null
          catatan: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          divisi: string
          id: number
          komponen: Json | null
          komponen_released: string[] | null
          panel: string
          panel_id: number | null
          pekerja: Json | null
          pekerja_per_komponen: Json | null
          prioritas: string | null
          proses: string
          proyek: string
          raw_id: number | null
          tanggal: string
          updated_at: string | null
          updated_by: string | null
          wo_id: number | null
          wp: string
        }
        Insert: {
          carry_over?: boolean | null
          catatan?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          divisi: string
          id?: never
          komponen?: Json | null
          komponen_released?: string[] | null
          panel: string
          panel_id?: number | null
          pekerja?: Json | null
          pekerja_per_komponen?: Json | null
          prioritas?: string | null
          proses: string
          proyek: string
          raw_id?: number | null
          tanggal: string
          updated_at?: string | null
          updated_by?: string | null
          wo_id?: number | null
          wp: string
        }
        Update: {
          carry_over?: boolean | null
          catatan?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          divisi?: string
          id?: never
          komponen?: Json | null
          komponen_released?: string[] | null
          panel?: string
          panel_id?: number | null
          pekerja?: Json | null
          pekerja_per_komponen?: Json | null
          prioritas?: string | null
          proses?: string
          proyek?: string
          raw_id?: number | null
          tanggal?: string
          updated_at?: string | null
          updated_by?: string | null
          wo_id?: number | null
          wp?: string
        }
        Relationships: [
          {
            foreignKeyName: "renhar_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renhar_raw_id_fkey"
            columns: ["raw_id"]
            isOneToOne: false
            referencedRelation: "raw_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renhar_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renhar_wo_id_fkey"
            columns: ["wo_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      renhar_archived: {
        Row: {
          carry_over: boolean | null
          catatan: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          diarsipkan_oleh: string | null
          diarsipkan_pada: string | null
          divisi: string
          id: number
          komponen: Json | null
          komponen_released: string[] | null
          panel: string
          panel_id: number | null
          pekerja: Json | null
          pekerja_per_komponen: Json | null
          prioritas: string | null
          proses: string
          proyek: string
          raw_id: number | null
          tanggal: string
          updated_at: string | null
          updated_by: string | null
          wo_id: number | null
          wp: string
        }
        Insert: {
          carry_over?: boolean | null
          catatan?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          divisi: string
          id: number
          komponen?: Json | null
          komponen_released?: string[] | null
          panel: string
          panel_id?: number | null
          pekerja?: Json | null
          pekerja_per_komponen?: Json | null
          prioritas?: string | null
          proses: string
          proyek: string
          raw_id?: number | null
          tanggal: string
          updated_at?: string | null
          updated_by?: string | null
          wo_id?: number | null
          wp: string
        }
        Update: {
          carry_over?: boolean | null
          catatan?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          diarsipkan_oleh?: string | null
          diarsipkan_pada?: string | null
          divisi?: string
          id?: number
          komponen?: Json | null
          komponen_released?: string[] | null
          panel?: string
          panel_id?: number | null
          pekerja?: Json | null
          pekerja_per_komponen?: Json | null
          prioritas?: string | null
          proses?: string
          proyek?: string
          raw_id?: number | null
          tanggal?: string
          updated_at?: string | null
          updated_by?: string | null
          wo_id?: number | null
          wp?: string
        }
        Relationships: []
      }
      service_schedule: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: number
          interval_service: string | null
          keterangan: string | null
          machine_id: number | null
          nama_mesin: string | null
          status: string | null
          tanggal_service: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          interval_service?: string | null
          keterangan?: string | null
          machine_id?: number | null
          nama_mesin?: string | null
          status?: string | null
          tanggal_service: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          interval_service?: string | null
          keterangan?: string | null
          machine_id?: number | null
          nama_mesin?: string | null
          status?: string | null
          tanggal_service?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_schedule_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: number
          is_archived: boolean | null
          proyek: string
          target: string
          updated_at: string | null
          updated_by: string | null
          wo: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: never
          is_archived?: boolean | null
          proyek: string
          target: string
          updated_at?: string | null
          updated_by?: string | null
          wo: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: never
          is_archived?: boolean | null
          proyek?: string
          target?: string
          updated_at?: string | null
          updated_by?: string | null
          wo?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      arsip_kembalikan_tabel: {
        Args: { p_col: string; p_panel_id: number; p_table: string }
        Returns: undefined
      }
      arsip_panel: {
        Args: { p_panel_id: number; p_progress: number; p_user: string }
        Returns: undefined
      }
      arsip_pindah_tabel: {
        Args: {
          p_col: string
          p_panel_id: number
          p_table: string
          p_user: string
        }
        Returns: undefined
      }
      cleanup_recycle_bin: { Args: never; Returns: undefined }
      delete_old_activity_logs: { Args: never; Returns: undefined }
      find_renhar_anomalies: {
        Args: never
        Returns: {
          divisi: string
          id: number
          missing_items: string[]
          panel: string
          proses: string
          tanggal: string
          wo_id: number
        }[]
      }
      find_wo_sync_issues: {
        Args: never
        Returns: {
          detail: string
          issue_type: string
          proyek: string
          target: string
          wo_id: number
          wo_number: string
        }[]
      }
      latest_operator_per_komponen: {
        Args: { as_of_date: string }
        Returns: {
          kode_komponen: string
          panel_id: number
          pekerja_id: number
          proses: string
          tanggal: string
        }[]
      }
      search_panel_fuzzy: {
        Args: { min_similarity?: number; search_term: string }
        Returns: {
          nama: string
          similarity_score: number
          tipe: string
          wo_id: number
        }[]
      }
      search_proyek_fuzzy: {
        Args: { min_similarity?: number; search_term: string }
        Returns: {
          proyek: string
          similarity_score: number
          wo: string
        }[]
      }
      set_current_admin: { Args: { admin_name: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unarsip_panel: { Args: { p_panel_id: number }; Returns: undefined }
      verify_admin_login: {
        Args: { p_password: string; p_username: string }
        Returns: {
          avatar: string | null
          created_at: string | null
          divisi: string | null
          id: number
          is_active: boolean | null
          last_login: string | null
          nama: string
          password: string
          username: string
        }[]
        SetofOptions: {
          from: "*"
          to: "admins"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      verify_operator_login: {
        Args: { p_password: string; p_username: string }
        Returns: {
          created_at: string | null
          divisi: string
          id: number
          is_active: boolean | null
          last_login: string | null
          nama: string
          password: string
          username: string
        }[]
        SetofOptions: {
          from: "*"
          to: "operator_users"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
