// SUPABASE REPO - implementasi RepoJadwalRaw terhadap DATA ASLI (10 Okt 2026). BELUM DIPASANG: Raw Schedule per WP
// saat ini memakai MemoryRepo (sandbox). Dipasang hanya setelah paritas terbukti & disetujui user - peralihan =
// mengganti buatMemoryRepo(...) dengan buatSupabaseRepo(...) di RawScheduleAccordion.
// Fungsi tulis jadwal & rencana harian diambil dari App (sama dgn Raw Schedule asli: optimistic + realtime).
import { supabase } from './supabase'
import { activityLogService } from '../services/activityLogService'
import { markRawDirty, clearRawDirty, markRenharDirty } from './globalState'
import { buatFcsService } from '../services/fcsService'
import { buatAksesPindahMulti } from './pindahMulti'
import { buatAksesUrutanPanel } from './rawPanelOrder'
import { buatAksesKapasitas } from './kapasitasHari'
import type { RepoJadwalRaw } from './repoJadwalRaw'

export function buatSupabaseRepo(app: {
  rawData: () => any[]; updateRaw: RepoJadwalRaw['updateRaw']; createRaw: RepoJadwalRaw['createRaw']; log: RepoJadwalRaw['logApp']
  withRenharQueue: RepoJadwalRaw['renhar']['withQueue']; createRenhar: RepoJadwalRaw['renhar']['create']; updateRenhar: RepoJadwalRaw['renhar']['update']; removeRenhar: RepoJadwalRaw['renhar']['remove']
  orderMap: () => Record<number, string>; dengar: RepoJadwalRaw['dengar']
}): RepoJadwalRaw {
  return {
    jenis: 'supabase',
    io: {
      fcs: buatFcsService(), pindah: buatAksesPindahMulti(), urutan: buatAksesUrutanPanel(), kapasitas: buatAksesKapasitas(),
      db: supabase, log: activityLogService,
      kotor: { markRaw: markRawDirty, clearRaw: clearRawDirty, markRenhar: markRenharDirty },
    },
    rawSemua: app.rawData, updateRaw: app.updateRaw, createRaw: app.createRaw, logApp: app.log,
    renhar: { withQueue: app.withRenharQueue, create: app.createRenhar, update: app.updateRenhar, remove: app.removeRenhar },
    orderMap: app.orderMap, dengar: app.dengar,
  }
}
