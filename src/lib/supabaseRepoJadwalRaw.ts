// SUPABASE REPO - implementasi RepoJadwalRaw terhadap DATA ASLI (10 Okt 2026). Dipasang di RawScheduleAccordion sejak
// Tahap A penukaran (28 Okt 2026) DENGAN penjaga uji WO (lib/penjagaUjiWo): semua tulisan hanya utk jadwal WO uji.
// Penukaran nanti = membuat repo tanpa `penjaga` (perilaku = Raw Schedule asli).
// Fungsi tulis jadwal & rencana harian diambil dari App (sama dgn Raw Schedule asli: optimistic + realtime).
import { supabase } from './supabase'
import { activityLogService } from '../services/activityLogService'
import { markRawDirty, clearRawDirty, markRenharDirty } from './globalState'
import { buatFcsService } from '../services/fcsService'
import { buatAksesPindahMulti } from './pindahMulti'
import { buatAksesUrutanPanel } from './rawPanelOrder'
import { buatAksesKapasitas } from './kapasitasHari'
import type { RepoJadwalRaw } from './repoJadwalRaw'
import type { PenjagaUji } from './penjagaUjiWo'

export function buatSupabaseRepo(app: {
  rawData: () => any[]; updateRaw: RepoJadwalRaw['updateRaw']; createRaw: RepoJadwalRaw['createRaw']; log: RepoJadwalRaw['logApp']
  withRenharQueue: RepoJadwalRaw['renhar']['withQueue']; createRenhar: RepoJadwalRaw['renhar']['create']; updateRenhar: RepoJadwalRaw['renhar']['update']; removeRenhar: RepoJadwalRaw['renhar']['remove']
  orderMap: () => Record<number, string>; dengar: RepoJadwalRaw['dengar']
}, penjaga?: PenjagaUji): RepoJadwalRaw {
  const klien: any = penjaga?.klien ?? supabase
  const log = activityLogService // activity_log insert selalu boleh (juga di mode uji) - perilaku sama dgn tampilan lama
  // fungsi tulis App: tanpa penjaga = apa adanya; dgn penjaga = dicek dulu (ditolak -> { success:false, error })
  const jaga = <F extends (...a: any[]) => Promise<any>>(cek: (...a: Parameters<F>) => Promise<string | null>, fn: F): F =>
    penjaga ? (async (...a: Parameters<F>) => { const alasan = await cek(...a); if (alasan) { console.warn('[penjaga uji WO]', alasan); return { success: false, error: alasan, code: 'P0001' } } return fn(...a) }) as F : fn
  const cekRaw = async (id: number, _d?: any) => penjaga!.rawIdUji([id])
  return {
    jenis: 'supabase',
    io: {
      fcs: buatFcsService(klien, log), pindah: buatAksesPindahMulti(klien), urutan: buatAksesUrutanPanel(klien), kapasitas: buatAksesKapasitas(klien),
      db: klien, log,
      kotor: { markRaw: markRawDirty, clearRaw: clearRawDirty, markRenhar: markRenharDirty },
    },
    rawSemua: app.rawData,
    updateRaw: jaga(cekRaw, app.updateRaw),
    createRaw: jaga(async (d: any) => penjaga!.woUji(d?.wo_id), app.createRaw),
    logApp: app.log,
    renhar: {
      withQueue: app.withRenharQueue,
      create: jaga(async (d: any) => d?.raw_id == null ? 'Mode uji: rencana harian tanpa baris jadwal ditolak.' : penjaga!.rawIdUji([d.raw_id]), app.createRenhar),
      update: jaga(async (id: any, _d?: any) => penjaga!.renharIdUji([id]), app.updateRenhar),
      remove: jaga(async (id: any) => penjaga!.renharIdUji([id]), app.removeRenhar),
    },
    orderMap: app.orderMap, dengar: app.dengar,
  }
}
