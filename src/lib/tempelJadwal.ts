// RENCANA TEMPEL JADWAL (Ctrl+V / Copy banyak sel) - FUNGSI MURNI (22 Okt 2026, tahap 2 saringan relevansi).
// Satu-satunya jalur Raw Schedule yang bisa menaruh isi sel ke BARIS PROSES LAIN (offset baris & tanggal dari sel
// paling kiri-atas). Aturan:
// - jejak (digeserKe) & penanda tanggal sumber (carriedOverFrom/createdBy/dst) tidak ikut; token __wiring_ ikut;
// - komponen tidak relevan utk proses baris tujuan / tidak ada / qty 0 di panel tujuan DISARING (lib/relevansiJadwal)
//   kecuali tanpaSaring ("Tambahkan juga");
// - isi tujuan DIGABUNG lewat taruhDiTujuan (union per WP + manualPin; jejak kode itu di tujuan dihapus), BUKAN ditimpa;
// - BUSBAR digabung (union), tidak disaring;
// - baris yang hasilnya sama persis dgn sebelum tidak ikut ditulis.
import { taruhDiTujuan } from './jadwalPindah'
import { saringKomponenRelevan, type KomponenDilewati } from './relevansiJadwal'

export type SelSalinan = { rawId: number; date: string; entries: any[]; busbar: string[] }
export type KonteksTempel = {
  rawData: any[] // urutan baris SEPERTI di layar (offset baris dihitung dari indeks di sini)
  panelById: (id: number) => any
  tanggalKeIdx: (d: string) => number
  idxKeTanggal: (i: number) => string
  totalKolom: number
}
export type HasilTempel = {
  batch: Record<number, { schedule: any; busbar_schedule: any }>
  dilewati: (KomponenDilewati & { proses: string; panelId: number })[]
  ringkas: string[]
}

export function rencanakanTempel(sel: SelSalinan[], targetRawId: number, targetDate: string, ctx: KonteksTempel, opsi: { tanpaSaring?: boolean; nowIso?: string } = {}): HasilTempel {
  const { rawData } = ctx
  const nowIso = opsi.nowIso || new Date().toISOString()
  const targetDayIdx = ctx.tanggalKeIdx(targetDate)
  const targetRowIdx = rawData.findIndex((r: any) => r.id === targetRawId)
  const srcRowIds = [...new Set(sel.map(c => c.rawId))]
  const minSrcDayIdx = Math.min(...sel.map(c => ctx.tanggalKeIdx(c.date)))
  const minSrcRowIdx = Math.min(...srcRowIds.map(id => rawData.findIndex((r: any) => r.id === id)))
  const batch: HasilTempel['batch'] = {}
  const dilewati: HasilTempel['dilewati'] = []
  const ringkas: string[] = []
  for (const cell of sel) {
    const destDayIdx = targetDayIdx + (ctx.tanggalKeIdx(cell.date) - minSrcDayIdx)
    const destRowIdx = targetRowIdx + (rawData.findIndex((r: any) => r.id === cell.rawId) - minSrcRowIdx)
    if (destDayIdx < 0 || destDayIdx >= ctx.totalKolom) continue
    if (destRowIdx < 0 || destRowIdx >= rawData.length) continue
    const destDate = ctx.idxKeTanggal(destDayIdx)
    const destRow = rawData[destRowIdx]
    if (!destRow) continue
    if (!batch[destRow.id]) batch[destRow.id] = { schedule: { ...(destRow.schedule || {}) }, busbar_schedule: { ...(destRow.busbar_schedule || {}) } }
    const bersih = (cell.entries || []).map((e: any) => ({ wp: e.wp, komponen: (e.komponen || []).filter((k: string) => !e.digeserKe?.[k]) }))
      .filter((e: any) => e.komponen.some((k: string) => !k.startsWith('__')))
    const pid = Number(destRow.panel_id || destRow.panelId)
    let entri = bersih
    if (!opsi.tanpaSaring) {
      const h = saringKomponenRelevan(bersih, ctx.panelById(pid), destRow.proses)
      entri = h.entri
      h.dilewati.forEach(d => dilewati.push({ ...d, proses: destRow.proses, panelId: pid }))
    }
    if (entri.length > 0) {
      batch[destRow.id].schedule = taruhDiTujuan(batch[destRow.id].schedule, destDate, entri, nowIso)
      ringkas.push(`${destRow.panel || ''} ${destRow.proses} ${destDate}: ${entri.map((e: any) => e.wp + ' ' + e.komponen.filter((k: string) => !k.startsWith('__')).join(',')).join('; ')}`)
    }
    if ((cell.busbar || []).length > 0) {
      const lama = batch[destRow.id].busbar_schedule[destDate] || []
      batch[destRow.id].busbar_schedule[destDate] = [...new Set([...lama, ...cell.busbar])]
      ringkas.push(`${destRow.panel || ''} ${destRow.proses} ${destDate}: BUSBAR ${cell.busbar.join(',')}`)
    }
  }
  for (const [rowId, data] of Object.entries(batch)) {
    const r0 = rawData.find((r: any) => r.id === Number(rowId))
    if (JSON.stringify(data.schedule) === JSON.stringify(r0?.schedule || {}) && JSON.stringify(data.busbar_schedule) === JSON.stringify(r0?.busbar_schedule || {})) delete batch[Number(rowId)]
  }
  return { batch, dilewati, ringkas }
}
