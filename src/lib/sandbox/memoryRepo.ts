// MEMORY REPO - implementasi RepoJadwalRaw untuk SANDBOX "Raw Schedule per WP" (10 Okt 2026, keputusan user).
// Snapshot data produksi dimuat SEKALI (bacaSnapshot: SELECT saja) ke MemoryDb, lalu SEMUA aksi berjalan lokal
// memakai logika bersama yang sama dgn Raw Schedule asli (fcsService, lib/pindahMulti, lib/rawPanelOrder,
// lib/kapasitasHari lewat pabriknya). Tidak ada insert/update/delete/rpc/realtime ke Supabase dari sini.
// Rencana harian = no-op (tabel renhar salinan kosong; sinkron tidak dijalankan).
import { MemoryDb } from './memoryDb'
import { bacaTabel } from './bacaSnapshot'
import { buatFcsService } from '../../services/fcsService'
import { buatAksesPindahMulti } from '../pindahMulti'
import { buatAksesUrutanPanel } from '../rawPanelOrder'
import { buatAksesKapasitas } from '../kapasitasHari'
import type { RepoJadwalRaw, HasilSimpan } from '../repoJadwalRaw'
import type { IoJadwalRaw } from '../ioJadwalRaw'

export async function muatSnapshotSandbox(): Promise<MemoryDb> {
  const [raw, panels, wo, pt, ov, timer, urutan, qty, notif] = await Promise.all([
    bacaTabel('raw_schedule'), bacaTabel('panels'), bacaTabel('work_orders'), bacaTabel('fcs_process_time'),
    bacaTabel('fcs_kapasitas_override'), bacaTabel('fcs_timer_kerja'), bacaTabel('raw_schedule_panel_order'),
    bacaTabel('qty_change_log', '*', { urut: { kolom: 'created_at', naik: false }, maks: 200 }),
    bacaTabel('fcs_notifikasi', '*', { eq: [['dibaca', false], ['tipe', 'available']] }),
  ])
  return new MemoryDb({
    raw_schedule: raw, panels, work_orders: wo, fcs_process_time: pt, fcs_kapasitas_override: ov, fcs_timer_kerja: timer,
    raw_schedule_panel_order: urutan, qty_change_log: qty, fcs_notifikasi: notif,
    renhar: [], activity_log: [], // sandbox: rencana harian & log tidak disalin; tulis ke sini hanya di memori
  })
}

export function buatMemoryRepo(db: MemoryDb): RepoJadwalRaw {
  const klien = db as any // MemoryDb meniru subset klien Supabase yang dipakai logika bersama
  const log = { insert: async (e: any) => { db.catatan.push({ ...e, created_at: new Date().toISOString(), halaman_asli: e?.halaman, halaman: 'Raw Schedule per WP (uji)' }); return { success: true } } }
  const io: IoJadwalRaw = {
    fcs: buatFcsService(klien, log), pindah: buatAksesPindahMulti(klien), urutan: buatAksesUrutanPanel(klien), kapasitas: buatAksesKapasitas(klien),
    db: klien, log,
    kotor: { markRaw: () => {}, clearRaw: () => {}, markRenhar: () => {} }, // penanda "dirty" App tidak disentuh
  }
  const ok = async (): Promise<HasilSimpan> => ({ success: true, data: { id: 0 } })
  return {
    jenis: 'memori',
    io,
    rawSemua: () => db.baris('raw_schedule').slice(),
    async updateRaw(id, payload) {
      const { updated_by, ...aman } = payload || {} // sama dgn rawScheduleService.update
      const { data, error } = await db.from('raw_schedule').update(aman).eq('id', id).select().single()
      return error ? { success: false, error: error.message } : { success: true, data }
    },
    async createRaw(payload) {
      const { updated_by, ...aman } = payload || {}
      const { data, error } = await db.from('raw_schedule').insert(aman).select().single()
      return error ? { success: false, error: error.message } : { success: true, data }
    },
    async logApp(action, description, module, extra) { await log.insert({ action, description, module, ...(extra || {}) }) },
    renhar: { withQueue: async () => {}, create: ok, update: ok, remove: ok },
    orderMap: () => Object.fromEntries(db.baris('raw_schedule_panel_order').map((o: any) => [Number(o.panel_id), o.order_key])),
    dengar: f => db.dengar(f),
  }
}
