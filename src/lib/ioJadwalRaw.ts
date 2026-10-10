// I/O BERSAMA modul Raw Schedule (10 Okt 2026, sandbox Raw Schedule per WP).
// Hook/modal bersama (ModalJadwalSel, usePindahMulti, useUrutanPanel, ModalAturKapasitas, RiwayatQty,
// NotifAvailable) menerima `io` OPSIONAL. Tanpa `io` = perilaku lama (Supabase asli, activity_log asli, penanda
// "dirty" global App). Raw Schedule per WP (sandbox) mengisi `io` dgn implementasi memori (lib/sandbox) sehingga
// logika yang SAMA berjalan terhadap salinan data, tanpa satu pun tulis ke database produksi.
import type { LayananFcs } from '../services/fcsService'
import type { buatAksesPindahMulti } from './pindahMulti'
import type { buatAksesUrutanPanel } from './rawPanelOrder'
import type { buatAksesKapasitas } from './kapasitasHari'

export type IoJadwalRaw = {
  fcs: LayananFcs
  pindah: ReturnType<typeof buatAksesPindahMulti>
  urutan: ReturnType<typeof buatAksesUrutanPanel>
  kapasitas: ReturnType<typeof buatAksesKapasitas>
  db: any // klien bergaya Supabase (dipakai Riwayat Qty & notifikasi)
  log: { insert: (e: any) => Promise<any> }
  kotor: { markRaw: (id: number) => void; clearRaw: (id: number) => void; markRenhar: (id: number) => void }
}
