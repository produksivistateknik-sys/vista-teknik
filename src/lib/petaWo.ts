// PETA WO UTK KARTU PANEL (9 Nov 2026, chip deadline + nomor WO di Aktivitas Panel, Kendala, Catatan). Fungsi murni.
// Deadline HANYA ada per record WO (work_orders.target; panels tidak punya kolom deadline). Satu nomor WO bisa punya beberapa
// record dgn target beda (pecahan per tanggal kirim, mis. WO 084 id 198 = 4 Des & id 230 = 20 Nov), jadi deadline panel =
// target record WO tempat panel itu berada SEKARANG - sama dgn kartu Manajemen WO. Sumber: woData App (WO aktif, realtime
// useWorkOrders) - tanpa query baru. Kendala/catatan lama dgn snapshot wo_id/wo_number: panel tetap dicari ke WO terkini.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type InfoWo = { id: number; nomor: string; proyek: string; target: string | null; selesai: boolean }
export type PetaWo = { perId: Map<number, InfoWo>; perPanel: Map<number, InfoWo>; perProyek: Map<string, InfoWo[]> }

// pctWo = persen WO (Manajemen WO: woOverallCcpAware; tanpa ccp: woOverall). selesai = 100% -> chip tanpa H- (sama dgn Manajemen WO).
export function bangunPetaWo(woData: any[], pctWo: (w: any) => number): PetaWo {
  const perId = new Map<number, InfoWo>(), perPanel = new Map<number, InfoWo>(), perProyek = new Map<string, InfoWo[]>()
  for (const w of woData || []) {
    if (!w || w.deleted_at || w.is_archived) continue
    let selesai = false
    try { selesai = Number(pctWo(w)) >= 100 } catch { selesai = false }
    const info: InfoWo = { id: Number(w.id), nomor: String(w.wo ?? '').trim(), proyek: String(w.proyek ?? '').trim(), target: w.target || null, selesai }
    perId.set(info.id, info)
    for (const p of w.panels || []) if (!p?.deleted_at) perPanel.set(Number(p.id), info)
    const k = info.proyek; const a = perProyek.get(k); if (a) a.push(info); else perProyek.set(k, [info])
  }
  return { perId, perPanel, perProyek }
}

export const PETA_KOSONG: PetaWo = { perId: new Map(), perPanel: new Map(), perProyek: new Map() }
export const teksNomorWo = (nomor: string | null | undefined) => (nomor ? `WO ${nomor}` : '')

// WO sebuah kartu panel: panel -> record WO terkini; panel tidak aktif -> snapshot nomor (tanpa deadline, ditandai arsip).
export function woKartuPanel(peta: PetaWo, panelId: number | null | undefined, snapshot?: { woId?: number | null; nomor?: string | null }):
  { info: InfoWo | null; nomor: string; arsip: boolean } {
  const info = panelId != null ? peta.perPanel.get(Number(panelId)) || null : null
  if (info) return { info, nomor: info.nomor, arsip: false }
  const lama = snapshot?.woId != null ? peta.perId.get(Number(snapshot.woId)) || null : null
  if (lama) return { info: lama, nomor: lama.nomor, arsip: false }
  return { info: null, nomor: String(snapshot?.nomor || '').trim(), arsip: !!snapshot?.nomor }
}

// Kartu umum proyek (tanpa panel): semua nomor WO aktif proyek (urut, tanpa dobel) + record dgn deadline TERDEKAT yang belum
// selesai (keputusan user 9 Nov); semua selesai -> terdekat di antara semuanya.
export function woUmumProyek(peta: PetaWo, proyek: string): { nomor: string[]; terdekat: InfoWo | null } {
  const ws = peta.perProyek.get(String(proyek || '').trim()) || []
  const nomor = [...new Set(ws.map((w) => w.nomor).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const urut = (xs: InfoWo[]) => [...xs].filter((w) => w.target).sort((a, b) => String(a.target).localeCompare(String(b.target)))
  const terdekat = urut(ws.filter((w) => !w.selesai))[0] || urut(ws)[0] || null
  return { nomor, terdekat }
}
