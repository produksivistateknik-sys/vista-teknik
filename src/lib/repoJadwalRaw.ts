// REPOSITORY JADWAL RAW (10 Okt 2026) - SATU antarmuka akses data untuk "Raw Schedule per WP".
// UI hanya bicara ke antarmuka ini (muat jadwal, simpan edit, pindah banyak, undo, hapus, prioritas, urutan,
// kapasitas, log). Implementasi:
//  - MemoryRepo  (lib/sandbox/memoryRepo.ts)  : DIPAKAI SEKARANG - salinan data di memori, tidak menulis DB.
//  - SupabaseRepo (lib/supabaseRepoJadwalRaw.ts): implementasi data asli, BELUM dipasang. Peralihan nanti =
//    mengganti implementasi yang dibuat di RawScheduleAccordion (keputusan & persetujuan user).
import type { IoJadwalRaw } from './ioJadwalRaw'

export type HasilSimpan = { success: boolean; data?: any; error?: string }

export interface RepoJadwalRaw {
  jenis: 'memori' | 'supabase'
  // I/O untuk logika bersama (modal edit, pindah banyak + undo, urutan/prioritas, Atur Kapasitas, Riwayat, notifikasi)
  io: IoJadwalRaw
  // jadwal (raw_schedule) - semua baris; tampilan menyaring WO aktif
  rawSemua(): any[]
  updateRaw(id: number, payload: any): Promise<HasilSimpan>
  createRaw(payload: any): Promise<HasilSimpan>
  // log gaya prop `log` App (action, description, module, extra)
  logApp(action: string, description: string, module: string, extra?: any): Promise<void>
  // rencana harian (sandbox: no-op)
  renhar: {
    withQueue: (task: any, fn: (existing: any) => Promise<void>) => Promise<any>
    create: (d: any) => Promise<HasilSimpan>
    update: (id: any, d: any) => Promise<HasilSimpan>
    remove: (id: any) => Promise<HasilSimpan>
  }
  orderMap(): Record<number, string>
  // perubahan data (MemoryRepo: perubahan di memori; SupabaseRepo: realtime) -> nama tabel
  dengar(f: (tabel: string) => void): () => void
  // MemoryRepo saja: akses salinan utk uji otomatis
  uji?: { db: any }
}
